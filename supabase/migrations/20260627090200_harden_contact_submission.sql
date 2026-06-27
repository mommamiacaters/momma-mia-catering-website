-- ============================================================================
-- Harden the contact + quote notify path against email-amplification abuse
-- ----------------------------------------------------------------------------
-- 20260627090000 added AFTER INSERT email triggers to contact_submissions and
-- quote_requests. But contact_submissions still carried the original
-- `with check (true)` anon INSERT policy, so anyone with the (public) anon key
-- could POST straight to PostgREST and make the trigger send a Resend email on
-- every row — bypassing the client-side honeypot and draining the SHARED Resend
-- quota that ORDER emails also depend on (order-notify silently drops on
-- provider failure, so the starvation would be invisible).
--
-- Two defenses, mirroring how the orders table was already locked down
-- (20260524132145 routes anon writes through the create_order SECURITY DEFINER
-- RPC instead of a raw insert):
--   (1) No direct anon INSERT on contact_submissions — go through
--       submit_contact_message(), which enforces a SERVER-SIDE honeypot + input
--       bounds. (quote_requests was already write-by-service-role only.)
--   (2) A coarse per-minute email throttle inside the notify helpers, so a flood
--       (via ANY path) can't exhaust Resend — the rows still persist, only the
--       email is skipped above the cap.
--
-- NOTE: the public `chat` Edge Function remains an unauthenticated endpoint by
-- design; bounding its LLM/DB abuse fully needs a rate-limit / Turnstile token —
-- tracked as a follow-up. This migration caps the email blast radius, which is
-- the shared-quota availability risk.
-- Additive only.
-- ============================================================================

-- ---------- (1) bound the payload size --------------------------------------
-- `not valid` enforces on every NEW row immediately while skipping a scan of
-- (trusted) existing rows.
alter table public.contact_submissions
  drop constraint if exists contact_message_len;
alter table public.contact_submissions
  add constraint contact_message_len check (char_length(message) <= 5000) not valid;

-- ---------- (2) close the open anon INSERT, route through an RPC -------------
drop policy if exists "anyone can submit a contact message" on public.contact_submissions;
revoke insert on public.contact_submissions from anon, authenticated;

create or replace function public.submit_contact_message(
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_topic      text,
  p_message    text,
  p_hp         text default ''   -- honeypot: real users leave this empty
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Server-side honeypot — a filled field means a bot. Pretend success, insert
  -- nothing (so no trigger, no email). This cannot be skipped by a raw POST the
  -- way the client-only honeypot could.
  if coalesce(btrim(p_hp), '') <> '' then
    return;
  end if;

  if p_first_name is null or btrim(p_first_name) = '' then
    raise exception 'First name is required';
  end if;
  if p_email is null or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email is required';
  end if;
  if p_message is null or btrim(p_message) = '' then
    raise exception 'Message is required';
  end if;
  if char_length(p_message) > 5000 then
    raise exception 'Message is too long (5000 characters max)';
  end if;

  insert into public.contact_submissions (first_name, last_name, email, topic, message)
  values (
    btrim(p_first_name),
    nullif(btrim(p_last_name), ''),
    btrim(p_email),
    nullif(btrim(p_topic), ''),
    p_message
  );
end;
$$;

revoke all on function public.submit_contact_message(text, text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text, text, text) to anon, authenticated;

-- ---------- (3) per-minute email throttle in the notify helpers -------------
-- Coarse availability guard: above the cap we skip the Resend call (the row is
-- already saved). For a small catering site, >12 contact msgs or quotes in a
-- minute is abuse, not traffic. Protects the shared RESEND_API_KEY that order
-- emails also use. `create or replace` re-defines the 20260627090000 helpers.

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
  v_recent int;
begin
  begin
    -- Throttle: skip the email (not the insert) when contact volume spikes.
    select count(*) into v_recent
      from public.contact_submissions
     where created_at > now() - interval '1 minute';
    if v_recent > 12 then
      raise warning 'contact-notify: rate cap hit (% in last minute) — skipping email', v_recent;
      return;
    end if;

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
  v_recent int;
begin
  begin
    select count(*) into v_recent
      from public.quote_requests
     where created_at > now() - interval '1 minute';
    if v_recent > 12 then
      raise warning 'quote-notify: rate cap hit (% in last minute) — skipping email', v_recent;
      return;
    end if;

    select coalesce(nullif(btrim(order_notification_email), ''), 'mommamiacaters@gmail.com')
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
