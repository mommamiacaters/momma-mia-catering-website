// Shared checkout handlers for the PayPal Edge Functions.
// -----------------------------------------------------------------------------
// ONE implementation serves four slugs: paypal-create-order / -capture-order
// (live) and their -sandbox twins. The mode is fixed per slug at deploy time,
// never read from the request — a request-chosen "sandbox" against the live
// site would let anyone mark a real order paid with sandbox play-money.
//
// The sandbox slugs carry a second lock: the x-sandbox-key header must match
// the PAYPAL_SANDBOX_TEST_KEY secret. The key lives only in the developer's
// local .env (never the committed workflow), so the public site cannot reach
// the sandbox path at all.
// -----------------------------------------------------------------------------

import {
  CORS,
  CURRENCY,
  amountToCents,
  centsToAmount,
  getAccessToken,
  getOrder,
  getPayPalConfig,
  json,
  paypalFetch,
  rpc,
  type PayPalMode,
} from "./paypal.ts";

const BRAND_NAME = "Momma Mia Catering";

interface CaptureResult {
  order_ref: string;
  status: "paid" | "failed";
  duplicate?: boolean;
  /** Set when status is 'failed': 'amount_mismatch' or PayPal's own status. */
  reason?: string;
}

/** null = allowed; a Response = the refusal to return. */
function sandboxGate(mode: PayPalMode, req: Request): Response | null {
  if (mode !== "sandbox") return null;
  // Preflights never carry custom headers — refusing OPTIONS here would make
  // the browser block the real request before the key was ever sent.
  if (req.method === "OPTIONS") return null;
  const expected = Deno.env.get("PAYPAL_SANDBOX_TEST_KEY") ?? "";
  if (!expected || req.headers.get("x-sandbox-key") !== expected) {
    return json({ error: "Not available" }, 404);
  }
  return null;
}

export function createOrderHandler(mode: PayPalMode) {
  const cfg = getPayPalConfig(mode);
  return async (req: Request): Promise<Response> => {
    const refusal = sandboxGate(mode, req);
    if (refusal) return refusal;

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { order_id, order_ref } = await req.json().catch(() => ({}));
    if (typeof order_id !== "string" || typeof order_ref !== "string") {
      return json({ error: "order_id and order_ref are required" }, 400);
    }

    const order = await getOrder({ id: order_id });
    // One message for "no such order" and "wrong ref" so this cannot be used to
    // probe which order ids exist.
    if (!order || order.order_ref !== order_ref) {
      return json({ error: "Order not found" }, 404);
    }
    if (order.payment_status !== "awaiting_payment") {
      return json({ error: "This order is not awaiting payment" }, 409);
    }

    const totalCents = Number(order.total_cents);
    if (!Number.isInteger(totalCents) || totalCents <= 0) {
      console.error("Refusing to bill a non-positive total", order_ref, order.total_cents);
      return json({ error: "This order has no payable total" }, 409);
    }

    const token = await getAccessToken(cfg);
    const { status, body } = await paypalFetch(cfg, token, "/v2/checkout/orders", {
      method: "POST",
      // Same cart re-opened returns the same PayPal order instead of a second one.
      requestId: `create-${order_id}`,
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            // Both are echoed back on the capture and the webhook, which is how
            // a payment is traced to an order in the PayPal dashboard.
            invoice_id: order.order_ref,
            custom_id: order_id,
            description: `${BRAND_NAME} order ${order.order_ref}`.slice(0, 127),
            amount: { currency_code: CURRENCY, value: centsToAmount(totalCents) },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: BRAND_NAME,
              shipping_preference: "NO_SHIPPING",
              // The buyer confirms the amount on our page, not PayPal's.
              user_action: "PAY_NOW",
            },
          },
        },
      }),
    });

    if (status !== 200 && status !== 201) {
      console.error("PayPal create order failed:", status, JSON.stringify(body));
      return json({ error: "Could not start the PayPal payment" }, 502);
    }

    const paypalOrderId = body.id as string;

    // Store it BEFORE the buyer is handed to PayPal. If the browser dies during
    // approval, the webhook still has a way back to this order.
    await rpc("attach_paypal_order", {
      p_order_id: order_id,
      p_paypal_order_id: paypalOrderId,
    });

    return json({ paypal_order_id: paypalOrderId });
  } catch (e) {
    console.error("paypal-create-order error:", e instanceof Error ? e.message : e);
    return json({ error: "Could not start the PayPal payment" }, 500);
  }
  };
}

export function captureOrderHandler(mode: PayPalMode) {
  const cfg = getPayPalConfig(mode);
  return async (req: Request): Promise<Response> => {
    const refusal = sandboxGate(mode, req);
    if (refusal) return refusal;

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

    const token = await getAccessToken(cfg);
    const { status, body } = await paypalFetch(
      cfg,
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
  };
}
