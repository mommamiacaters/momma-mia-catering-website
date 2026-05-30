-- ============================================================================
-- Repoint the order-notification from self-hosted n8n → a Supabase Edge Function
-- ----------------------------------------------------------------------------
-- The n8n host went down/unreachable, taking all order emails with it (web +
-- mobile). Per the decision in
-- docs/plans/2026-05-25-refactor-order-email-delivery-decision-plan.md, the
-- notification now targets a managed, in-platform Edge Function (order-notify),
-- which sends via Resend/SES. The trigger payload is unchanged — only the
-- destination (app_settings keys) changes: n8n_* → order_notify_*.
-- ============================================================================

create or replace function public.notify_order_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to     text;
  v_url    text;
  v_secret text;
  v_items  jsonb;
begin
  select order_notification_email into v_to from public.company_profile limit 1;
  select value #>> '{}' into v_url    from public.app_settings where key = 'order_notify_url';
  select value #>> '{}' into v_secret from public.app_settings where key = 'order_notify_secret';

  -- Not configured yet → skip silently (never error the order).
  if v_url is null or v_url = '' then
    return new;
  end if;

  select coalesce(
           jsonb_agg(jsonb_build_object(
             'item_name', i.item_name,
             'qty', i.qty,
             'unit_price_cents', i.unit_price_cents,
             'plan_type', i.plan_type)),
           '[]'::jsonb)
    into v_items
    from public.order_items i
   where i.order_id = new.id;

  perform net.http_post(
    url := v_url,
    timeout_milliseconds := 10000,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-MM-Auth-Token', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'source', 'app-order',
      'notificationEmail', v_to,
      'order', jsonb_build_object(
        'orderRef', new.order_ref,
        'status', new.status,
        'orderType', new.order_type,
        'subtotalCents', new.subtotal_cents,
        'deliveryFeeCents', new.delivery_fee_cents,
        'totalCents', new.total_cents,
        'paymentProofUrl', new.payment_proof_url,
        'createdAt', new.created_at
      ),
      'customer', jsonb_build_object(
        'firstName', new.customer_first_name,
        'lastName', new.customer_last_name,
        'email', new.customer_email,
        'phone', new.customer_phone,
        'deliveryAddress', new.delivery_address,
        'deliveryDate', new.delivery_date,
        'deliveryTime', new.delivery_time,
        'specialRequests', new.special_requests
      ),
      'items', v_items
    )
  );

  return new;
end;
$$;

-- (trigger trg_notify_order_created already exists from the prior migration and
--  is unchanged — it just calls this updated function.)
