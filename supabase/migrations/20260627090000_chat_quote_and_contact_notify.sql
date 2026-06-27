-- ============================================================================
-- Chatbot quote leads + contact-form email — fully on Supabase (retire n8n)
-- ----------------------------------------------------------------------------
-- The website chatbot and contact form were the last two features still calling
-- the self-hosted n8n instance (n8n.mommamiacaters.com), whose TLS cert
-- intermittently breaks and takes those features down. This migration moves
-- their server-side side-effects onto the SAME managed path the order emails
-- already use:  DB trigger → pg_net → the order-notify Edge Function → Resend.
-- No Google Sheets; chatbot leads become a first-class table.
--
--   * quote_requests        new table; the `chat` Edge Function (service role)
--                           inserts a row once it has collected a full quote.
--   * _quote_notify_post     fire-and-forget owner email on a new quote lead.
--   * _contact_notify_post   fire-and-forget owner email on a new contact msg.
--                           (contact_submissions already PERSISTS the message;
--                            this only adds the notification n8n used to send.)
--
-- Both reuse the existing app_settings keys order_notify_url / order_notify_secret
-- and the existing ORDER_NOTIFY_SECRET / RESEND_API_KEY edge secrets — the
-- order-notify function gains two new `kind`s (quote_lead, contact_message).
-- Each helper is safe-wrapped (BEGIN..EXCEPTION WHEN OTHERS) exactly like
-- _order_notify_post (20260528120000) so a notification failure can NEVER block
-- the insert. pg_net was already enabled by the order-notify migrations.
--
-- Additive only — no existing migrations rewritten.
-- ============================================================================

-- ---------- quote_requests (chatbot leads) ----------------------------------
create table if not exists public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  email         text not null,
  event_type    text,
  pax           text,            -- free-text ("about 50", "50-60") as the bot collects it
  event_date    text,            -- free-text ("next Saturday evening")
  order_request text,            -- food preferences / conversation summary
  intents       text[]      not null default '{}',
  lead_score    int         not null default 0,
  lead_level    text,            -- hot | warm | cold
  lead_priority text,            -- high | medium | low
  conversation  jsonb       not null default '[]'::jsonb,  -- snapshot of the chat transcript
  created_at    timestamptz not null default now()
);

create index if not exists idx_quote_requests_created on public.quote_requests(created_at desc);

alter table public.quote_requests enable row level security;

-- Admin-read only. Inserts come from the `chat` Edge Function via the service
-- role (which bypasses RLS), so there is INTENTIONALLY no anon/authenticated
-- insert policy — the public can never write leads directly (mirrors the
-- write-by-definer / read-by-admin shape of contact_submissions).
drop policy if exists "admins read quote requests" on public.quote_requests;
create policy "admins read quote requests"
  on public.quote_requests for select
  using (public.is_admin());

-- ---------- quote lead → owner email ----------------------------------------
create or replace function public._quote_notify_post(p_quote public.quote_requests)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to     text;
  v_url    text;
  v_secret text;
begin
  -- Outer guard: any failure below degrades to a logged warning, never an error
  -- that would roll back the quote insert.
  begin
    select coalesce(nullif(btrim(order_notification_email), ''), 'mommamiacaters@gmail.com')
      into v_to from public.company_profile limit 1;
    if v_to is null or btrim(v_to) = '' then
      return;
    end if;

    select value #>> '{}' into v_url    from public.app_settings where key = 'order_notify_url';
    select value #>> '{}' into v_secret from public.app_settings where key = 'order_notify_secret';
    if v_url is null or v_url = '' then
      return;  -- not configured yet → skip silently
    end if;
    if v_url !~* '^https?://' then
      raise warning 'quote-notify: order_notify_url not http(s) — skipping (%)', v_url;
      return;
    end if;

    perform net.http_post(
      url := v_url,
      timeout_milliseconds := 10000,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-MM-Auth-Token', coalesce(v_secret, '')
      ),
      body := jsonb_build_object(
        'kind', 'quote_lead',
        'to', v_to,
        'replyTo', p_quote.email,
        'quote', jsonb_build_object(
          'name', p_quote.name,
          'email', p_quote.email,
          'eventType', p_quote.event_type,
          'pax', p_quote.pax,
          'eventDate', p_quote.event_date,
          'orderRequest', p_quote.order_request,
          'leadScore', p_quote.lead_score,
          'leadLevel', p_quote.lead_level,
          'leadPriority', p_quote.lead_priority,
          'intents', p_quote.intents,
          'createdAt', p_quote.created_at
        )
      )
    );
  exception
    when others then
      raise warning 'quote-notify swallowed: % (sqlstate %)', sqlerrm, sqlstate;
      return;
  end;
end;
$$;

create or replace function public.notify_quote_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._quote_notify_post(new);
  return new;
end;
$$;

drop trigger if exists trg_notify_quote_request on public.quote_requests;
create trigger trg_notify_quote_request
  after insert on public.quote_requests
  for each row execute function public.notify_quote_request();

-- ---------- contact submission → owner email --------------------------------
create or replace function public._contact_notify_post(p_contact public.contact_submissions)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to     text;
  v_url    text;
  v_secret text;
begin
  begin
    -- Prefer a dedicated contact inbox if the admin set company_profile.contact_email;
    -- otherwise fall back to the store's order_notification_email.
    select coalesce(
             nullif(btrim(contact_email), ''),
             nullif(btrim(order_notification_email), ''),
             'mommamiacaters@gmail.com')
      into v_to from public.company_profile limit 1;
    if v_to is null or btrim(v_to) = '' then
      return;
    end if;

    select value #>> '{}' into v_url    from public.app_settings where key = 'order_notify_url';
    select value #>> '{}' into v_secret from public.app_settings where key = 'order_notify_secret';
    if v_url is null or v_url = '' then
      return;
    end if;
    if v_url !~* '^https?://' then
      raise warning 'contact-notify: order_notify_url not http(s) — skipping (%)', v_url;
      return;
    end if;

    perform net.http_post(
      url := v_url,
      timeout_milliseconds := 10000,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-MM-Auth-Token', coalesce(v_secret, '')
      ),
      body := jsonb_build_object(
        'kind', 'contact_message',
        'to', v_to,
        'replyTo', p_contact.email,
        'contact', jsonb_build_object(
          'firstName', p_contact.first_name,
          'lastName', p_contact.last_name,
          'email', p_contact.email,
          'topic', p_contact.topic,
          'message', p_contact.message,
          'createdAt', p_contact.created_at
        )
      )
    );
  exception
    when others then
      raise warning 'contact-notify swallowed: % (sqlstate %)', sqlerrm, sqlstate;
      return;
  end;
end;
$$;

create or replace function public.notify_contact_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._contact_notify_post(new);
  return new;
end;
$$;

drop trigger if exists trg_notify_contact_submission on public.contact_submissions;
create trigger trg_notify_contact_submission
  after insert on public.contact_submissions
  for each row execute function public.notify_contact_submission();
