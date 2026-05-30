// Supabase Edge Function: order-notify
// -----------------------------------------------------------------------------
// One function, three emails — selected by the payload's `kind`:
//   • store_alert           → store ops inbox: "a new order arrived"      (on finalize)
//   • customer_confirmation → the buyer:       "we got your order!"        (on finalize)
//   • customer_receipt      → the buyer:       itemized receipt            (on delivery)
//
// Fired server-to-server by the DB triggers (notify_order_created /
// notify_order_delivered) via pg_net. Replaces the offline self-hosted-n8n hop
// with a managed, reachable path (Supabase → email provider).
//
// Provider: Resend only. SES is intentionally dropped (YAGNI — keeping both was
// dead weight and the heavy aws-sdk dynamic import was a real cost). If
// RESEND_API_KEY is unset the function logs and returns 200 (no-op) so it's
// safe to deploy before the secret is set.
//
// Auth: deployed with verify_jwt = false (called by the DB trigger), so it checks
// a shared secret header (X-MM-Auth-Token) instead, with a constant-time compare.
//
// DELIVERY CONTRACT — AT-MOST-ONCE:
//   We return HTTP 200 on provider failures (Resend 429/5xx/etc) and log the
//   error. This is deliberate: any retry layer (Database Webhooks, in particular)
//   retries on non-2xx, which combined with a provider that accepted-then-errored
//   would double-send. We'd rather drop the rare email and surface it in logs
//   than risk duplicate store emails or duplicate customer confirmations. The
//   trigger is fire-and-forget; the order itself is never blocked.
//
// Deploy:  supabase functions deploy order-notify --project-ref fbzwicfvhrtyfqjounvo
// Secrets: supabase secrets set ORDER_NOTIFY_SECRET=… ORDER_FROM_EMAIL=… RESEND_API_KEY=…
// -----------------------------------------------------------------------------

import { encodeBase64 } from "jsr:@std/encoding/base64";

const NOTIFY_SECRET = Deno.env.get("ORDER_NOTIFY_SECRET") ?? "";
const FROM = Deno.env.get("ORDER_FROM_EMAIL") ?? "Momma Mia Caters <orders@mommamiacaters.com>";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Auto-injected by Supabase into every Edge Function — used to read the private
// payment-proofs bucket (service role bypasses RLS) so we can attach the proof.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PROOF_BUCKET = "payment-proofs";

// Simple email shape check — good enough to refuse "" / "hi" / "a@b" and to
// neutralise header injection vectors at the recipient. Not RFC-perfect on
// purpose: stricter regexes reject valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Kind = "store_alert" | "customer_confirmation" | "customer_receipt";

interface Item { item_name: string; qty: number; unit_price_cents: number; plan_type: string | null }
interface Payload {
  kind?: Kind;
  to?: string;                  // explicit recipient
  notificationEmail?: string;   // legacy alias ⇒ store_alert recipient
  order?: {
    orderRef?: string; status?: string; orderType?: string;
    subtotalCents?: number; deliveryFeeCents?: number; totalCents?: number;
    paymentProofUrl?: string | null; createdAt?: string;
  };
  customer?: {
    firstName?: string; lastName?: string; email?: string; phone?: string;
    deliveryAddress?: string | null; deliveryDate?: string | null; deliveryTime?: string | null;
    specialRequests?: string | null;
  };
  items?: Item[];
}

const BRAND = "#E36A2E";
const INK = "#2E2A26";
const MUTE = "#6B6358";
const LINE = "#D9CDBE";

const peso = (cents = 0) => `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

// Mobile-first single-column shell (most receipts are read on a phone).
function shell(inner: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:${INK};max-width:560px;margin:0 auto;padding:8px">${inner}</div>`;
}

function itemRows(items: Item[]): string {
  return items
    .map((i) => `<tr><td style="padding:4px 0">${i.qty}× ${esc(i.item_name)}${i.plan_type ? ` <span style="color:${MUTE}">(${esc(i.plan_type)})</span>` : ""}</td><td style="text-align:right;white-space:nowrap">${peso((i.unit_price_cents ?? 0) * (i.qty ?? 0))}</td></tr>`)
    .join("");
}

// Subtotal / delivery / total block. Falls back to total-only if subtotal absent.
function totalsBlock(o: NonNullable<Payload["order"]>): string {
  const line = (label: string, val: string, bold = false) =>
    `<tr><td style="padding:2px 0;${bold ? "font-weight:bold" : `color:${MUTE}`}">${label}</td><td style="text-align:right;${bold ? "font-weight:bold" : `color:${MUTE}`}">${val}</td></tr>`;
  const parts: string[] = [];
  if (o.subtotalCents != null) parts.push(line("Subtotal", peso(o.subtotalCents)));
  if (o.deliveryFeeCents) parts.push(line("Delivery fee", peso(o.deliveryFeeCents)));
  return `<tr><td colspan="2" style="padding-top:8px;border-top:1px solid ${LINE}"></td></tr>${parts.join("")}${line("Total", peso(o.totalCents), true)}`;
}

function customerBlock(c: NonNullable<Payload["customer"]>): string {
  return `<p style="margin:0;line-height:1.6">
    ${esc(c.firstName)} ${esc(c.lastName)}<br>${esc(c.phone)} · ${esc(c.email)}<br>
    ${c.deliveryAddress ? esc(c.deliveryAddress) + "<br>" : ""}
    ${c.specialRequests ? `<em>Note: ${esc(c.specialRequests)}</em><br>` : ""}
  </p>`;
}

function deliveryLine(c: NonNullable<Payload["customer"]>): string {
  const when = [c.deliveryDate, c.deliveryTime].filter(Boolean).map((s) => esc(s)).join(" · ");
  const where = c.deliveryAddress ? esc(c.deliveryAddress) : "";
  if (!when && !where) return "";
  return `<p style="margin:12px 0 0;color:${MUTE}">${[when, where].filter(Boolean).join("<br>")}</p>`;
}

// ---- templates ------------------------------------------------------------
function renderStoreAlert(p: Payload, proofAttached: boolean): string {
  const o = p.order ?? {}, c = p.customer ?? {}, items = p.items ?? [];
  const proofNote = !o.paymentProofUrl
    ? ""
    : proofAttached
      ? `<p style="margin:16px 0 0;color:${MUTE}">📎 Payment proof attached to this email.</p>`
      : `<p style="margin:16px 0 0;color:${MUTE}">Payment proof on file: ${esc(o.paymentProofUrl)}</p>`;
  return shell(`
    <h2 style="color:${BRAND};margin:0 0 4px">New order ${esc(o.orderRef)}</h2>
    <p style="margin:0 0 16px;color:${MUTE}">Placed ${esc(o.createdAt)}</p>
    <table style="width:100%;border-collapse:collapse">${itemRows(items)}${totalsBlock(o)}</table>
    <h3 style="margin:20px 0 6px">Customer</h3>${customerBlock(c)}
    ${proofNote}
  `);
}

function renderCustomerConfirmation(p: Payload): string {
  const o = p.order ?? {}, c = p.customer ?? {}, items = p.items ?? [];
  return shell(`
    <h2 style="color:${BRAND};margin:0 0 4px">We got your order! 🍱</h2>
    <p style="margin:0 0 16px;line-height:1.6">Hi ${esc(c.firstName) || "there"}, thanks for ordering with Momma Mia Caters.
      Your payment is in and we're getting everything ready. Here's your summary:</p>
    <p style="margin:0 0 12px;color:${MUTE}">Order <strong style="color:${INK}">${esc(o.orderRef)}</strong></p>
    <table style="width:100%;border-collapse:collapse">${itemRows(items)}${totalsBlock(o)}</table>
    ${deliveryLine(c)}
    <p style="margin:20px 0 0;line-height:1.6">We'll email you a receipt the moment your order is delivered. 💛</p>
    <p style="margin:16px 0 0;color:${MUTE};font-size:13px">Questions? Just reply to this email.</p>
  `);
}

function renderCustomerReceipt(p: Payload): string {
  const o = p.order ?? {}, c = p.customer ?? {}, items = p.items ?? [];
  return shell(`
    <h2 style="color:${BRAND};margin:0 0 4px">Delivered — here's your receipt ✅</h2>
    <p style="margin:0 0 16px;line-height:1.6">Thank you, ${esc(c.firstName) || "friend"}! Your Momma Mia order has been delivered.
      We hope it's delicious. 🧡</p>
    <p style="margin:0 0 4px;color:${MUTE}">Receipt for order <strong style="color:${INK}">${esc(o.orderRef)}</strong></p>
    <p style="margin:0 0 12px;color:${MUTE}">Placed ${esc(o.createdAt)}</p>
    <table style="width:100%;border-collapse:collapse">${itemRows(items)}${totalsBlock(o)}</table>
    ${deliveryLine(c)}
    <p style="margin:16px 0 0;color:${MUTE}">Payment: received via uploaded proof ✓</p>
    <p style="margin:20px 0 0;line-height:1.6">Crave more? Order again at
      <a href="https://mommamiacaters.com" style="color:${BRAND}">mommamiacaters.com</a>.</p>
  `);
}

function render(kind: Kind, p: Payload, opts: { proofAttached?: boolean } = {}): { subject: string; html: string } {
  const ref = p.order?.orderRef ?? "";
  // Avoid the double-space / dangling em-dash when orderRef is missing
  // (e.g. an admin retry where the payload lost the ref).
  const refTail = ref ? ` — ${ref}` : "";
  switch (kind) {
    case "customer_confirmation":
      return { subject: `🍱 Order confirmed${refTail} · Momma Mia Caters`, html: renderCustomerConfirmation(p) };
    case "customer_receipt":
      return { subject: ref ? `✅ Delivered — your receipt for ${ref}` : `✅ Delivered — your receipt`, html: renderCustomerReceipt(p) };
    case "store_alert":
    default:
      return { subject: `🧾 New order${refTail} — ${peso(p.order?.totalCents)}`, html: renderStoreAlert(p, opts.proofAttached ?? false) };
  }
}

// ---- payment-proof attachment (store alert only) --------------------------
interface Attachment { filename: string; content: string }  // content = base64

// Downloads the proof from the private bucket with the service role and returns
// a Resend attachment. Never throws — a proof we can't fetch must not stop the
// email (the body keeps the storage-path link as a fallback).
async function fetchProofAttachment(path: string): Promise<Attachment | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${PROOF_BUCKET}/${path}`, {
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!res.ok) {
      console.warn(`proof download ${res.status} for ${path}`);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ext = (path.split(".").pop() || "jpg").toLowerCase();
    return { filename: `payment-proof.${ext}`, content: encodeBase64(bytes) };
  } catch (e) {
    console.warn("proof download failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---- providers ------------------------------------------------------------
async function sendResend(to: string, subject: string, html: string, attachments?: Attachment[]) {
  const body: Record<string, unknown> = { from: FROM, to, subject, html };
  if (attachments?.length) body.attachments = attachments;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

// Constant-time string compare. The early length check leaks length (which is
// a fixed policy of the secret, not the attacker's input), but never the
// per-byte content. Stops the "hammer the endpoint and watch response timing
// to derive the secret one byte at a time" attack that `!==` enables when
// verify_jwt is off — see todo 011.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  // Fail CLOSED. With verify_jwt = false, this header is the only gate between
  // a public URL and our DKIM-signed domain. The previous `NOTIFY_SECRET &&`
  // pattern would let every request through whenever the env var was unset
  // (e.g. a misdeploy) — an open email relay. See todo 008.
  if (!NOTIFY_SECRET) {
    console.error("order-notify: ORDER_NOTIFY_SECRET not set — refusing all requests");
    return new Response("server misconfigured", { status: 503 });
  }
  const provided = req.headers.get("x-mm-auth-token") ?? "";
  if (!timingSafeEqual(provided, NOTIFY_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const kind: Kind = payload.kind ?? "store_alert";
  // Recipient: explicit `to`, else legacy `notificationEmail` (store_alert only).
  const to = (payload.to ?? payload.notificationEmail)?.trim();
  if (!to) return new Response(JSON.stringify({ skipped: "no recipient", kind }), { status: 200 });
  // Refuse malformed recipients (header-injection neutraliser + cheap sanity gate).
  // Return 200 so any future retry layer doesn't keep hammering us — the address
  // is bad, not the request. Logs surface it for triage.
  if (!EMAIL_RE.test(to)) {
    console.warn(`order-notify: bad recipient for ${kind}`);
    return new Response(JSON.stringify({ skipped: "bad recipient", kind }), { status: 200 });
  }

  // Attach the GCash payment proof to the STORE alert only (the customer uploaded
  // it — we never echo it back to them).
  let attachments: Attachment[] | undefined;
  const proofPath = payload.order?.paymentProofUrl;
  if (kind === "store_alert" && proofPath && RESEND_API_KEY) {
    const a = await fetchProofAttachment(proofPath);
    if (a) attachments = [a];
  }

  let { subject, html } = render(kind, payload, { proofAttached: !!attachments });
  // CRLF strip: order_ref flows into the subject and is client-supplied to
  // create_order without server-side validation. A crafted ref with newlines
  // could inject headers on any raw-MIME path. Cheap belt-and-braces.
  subject = subject.replace(/[\r\n]/g, " ").trim();

  try {
    if (RESEND_API_KEY) {
      await sendResend(to, subject, html, attachments);
    } else {
      // No provider configured (RESEND_API_KEY unset). Safe to deploy without
      // it — log and no-op so the trigger isn't hammered with errors.
      console.warn("order-notify: no email provider configured (set RESEND_API_KEY) — skipping send");
      return new Response(JSON.stringify({ skipped: "no provider", kind }), { status: 200 });
    }
  } catch (e) {
    // AT-MOST-ONCE: log + return 200 so any retry layer doesn't double-send
    // when the provider accepted-then-errored. We accept the rare dropped email
    // (monitor logs) over duplicate store/customer mails. See todo 010.
    console.error(`order-notify ${kind} send failed:`, e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ ok: false, kind, error: "send failed" }), { status: 200 });
  }

  // Note: do NOT echo `to` in the success body. The trigger only needs to know
  // the call succeeded; keeping PII out of pg_net's `net._http_response` log
  // (and any Edge Function access logs) is cheap defence-in-depth — todo 014.
  return new Response(JSON.stringify({ sent: true, kind }), { status: 200 });
});
