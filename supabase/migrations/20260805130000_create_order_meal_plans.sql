-- ============================================================================
-- create_order: the meal PLAN is the priced line, dishes are free components
-- ----------------------------------------------------------------------------
-- Until now every order line was a menu_item and the box price was implied by
-- summing the dishes inside it (2 mains x ₱70 + side ₱90 + rice ₱35). That is
-- backwards for how Check-a-Lunch actually sells: the customer buys "Standard
-- Bento ₱210" and the dishes they pick are what goes IN it, at no extra charge.
--
-- After this, an order line is one of:
--   * a PLAN      — carries meal_plan_id and the plan's price
--   * a COMPONENT — a dish chosen to fill a slot in that plan. Identified by
--                   carrying plan_instance_id; priced at COALESCE(price_cents, 0)
--                   so an optional upcharge still works (Garlic Rice +₱15,
--                   Yangchow +₱20 on the printed menu) while ordinary dishes
--                   with a NULL price cost nothing.
--   * À-LA-CARTE  — a dish bought on its own (Café Menu, Party Trays). Unchanged:
--                   it must still have a price, and a NULL one is rejected.
--
-- The plan_instance_id test is what separates a free component from a priced
-- catalogue item, so a dish with no price can never be sold standalone by
-- omitting its plan.
--
-- Additive: existing à-la-carte payloads behave exactly as before.
-- ============================================================================

-- ---------- order_items can reference a plan --------------------------------
alter table public.order_items
  add column if not exists meal_plan_id int references public.meal_plans(id) on delete set null;

create index if not exists idx_order_items_meal_plan on public.order_items(meal_plan_id);

-- ---------- create_order v3 --------------------------------------------------
create or replace function public.create_order(
  p_items             jsonb,        -- [{ "meal_plan_id": int, "qty": int, "plan_instance_id": text }
                                    --  ,{ "menu_item_id": uuid, "qty": int,
                                    --     "plan_instance_id"?: text, "plan_type"?: text, "notes"?: text }]
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
  v_client   uuid := auth.uid();    -- derive from the session; never trust the payload
  v_subtotal int  := 0;
  v_item     jsonb;
  v_qty      int;
  v_mi       record;
  v_plan     record;
  v_unit     int;
  v_plan_iid text;
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

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty <= 0 then
      raise exception 'Invalid quantity';
    end if;
    v_plan_iid := nullif(v_item->>'plan_instance_id', '');

    -- ---------- a plan line ------------------------------------------------
    if nullif(v_item->>'meal_plan_id','') is not null then
      select mp.id, mp.name, mp.price_cents, mp.is_active
        into v_plan
        from public.meal_plans mp
       where mp.id = (v_item->>'meal_plan_id')::int;

      if not found then
        raise exception 'Unknown meal plan %', v_item->>'meal_plan_id';
      end if;
      if v_plan.is_active is not true then
        raise exception 'Meal plan not available: %', v_plan.name;
      end if;

      insert into public.order_items (
        order_id, meal_plan_id, item_name, item_type, qty, unit_price_cents,
        plan_instance_id, plan_type
      ) values (
        v_order_id, v_plan.id, v_plan.name, 'meal_plan', v_qty, v_plan.price_cents,
        v_plan_iid, v_plan.name
      );

      v_subtotal := v_subtotal + v_plan.price_cents * v_qty;

    -- ---------- a dish line ------------------------------------------------
    else
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

      if v_plan_iid is not null then
        -- Component of a plan: the plan line already carries the money. A price
        -- here is an optional upcharge (rice upgrades), not the dish's cost.
        v_unit := coalesce(v_mi.price_cents, 0);
      else
        -- Sold on its own, so it must be priced. NULL still means "price on
        -- request" and cannot be bought online.
        if v_mi.price_cents is null then
          raise exception 'Item has no online price: %', v_mi.name;
        end if;
        v_unit := v_mi.price_cents;
      end if;

      insert into public.order_items (
        order_id, menu_item_id, item_name, item_type, qty, unit_price_cents,
        plan_instance_id, plan_type, notes
      ) values (
        v_order_id, v_mi.id, v_mi.name, v_mi.item_type, v_qty, v_unit,
        v_plan_iid, nullif(v_item->>'plan_type',''), nullif(v_item->>'notes','')
      );

      v_subtotal := v_subtotal + v_unit * v_qty;
    end if;
  end loop;

  -- Finalize: totals plus the write-once notified_at the email trigger keys on.
  update public.orders
     set subtotal_cents = v_subtotal,
         total_cents    = v_subtotal,
         notified_at    = now()
   where id = v_order_id;

  return jsonb_build_object('order_ref', p_order_ref, 'order_id', v_order_id, 'total_cents', v_subtotal);
end;
$$;

grant execute on function public.create_order(jsonb, jsonb, text, text) to anon, authenticated;
