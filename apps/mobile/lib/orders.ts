import type { Database } from '@momma-mia/db';
import { supabase } from './supabase';
import type { CartLine } from '../store/cart';

function makeOrderRef(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6);
  return `MM-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${rand}`;
}

// Unguessable token for the payment-proof storage path. The path must NOT be
// derivable from the (low-entropy) order_ref, or an attacker could overwrite a
// customer's proof before review. Prefer crypto.randomUUID where available
// (web + newer RN), fall back to a high-entropy token (no extra native dep).
function randomToken(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export interface CheckoutCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  specialRequests?: string;
}

export interface ProofImage {
  uri: string;
  mimeType?: string;
}

/**
 * Map a raw `create_order` RPC error message to user-friendly copy. The RPC
 * raises plain Postgres exceptions like "Item not available" which are useful
 * for logs but terrible UX — we should NEVER show raw DB strings to users.
 * Any unknown error falls back to a generic message so we don't accidentally
 * leak internals (e.g. column names, plpgsql line numbers).
 */
export function mapOrderError(msg: string): string {
  if (/item not available/i.test(msg)) {
    return 'One of your items just sold out or was removed. Please refresh and try again.';
  }
  if (/unknown menu item/i.test(msg)) {
    return 'An item in your cart is no longer on the menu. Please refresh.';
  }
  if (/qty/i.test(msg)) {
    return 'Quantity is invalid. Please review your cart.';
  }
  if (/empty/i.test(msg)) {
    return 'Your cart is empty.';
  }
  return "Couldn't place your order. Please try again.";
}

// Shape of the `create_order` RPC return value. The DB function returns
// `Json`, so we narrow it here at the one place we read it.
interface CreateOrderResult {
  order_id: string;
  order_ref: string;
  total_cents: number;
}

/**
 * Submit an order via the server-authoritative `create_order` RPC.
 * The server looks up prices from menu_items by id, recomputes the total,
 * forces client_id = auth.uid(), and inserts the order + items atomically.
 * The client no longer sends prices/totals/client_id or generates the PK.
 * `clientId` is accepted for signature compat but intentionally unused — the
 * server derives the owner from the session. Mirrors apps/web orderService.
 *
 * Returns `totalCents` (the SERVER-AUTHORITATIVE charged total) so the
 * confirmation screen can show what the customer was actually charged — never
 * the client-side subtotal, which can differ if a price changed mid-order.
 */
export async function submitOrder(opts: {
  customer: CheckoutCustomer;
  lines: CartLine[];
  clientId?: string | null;
  proof?: ProofImage | null;
}): Promise<{ orderRef: string; totalCents: number }> {
  const { customer, lines, proof } = opts;
  const orderRef = makeOrderRef();

  // 1) upload payment proof to the private bucket (best-effort, non-fatal).
  //    Keyed by the client-generated order_ref so the path is stable; the RPC
  //    owns everything price/identity related.
  let paymentProofUrl: string | null = null;
  if (proof?.uri) {
    try {
      const resp = await fetch(proof.uri);
      const arrayBuffer = await resp.arrayBuffer();
      const ext = proof.mimeType?.split('/')[1] || 'jpg';
      // Unguessable path + upsert:false → a proof can't be overwritten/guessed.
      const path = `${randomToken()}.${ext}`;
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .upload(path, arrayBuffer, { contentType: proof.mimeType || 'image/jpeg', upsert: false });
      if (error) console.warn('Payment proof upload failed:', error.message);
      else paymentProofUrl = data?.path ?? path;
    } catch (e) {
      console.warn('Payment proof upload error:', e);
    }
  }

  // 2) create the order server-side. Only menu_item_id + qty are sent per line;
  //    the server snapshots the catalog name/type/price.
  const { data, error } = await supabase.rpc('create_order', {
    p_items: lines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty })),
    p_customer: {
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      delivery_address: customer.deliveryAddress || null,
      special_requests: customer.specialRequests || null,
      order_type: 'delivery',
    },
    p_order_ref: orderRef,
    p_payment_proof_url: paymentProofUrl,
  });
  // Wrap raw plpgsql exceptions in friendly copy — UI never sees DB strings.
  if (error) throw new Error(mapOrderError(error.message));

  // The RPC returns { order_id, order_ref, total_cents }. We trust the SERVER's
  // total — not the client subtotal — so the confirmation screen reflects what
  // was actually charged. Falls back to 0 only if the RPC ever drops the field;
  // a wrong-by-zero is loud and easy to catch, vs. silently showing client math.
  const result = (data ?? {}) as Partial<CreateOrderResult>;
  const totalCents = typeof result.total_cents === 'number' ? result.total_cents : 0;

  return { orderRef, totalCents };
}

export interface OrderSummary {
  id: string;
  order_ref: string;
  status: Database['public']['Enums']['order_status'];
  total_cents: number;
  created_at: string;
  order_items: { item_name: string; qty: number; menu_item_id: string | null }[];
}

/**
 * Fetch the signed-in user's orders + a light item summary (RLS scopes to
 * client_id = auth.uid()). The nested `order_items` lets the list show "what
 * was ordered" and power one-tap Reorder without a second round-trip.
 */
export async function fetchMyOrders(): Promise<OrderSummary[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_ref, status, total_cents, created_at, order_items(item_name, qty, menu_item_id)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  // No cast: the select result is inferred from the generated row type, so a
  // typo in the select string or an enum drift now fails the build.
  return data ?? [];
}

// ── Status presentation helpers (shared by the list + detail) ───────────────
const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  'pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up',
]);

/** An order is "active" until it's delivered or cancelled. */
export function isActiveOrder(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

/** Friendly, human status line for the orders list (not the raw enum). */
export function friendlyStatus(status: string): string {
  switch (status) {
    case 'pending': return "We've got your order";
    case 'confirmed': return 'Confirmed — getting started';
    case 'preparing': return 'Still cooking 🍳';
    case 'ready': return 'Ready & packed 🍱';
    case 'assigned':
    case 'picked_up': return 'On the way 🛵';
    case 'delivered': return 'Delivered';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

/** "2× Swedish Meatballs, Chicken Fillet +1 more" style one-liner. */
export function itemsSummary(items: { item_name: string; qty: number }[]): string {
  if (!items?.length) return '';
  const head = items
    .slice(0, 2)
    .map((i) => (i.qty > 1 ? `${i.qty}× ${i.item_name}` : i.item_name))
    .join(', ');
  const extra = items.length - 2;
  return extra > 0 ? `${head} +${extra} more` : head;
}

export interface OrderItemLine {
  id: string;
  item_name: string;
  item_type: string | null;
  qty: number;
  unit_price_cents: number;
  plan_type: string | null;
}

export interface OrderDetail {
  id: string;
  order_ref: string;
  status: Database['public']['Enums']['order_status'];
  order_type: Database['public']['Enums']['order_type'];
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  special_requests: string | null;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  created_at: string;
  order_items: OrderItemLine[];
}

/**
 * Fetch one order + its line items (RLS scopes to the owner / admin). The nested
 * `order_items(...)` select returns the lines in a single round-trip.
 */
export async function fetchOrderDetail(id: string): Promise<OrderDetail> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_ref, status, order_type, customer_first_name, customer_last_name, customer_email, customer_phone, delivery_address, delivery_date, delivery_time, special_requests, subtotal_cents, delivery_fee_cents, total_cents, created_at, order_items(id, item_name, item_type, qty, unit_price_cents, plan_type)',
    )
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
