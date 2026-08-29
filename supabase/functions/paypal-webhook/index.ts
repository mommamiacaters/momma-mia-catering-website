// Supabase Edge Function: paypal-webhook
// -----------------------------------------------------------------------------
// The safety net. paypal-capture-order handles the happy path; this handles
// everything the browser is not around for:
//   * buyer approves, then closes the tab before onApprove fires
//   * the capture succeeds at PayPal but our recording call fails
//   * a refund or a chargeback happens later, in the PayPal dashboard
//
// Every event is signature-verified against PAYPAL_WEBHOOK_ID before it is
// believed. Without that this endpoint is an unauthenticated "mark my order
// paid" button, since it is necessarily public.
//
// It records through the same record_paypal_capture function the capture
// endpoint uses, so the two cannot disagree and only one of them can stamp
// notified_at (the customer gets one email, not two).
//
// Deploy:  supabase functions deploy paypal-webhook --project-ref fbzwicfvhrtyfqjounvo
// Secrets: PAYPAL_WEBHOOK_ID (from the webhook you register in the dashboard)
// Subscribe to: PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED,
//               PAYMENT.CAPTURE.REFUNDED, PAYMENT.CAPTURE.REVERSED
// -----------------------------------------------------------------------------

import {
  CORS,
  amountToCents,
  getAccessToken,
  getPayPalConfig,
  json,
  paypalFetch,
  rpc,
} from "../_shared/paypal.ts";

// Webhooks are only registered for the LIVE app; sandbox testing goes through
// the capture endpoint alone.
const cfg = getPayPalConfig("live");

const WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID") ?? "";

/** PayPal signs with these; a missing one means the request is not from PayPal. */
const SIG_HEADERS = [
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-id",
  "paypal-transmission-sig",
  "paypal-transmission-time",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!WEBHOOK_ID) {
      console.error("PAYPAL_WEBHOOK_ID is not set — refusing to trust any event");
      return json({ error: "Webhook not configured" }, 500);
    }

    // The raw text matters: verification hashes the body exactly as sent, so it
    // must not be round-tripped through JSON.parse/stringify first.
    const raw = await req.text();

    const headers: Record<string, string> = {};
    for (const h of SIG_HEADERS) {
      const v = req.headers.get(h);
      if (!v) {
        console.error("Webhook missing signature header:", h);
        return json({ error: "Unsigned request" }, 400);
      }
      headers[h] = v;
    }

    const token = await getAccessToken(cfg);
    const { status, body: verdict } = await paypalFetch(
      cfg,
      token,
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          auth_algo: headers["paypal-auth-algo"],
          cert_url: headers["paypal-cert-url"],
          transmission_id: headers["paypal-transmission-id"],
          transmission_sig: headers["paypal-transmission-sig"],
          transmission_time: headers["paypal-transmission-time"],
          webhook_id: WEBHOOK_ID,
          // Must be the parsed object, but built from the untouched raw text.
          webhook_event: JSON.parse(raw),
        }),
      },
    );

    if (status !== 200 || verdict.verification_status !== "SUCCESS") {
      console.error("Webhook signature rejected:", status, JSON.stringify(verdict));
      return json({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(raw) as {
      event_type?: string;
      resource?: Record<string, unknown>;
    };
    const type = event.event_type ?? "";
    const resource = event.resource ?? {};

    // supplementary_data.related_ids.order_id is the PayPal ORDER id; the
    // resource id is the CAPTURE id. We key on the order id because that is
    // what we stored before sending the buyer over.
    const related = (
      (resource.supplementary_data as Record<string, unknown> | undefined)
        ?.related_ids as Record<string, unknown> | undefined
    ) ?? {};
    const paypalOrderId = related.order_id as string | undefined;
    const captureId = resource.id as string | undefined;
    const amount = resource.amount as { value?: string; currency_code?: string } | undefined;

    if (!paypalOrderId || !captureId || !amount?.value) {
      // Acknowledge anyway: retrying an event we structurally cannot use just
      // makes PayPal retry it for days.
      console.warn("Webhook event not actionable:", type, JSON.stringify(event).slice(0, 500));
      return json({ ok: true, ignored: type });
    }

    // Map the event to the capture status record_paypal_capture expects.
    const statusForRecord =
      type === "PAYMENT.CAPTURE.COMPLETED"
        ? "COMPLETED"
        : type === "PAYMENT.CAPTURE.DENIED"
          ? "DECLINED"
          : type === "PAYMENT.CAPTURE.REFUNDED" || type === "PAYMENT.CAPTURE.REVERSED"
            ? "REFUNDED"
            : null;

    if (!statusForRecord) {
      return json({ ok: true, ignored: type });
    }

    try {
      const result = await rpc<{ status?: string; reason?: string }>("record_paypal_capture", {
        p_paypal_order_id: paypalOrderId,
        p_capture_id: captureId,
        p_amount_cents: amountToCents(amount.value),
        p_currency: amount.currency_code ?? "",
        p_status: statusForRecord,
      });
      if (result?.status === "failed") {
        // Captured money we did not ask for, or a declined capture. Either way
        // the order is marked failed and a person has to deal with it.
        console.error("WEBHOOK RECORDED A FAILURE:", type, JSON.stringify(result));
      } else {
        console.log("Webhook recorded:", type, JSON.stringify(result));
      }
    } catch (e) {
      // A mismatch raises in the SQL function. Log it and still return 200 —
      // the order is already marked failed, and a retry would only repeat the
      // same rejection. This needs a human, not another delivery attempt.
      console.error(
        "Webhook could not record %s for paypal_order=%s: %s",
        type,
        paypalOrderId,
        e instanceof Error ? e.message : e,
      );
    }

    return json({ ok: true });
  } catch (e) {
    console.error("paypal-webhook error:", e instanceof Error ? e.message : e);
    // 500 asks PayPal to retry, which is right for an unexpected failure.
    return json({ error: "Webhook processing failed" }, 500);
  }
});
