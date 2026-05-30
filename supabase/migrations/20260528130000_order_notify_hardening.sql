-- ============================================================================
-- Order-notify hardening (todos 009 + 014 items 1-2)
-- ----------------------------------------------------------------------------
-- Three independent guardrails bundled into one migration:
--
-- 1) notified_at gate on the order-notify trigger (todo 009)
--    The previous WHEN clause keyed on the mutable money column total_cents
--    (`old=0 AND new>0`). Two defects: a legit $0 order (free promo) never
--    fires, and any future re-sum (cancel+requote, partial refund) would
--    re-fire and double-email staff. Fix: add an immutable, write-once
--    timestamp column `notified_at`, set it inside create_order's finalize
--    UPDATE, and gate the trigger on its 0→non-null transition. Result:
--    exactly ONE notify per order, regardless of total mutations.
--
-- 2) app_settings secret-public guardrail (todo 014 #1)
--    Belt-and-braces: prevent a hand-edited row from flagging
--    `order_notify_*` / `*secret*` / `*token*` settings as `is_public = true`,
--    which would expose them to every anonymous storefront visitor via the
--    public-readable RLS policy. Enforced as a BEFORE trigger so existing
--    rows that get mutated also re-validate.
--
-- 3) company_profile admin re-seed path (todo 014 #2)
--    The singleton row had no INSERT policy — if it were ever deleted, no
--    admin could recreate it through the client and notifications would
--    silently send to NULL forever. Add a guarded admin INSERT policy.
--
-- Additive only — no existing migrations rewritten.
-- ============================================================================

-- ---------- (1) notified_at column + create_order replacement ---------------
alter table public.orders add column if not exists notified_at timestamptz;

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

  -- Finalize: set totals AND stamp notified_at. The trigger keys off the
  -- 0→non-null transition on notified_at — immutable, fires exactly once
  -- regardless of total mutations (cancel+requote, partial refund, $0 orders).
  update public.orders
     set subtotal_cents = v_subtotal,
         total_cents    = v_subtotal,     -- delivery_fee_cents stays 0 for now
         notified_at    = now()
   where id = v_order_id;

  return jsonb_build_object('order_ref', p_order_ref, 'order_id', v_order_id, 'total_cents', v_subtotal);
end;
$$;

-- Re-grant (create or replace preserves grants in modern Postgres, but be
-- explicit so a future signature change doesn't silently drop access).
grant execute on function public.create_order(jsonb, jsonb, text, text) to anon, authenticated;

-- Swap the trigger to key off notified_at instead of total_cents.
drop trigger if exists trg_notify_order_created on public.orders;
create trigger trg_notify_order_created
  after update of notified_at on public.orders
  for each row
  when (new.notified_at is not null and old.notified_at is null)
  execute function public.notify_order_created();

-- ---------- (2) app_settings secret-public guardrail (todo 014 #1) ----------
-- Refuse to flip a secret/token/order_notify_* row to is_public=true. Trigger
-- rather than CHECK so the rule applies to UPDATE as well as INSERT — existing
-- rows are protected if someone tries to flip the flag later.
create or replace function public.enforce_app_settings_secret_private()
returns trigger
language plpgsql
as $$
begin
  if new.is_public is true and (
    new.key ilike '%secret%'
    or new.key ilike '%token%'
    or new.key ilike 'order_notify\_%' escape '\'
  ) then
    raise exception 'app_settings: key % must not be public (secret-like key)', new.key
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_app_settings_secret_private on public.app_settings;
create trigger trg_app_settings_secret_private
  before insert or update on public.app_settings
  for each row execute function public.enforce_app_settings_secret_private();

-- ---------- (3) company_profile admin re-seed path (todo 014 #2) ------------
-- Singleton row guard: id is `boolean primary key default true check (id)`,
-- so `with check (id = true)` plus the admin gate matches the style of the
-- existing update policy and keeps the table strictly single-row.
drop policy if exists "admins insert company profile" on public.company_profile;
create policy "admins insert company profile"
  on public.company_profile for insert
  with check (public.is_admin() and id = true);
