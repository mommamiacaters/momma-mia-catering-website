-- ============================================================================
-- Meal plans: switchable pricing mode (fixed price vs price range)
-- ----------------------------------------------------------------------------
-- Dishes keep their own price_cents — that stays useful as a list/cost figure
-- and for selling the same dish à la carte elsewhere — but inside a meal plan
-- it is NOT what the customer pays. The plan is the priced line.
--
-- Two modes, chosen per plan:
--   'fixed'  (default)  the customer pays plan.price_cents. Component dishes are
--                       ₱0 no matter what price_cents says.
--   'range'             the customer pays for what they actually picked: the
--                       components carry their own prices and the plan line is
--                       ₱0. The storefront advertises this as a RANGE, because
--                       the total depends on the combination chosen.
--
-- The mode lives in the database, not the frontend. Putting pricing rules in
-- code is precisely what left MEAL_PLAN_LIMITS stale and unmaintainable, and a
-- price the client computes is a price the client can lie about.
-- ============================================================================

alter table public.meal_plans
  add column if not exists pricing_mode text not null default 'fixed';

alter table public.meal_plans
  drop constraint if exists meal_plans_pricing_mode_check;
alter table public.meal_plans
  add constraint meal_plans_pricing_mode_check
  check (pricing_mode in ('fixed', 'range'));

-- ---------- what a 'range' plan would cost -----------------------------------
-- Cheapest and dearest valid combination, derived from the dishes actually on
-- sale in each slot. A view rather than client-side maths so the storefront, the
-- admin preview and any future receipt all quote the same number.
create or replace view public.meal_plan_price_ranges as
with slot_stats as (
  select s.slot,
         min(coalesce(m.price_cents, 0)) as lo,
         max(coalesce(m.price_cents, 0)) as hi
    from public.menu_items m
    join public.sub_categories s on s.id = m.sub_category_id
   where m.is_available
     and s.slot is not null
   group by s.slot
)
select p.id                                        as meal_plan_id,
       p.pricing_mode,
       p.price_cents,
       coalesce(sum(coalesce(st.lo, 0) * c.n), 0)::int as min_cents,
       coalesce(sum(coalesce(st.hi, 0) * c.n), 0)::int as max_cents
  from public.meal_plans p
  cross join lateral (
    values ('main',    p.main_count),
           ('side',    p.side_count),
           ('dessert', p.dessert_count),
           ('rice',    p.rice_count)
  ) as c(slot, n)
  left join slot_stats st on st.slot = c.slot
 group by p.id, p.pricing_mode, p.price_cents;

grant select on public.meal_plan_price_ranges to anon, authenticated;

-- ============================================================================
-- create_order v4 — price the order from the plan's OWN mode
-- ============================================================================
create or replace function public.create_order(
  p_items             jsonb,
  p_customer          jsonb,
  p_order_ref         text,
  p_payment_proof_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

    if v_plan_iid is not null then
      v_modes := v_modes || jsonb_build_object(v_plan_iid, v_plan.pricing_mode);
    end if;
  end loop;

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
$$;

grant execute on function public.create_order(jsonb, jsonb, text, text) to anon, authenticated;
