import type { OrderSubmission } from "../types";
import { supabase } from "../lib/supabase";

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

  // 1) upload payment proof to the private bucket (if provided)
  let paymentProofUrl: string | null = null;
  if (paymentProof?.base64) {
    // dataUriToBlob lives INSIDE this try-block: a malformed data URI (bad
    // base64, no comma, etc.) would throw in atob and abort the whole order
    // submission. Better to degrade to "no proof attached" than to fail
    // checkout — the proof is best-effort metadata, not the system of record.
    try {
      const { blob, mime } = dataUriToBlob(paymentProof.base64);
      // Unguessable path + upsert:false → a proof can't be overwritten/guessed
      // (the low-entropy order_ref must not be derivable from the path).
      const ext = (paymentProof.fileName?.split(".").pop() || mime.split("/")[1] || "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { data: up, error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) {
        // Non-fatal: keep the order, just note the proof failed to attach.
        console.error("Payment proof upload failed:", upErr.message);
      } else {
        paymentProofUrl = up?.path ?? path;
      }
    } catch (e) {
      // Malformed data URI — keep the order, drop the proof.
      console.error("Payment proof parse failed:", e instanceof Error ? e.message : e);
    }
  }

  // 2) create the order server-side. The create_order RPC looks up prices from
  //    menu_items by id, recomputes the total, forces client_id = auth.uid(),
  //    and inserts the order + items atomically — the client no longer sends
  //    prices/totals/client_id or generates the PK. Each meal-plan dish becomes
  //    one line (qty 1) carrying its plan grouping; the à-la-carte fallback maps
  //    order.items by id (vestigial today, but kept loud rather than silent).
  const items = order.planInstances?.length
    ? order.planInstances.flatMap((plan) =>
        plan.items.map((it) => ({
          menu_item_id: it.menuItemId,
          qty: 1,
          plan_instance_id: plan.id,
          plan_type: plan.type,
        })),
      )
    : order.items.map((it) => ({ menu_item_id: it.menuItemId, qty: 1 }));

  const { error } = await supabase.rpc("create_order", {
    p_items: items,
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
    p_payment_proof_url: paymentProofUrl,
  });
  if (error) throw new Error(`Failed to submit order: ${error.message}`);
  // No client-side notify call. See the docstring above — emails are sent
  // server-side via the order-notify trigger.
}
