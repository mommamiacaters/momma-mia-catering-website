---
module: Momma Mia (Supabase order-notify)
date: 2026-05-25
problem_type: best_practice
component: database
symptoms:
  - "A 'fire-and-forget' notification trigger can still roll back the parent transaction"
  - "An admin-typed config value (e.g. a malformed webhook URL) breaks customer checkout"
  - "net.http_post is async, yet a bad argument to it raises synchronously inside the order txn"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [supabase, pg_net, trigger, security-definer, transaction, fire-and-forget, postgres]
---

# Best practice: side-effect triggers (`pg_net`) must guard their body — async ≠ can't-roll-back

## Problem
A Postgres `AFTER` trigger that performs a side-effect (here: `net.http_post` to send an order email)
runs **synchronously inside the parent transaction**. `pg_net`'s `net.http_post` is genuinely async —
it only enqueues a row and returns; the HTTP call happens later in a background worker, so a *network*
failure or timeout cannot roll back the order. **But the trigger function's other statements are
synchronous**, and several can `RAISE` and abort the parent transaction:
- a **malformed `url`** argument (e.g. admin-typed `htttp://…` or a bare host) makes `net.http_post`
  raise its **argument validation synchronously**;
- the `pg_net` extension being absent/dropped;
- any other error in the `SELECT`/`jsonb_build` setup.

Result: a single bad character in an admin settings field silently turns "send a notification email"
into **"customer checkout fails."** "Fire-and-forget" describes the *network call*, not the *setup
code around it* — conflating the two is the trap.

## Environment
- Supabase Postgres, `pg_net`; trigger `notify_order_created()` (`SECURITY DEFINER`, `search_path=''`)
  on `public.orders`, firing inside the `create_order` RPC transaction.
- Surfaced 2026-05-25 by `/workflows:review` (data-integrity-guardian) — perf + security lenses both
  missed it; only "can this side-effect's setup raise and roll back its own transaction?" caught it.

## The rule
> **Any trigger/function that performs a side-effect must wrap its body in an exception handler so it
> can NEVER abort the transaction it lives in.** Treat "fire-and-forget" as a guarantee you must
> *enforce*, not one you get for free from an async API.

## Solution (WRONG vs CORRECT)
```sql
-- ❌ WRONG: a malformed app_settings URL (or missing pg_net) raises and rolls back the order
create function notify_order_created() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  select value #>> '{}' into v_url from public.app_settings where key = 'order_notify_url';
  perform net.http_post(url := v_url, body := …);  -- raises synchronously on a bad URL
  return new;
end; $$;

-- ✅ CORRECT: swallow everything; the notification must never fail an order
create function notify_order_created() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  begin
    select value #>> '{}' into v_url from public.app_settings where key = 'order_notify_url';
    if v_url is null or v_url = '' then return new; end if;
    perform net.http_post(url := v_url, body := …);
  exception when others then
    return new;  -- notification is best-effort; the order is already valid
  end;
  return new;
end; $$;
```

## Why This Works
The inner `begin … exception when others then return new; end;` block catches *any* synchronous error
(bad URL, missing extension, type error) and lets the trigger return normally, so the parent `UPDATE`
(and the customer's order) commits regardless. The async HTTP is unaffected — it still fires when the
config is valid. You've now *enforced* fire-and-forget instead of assuming it.

## Prevention
- **Default posture for side-effect triggers:** wrap the body in `exception when others then return
  new/null`. Side-effects (email, webhooks, queues) are best-effort; never let them gate the business
  write.
- **Treat any value read from a config table as untrusted input** to `net.http_post` — validate the
  URL (`~ '^https?://'`) and/or rely on the exception guard.
- **Review heuristic:** for every trigger, ask *"if every statement in here raised, would the parent
  transaction survive?"* If not, it can break the core write.
- Monitor `net._http_response` (status/timeout) for delivery failures, since they're now silent.

## Related Issues
- Codebase fix tracked in `todos/007-pending-p1-notify-trigger-can-rollback-order.md` (apply the
  exception wrapper) and `todos/013-…` (collapse + idempotent migration).
- Order pipeline + this trigger: memory `mommamia-create-order-rpc`.
- Adjacent Supabase/infra notes: `docs/solutions/developer-experience/expo-go-something-went-wrong-adb-reverse-momma-mobile-20260525.md`.
- See also: [resend-namecheap-domain-verify-no-mx-OrderEmails-20260525.md](../integration-issues/resend-namecheap-domain-verify-no-mx-OrderEmails-20260525.md) — the email-provider/DNS side of this same order-email pipeline (Resend + Namecheap verification gotchas).
