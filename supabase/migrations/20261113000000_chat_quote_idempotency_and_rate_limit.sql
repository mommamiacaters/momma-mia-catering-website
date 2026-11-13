-- ============================================================================
-- Chatbot hardening: one quote row per conversation + cheap rate limiting
-- ----------------------------------------------------------------------------
-- Prod bug (2026-10-13): one customer produced 5 quote_requests rows (and 5 owner
-- emails) because the `chat` function inserted on every turn that carried a
-- [QUOTE_DATA] tag / an email, with `quoteSent` held (and lost) client-side.
--
--   * quote_requests.conversation_id   UUID minted by the widget, UNIQUE.
--   * chat_save_quote()                SECURITY DEFINER upsert: first call INSERTs
--                                      (-> trg_notify_quote_request emails the
--                                      owner ONCE); later calls for the same
--                                      conversation UPDATE the row in place
--                                      (richer details, no second email, since the
--                                      trigger is AFTER INSERT only).
--   * chat_rate_limit + chat_rate_check()  fixed-window counters, used by the
--                                      function for per-IP / per-conversation
--                                      limits and a per-IP new-quote quota.
--
-- Everything is service-role only. Fully re-runnable. Does not touch the notify
-- trigger/functions.
-- ============================================================================

-- ---------- conversation id on quote_requests --------------------------------
alter table public.quote_requests
  add column if not exists conversation_id uuid;

-- Plain (non-partial) unique index so upserts can target it. Legacy rows keep
-- NULL, and NULLs are distinct, so they never collide.
create unique index if not exists uq_quote_requests_conversation
  on public.quote_requests(conversation_id);

-- ---------- rate-limit counters ----------------------------------------------
create table if not exists public.chat_rate_limit (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         int         not null default 0,
  primary key (bucket, window_start)
);
alter table public.chat_rate_limit enable row level security;  -- no policies: service role only
revoke all on public.chat_rate_limit from public, anon, authenticated;

-- Count one hit in the current fixed window; true = still within p_limit.
create or replace function public.chat_rate_check(
  p_bucket text, p_limit int, p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits  int;
begin
  insert into public.chat_rate_limit(bucket, window_start, hits)
  values (p_bucket, v_start, 1)
  on conflict (bucket, window_start)
  do update set hits = public.chat_rate_limit.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup (~2% of calls) keeps the table tiny without pg_cron.
  if random() < 0.02 then
    delete from public.chat_rate_limit where window_start < now() - interval '2 days';
  end if;

  return v_hits <= p_limit;
end;
$$;

-- ---------- idempotent quote save --------------------------------------------
-- Returns 'inserted' | 'updated' | 'rate_limited'. A per-IP quota (5 NEW leads
-- per 24 h) applies only to brand-new conversations, never to updates.
create or replace function public.chat_save_quote(
  p_conversation_id uuid,
  p_ip_hash         text,
  p_name            text,
  p_email           text,
  p_event_type      text,
  p_pax             text,
  p_event_date      text,
  p_order_request   text,
  p_intents         text[],
  p_lead_score      int,
  p_lead_level      text,
  p_lead_priority   text,
  p_conversation    jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean;
begin
  if p_conversation_id is null then
    raise exception 'conversation_id required';
  end if;

  if not exists (select 1 from public.quote_requests where conversation_id = p_conversation_id)
     and not public.chat_rate_check('quote-ip:' || coalesce(p_ip_hash, 'unknown'), 5, 86400) then
    return 'rate_limited';
  end if;

  insert into public.quote_requests as q (
    conversation_id, name, email, event_type, pax, event_date, order_request,
    intents, lead_score, lead_level, lead_priority, conversation
  ) values (
    p_conversation_id, nullif(p_name, ''), p_email, nullif(p_event_type, ''),
    nullif(p_pax, ''), nullif(p_event_date, ''), p_order_request,
    coalesce(p_intents, '{}'), coalesce(p_lead_score, 0), p_lead_level, p_lead_priority,
    coalesce(p_conversation, '[]'::jsonb)
  )
  on conflict (conversation_id) do update set
    name          = coalesce(nullif(excluded.name, ''), q.name),
    email         = excluded.email,
    event_type    = coalesce(nullif(excluded.event_type, ''), q.event_type),
    pax           = coalesce(nullif(excluded.pax, ''), q.pax),
    event_date    = coalesce(nullif(excluded.event_date, ''), q.event_date),
    order_request = coalesce(nullif(excluded.order_request, ''), q.order_request),
    intents       = excluded.intents,
    lead_score    = greatest(q.lead_score, excluded.lead_score),
    lead_level    = case when excluded.lead_score >= q.lead_score then excluded.lead_level else q.lead_level end,
    lead_priority = case when excluded.lead_score >= q.lead_score then excluded.lead_priority else q.lead_priority end,
    conversation  = excluded.conversation
  returning (xmax = 0) into v_inserted;

  return case when v_inserted then 'inserted' else 'updated' end;
end;
$$;

revoke all on function public.chat_rate_check(text, int, int) from public, anon, authenticated;
revoke all on function public.chat_save_quote(uuid, text, text, text, text, text, text, text, text[], int, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.chat_rate_check(text, int, int) to service_role;
grant execute on function public.chat_save_quote(uuid, text, text, text, text, text, text, text, text[], int, text, text, jsonb)
  to service_role;
