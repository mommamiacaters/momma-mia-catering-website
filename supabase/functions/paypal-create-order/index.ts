// Supabase Edge Function: paypal-create-order
// -----------------------------------------------------------------------------
// Opens a PayPal order for one of ours, and returns only its id.
//
// The request body is `{ order_id, order_ref }` and nothing else. In particular
// it does NOT carry an amount: the amount is read from orders.total_cents, which
// create_order computed from the catalogue. This is the whole reason this runs
// on a server. A browser that posts its own total gets the catalogue price
// anyway.
//
// order_ref is required alongside the id and must match. The id is already an
// unguessable uuid; requiring both means a leaked id on its own is not enough to
// poke at someone else's checkout.
//
// Auth: public (verify_jwt = false) — guest checkout has no session. The
// function only ever acts on an order that is already awaiting payment, and can
// only ask PayPal for the amount that order costs, so an anonymous caller
// gains nothing.
//
// Deploy:  supabase functions deploy paypal-create-order --project-ref fbzwicfvhrtyfqjounvo
// Secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV
// -----------------------------------------------------------------------------

import {
  CORS,
  CURRENCY,
  centsToAmount,
  getAccessToken,
  getOrder,
  json,
  paypalFetch,
  rpc,
} from "../_shared/paypal.ts";

const BRAND_NAME = "Momma Mia Catering";

Deno.serve(async (req) => {
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

    const token = await getAccessToken();
    const { status, body } = await paypalFetch(token, "/v2/checkout/orders", {
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
});
