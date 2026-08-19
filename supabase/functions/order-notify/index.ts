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

type Kind =
  | "store_alert"
  | "customer_confirmation"
  | "customer_receipt"
  | "contact_message"   // contact-form submission → owner inbox
  | "quote_lead";       // chatbot quote lead → owner inbox

interface Item {
  item_name: string;
  qty: number;
  unit_price_cents: number;
  plan_type: string | null;
  /** Set only on the priced plan line; null on the dishes filling it. */
  meal_plan_id?: number | null;
  /** Groups a plan line with the dishes in that box. */
  plan_instance_id?: string | null;
}
interface ContactInfo {
  firstName?: string; lastName?: string; email?: string;
  topic?: string | null; message?: string; createdAt?: string;
}
interface QuoteInfo {
  name?: string; email?: string; eventType?: string | null; pax?: string | null;
  eventDate?: string | null; orderRequest?: string | null;
  leadScore?: number; leadLevel?: string | null; leadPriority?: string | null;
  intents?: string[]; createdAt?: string;
}
interface Payload {
  kind?: Kind;
  to?: string;                  // explicit recipient
  notificationEmail?: string;   // legacy alias ⇒ store_alert recipient
  replyTo?: string;             // set Reply-To (e.g. the customer) on owner-facing mail
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
  contact?: ContactInfo;
  quote?: QuoteInfo;
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

// A lunch-box order is a priced PLAN line plus the dishes that fill it, and a
// real order is mostly IDENTICAL boxes — so the email groups them the way the
// site's Overview does: one line per distinct build ("15× Standard Bento"),
// its per-box dishes once underneath, and a muted per-box price. Grouping is
// by id (meal_plan_id / plan_instance_id), never by name: under `range`
// pricing the plan line is ₱0 and the dishes carry the money, so price can't
// identify a row. The signature includes every component's name AND unit
// price, so builds that differ in any way never collapse together.
function itemRows(items: Item[]): string {
  const line = (label: string, price: string, sub = false) =>
    `<tr><td style="padding:${sub ? "2px 0 2px 20px" : "6px 0 2px"}${sub ? `;color:${MUTE};font-size:13px` : ""}">${label}</td>` +
    `<td style="text-align:right;white-space:nowrap${sub ? `;color:${MUTE};font-size:13px` : ""}">${price}</td></tr>`;

  // Boxes that actually have a plan line. Older orders stored the dishes with a
  // plan_instance_id but no plan row — those must still render on their own,
  // or the email would silently drop every item.
  const planned = new Set(
    items.filter((i) => i.meal_plan_id != null && i.plan_instance_id).map((i) => i.plan_instance_id),
  );

  const isComponent = (i: Item) =>
    i.meal_plan_id == null && !!i.plan_instance_id && planned.has(i.plan_instance_id);

  // Group the components by box ONCE, then CONSUME each group as it's emitted.
  // Two plan lines sharing a plan_instance_id (possible pre-create_order-v5)
  // must not each count that box's dishes, or the visible lines would sum to
  // more than the Total.
  const pending = new Map<string, Item[]>();
  for (const i of items) {
    if (!isComponent(i)) continue;
    const id = i.plan_instance_id as string;
    const list = pending.get(id) ?? [];
    list.push(i);
    pending.set(id, list);
  }

  interface Build {
    label: string;
    boxes: number;
    totalCents: number;
    comps: Array<{ name: string; qty: number }>;
  }
  const builds = new Map<string, Build>();
  const emitOrder: Array<{ kind: "build"; key: string } | { kind: "row"; html: string }> = [];

  for (const i of items) {
    if (isComponent(i)) continue;

    const qty = i.qty ?? 1;
    const ownTotal = (i.unit_price_cents ?? 0) * (i.qty ?? 0);

    // Not a plan-backed box (à la carte line, or a legacy orphan dish whose
    // box has no plan row) — render it exactly as before, in place.
    if (i.meal_plan_id == null || !i.plan_instance_id) {
      const suffix = i.plan_type
        ? ` <span style="color:${MUTE}">(${esc(i.plan_type)})</span>`
        : "";
      emitOrder.push({
        kind: "row",
        html: line(`${qty}× ${esc(i.item_name)}${suffix}`, ownTotal > 0 ? peso(ownTotal) : ""),
      });
      continue;
    }

    // Aggregate this box's dishes to one entry per distinct dish, keeping
    // first-seen order (main → side → rice → dessert as the cart stored them).
    const comps = pending.get(i.plan_instance_id) ?? [];
    pending.delete(i.plan_instance_id); // consumed — never count this box twice
    const compAgg = new Map<string, { name: string; qty: number; cents: number }>();
    for (const c of comps) {
      const k = `${c.item_name}|${c.unit_price_cents ?? 0}`;
      const entry = compAgg.get(k) ?? { name: c.item_name, qty: 0, cents: 0 };
      entry.qty += c.qty ?? 1;
      entry.cents += (c.unit_price_cents ?? 0) * (c.qty ?? 0);
      compAgg.set(k, entry);
    }
    const boxTotal = ownTotal + [...compAgg.values()].reduce((a, c) => a + c.cents, 0);

    const sig = [
      i.meal_plan_id,
      i.item_name,
      i.unit_price_cents ?? 0,
      ...[...compAgg.keys()].sort().map((k) => `${k}|${compAgg.get(k)!.qty}`),
    ].join("~");

    const existing = builds.get(sig);
    if (existing) {
      existing.boxes += qty;
      existing.totalCents += boxTotal;
    } else {
      builds.set(sig, {
        label: i.item_name,
        boxes: qty,
        totalCents: boxTotal,
        comps: [...compAgg.values()].map(({ name, qty: q }) => ({ name, qty: q })),
      });
      emitOrder.push({ kind: "build", key: sig });
    }
  }

  const out: string[] = [];
  for (const e of emitOrder) {
    if (e.kind === "row") {
      out.push(e.html);
      continue;
    }
    const b = builds.get(e.key)!;
    out.push(line(`${b.boxes}× ${esc(b.label)}`, b.totalCents > 0 ? peso(b.totalCents) : ""));
    for (const c of b.comps) {
      out.push(line(`${c.qty > 1 ? `${c.qty}× ` : ""}${esc(c.name)}`, "", true));
    }
    // Identical builds by construction, so per-box price divides evenly.
    if (b.boxes > 1 && b.totalCents > 0) {
      out.push(line(`<em>${peso(b.totalCents / b.boxes)} per box</em>`, "", true));
    }
  }
  return out.join("");
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

// Owner-facing label/value table (used by the contact + quote lead emails).
function kvTable(rows: Array<[string, string]>): string {
  return `<table style="width:100%;border-collapse:collapse">${rows
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:${MUTE};vertical-align:top;width:130px">${esc(k)}</td><td style="padding:6px 0">${v}</td></tr>`)
    .join("")}</table>`;
}

// Contact-form submission → store inbox. Reply-To is the sender so the owner can
// just hit reply. (Replaces the old n8n "Contact Form - Send Email" workflow.)
function renderContactMessage(p: Payload): string {
  const c = p.contact ?? {};
  const name = [c.firstName, c.lastName].filter(Boolean).map((s) => esc(s)).join(" ");
  return shell(`
    <h2 style="color:${BRAND};margin:0 0 4px">New contact message</h2>
    <p style="margin:0 0 16px;color:${MUTE}">${esc(c.createdAt)}</p>
    ${kvTable([
      ["Name", name],
      ["Email", c.email ? `<a href="mailto:${esc(c.email)}" style="color:${BRAND}">${esc(c.email)}</a>` : ""],
      ["Topic", esc(c.topic)],
    ])}
    <h3 style="margin:20px 0 6px">Message</h3>
    <p style="margin:0;line-height:1.6;white-space:pre-wrap">${esc(c.message)}</p>
  `);
}

// Chatbot quote lead → store inbox. (Replaces the old n8n Google-Sheets + email
// step; the lead is also persisted to public.quote_requests.)
function renderQuoteLead(p: Payload): string {
  const q = p.quote ?? {};
  const lvl = (q.leadLevel ?? "").toLowerCase();
  const badgeColor = lvl === "hot" ? "#C2410C" : lvl === "warm" ? BRAND : MUTE;
  const badge = q.leadLevel
    ? `<span style="display:inline-block;background:${badgeColor};color:#fff;border-radius:999px;padding:2px 10px;font-size:12px;text-transform:uppercase">${esc(q.leadLevel)}${q.leadScore != null ? ` · ${q.leadScore}` : ""}</span>`
    : "";
  return shell(`
    <h2 style="color:${BRAND};margin:0 0 4px">New quote request 💰</h2>
    <p style="margin:0 0 16px;color:${MUTE}">${esc(q.createdAt)} ${badge}</p>
    ${kvTable([
      ["Name", esc(q.name)],
      ["Email", q.email ? `<a href="mailto:${esc(q.email)}" style="color:${BRAND}">${esc(q.email)}</a>` : ""],
      ["Event type", esc(q.eventType)],
      ["Guests (pax)", esc(q.pax)],
      ["Date / time", esc(q.eventDate)],
      ["Intents", esc((q.intents ?? []).join(", "))],
    ])}
    <h3 style="margin:20px 0 6px">Request / preferences</h3>
    <p style="margin:0;line-height:1.6;white-space:pre-wrap">${esc(q.orderRequest)}</p>
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
    case "contact_message": {
      const who = [p.contact?.firstName, p.contact?.lastName].filter(Boolean).join(" ");
      const topic = p.contact?.topic ? `${p.contact.topic}` : "message";
      return { subject: `📨 New contact: ${topic}${who ? ` — ${who}` : ""}`, html: renderContactMessage(p) };
    }
    case "quote_lead": {
      const who = p.quote?.name ? ` from ${p.quote.name}` : "";
      const ev = p.quote?.eventType ? ` — ${p.quote.eventType}` : "";
      return { subject: `💰 New quote request${who}${ev}`, html: renderQuoteLead(p) };
    }
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
async function sendResend(to: string, subject: string, html: string, attachments?: Attachment[], replyTo?: string) {
  const body: Record<string, unknown> = { from: FROM, to, subject, html };
  if (attachments?.length) body.attachments = attachments;
  // Reply-To lets the owner reply straight to the customer on contact/quote mail.
  if (replyTo && EMAIL_RE.test(replyTo)) body.reply_to = replyTo;
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
    // Retry briefly. Since create_order v6 the SERVER reserves the storage key
    // and the client uploads to it just AFTER the order commits — while this
    // alert is already on its way. The bytes usually land within a second, so a
    // couple of short retries turn a race into a non-event. If they still
    // aren't there we send anyway: renderStoreAlert prints the path instead,
    // and the order must never wait on an attachment.
    for (let attempt = 0; attempt < 3 && !attachments; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
      const a = await fetchProofAttachment(proofPath);
      if (a) attachments = [a];
    }
    if (!attachments) {
      console.warn(`order-notify: proof ${proofPath} not readable after 3 tries — sending without it`);
    }
  }

  let { subject, html } = render(kind, payload, { proofAttached: !!attachments });
  // CRLF strip: order_ref flows into the subject and is client-supplied to
  // create_order without server-side validation. A crafted ref with newlines
  // could inject headers on any raw-MIME path. Cheap belt-and-braces.
  subject = subject.replace(/[\r\n]/g, " ").trim();

  try {
    if (RESEND_API_KEY) {
      await sendResend(to, subject, html, attachments, payload.replyTo);
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
