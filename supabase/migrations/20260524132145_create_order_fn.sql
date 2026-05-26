-- ============================================================================
-- Phase 5 (security): server-authoritative order creation
-- ----------------------------------------------------------------------------
-- Replaces the client-trusted direct INSERT into orders/order_items (which ran
-- under `with check (true)`) with a single SECURITY DEFINER function. The server
-- now:
--   * forces client_id := auth.uid()  (NEVER trusts a client-supplied id),
--   * looks up unit prices from menu_items by id and RECOMPUTES the total,
--   * rejects unknown / unavailable / null-price items,
--   * inserts the order + all line items ATOMICALLY (one txn) so a partial
--     failure can never leave an empty order.
-- Both the website and the mobile app call this RPC; the open insert policies
-- are dropped so the table can only be written through this validated path.
--
-- Pricing note: every (category, item_type) is uniformly priced and the web
-- meal-plan UI requires a COMPLETE plan before checkout, so SUM(price*qty) over
-- the chosen items equals the web's bundle price exactly — no separate meal-plan
-- pricing table is needed. Mobile is à-la-carte, so the sum is its cart total.
-- ============================================================================

create or replace function public.create_order(
  p_items             jsonb,        -- [{ "menu_item_id": uuid, "qty": int,
                                    --    "plan_instance_id"?: text, "plan_type"?: text, "notes"?: text }]
  p_customer          jsonb,        -- { first_name,last_name,email,phone,
                                    --   delivery_address?,delivery_date?,delivery_time?,special_requests?,order_type? }
  p_order_ref         text,
  p_payment_proof_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''                -- hardened: every object below is schema-qualified
as $$
declare
  v_order_id uuid;
  v_client   uuid := auth.uid();    -- derive from the session; do NOT read client_id from the payload
  v_subtotal int  := 0;
  v_item     jsonb;
  v_qty      int;
  v_mi       record;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  -- order shell; totals are filled after summing validated line items
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

  -- one validated line per item; price + name are SNAPSHOTTED from the catalog
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'qty')::int, 0);
    if v_qty <= 0 then
      raise exception 'Invalid quantity for item %', v_item->>'menu_item_id';
    end if;

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
    if v_mi.price_cents is null then
      raise exception 'Item has no online price: %', v_mi.name;
    end if;

    insert into public.order_items (
      order_id, menu_item_id, item_name, item_type, qty, unit_price_cents,
      plan_instance_id, plan_type, notes
    ) values (
      v_order_id, v_mi.id, v_mi.name, v_mi.item_type, v_qty, v_mi.price_cents,
      nullif(v_item->>'plan_instance_id',''), nullif(v_item->>'plan_type',''), nullif(v_item->>'notes','')
    );

    v_subtotal := v_subtotal + v_mi.price_cents * v_qty;
  end loop;

  update public.orders
     set subtotal_cents = v_subtotal,
         total_cents    = v_subtotal      -- delivery_fee_cents stays 0 for now
   where id = v_order_id;

  return jsonb_build_object('order_ref', p_order_ref, 'order_id', v_order_id, 'total_cents', v_subtotal);
end;
$$;

-- ---------- lock the table-level write path -------------------------------
-- The function runs as its owner (table owner) and bypasses RLS, so dropping
-- these policies removes the only client-reachable insert path while leaving
-- the validated RPC fully functional.
drop policy if exists "anyone can create an order"               on public.orders;
drop policy if exists "order items can be created with an order" on public.order_items;
revoke insert on public.orders, public.order_items from anon, authenticated;

-- Expose ONLY the validated path. anon is included so guest checkout keeps working.
grant execute on function public.create_order(jsonb, jsonb, text, text) to anon, authenticated;
