import type { PlanInstance } from "../types";

/**
 * True when every slot the plan asks for is filled.
 *
 * Limits are passed in rather than looked up — they come from the database per
 * plan now. Looking them up in a module-level table keyed by plan name returned
 * undefined for every new plan, jamming the checkout gate shut.
 */
export function isPlanInstanceComplete(
  planInstance: PlanInstance,
  limits: Record<string, number>,
): boolean {
  if (!limits) return false;

  for (const [slot, limit] of Object.entries(limits)) {
    if (limit <= 0) continue;
    const filled = planInstance.items.filter((item) => item.type === slot).length;
    if (filled < limit) return false;
  }
  return true;
}
