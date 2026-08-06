-- ============================================================================
-- create_order v5 — close the ₱0 component hole + enforce the order minimum
-- ----------------------------------------------------------------------------
-- TWO fixes, deliberately in one migration because the first defeats the second.
--
-- 1) SECURITY (live bug, predates this change). A dish line carrying a
--    plan_instance_id that has NO matching plan line in the same order fell
--    through v4's pricing chain to `else v_unit := 0`:
--      - pass 1 skips it (no meal_plan_id), so v_modes never learns the id;
--      - pass 2 sees v_plan_iid is not null, so the à-la-carte branch is skipped;
--      - coalesce(v_modes ->> v_plan_iid, 'fixed') = 'range' is false;
--      - therefore v_unit := 0.
--    create_order is EXECUTE-able by anon and the anon key ships in the web
--    bundle, so anyone could order any available item, any quantity, for ₱0 by
--    inventing a plan_instance_id. Now rejected.
--    Legitimate carts are unaffected: apps/web/src/services/orderService.ts:62
--    always emits the plan line before its dishes, and the à-la-carte fallback
--    sends no plan_instance_id at all.
--
-- 2) FEATURE. app_settings.minimum_meal_plans is now enforced server-side, not
--    just in the cart drawer. It applies ONLY to orders that actually contain
--    meal-plan lines, so à-la-carte / Party Trays / equipment rental / every
--    mobile order (which can never send meal_plan_id) are structurally exempt.
--
-- Counting: BOXES. A 'fixed' plan line is charged price × qty, so qty is
-- money-backed and is summed. A 'range' plan line is booked at ₱0 by design
-- (the dishes carry the money), so its qty is a free caller-controlled integer
-- and must NOT be a multiplier — one range line counts as one box. Duplicate
-- plan_instance_ids are rejected so N lines cannot share one box reference.
--
-- Fail-open on the setting: a missing or non-numeric row disables the rule
-- rather than bricking all meal-plan ordering with no storefront remedy.
--
-- Placement of the gate — after pass 1, before pass 2 and before the finalize
-- UPDATE that sets notified_at (which fires the pg_net order-notify trigger),
-- so a rejected order never emits an email. The orders INSERT has already run,
-- but the whole body is one transaction and the raise rolls it back, exactly
-- like the existing post-INSERT raises.
--
-- Re-runnable: create or replace.
-- ============================================================================

create or replace function public.create_order(
  p_items jsonb,
  p_customer jsonb,
  p_order_ref text,
  p_payment_proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order_id uuid;
  v_client   uuid := auth.uid();
  v_subtotal int  := 0;
  v_item     jsonb;
  v_qty      int;
  v_mi       record;
  v_plan     record;
  v_unit     int;
  v_plan_iid text;
  -- plan_instance_id -> pricing_mode, filled by the first pass so a component
  -- can be priced according to the plan it belongs to.
  v_modes    jsonb := '{}'::jsonb;
  -- Boxes in this order, and the admin-configured minimum.
  v_boxes     int := 0;
  v_min_boxes int := 0;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  insert into public.orders (
    order_ref, client_id, order_type,
    customer_first_name, customer_last_name, customer_email, customer_phone,
    delivery_address, delivery_date, delivery_time, special_requests,
    subtotal_cents, delivery_fee_cents, total_cents, payment_proof_url
  ) values (
    p_order_ref, v_client,
    coalesce(nullif(p_customer->>'order_type','')::public.order_type, 'delivery'),
    p_customer->>'first_name', p_customer->>'last_name',
    p_customer->>'email',      p_customer->>'phone',
    nullif(p_customer->>'delivery_address',''),
    nullif(p_customer->>'delivery_date','')::date,
    nullif(p_customer->>'delivery_time',''),
    nullif(p_customer->>'special_requests',''),
    0, 0, 0, p_payment_proof_url
  ) returning id into v_order_id;

  -- ---------- pass 1: plan lines ---------------------------------------------
  -- Done first so every component in pass 2 already knows its plan's mode.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if nullif(v_item->>'meal_plan_id','') is null then
      continue;
    end if;

    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty <= 0 then
      raise exception 'Invalid quantity for meal plan';
    end if;
    v_plan_iid := nullif(v_item->>'plan_instance_id', '');

    select mp.id, mp.name, mp.price_cents, mp.is_active, mp.pricing_mode
      into v_plan
      from public.meal_plans mp
     where mp.id = (v_item->>'meal_plan_id')::int;

    if not found then
      raise exception 'Unknown meal plan %', v_item->>'meal_plan_id';
    end if;
    if v_plan.is_active is not true then
      raise exception 'Meal plan not available: %', v_plan.name;
    end if;

    -- One box reference may only be claimed once, otherwise several ₱0 'range'
    -- lines could share an id and inflate the box tally for free.
    if v_plan_iid is not null and (v_modes ? v_plan_iid) then
      raise exception 'Duplicate lunch box reference %', v_plan_iid;
    end if;

    -- In 'range' mode the dishes carry the money, so the plan line is ₱0 and
    -- exists only to record which box was bought.
    v_unit := case when v_plan.pricing_mode = 'range' then 0 else v_plan.price_cents end;

    insert into public.order_items (
      order_id, meal_plan_id, item_name, item_type, qty, unit_price_cents,
      plan_instance_id, plan_type
    ) values (
      v_order_id, v_plan.id, v_plan.name, 'meal_plan', v_qty, v_unit,
      v_plan_iid, v_plan.name
    );

    v_subtotal := v_subtotal + v_unit * v_qty;

    -- Boxes: qty is money-backed for a fixed plan, but free for a ₱0 range
    -- line, so a range line counts once regardless of the qty sent.
    v_boxes := v_boxes + case when v_plan.pricing_mode = 'range' then 1 else v_qty end;

    if v_plan_iid is not null then
      v_modes := v_modes || jsonb_build_object(v_plan_iid, v_plan.pricing_mode);
    end if;
  end loop;

  -- ---------- order minimum ---------------------------------------------------
  -- Only orders that actually contain meal-plan lines are gated; v_boxes is 0
  -- for à-la-carte / Party Trays / mobile, which skip this entirely.
  if v_boxes > 0 then
    select coalesce(
             (select case
                       when jsonb_typeof(s.value) = 'number'
                       then greatest(floor((s.value #>> '{}')::numeric)::int, 0)
                     end
                from public.app_settings s
               where s.key = 'minimum_meal_plans'),
             0)
      into v_min_boxes;

    if v_boxes < v_min_boxes then
      raise exception 'Minimum % lunch boxes per order; this order has %',
        v_min_boxes, v_boxes;
    end if;
  end if;

  -- ---------- pass 2: dish lines ---------------------------------------------
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if nullif(v_item->>'meal_plan_id','') is not null then
      continue;
    end if;

    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty <= 0 then
      raise exception 'Invalid quantity for item %', v_item->>'menu_item_id';
    end if;
    v_plan_iid := nullif(v_item->>'plan_instance_id', '');

    select mi.id, mi.name, mi.item_type, mi.price_cents, mi.is_available
      into v_mi
      from public.menu_items mi
     where mi.id = (v_item->>'menu_item_id')::uuid;

    if not found then
      raise exception 'Unknown menu item %', v_item->>'menu_item_id';
    end if;
    if v_mi.is_available is not true then
      raise exception 'Item not available: %', v_mi.name;
    end if;

    -- A dish may only claim a box that exists in THIS order. Without this an
    -- invented plan_instance_id reached the fixed-plan branch below and was
    -- priced at ₱0 — free food, and it also kept v_boxes at 0 so the minimum
    -- above never ran.
    if v_plan_iid is not null and not (v_modes ? v_plan_iid) then
      raise exception 'Item % is not part of any lunch box in this order', v_mi.name;
    end if;

    if v_plan_iid is null then
      -- À la carte: unchanged. Must be priced; NULL still means "price on
      -- request" and cannot be bought online.
      if v_mi.price_cents is null then
        raise exception 'Item has no online price: %', v_mi.name;
      end if;
      v_unit := v_mi.price_cents;

    elsif coalesce(v_modes ->> v_plan_iid, 'fixed') = 'range' then
      -- Range plan: what you picked is what you pay.
      v_unit := coalesce(v_mi.price_cents, 0);

    else
      -- Fixed plan: the dish keeps its price in the catalogue, but it is NOT
      -- reflected in the order. The plan line already charged the customer.
      v_unit := 0;
    end if;

    insert into public.order_items (
      order_id, menu_item_id, item_name, item_type, qty, unit_price_cents,
      plan_instance_id, plan_type, notes
    ) values (
      v_order_id, v_mi.id, v_mi.name, v_mi.item_type, v_qty, v_unit,
      v_plan_iid, nullif(v_item->>'plan_type',''), nullif(v_item->>'notes','')
    );

    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  update public.orders
     set subtotal_cents = v_subtotal,
         total_cents    = v_subtotal,
         notified_at    = now()
   where id = v_order_id;

  return jsonb_build_object('order_ref', p_order_ref, 'order_id', v_order_id, 'total_cents', v_subtotal);
end;
$function$;

-- create or replace preserves grants in modern Postgres, but be explicit.
grant execute on function public.create_order(jsonb, jsonb, text, text) to anon, authenticated;
