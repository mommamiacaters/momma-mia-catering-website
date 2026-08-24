import type { PlanInstance } from "../types";
import { PLAN_SLOTS } from "../constants/planSlots";

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

/** One entry per distinct build: same plan + same dishes, in display order. */
export interface PlanInstanceGroup {
  type: string;
  count: number;
  sample: PlanInstance;
  /**
   * The group's signature — use it as the React key. sample.id belongs to
   * whichever box happened to come first, so editing that box re-keyed (and
   * remounted) tiles whose build hadn't changed.
   */
  sig: string;
}

/**
 * Identical boxes collapse into one group with a count — a 30-box order is
 * usually two or three builds, and every summary surface (checkout, bag,
 * lunch-box panel) must read that way instead of thirty near-identical cards.
 * Signature = plan + its dishes by id, sorted so pick order can't split groups.
 */
export function groupPlanInstances(
  instances: PlanInstance[],
): PlanInstanceGroup[] {
  const map = new Map<string, PlanInstanceGroup>();
  for (const pi of instances) {
    const sig =
      pi.type +
      "|" +
      pi.items
        .map((i) => `${i.type}:${i.menuItemId}`)
        .sort()
        .join("|");
    const existing = map.get(sig);
    if (existing) existing.count += 1;
    else map.set(sig, { type: pi.type, count: 1, sample: pi, sig });
  }
  return [...map.values()];
}

/** A build's dishes rolled up to one line per distinct dish, mains first. */
export function aggregateDishes(items: PlanInstance["items"]) {
  const byDish = new Map<
    string,
    { name: string; image: string; type: string; qty: number }
  >();
  for (const item of items) {
    const entry = byDish.get(item.menuItemId);
    if (entry) entry.qty += 1;
    else
      byDish.set(item.menuItemId, {
        name: item.name,
        image: item.image,
        type: item.type,
        qty: 1,
      });
  }
  return PLAN_SLOTS.flatMap((cat) =>
    [...byDish.values()].filter((d) => d.type === cat),
  );
}
