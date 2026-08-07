import type { OrderSubmission } from "../types";
import { supabase } from "../lib/supabase";

/** Mirrors create_order's allow-list — anything else is refused server-side. */
const PROOF_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

/**
 * Map a raw create_order error to customer copy. The patterns are taken
 * verbatim from that function's `raise` statements — don't copy them from
 * another mapper without re-checking against the SQL. (`/qty/i` does NOT match
 * "Invalid quantity", which is how the mobile mapper shipped two dead branches.)
 *
 * The minimum message is worded for the moment it can actually appear: after
 * the customer has already seen the payment QR. It must say plainly that no
 * order exists and nothing was charged here.
 */
export function mapOrderError(msg: string): string {
  const min = msg.match(/minimum (\d+) lunch boxes/i);
  if (min) {
    return `Orders need at least ${min[1]} lunch boxes. Your order was NOT placed and nothing was charged by this site. If you already sent a payment it has not been applied — please contact us and we'll sort it out.`;
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
  return "Something went wrong and your order was not placed. Nothing was charged — please try again or contact us.";
}

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
 * Submit an order. Supabase is the system of record. The store + customer
 * emails are sent server-side: an AFTER-UPDATE trigger on `orders` (keyed off
 * the `notified_at` stamp written by create_order's finalize) calls the
 * order-notify Edge Function via pg_net. The client makes no notification
 * call — web and mobile share the same single send path.
 */
export async function submitOrder(data: OrderSubmission): Promise<void> {
  const { customer, order, orderRef, paymentProof } = data;

  // 1) PARSE the proof — but do not upload yet.
  //
  // The upload used to happen here, before create_order. Every raise in that
  // function then rolled the order back and left the blob in the private bucket
  // with nothing referencing it (todo 017). Now the server reserves the key and
  // we upload to it AFTER the order commits, so a rejected order has no upload
  // to orphan.
  //
  // dataUriToBlob stays inside the try: a malformed data URI would throw in
  // atob and abort the whole submission. The proof is best-effort metadata, not
  // the system of record — degrade to "no proof" rather than failing checkout.
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

  // 2) create the order server-side. The create_order RPC looks up prices from
  //    menu_items by id, recomputes the total, forces client_id = auth.uid(),
  //    and inserts the order + items atomically — the client no longer sends
  //    prices/totals/client_id or generates the PK. Each meal-plan dish becomes
  //    one line (qty 1) carrying its plan grouping; the à-la-carte fallback maps
  //    order.items by id (vestigial today, but kept loud rather than silent).
  // Each box sends a PLAN line (which carries the price) followed by its chosen
  // dishes as components. create_order prices the components from the plan's
  // own pricing_mode, so the client never sends money.
  const items = order.planInstances?.length
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

  const { data: result, error } = await supabase.rpc("create_order", {
    p_items: items as unknown as never,
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
    // Keep the raw Postgres text for the console; never render it.
    console.error("create_order failed:", error.message);
    throw new Error(mapOrderError(error.message));
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
  // No client-side notify call. See the docstring above — emails are sent
  // server-side via the order-notify trigger.
}
