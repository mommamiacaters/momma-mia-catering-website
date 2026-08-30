// Order presentation shared by the customer Account page and the admin console.
// Both surfaces render the same order rows, so the status vocabulary, chip colours
// and money/date formatting live here rather than being duplicated per page.

/** Mirrors public.order_status in Postgres — keep in sync with the enum. */
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "assigned",
  "picked_up",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Chip styling per status. Text is 800-weight on a 100-weight background so every
 * pair clears WCAG AA (4.5:1); the 700 shades used previously sat right on the line.
 * Colour is never the only signal — the label is always rendered alongside it.
 */
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-indigo-100 text-indigo-800",
  ready: "bg-purple-100 text-purple-800",
  assigned: "bg-cyan-100 text-cyan-800",
  picked_up: "bg-teal-100 text-teal-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export const orderStatusClass = (status: string): string =>
  STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700";

export const orderStatusLabel = (status: string): string => status.replace(/_/g, " ");

/** Money is stored in centavos, so never divide anywhere but here. */
export const peso = (cents: number): string => `₱${(cents / 100).toFixed(2)}`;

/**
 * An amount the storefront already holds in pesos. Groups thousands and shows
 * decimals only when there are any, so a whole-peso price stays "₱850" while
 * a fractional one cannot leak float noise like "₱60.300000000000004".
 */
export const pesoAmount = (amount: number): string =>
  `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export const orderDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const itemCountLabel = (n: number): string => `${n} item${n === 1 ? "" : "s"}`;
