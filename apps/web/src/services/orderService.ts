import type { OrderSubmission } from "../types";
import { supabase } from "../lib/supabase";

const pesosToCents = (p: number): number => Math.round((p || 0) * 100);

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
 * Submit an order. Supabase is the system of record; the n8n webhook is fired
 * best-effort afterwards so the owner keeps receiving order emails during the
 * transition (later replaced by a Supabase Database Webhook -> n8n).
 */
export async function submitOrder(data: OrderSubmission): Promise<void> {
  const orderId = crypto.randomUUID();
  const { customer, order, orderRef, paymentProof } = data;

  // 1) upload payment proof to the private bucket (if provided)
  let paymentProofUrl: string | null = null;
  if (paymentProof?.base64) {
    const { blob, mime } = dataUriToBlob(paymentProof.base64);
    const path = `${orderRef}/${paymentProof.fileName || "proof"}`;
    const { data: up, error: upErr } = await supabase.storage
      .from("payment-proofs")
      .upload(path, blob, { contentType: mime, upsert: true });
    if (upErr) {
      // Non-fatal: keep the order, just note the proof failed to attach.
      console.error("Payment proof upload failed:", upErr.message);
    } else {
      paymentProofUrl = up?.path ?? path;
    }
  }

  // 2) insert the order (id generated client-side so we can attach items
  //    without needing SELECT permission as a guest)
  const subtotalCents = pesosToCents(order.subtotal);
  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    order_ref: orderRef,
    order_type: "delivery",
    customer_first_name: customer.firstName,
    customer_last_name: customer.lastName,
    customer_email: customer.email,
    customer_phone: customer.phone,
    delivery_address: customer.deliveryAddress || null,
    delivery_date: customer.deliveryDate || null,
    delivery_time: customer.deliveryTime || null,
    special_requests: customer.specialRequests || null,
    subtotal_cents: subtotalCents,
    delivery_fee_cents: 0,
    total_cents: subtotalCents,
    payment_proof_url: paymentProofUrl,
  });
  if (orderErr) throw new Error(`Failed to submit order: ${orderErr.message}`);

  // 3) insert line items — prefer the richer planInstances (they carry price)
  type ItemRow = {
    order_id: string;
    item_name: string;
    item_type: string | null;
    qty: number;
    unit_price_cents: number;
    plan_instance_id: string | null;
    plan_type: string | null;
  };
  const rows: ItemRow[] = [];
  if (order.planInstances?.length) {
    for (const plan of order.planInstances) {
      for (const item of plan.items) {
        rows.push({
          order_id: orderId,
          item_name: item.name,
          item_type: item.type ?? null,
          qty: 1,
          unit_price_cents: pesosToCents(item.price),
          plan_instance_id: plan.id,
          plan_type: plan.type,
        });
      }
    }
  } else {
    for (const item of order.items) {
      rows.push({
        order_id: orderId,
        item_name: item.name,
        item_type: item.type ?? null,
        qty: 1,
        unit_price_cents: 0,
        plan_instance_id: null,
        plan_type: null,
      });
    }
  }
  if (rows.length) {
    const { error: itemsErr } = await supabase.from("order_items").insert(rows);
    if (itemsErr) console.error("Failed to insert order items:", itemsErr.message);
  }

  // 4) best-effort n8n notification (keeps existing order emails working)
  void notifyN8n(data);
}

async function notifyN8n(data: OrderSubmission): Promise<void> {
  const base = import.meta.env.VITE_N8N_BASE_URL || import.meta.env.VITE_N8N_LOCAL;
  if (!base) return;
  try {
    await fetch(`${base}/webhook/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MM-Auth-Token": import.meta.env.VITE_CHECKOUT_TOKEN || "",
      },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn("n8n order notification failed (non-fatal):", err);
  }
}
