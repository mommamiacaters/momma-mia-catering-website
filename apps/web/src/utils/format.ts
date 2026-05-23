/** Format integer centavos as a peso string, or a friendly "price on request". */
export function formatPeso(cents: number | null, fallback = "Price on request"): string {
  return cents == null ? fallback : `₱${(cents / 100).toFixed(2)}`;
}

/** URL-safe slug from a human label, e.g. "Party Trays" -> "party-trays". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
