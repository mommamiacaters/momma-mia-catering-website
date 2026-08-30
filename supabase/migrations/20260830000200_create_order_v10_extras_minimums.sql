-- ============================================================================
-- create_order v10 — extras respect the per-dish minimum.
--
-- Generated from v9 (20260829000100) with ONE behavioural change: the per-dish
-- minimum aggregation no longer skips lines without a plan_instance_id, so
-- à-la-carte extras (Add-ons / Café Menu) riding a lunch-box order are held to
-- the same floor as box dishes. Still gated on v_boxes > 0, so a pure
-- à-la-carte order (the unshipped mobile flow) behaves exactly as before.
--
-- Same 6-argument signature as v9 — grants carry over, and no drop is needed.
-- Re-runnable.
-- ============================================================================

create or replace function public.create_order(
  p_items jsonb,
  p_customer jsonb,
  p_order_ref text,
  p_payment_proof_url text default null,
  -- File extension the client intends to upload; the server picks the key.
  p_proof_ext text default null,
  -- 'paypal' puts the order in awaiting_payment and holds the emails back until
  -- the capture lands. NULL keeps the legacy receipt-upload behaviour that the
  -- mobile app still uses.
  p_payment_provider text default null
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
  -- Boxes in this order: the grand total, and a per-category tally so each
  -- food service enforces its own minimum.
  v_boxes     int := 0;
  v_cat_boxes jsonb := '{}'::jsonb;
  v_cat_key   text;
  v_cat_count int;
  v_min_boxes int := 0;
  v_cat_min   int;
  -- Per-dish minimum: the store default, and the first violating dish if any.
  v_min_dish  int := 0;
  v_viol      record;
  v_ext        text;
  v_proof_path text;
  v_provider   text;
  v_pay_status public.payment_status;
begin
  v_provider := nullif(lower(btrim(coalesce(p_payment_provider, ''))), '');
  if v_provider is not null and v_provider <> 'paypal' then
    raise exception 'Unsupported payment provider: %', p_payment_provider;
  end if;
  -- No provider means the pre-PayPal path: the customer paid outside the site
  -- and uploaded a receipt an admin still eyeballs.
  v_pay_status := case when v_provider = 'paypal'
                       then 'awaiting_payment'::public.payment_status
                       else 'manual_proof'::public.payment_status end;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  -- Reserve the proof key server-side. The extension is allow-listed rather
  -- than sanitised: it ends up in a storage path, and a fixed set is easier to
  -- reason about than an escaping rule.
  if p_proof_ext is not null then
    v_ext := lower(btrim(p_proof_ext));
    if v_ext not in ('jpg','jpeg','png','webp','heic','heif') then
      raise exception 'Unsupported payment proof file type: %', p_proof_ext;
    end if;
    v_proof_path := gen_random_uuid()::text || '.' || v_ext;
  else
    -- Pre-v6 client: it already uploaded to its own key and passed it in.
    v_proof_path := p_payment_proof_url;
  end if;

  insert into public.orders (
    order_ref, client_id, order_type,
    customer_first_name, customer_last_name, customer_email, customer_phone,
    delivery_address, delivery_date, delivery_time, special_requests,
    subtotal_cents, delivery_fee_cents, total_cents, payment_proof_url,
    payment_status, payment_provider
  ) values (
    p_order_ref, v_client,
    coalesce(nullif(p_customer->>'order_type','')::public.order_type, 'delivery'),
    p_customer->>'first_name', p_customer->>'last_name',
    p_customer->>'email',      p_customer->>'phone',
    nullif(p_customer->>'delivery_address',''),
    nullif(p_customer->>'delivery_date','')::date,
    nullif(p_customer->>'delivery_time',''),
    nullif(p_customer->>'special_requests',''),
    0, 0, 0, v_proof_path,
    v_pay_status, v_provider
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

    select mp.id, mp.name, mp.price_cents, mp.is_active, mp.pricing_mode, mp.category_id
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
    v_cat_count := case when v_plan.pricing_mode = 'range' then 1 else v_qty end;
    v_boxes := v_boxes + v_cat_count;
    v_cat_key := coalesce(v_plan.category_id::text, 'none');
    v_cat_boxes := jsonb_set(
      v_cat_boxes,
      array[v_cat_key],
      to_jsonb(coalesce((v_cat_boxes ->> v_cat_key)::int, 0) + v_cat_count)
    );

    if v_plan_iid is not null then
      v_modes := v_modes || jsonb_build_object(v_plan_iid, v_plan.pricing_mode);
    end if;
  end loop;

  -- ---------- order minimum (v8: per service) ---------------------------------
  -- Each category present in the order must reach its own floor:
  -- coalesce(categories.min_order_boxes, minimum_meal_plans store default).
  -- Orders with no plan lines (à-la-carte / mobile) skip this entirely.
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

    for v_cat_key, v_cat_count in
      select key, value::int from jsonb_each_text(v_cat_boxes)
    loop
      select coalesce(c.min_order_boxes, v_min_boxes)
        into v_cat_min
        from public.categories c
       where c.id::text = v_cat_key;
      if not found then
        v_cat_min := v_min_boxes;
      end if;

      if v_cat_count < v_cat_min then
        raise exception 'Minimum % lunch boxes per order; this order has %',
          v_cat_min, v_cat_count;
      end if;
    end loop;
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

  -- ---------- per-dish minimum ------------------------------------------------
  -- Same scope as the box minimum: lunch-box orders only. Box dishes arrive as
  -- one qty-1 line per slot; EXTRAS (Add-ons / Café Menu, v10) arrive as one
  -- à-la-carte line carrying its qty. Both are aggregated per dish and held to
  -- the same floor — an extra is still a kitchen batch. First violation
  -- (alphabetical, for determinism) aborts the order.
  if v_boxes > 0 then
    select coalesce(
             (select case
                       when jsonb_typeof(s.value) = 'number'
                       then greatest(floor((s.value #>> '{}')::numeric)::int, 0)
                     end
                from public.app_settings s
               where s.key = 'minimum_qty_per_dish'),
             0)
      into v_min_dish;

    select mi.name,
           coalesce(mi.min_qty, v_min_dish) as required,
           t.have
      into v_viol
      from (select oi.menu_item_id, sum(oi.qty)::int as have
              from public.order_items oi
             where oi.order_id = v_order_id
               and oi.menu_item_id is not null
               -- v10: no plan_instance_id filter — à-la-carte extras riding a
               -- box order are held to the dish floor too.
             group by oi.menu_item_id) t
      join public.menu_items mi on mi.id = t.menu_item_id
     where coalesce(mi.min_qty, v_min_dish) > 0
       and t.have < coalesce(mi.min_qty, v_min_dish)
     order by mi.name
     limit 1;

    if found then
      raise exception 'Minimum % of dish "%" per order; this order has %',
        v_viol.required, v_viol.name, v_viol.have;
    end if;
  end if;

  update public.orders
     set subtotal_cents = v_subtotal,
         total_cents    = v_subtotal,
         -- The email trigger keys on this stamp. An unpaid PayPal order is not
         -- something the kitchen or the customer should hear about yet, so it
         -- stays NULL until record_paypal_capture stamps it.
         notified_at    = case when v_pay_status = 'awaiting_payment'
                               then null else now() end
   where id = v_order_id;

  return jsonb_build_object(
           'order_ref', p_order_ref,
           'order_id', v_order_id,
           'total_cents', v_subtotal,
           'payment_proof_path', v_proof_path,
           'payment_status', v_pay_status);
end;
$function$;


grant execute on function public.create_order(jsonb, jsonb, text, text, text, text)
  to anon, authenticated;
