import type { OrderSubmission } from "../types";
import { supabase } from "../lib/supabase";
import { PAYPAL_MODE, PAYPAL_SANDBOX_KEY } from "../lib/paypal";

/**
 * Map a raw create_order error to customer copy. The patterns are taken
 * verbatim from that function's `raise` statements — don't copy them from
 * another mapper without re-checking against the SQL. (`/qty/i` does NOT match
 * "Invalid quantity", which is how the mobile mapper shipped two dead branches.)
 *
 * The reassurance line differs by payment path. On the PayPal path these fire
 * BEFORE any money moves, so "nothing has been charged" is a plain fact. On the
 * QR path the customer may already have transferred money in their bank app
 * before submitting, so the copy must say the payment has not been applied and
 * point them at us — never imply their transfer vanished.
 */
export function mapOrderError(
  msg: string,
  opts: { mayHavePaid?: boolean } = {},
): string {
  const notCharged = opts.mayHavePaid
    ? "Your order was NOT placed. If you already sent a payment it has not been applied — please contact us and we'll sort it out."
    : "Nothing has been charged — please adjust your order and try again.";
  const min = msg.match(/minimum (\d+) lunch boxes/i);
  if (min) {
    return `Orders need at least ${min[1]} lunch boxes. ${notCharged}`;
  }
  const dishMin = msg.match(/minimum (\d+) of dish "(.+?)" per order; this order has (\d+)/i);
  if (dishMin) {
    return `"${dishMin[2]}" needs at least ${dishMin[1]} servings per order — your order has ${dishMin[3]}. ${notCharged}`;
  }
  if (/not part of any lunch box/i.test(msg) || /duplicate lunch box/i.test(msg)) {
    return "Something's off with your cart. Please rebuild your order and try again.";
  }
  if (/invalid quantity/i.test(msg)) {
    return "One of the quantities in your order is invalid. Please review your cart and try again.";
  }
  if (/must contain at least one item/i.test(msg)) {
    return "Your cart is empty.";
  }
  if (/(item|meal plan) not available/i.test(msg)) {
    return "One of your items just sold out or was removed. Please refresh and try again.";
  }
  if (/unknown (menu item|meal plan)/i.test(msg)) {
    return "An item in your cart is no longer on the menu. Please refresh.";
  }
  if (/has no online price/i.test(msg)) {
    return "One of your items can't be ordered online. Please remove it or contact us.";
  }
  // Constraint violations reach us as raw Postgres text — never render that.
  if (/orders_order_ref_format/i.test(msg)) {
    return "We couldn't generate a valid order reference. Please refresh and try again — nothing was charged.";
  }
  return opts.mayHavePaid
    ? "Something went wrong and your order was not placed. If you already sent a payment it has not been applied — please contact us."
    : "Something went wrong and your order was not placed. Nothing was charged — please try again or contact us.";
}

/** What create_order gives back once the cart has been priced server-side. */
export interface PendingOrder {
  orderId: string;
  orderRef: string;
  /** The authoritative total, in centavos. PayPal is billed this, not the cart. */
  totalCents: number;
}

/** Shape of one line create_order accepts. */
type OrderLine = {
  meal_plan_id?: number;
  menu_item_id?: string;
  qty: number;
  plan_instance_id?: string;
  plan_type?: string;
};

/**
 * Turn the cart into create_order's line format.
 *
 * Each box sends a PLAN line (which carries the price) followed by its chosen
 * dishes as components. create_order prices the components from the plan's own
 * pricing_mode, so the client never sends money.
 */
function toOrderLines(order: OrderSubmission["order"]): OrderLine[] {
  return order.planInstances?.length
    ? order.planInstances.flatMap((plan) => [
        { meal_plan_id: plan.mealPlanId, qty: 1, plan_instance_id: plan.id },
        ...plan.items.map((it) => ({
          menu_item_id: it.menuItemId,
          qty: 1,
          plan_instance_id: plan.id,
          plan_type: plan.type,
        })),
      ])
    : order.items.map((it) => ({ menu_item_id: it.menuItemId, qty: 1 }));
}

/**
 * Create the order server-side, priced and validated, but NOT yet paid.
 *
 * create_order looks up prices from the catalogue, recomputes the total, forces
 * client_id = auth.uid(), and inserts the order + items atomically — the client
 * never sends prices, totals or client_id. Passing 'paypal' puts the row in
 * `awaiting_payment` and holds the confirmation emails back: an abandoned
 * checkout emails nobody, and the kitchen only hears about orders that are paid.
 *
 * Every validation failure (minimums, sold-out dishes, bad quantities) happens
 * HERE, before the customer is sent to PayPal. That ordering is the point: the
 * old flow could reject an order the customer had already paid for by QR.
 */
export async function createPendingOrder(
  data: OrderSubmission,
): Promise<PendingOrder> {
  const { customer, order, orderRef } = data;

  const { data: result, error } = await supabase.rpc("create_order", {
    p_items: toOrderLines(order) as unknown as never,
    p_customer: {
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      delivery_address: customer.deliveryAddress || null,
      delivery_date: customer.deliveryDate || null,
      delivery_time: customer.deliveryTime || null,
      special_requests: customer.specialRequests || null,
      order_type: "delivery",
    },
    p_order_ref: orderRef,
    p_payment_provider: "paypal",
  } as never);

  if (error) {
    // Keep the raw Postgres text for the console; never render it.
    console.error("create_order failed:", error.message);
    throw new Error(mapOrderError(error.message));
  }

  const row = result as unknown as {
    order_id: string;
    order_ref: string;
    total_cents: number;
  } | null;

  if (!row?.order_id) {
    throw new Error(mapOrderError(""));
  }

  return {
    orderId: row.order_id,
    orderRef: row.order_ref,
    totalCents: row.total_cents,
  };
}

/**
 * Call one of the PayPal Edge Functions with the anon key. In sandbox mode
 * (local dev only) the -sandbox slugs are used, unlocked by the test key —
 * the live slugs and the sandbox slugs are the same handler code with the
 * PayPal environment fixed server-side.
 */
async function callPayPalFn<T>(
  fn: "paypal-create-order" | "paypal-capture-order",
  body: Record<string, unknown>,
): Promise<T> {
  const slug = PAYPAL_MODE === "sandbox" ? `${fn}-sandbox` : fn;
  const { data, error } = await supabase.functions.invoke<T>(slug, {
    body,
    headers:
      PAYPAL_MODE === "sandbox" ? { "x-sandbox-key": PAYPAL_SANDBOX_KEY } : undefined,
  });

  if (error) {
    // FunctionsHttpError carries the response; the body holds our own message,
    // which is written for customers. Surface it rather than a generic string.
    let detail: string | null = null;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const parsed = (await ctx.json()) as { error?: string };
        if (parsed?.error) detail = parsed.error;
      } catch {
        /* non-JSON body — fall through to the generic message */
      }
    }
    console.error(`${slug} failed:`, error.message, detail);
    throw new Error(detail ?? "We couldn't reach PayPal. Please try again.");
  }
  if (!data) throw new Error("PayPal returned an empty response. Please try again.");
  return data;
}

/**
 * Open a PayPal order for an order we already created, and return its id for
 * the SDK's `createOrder` callback.
 *
 * Note what is NOT sent: an amount. The Edge Function reads total_cents from
 * the order row, so the price the buyer is shown in the PayPal window is the
 * one the database computed.
 */
export async function startPayPalPayment(pending: PendingOrder): Promise<string> {
  const res = await callPayPalFn<{ paypal_order_id: string }>("paypal-create-order", {
    order_id: pending.orderId,
    order_ref: pending.orderRef,
  });
  return res.paypal_order_id;
}

/**
 * Capture an approved payment and mark the order paid. The Edge Function
 * verifies the captured amount against the stored total before it commits,
 * and stamping the order paid is what releases the confirmation emails.
 */
export async function capturePayPalPayment(
  pending: PendingOrder,
): Promise<{ orderRef: string }> {
  const res = await callPayPalFn<{ order_ref: string; status: string }>(
    "paypal-capture-order",
    { order_id: pending.orderId, order_ref: pending.orderRef },
  );
  return { orderRef: res.order_ref };
}


// ─── QR / receipt-upload path (GCash, Maya, bank transfer via InstaPay QR) ───

/** Mirrors create_order's allow-list — anything else is refused server-side. */
const PROOF_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

/** Convert a `data:` URI (payment proof screenshot) into a Blob for upload. */
function dataUriToBlob(dataUri: string): { blob: Blob; mime: string } {
  const [meta, b64] = dataUri.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] || "application/octet-stream";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return { blob: new Blob([arr], { type: mime }), mime };
}

/**
 * Submit a QR-paid order: the customer has (says they have) already transferred
 * the money in their own bank app and uploads the receipt as evidence. No
 * p_payment_provider is sent, so create_order records `manual_proof` and the
 * confirmation emails fire immediately — the admin then verifies the receipt by
 * eye, exactly as before PayPal existed. This is the same trust model as the
 * old flow, deliberately unchanged; PayPal is the verified alternative.
 *
 * The proof upload still happens AFTER the order commits, to the key the server
 * reserved — a rejected order therefore never orphans a blob (todo 017).
 */
export async function submitOrder(data: OrderSubmission): Promise<void> {
  const { customer, order, orderRef, paymentProof } = data;

  // 1) PARSE the proof — but do not upload yet. dataUriToBlob stays inside the
  //    try: a malformed data URI would throw in atob and abort the submission.
  //    The proof is best-effort metadata, not the system of record — degrade to
  //    "no proof" rather than failing checkout.
  let proof: { blob: Blob; mime: string; ext: string } | null = null;
  if (paymentProof?.base64) {
    try {
      const { blob, mime } = dataUriToBlob(paymentProof.base64);
      const raw = (
        paymentProof.fileName?.split(".").pop() ||
        mime.split("/")[1] ||
        "jpg"
      ).toLowerCase();
      // Must match create_order's allow-list. An extension it rejects would now
      // fail the whole ORDER, so anything unfamiliar drops the proof instead —
      // preserving "a bad proof never costs you the order".
      const ext = PROOF_EXTS.includes(raw) ? raw : raw === "jfif" ? "jpg" : null;
      if (ext) proof = { blob, mime, ext };
      else console.error("Unsupported payment proof type, sending order without it:", raw);
    } catch (e) {
      console.error("Payment proof parse failed:", e instanceof Error ? e.message : e);
    }
  }

  // 2) Create the order server-side. No provider argument: this is the legacy
  //    manual_proof path and the emails fire on creation.
  const { data: result, error } = await supabase.rpc("create_order", {
    p_items: toOrderLines(order) as unknown as never,
    p_customer: {
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      delivery_address: customer.deliveryAddress || null,
      delivery_date: customer.deliveryDate || null,
      delivery_time: customer.deliveryTime || null,
      special_requests: customer.specialRequests || null,
      order_type: "delivery",
    },
    p_order_ref: orderRef,
    // The server mints the storage key from this and returns it.
    p_proof_ext: proof?.ext ?? undefined,
  });
  if (error) {
    // Keep the raw Postgres text for the console; never render it. The customer
    // may already have paid in their bank app, so the mapped copy says so.
    console.error("create_order failed:", error.message);
    throw new Error(mapOrderError(error.message, { mayHavePaid: true }));
  }

  // 3) Upload to the key the server reserved. Still non-fatal: the order is
  //    already committed and the store alert says plainly when no proof is on
  //    file, so a failure here costs a follow-up, not the order.
  const proofPath = (result as { payment_proof_path?: string } | null)
    ?.payment_proof_path;
  if (proof && proofPath) {
    const { error: upErr } = await supabase.storage
      .from("payment-proofs")
      .upload(proofPath, proof.blob, {
        contentType: proof.mime,
        upsert: false,
      });
    if (upErr) console.error("Payment proof upload failed:", upErr.message);
  }
  // No client-side notify call — emails are sent server-side via the
  // order-notify trigger, which manual_proof orders hit at creation.
}
