-- ============================================================================
-- Email the owner again when a chat quote's key details change (throttled).
-- ----------------------------------------------------------------------------
-- chat_save_quote() keeps ONE row per chat conversation: the first complete lead
-- INSERTs (trg_notify_quote_request emails the owner), later turns UPDATE in place.
-- An UPDATE never emailed, so a customer who corrected their headcount/date, or
-- asked for a second event in the same chat, changed the row with the owner never
-- told. Now an update that changes who/what/when/how-many emails the owner the
-- current details. Cosmetic updates (transcript, score) stay silent.
--
-- Throttle: at most one update email per quote per 10 minutes, measured from the
-- last email (or the row's creation, which already emailed). _quote_notify_post's
-- own cap counts INSERTs per minute, so it cannot bound repeated UPDATEs of one
-- row; without this, a scripted chat could turn every turn into an owner email.
--
-- BEFORE UPDATE so the stamp is written in the same row version (no second
-- UPDATE, no trigger recursion). _quote_notify_post swallows its own errors, so a
-- failed email never blocks the save. Idempotent; internal, not API-callable.
-- ============================================================================

alter table public.quote_requests
  add column if not exists last_notified_at timestamptz;

create or replace function public.notify_quote_request_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(old.last_notified_at, old.created_at) < now() - interval '10 minutes' then
    new.last_notified_at := now();
    perform public._quote_notify_post(new);
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_quote_request_updated() from public, anon, authenticated;

drop trigger if exists trg_notify_quote_request_updated on public.quote_requests;
create trigger trg_notify_quote_request_updated
  before update on public.quote_requests
  for each row
  when (
       old.email      is distinct from new.email
    or old.event_type is distinct from new.event_type
    or old.pax        is distinct from new.pax
    or old.event_date is distinct from new.event_date
  )
  execute function public.notify_quote_request_updated();
