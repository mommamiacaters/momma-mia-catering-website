// Supabase Edge Function: paypal-capture-order
// -----------------------------------------------------------------------------
// Takes the money and marks the order paid. Called from onApprove in the
// browser, with `{ order_id, order_ref }` — never an amount, and never the
// PayPal order id either: that is read from the row this function looks up, so
// a caller cannot point our capture at some other PayPal order.
//
// What makes this safe rather than merely working:
//   * PayPal-Request-Id keyed on our order id, so a double-click or a retry
//     returns the first capture instead of charging twice.
//   * record_paypal_capture compares the captured amount against total_cents
//     and refuses anything else. We told PayPal the amount, but we verify what
//     comes back regardless.
//   * That same function is what the webhook calls, so both paths agree on what
//     "paid" means and only one of them can stamp notified_at.
//
// A capture that succeeds at PayPal but fails to record here is the one case
// worth losing sleep over. It returns 502 and the webhook cleans up: the money
// is real, the order exists, and PAYMENT.CAPTURE.COMPLETED arrives moments later
// carrying the same capture id.
//
// Deploy:  supabase functions deploy paypal-capture-order --project-ref fbzwicfvhrtyfqjounvo
// -----------------------------------------------------------------------------

import {
  CORS,
  amountToCents,
  getAccessToken,
  getOrder,
  json,
  paypalFetch,
  rpc,
} from "../_shared/paypal.ts";

interface CaptureResult {
  order_ref: string;
  status: "paid" | "failed";
  duplicate?: boolean;
  /** Set when status is 'failed': 'amount_mismatch' or PayPal's own status. */
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { order_id, order_ref } = await req.json().catch(() => ({}));
    if (typeof order_id !== "string" || typeof order_ref !== "string") {
      return json({ error: "order_id and order_ref are required" }, 400);
    }

    const order = await getOrder({ id: order_id });
    if (!order || order.order_ref !== order_ref) {
      return json({ error: "Order not found" }, 404);
    }

    // Already settled — the browser retried, or the webhook won the race.
    if (order.payment_status === "paid") {
      return json({ order_ref: order.order_ref, status: "paid", duplicate: true });
    }
    if (order.payment_status !== "awaiting_payment") {
      return json({ error: "This order is not awaiting payment" }, 409);
    }

    const paypalOrderId = order.paypal_order_id as string | null;
    if (!paypalOrderId) {
      return json({ error: "No PayPal payment was started for this order" }, 409);
    }

    const token = await getAccessToken();
    const { status, body } = await paypalFetch(
      token,
      `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      { method: "POST", requestId: `capture-${order_id}`, body: "{}" },
    );

    // 422 ORDER_ALREADY_CAPTURED means the money is in and something else got
    // there first. Not an error for the customer — fall through to the row.
    if (status === 422) {
      const issue = (body?.details as { issue?: string }[] | undefined)?.[0]?.issue;
      if (issue === "ORDER_ALREADY_CAPTURED") {
        const fresh = await getOrder({ id: order_id });
        if (fresh?.payment_status === "paid") {
          return json({ order_ref: fresh.order_ref, status: "paid", duplicate: true });
        }
      }
      console.error("PayPal capture rejected:", status, JSON.stringify(body));
      return json({ error: "PayPal declined the payment" }, 402);
    }

    if (status !== 200 && status !== 201) {
      console.error("PayPal capture failed:", status, JSON.stringify(body));
      return json({ error: "PayPal could not complete the payment" }, 502);
    }

    const pu = (body.purchase_units as Record<string, unknown>[] | undefined)?.[0];
    const capture = (
      (pu?.payments as Record<string, unknown> | undefined)?.captures as
        | Record<string, unknown>[]
        | undefined
    )?.[0];

    if (!capture?.id) {
      console.error("Capture response had no capture object:", JSON.stringify(body));
      return json({ error: "PayPal returned an unexpected response" }, 502);
    }

    const amt = capture.amount as { value: string; currency_code: string };

    let result: CaptureResult;
    try {
      result = await rpc<CaptureResult>("record_paypal_capture", {
        p_paypal_order_id: paypalOrderId,
        p_capture_id: capture.id,
        p_amount_cents: amountToCents(amt.value),
        p_currency: amt.currency_code,
        p_status: capture.status,
      });
    } catch (e) {
      // The money moved but the books did not. Say so plainly and loudly — the
      // webhook is the recovery path, and this line is what makes it findable.
      console.error(
        "PAID BUT NOT RECORDED — order_ref=%s paypal_order=%s capture=%s: %s",
        order_ref,
        paypalOrderId,
        capture.id,
        e instanceof Error ? e.message : e,
      );
      return json(
        {
          error:
            "Your payment went through, but we could not finish recording the order. " +
            "Please contact us with your reference and we will confirm it right away.",
          order_ref,
          paid: true,
        },
        502,
      );
    }

    if (result.status !== "paid") {
      // amount_mismatch means PayPal took money for an amount that is not this
      // order's total. The row is already marked failed; this line is how a
      // human finds it, because it needs a refund, not a retry.
      console.error(
        "CAPTURE REJECTED — order_ref=%s reason=%s detail=%s",
        order_ref,
        (result as unknown as { reason?: string }).reason ?? "unknown",
        JSON.stringify(result),
      );
      return json(
        {
          error:
            "PayPal reported a problem with this payment. If money left your " +
            "account, please contact us with your reference and we will refund " +
            "or confirm it right away.",
          order_ref,
        },
        402,
      );
    }
    return json(result);
  } catch (e) {
    console.error("paypal-capture-order error:", e instanceof Error ? e.message : e);
    return json({ error: "Could not complete the payment" }, 500);
  }
});
