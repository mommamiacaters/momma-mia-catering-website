import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { PLAN_SLOTS } from "../constants/planSlots";
import type {
  MealPlanType,
  MealPlanOrder,
  SelectedItemWithQuantity,
  MenuItem,
  MenuTypeData,
  PlanInstance,
  AssignedItem,
  PlanSlot,
  DishFillMode,
} from "../types";
import { menuService, type MealPlan } from "../services/menuService";
import { useStoreSettings } from "./useStoreSettings";

function generatePlanId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateItemId(name: string): string {
  return `${name}-${Date.now()}-${Math.random()}`;
}

// ─── sessionStorage cart persistence ───

const CART_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Bumped when the cart shape changes. v1 stored plan NAMES from the two
 * hardcoded plans; those plans no longer exist, so restoring one would yield a
 * box with no price and no limits. Mismatched snapshots are discarded.
 */
const CART_VERSION = 2;

function getCartKey(slug: string): string {
  return `cart:${slug}`;
}

function readCart(slug: string) {
  try {
    const raw = sessionStorage.getItem(getCartKey(slug));
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (snap.version !== CART_VERSION || Date.now() - snap.savedAt > CART_TTL_MS) {
      sessionStorage.removeItem(getCartKey(slug));
      return null;
    }
    return snap as {
      planInstances: PlanInstance[];
      activePlanInstanceId: string | null;
      subtotal: number;
    };
  } catch {
    return null;
  }
}

function writeCart(
  slug: string,
  planInstances: PlanInstance[],
  activePlanInstanceId: string | null,
  subtotal: number
) {
  try {
    sessionStorage.setItem(
      getCartKey(slug),
      JSON.stringify({
        version: CART_VERSION,
        planInstances,
        activePlanInstanceId,
        subtotal,
        savedAt: Date.now(),
      })
    );
  } catch {
    /* storage full or unavailable */
  }
}

function clearCart(slug: string) {
  try {
    sessionStorage.removeItem(getCartKey(slug));
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

export function useOrderManagement(
  slug: string | undefined,
  hasMenu: boolean
) {
  // Shares the module-level settings cache — no extra request per mount.
  const { minimumMealPlans } = useStoreSettings();
  const [menuData, setMenuData] = useState<MenuTypeData | null>(null);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [planInstances, setPlanInstances] = useState<PlanInstance[]>(() => {
    if (!slug) return [];
    return readCart(slug)?.planInstances ?? [];
  });
  const [activePlanInstanceId, setActivePlanInstanceId] = useState<
    string | null
  >(() => {
    if (!slug) return null;
    return readCart(slug)?.activePlanInstanceId ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref keeps activePlanInstanceId current for memoized callbacks
  // (FoodCard's React.memo skips onAdd/onDecrease in its comparator)
  const activePlanRef = useRef(activePlanInstanceId);
  activePlanRef.current = activePlanInstanceId;

  // Debounced-persist plumbing — declared up here so clearSessionCart can
  // cancel a queued write; the persist effects live near the bottom.
  const persistTimer = useRef<number | null>(null);
  const pendingWrite = useRef<(() => void) | null>(null);

  // Fetch menu data when slug changes. Every food service page runs the same
  // plan-based builder; the map translates its URL slug to the menu CATEGORY
  // slug (Merienda Meals kept the legacy 'fun-boxes' category, and the
  // party-tray category is singular while its page is plural).
  useEffect(() => {
    const category =
      slug === "check-a-lunch"
        ? "check-a-lunch"
        : slug === "merienda-meals"
          ? "fun-boxes"
          : slug === "party-trays"
            ? "party-tray"
            : null;
    if (!slug || !hasMenu || !category) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Plans and their selectable dishes both come from the database. All
        // plans in a category share one dish pool (the meal_plan_options view
        // joins by category), so the first plan's options serve every plan.
        const loaded = await menuService.getMealPlans(category);
        if (cancelled) return;
        setPlans(loaded);
        const data = loaded.length
          ? await menuService.getPlanMenuData(loaded[0].id)
          : null;
        if (!cancelled) setMenuData(data);

        // Restored carts carry each dish's image/name/price frozen at the
        // moment it was added — menu edits (or repaired image URLs) would
        // never reach them. Re-stamp every assigned item from the fresh menu.
        if (!cancelled && data) {
          const freshById = new Map<string, MenuItem>();
          for (const list of Object.values(data)) {
            for (const it of list ?? []) freshById.set(it.id, it);
          }
          setPlanInstances((prev) =>
            prev.map((pi) => ({
              ...pi,
              items: pi.items.map((item) => {
                const fresh = freshById.get(item.menuItemId);
                return fresh
                  ? {
                      ...item,
                      name: fresh.name,
                      description: fresh.description,
                      price: fresh.price,
                      image: fresh.image,
                    }
                  : item;
              }),
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching menu data:", err);
        if (!cancelled) setError("Failed to load menu items. Please try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, hasMenu]);

  const clearSessionCart = useCallback(() => {
    // A queued debounced write would re-create the cart right after clearing.
    if (persistTimer.current !== null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    pendingWrite.current = null;
    if (slug) clearCart(slug);
  }, [slug]);

  // ─── Derived state (backward compat) ───

  const mealPlanOrders = useMemo<MealPlanOrder[]>(() => {
    const counts = new Map<MealPlanType, { mealPlanId: number; quantity: number }>();
    for (const pi of planInstances) {
      const seen = counts.get(pi.type);
      counts.set(pi.type, {
        mealPlanId: pi.mealPlanId,
        quantity: (seen?.quantity ?? 0) + 1,
      });
    }
    return Array.from(counts.entries()).map(([type, v]) => ({
      mealPlanId: v.mealPlanId,
      type,
      quantity: v.quantity,
    }));
  }, [planInstances]);

  /** Plan lookup by display name — the callbacks below are keyed on the name. */
  const planByName = useMemo(
    () => new Map(plans.map((p) => [p.name, p])),
    [plans],
  );

  // Read through a ref inside setState updaters so those callbacks stay
  // reference-stable (FoodCard's memo comparator skips onAdd/onDecrease).
  const planByNameRef = useRef(planByName);
  planByNameRef.current = planByName;

  // Reads only through planByNameRef, so it is genuinely reference-stable —
  // useCallback([]) states that rather than leaving callers to assert it with a
  // bare [] dep list the linter can't verify.
  const limitsFor = useCallback(
    (type: string): Record<string, number> =>
      planByNameRef.current.get(type)?.slots ?? {
        main: 0,
        side: 0,
        rice: 0,
        dessert: 0,
      },
    []
  );

  const selectedItems = useMemo<SelectedItemWithQuantity[]>(() => {
    return planInstances
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .flatMap((pi) =>
        pi.items.map((item) => ({
          menuItemId: item.menuItemId,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          type: item.type,
          image: item.image,
          quantity: 1,
          instanceId: item.instanceId,
          planInstanceId: item.planInstanceId,
        }))
      );
  }, [planInstances]);

  // ─── Core helpers ───

  /**
   * A zero for every slot that exists. Built from PLAN_SLOTS rather than
   * written out: the literal `{ main, side, rice, dessert }` this replaces
   * seeded the accumulator below, so a plan whose only slot was a newer one
   * (rice_bowl) aggregated to zero and offered the customer nothing to pick.
   */
  const zeroLimits = (): Record<string, number> =>
    Object.fromEntries(PLAN_SLOTS.map((slot) => [slot, 0]));

  const getMealPlanLimits = useCallback(
    (type: MealPlanType): Record<string, number> => {
      const plan = planByName.get(type);
      // An unknown plan grants nothing rather than throwing — a stale cart or a
      // plan hidden mid-session must not take the page down.
      if (!plan) return zeroLimits();
      return { ...plan.slots };
    },
    [planByName]
  );

  const getMaxAllowedItemsByType = useCallback((): Record<string, number> => {
    const limits = zeroLimits();
    for (const pi of planInstances) {
      const planLimits = getMealPlanLimits(pi.type);
      for (const slot of Object.keys(limits)) {
        limits[slot] += planLimits[slot] ?? 0;
      }
    }
    return limits;
  }, [planInstances, getMealPlanLimits]);

  const getRemainingCapacity = useCallback(
    (planInstanceId: string, itemType: string): number => {
      const pi = planInstances.find((p) => p.id === planInstanceId);
      if (!pi) return 0;
      const limits = getMealPlanLimits(pi.type);
      const used = pi.items.filter((item) => item.type === itemType).length;
      return Math.max(0, (limits[itemType] || 0) - used);
    },
    [planInstances, getMealPlanLimits]
  );

  // Get limits for the active plan, or aggregate if no active plan
  const getActivePlanMaxAllowed = useCallback((): Record<string, number> => {
    if (!activePlanInstanceId) {
      return getMaxAllowedItemsByType();
    }
    const pi = planInstances.find((p) => p.id === activePlanInstanceId);
    if (!pi) return getMaxAllowedItemsByType();
    return getMealPlanLimits(pi.type);
  }, [activePlanInstanceId, planInstances, getMealPlanLimits, getMaxAllowedItemsByType]);

  // Get selected count for active plan or aggregate
  const getActivePlanSelectedCount = useCallback(
    (itemType: string): number => {
      if (!activePlanInstanceId) {
        return planInstances.reduce(
          (total, pi) =>
            total + pi.items.filter((item) => item.type === itemType).length,
          0
        );
      }
      const pi = planInstances.find((p) => p.id === activePlanInstanceId);
      if (!pi) return 0;
      return pi.items.filter((item) => item.type === itemType).length;
    },
    [activePlanInstanceId, planInstances]
  );

  const getCurrentItemQuantity = useCallback(
    (item: MenuItem): number => {
      if (!activePlanInstanceId) {
        // Aggregate across all plans
        return planInstances.reduce(
          (total, pi) =>
            total + pi.items.filter((ai) => ai.menuItemId === item.id).length,
          0
        );
      }
      const pi = planInstances.find((p) => p.id === activePlanInstanceId);
      if (!pi) return 0;
      return pi.items.filter((ai) => ai.menuItemId === item.id).length;
    },
    [activePlanInstanceId, planInstances]
  );

  // ─── Meal Plan Management ───

  const handleMealPlanSelect = useCallback((type: MealPlanType) => {
    const plan = planByName.get(type);
    const mealPlanId = plan?.id ?? 0;
    // A fresh selection starts at this SERVICE's order minimum, not 1 — every
    // order has to reach it anyway. A service without its own floor uses the
    // store default; unknown settings or a switched-off minimum fall back to
    // the old single box.
    const seedCount = Math.max(1, plan?.categoryMinBoxes ?? minimumMealPlans ?? 1);
    setPlanInstances((prev) => {
      const instancesOfType = prev.filter((pi) => pi.type === type);
      if (instancesOfType.length > 0) {
        // Deselect: remove all instances of this type
        const remaining = prev.filter((pi) => pi.type !== type);
        if (remaining.length === 0) {
          return [];
        }
        return remaining;
      } else {
        const maxOrder = prev.reduce(
          (max, pi) => Math.max(max, pi.displayOrder),
          -1
        );
        const seeded: PlanInstance[] = [];
        for (let i = 0; i < seedCount; i++) {
          seeded.push({
            id: generatePlanId(),
            mealPlanId,
            type,
            displayOrder: maxOrder + 1 + i,
            items: [],
          });
        }
        return [...prev, ...seeded];
      }
    });
  }, [planByName, minimumMealPlans]);

  const handleMealPlanQuantityChange = useCallback(
    (type: MealPlanType, newQuantity: number) => {
      const mealPlanId = planByName.get(type)?.id ?? 0;
      setPlanInstances((prev) => {
        const instancesOfType = prev.filter((pi) => pi.type === type);
        const currentCount = instancesOfType.length;

        if (newQuantity < 1) {
          // Remove all of this type
          const remaining = prev.filter((pi) => pi.type !== type);
          return remaining;
        }

        if (newQuantity > currentCount) {
          // Add more instances
          const maxOrder = prev.reduce(
            (max, pi) => Math.max(max, pi.displayOrder),
            -1
          );
          const toAdd = newQuantity - currentCount;
          const newInstances: PlanInstance[] = [];
          for (let i = 0; i < toAdd; i++) {
            newInstances.push({
              id: generatePlanId(),
              mealPlanId,
              type,
              displayOrder: maxOrder + 1 + i,
              items: [],
            });
          }
          return [...prev, ...newInstances];
        }

        if (newQuantity < currentCount) {
          // Remove from the end (highest displayOrder first)
          const sorted = [...instancesOfType].sort(
            (a, b) => b.displayOrder - a.displayOrder
          );
          const toRemoveIds = new Set(
            sorted.slice(0, currentCount - newQuantity).map((pi) => pi.id)
          );
          return prev.filter((pi) => !toRemoveIds.has(pi.id));
        }

        return prev;
      });
    },
    [planByName]
  );

  // ─── Item Management ───

  const handleItemAdd = useCallback(
    (item: MenuItem) => {
      setPlanInstances((prev) => {
        if (prev.length === 0) return prev;

        // Read from ref — always current even inside memoized callbacks
        let targetId = activePlanRef.current;

        if (targetId) {
          // Check if active plan has capacity
          const pi = prev.find((p) => p.id === targetId);
          if (!pi) targetId = null;
          else {
            const limits = limitsFor(pi.type);
            const used = pi.items.filter((ai) => ai.type === item.type).length;
            if (used >= (limits[item.type] || 0)) {
              // Active plan is full for this category — don't add
              return prev;
            }
          }
        }

        if (!targetId) {
          // FIFO: find first plan with capacity (by displayOrder)
          const sorted = [...prev].sort(
            (a, b) => a.displayOrder - b.displayOrder
          );
          for (const pi of sorted) {
            const limits = limitsFor(pi.type);
            const used = pi.items.filter(
              (ai) => ai.type === item.type
            ).length;
            if (used < (limits[item.type] || 0)) {
              targetId = pi.id;
              break;
            }
          }
        }

        if (!targetId) {
          // All plans full for this type
          return prev;
        }

        const newItem: AssignedItem = {
          instanceId: generateItemId(item.name),
          planInstanceId: targetId,
          menuItemId: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          type: item.type,
          image: item.image,
          minQty: item.minQty ?? null,
        };

        return prev.map((pi) =>
          pi.id === targetId
            ? { ...pi, items: [...pi.items, newItem] }
            : pi
        );
      });
    },
    // limitsFor is useCallback([])-stable, so listing it costs no churn and
    // keeps the dep list honest; the rest is read from refs at call time.
    [limitsFor]
  );

  const handleItemQuantityDecrease = useCallback(
    (item: MenuItem) => {
      setPlanInstances((prev) => {
        const currentActivePlan = activePlanRef.current;
        // Find the last instance of this item across all plans (or in active plan)
        const allItems: { planId: string; item: AssignedItem }[] = [];
        const sorted = [...prev].sort(
          (a, b) => a.displayOrder - b.displayOrder
        );

        for (const pi of sorted) {
          for (const ai of pi.items) {
            if (ai.menuItemId === item.id) {
              if (!currentActivePlan || pi.id === currentActivePlan) {
                allItems.push({ planId: pi.id, item: ai });
              }
            }
          }
        }

        if (allItems.length === 0) return prev;
        const last = allItems[allItems.length - 1];

        return prev.map((pi) =>
          pi.id === last.planId
            ? {
                ...pi,
                items: pi.items.filter(
                  (ai) => ai.instanceId !== last.item.instanceId
                ),
              }
            : pi
        );
      });
    },
    [] // stable — reads activePlanRef.current at call time
  );

  /**
   * Bulk add: drop this dish into up to `count` open slots of its own type,
   * FIFO by displayOrder. Pass Infinity for "fill every box".
   *
   * Deliberately IGNORES the active plan. handleItemAdd targets the active box
   * and bails once that box is full, which is right for one-at-a-time picking
   * but would make "+10" add exactly one. Bulk is inherently a
   * across-all-boxes operation — that is the whole reason it exists when an
   * order runs to 24 boxes and 72 individual picks.
   */
  const handleItemAddMany = useCallback((
    item: MenuItem,
    count: number,
    spread: DishFillMode = "even",
  ) => {
    if (count <= 0) return;
    setPlanInstances((prev) => {
      if (prev.length === 0) return prev;
      let remaining = count;
      const sorted = [...prev].sort((a, b) => a.displayOrder - b.displayOrder);
      const additions = new Map<string, AssignedItem[]>();

      // Open slots of this course per box, decremented as we place.
      const open = new Map<string, number>();
      for (const pi of sorted) {
        const limits = limitsFor(pi.type);
        const used = pi.items.filter((ai) => ai.type === item.type).length;
        open.set(pi.id, Math.max(0, (limits[item.type] || 0) - used));
      }

      const place = (pi: PlanInstance) => {
        const list = additions.get(pi.id) ?? [];
        list.push({
          instanceId: generateItemId(item.name),
          planInstanceId: pi.id,
          menuItemId: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          type: item.type,
          image: item.image,
          minQty: item.minQty ?? null,
        });
        additions.set(pi.id, list);
        open.set(pi.id, (open.get(pi.id) ?? 0) - 1);
        remaining--;
      };

      if (spread === "even") {
        // One slot per box per pass, so 15 mains across 15 boxes give every box
        // a main before any box gets a second — the difference between "every
        // meal has a protein" and "seven meals are finished and eight are bare".
        let placedThisPass = 1;
        while (remaining > 0 && placedThisPass > 0) {
          placedThisPass = 0;
          for (const pi of sorted) {
            if (remaining <= 0) break;
            if ((open.get(pi.id) ?? 0) <= 0) continue;
            place(pi);
            placedThisPass++;
          }
        }
      } else {
        // Finish a box before moving on — the original behaviour.
        for (const pi of sorted) {
          if (remaining <= 0) break;
          while ((open.get(pi.id) ?? 0) > 0 && remaining > 0) place(pi);
        }
      }

      if (additions.size === 0) return prev;
      return prev.map((pi) =>
        additions.has(pi.id)
          ? { ...pi, items: [...pi.items, ...(additions.get(pi.id) as AssignedItem[])] }
          : pi
      );
    });
  }, [limitsFor]);

  /**
   * Bulk remove: take out up to `count` copies of this dish, last-placed first,
   * across every box. Pass Infinity for "clear it everywhere". Also ignores the
   * active plan, so it undoes exactly what handleItemAddMany did.
   */
  const handleItemRemoveMany = useCallback((item: MenuItem, count: number) => {
    if (count <= 0) return;
    setPlanInstances((prev) => {
      const sorted = [...prev].sort((a, b) => a.displayOrder - b.displayOrder);
      const doomed = new Set<string>();
      let remaining = count;

      // Walk boxes back-to-front so "-10" peels off the most recent fills.
      for (let i = sorted.length - 1; i >= 0 && remaining > 0; i--) {
        const matches = sorted[i].items.filter((ai) => ai.menuItemId === item.id);
        for (let j = matches.length - 1; j >= 0 && remaining > 0; j--) {
          doomed.add(matches[j].instanceId);
          remaining--;
        }
      }

      if (doomed.size === 0) return prev;
      return prev.map((pi) => ({
        ...pi,
        items: pi.items.filter((ai) => !doomed.has(ai.instanceId)),
      }));
    });
  }, []);

  /** Open slots for this dish's type across EVERY box — drives "Fill all (n)". */
  const getOpenSlotsForType = useCallback(
    (itemType: string): number =>
      planInstances.reduce((sum, pi) => {
        const limits = getMealPlanLimits(pi.type);
        const used = pi.items.filter((ai) => ai.type === itemType).length;
        return sum + Math.max(0, (limits[itemType] || 0) - used);
      }, 0),
    [planInstances, getMealPlanLimits]
  );

  /** How many copies of this dish are placed across EVERY box. */
  const getTotalPlacedCount = useCallback(
    (item: MenuItem): number =>
      planInstances.reduce(
        (sum, pi) => sum + pi.items.filter((ai) => ai.menuItemId === item.id).length,
        0
      ),
    [planInstances]
  );

  /**
   * Empty one course. Scope is explicit rather than inferred from the active
   * plan: pass a planInstanceId to clear that box only, or null to clear the
   * course across every box. The caller decides, because "clear" means two very
   * different-sized things depending on whether you're filling one box or
   * auto-filling, and guessing would make the destructive case the ambiguous one.
   */
  const clearCourse = useCallback(
    (itemType: string, planInstanceId: string | null) => {
      setPlanInstances((prev) =>
        prev.map((pi) =>
          planInstanceId && pi.id !== planInstanceId
            ? pi
            : { ...pi, items: pi.items.filter((ai) => ai.type !== itemType) }
        )
      );
    },
    []
  );

  const handleItemRemove = useCallback((item: SelectedItemWithQuantity) => {
    setPlanInstances((prev) =>
      prev.map((pi) => ({
        ...pi,
        items: pi.items.filter((ai) => ai.instanceId !== item.instanceId),
      }))
    );
  }, []);

  // Remove a specific item by instanceId (used in sidebar)
  const handleAssignedItemRemove = useCallback((instanceId: string) => {
    setPlanInstances((prev) =>
      prev.map((pi) => ({
        ...pi,
        items: pi.items.filter((ai) => ai.instanceId !== instanceId),
      }))
    );
  }, []);

  // ─── Plan Instance Management ───

  const removePlanInstance = useCallback(
    (planId: string) => {
      setPlanInstances((prev) => {
        const remaining = prev.filter((pi) => pi.id !== planId);
        return remaining;
      });
      // Reset active plan if it was removed
      setActivePlanInstanceId((current) =>
        current === planId ? null : current
      );
    },
    []
  );

  const reorderPlanInstances = useCallback(
    (fromIndex: number, toIndex: number) => {
      setPlanInstances((prev) => {
        const sorted = [...prev].sort(
          (a, b) => a.displayOrder - b.displayOrder
        );
        const [moved] = sorted.splice(fromIndex, 1);
        sorted.splice(toIndex, 0, moved);
        // Reassign displayOrder based on new positions
        return sorted.map((pi, i) => ({ ...pi, displayOrder: i }));
      });
    },
    []
  );

  // ─── Move / Swap items between plans ───

  const moveItemBetweenPlans = useCallback(
    (
      sourcePlanId: string,
      itemInstanceId: string,
      targetPlanId: string,
      targetItemInstanceId?: string
    ) => {
      setPlanInstances((prev) => {
        if (sourcePlanId === targetPlanId) return prev;

        const sourcePlan = prev.find((pi) => pi.id === sourcePlanId);
        const targetPlan = prev.find((pi) => pi.id === targetPlanId);
        if (!sourcePlan || !targetPlan) return prev;

        const sourceItem = sourcePlan.items.find(
          (i) => i.instanceId === itemInstanceId
        );
        if (!sourceItem) return prev;

        if (targetItemInstanceId) {
          // Swap: exchange two items between plans
          const targetItem = targetPlan.items.find(
            (i) => i.instanceId === targetItemInstanceId
          );
          if (!targetItem || sourceItem.type !== targetItem.type) return prev;

          return prev.map((pi) => {
            if (pi.id === sourcePlanId) {
              return {
                ...pi,
                items: pi.items.map((item) =>
                  item.instanceId === itemInstanceId
                    ? { ...targetItem, planInstanceId: sourcePlanId }
                    : item
                ),
              };
            }
            if (pi.id === targetPlanId) {
              return {
                ...pi,
                items: pi.items.map((item) =>
                  item.instanceId === targetItemInstanceId
                    ? { ...sourceItem, planInstanceId: targetPlanId }
                    : item
                ),
              };
            }
            return pi;
          });
        } else {
          // Move: check target has capacity
          const limits = limitsFor(targetPlan.type);
          const targetCatCount = targetPlan.items.filter(
            (i) => i.type === sourceItem.type
          ).length;
          const maxForCat = (limits[sourceItem.type] || 0) as number;

          if (targetCatCount >= maxForCat) return prev;

          return prev.map((pi) => {
            if (pi.id === sourcePlanId) {
              return {
                ...pi,
                items: pi.items.filter(
                  (i) => i.instanceId !== itemInstanceId
                ),
              };
            }
            if (pi.id === targetPlanId) {
              return {
                ...pi,
                items: [
                  ...pi.items,
                  { ...sourceItem, planInstanceId: targetPlanId },
                ],
              };
            }
            return pi;
          });
        }
      });
    },
    [limitsFor]
  );

  // ─── Query helpers ───

  const isItemSelected = useCallback(
    (item: MenuItem): boolean => {
      if (activePlanInstanceId) {
        const pi = planInstances.find((p) => p.id === activePlanInstanceId);
        if (!pi) return false;
        return pi.items.some((ai) => ai.menuItemId === item.id);
      }
      return planInstances.some((pi) =>
        pi.items.some((ai) => ai.menuItemId === item.id)
      );
    },
    [activePlanInstanceId, planInstances]
  );

  const getItemsByCategory = useCallback(
    (category: PlanSlot): MenuItem[] => {
      if (!menuData) return [];
      return menuData[category] || [];
    },
    [menuData]
  );

  /**
   * Price of one box. On a "fixed" plan that is simply the plan's price. On a
   * "range" plan the dishes carry the money, so it depends on what is in THIS
   * box — hence the optional instance argument. create_order recomputes both
   * server-side; this is display only.
   */
  const getMealPlanPrice = useCallback(
    (type: MealPlanType, planInstanceId?: string): number => {
      const plan = planByName.get(type);
      if (!plan) return 0;
      if (plan.pricingMode !== "range") return plan.price;

      const pi = planInstanceId
        ? planInstances.find((p) => p.id === planInstanceId)
        : undefined;
      if (!pi) return plan.minPrice;
      return pi.items.reduce((sum, item) => sum + (item.price ?? 0), 0);
    },
    [planByName, planInstances]
  );

  const calculateTotalPrice = useCallback((): number => {
    return planInstances.reduce(
      (total, pi) => total + getMealPlanPrice(pi.type, pi.id),
      0
    );
  }, [planInstances, getMealPlanPrice]);

  // ─── Persist cart to sessionStorage ───
  // Debounced: at a 150-box order the snapshot is hundreds of KB of JSON, and
  // stringifying it synchronously on every click was a real slice of the
  // picker's input lag. The trailing write lands once clicking pauses;
  // pagehide/hidden and unmount flush so no navigation loses a snapshot.
  const flushCartWrite = useCallback(() => {
    if (persistTimer.current !== null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    pendingWrite.current?.();
    pendingWrite.current = null;
  }, []);

  useEffect(() => {
    if (!slug) return;
    pendingWrite.current = () =>
      writeCart(slug, planInstances, activePlanInstanceId, calculateTotalPrice());
    if (persistTimer.current !== null) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(flushCartWrite, 400);
  }, [slug, planInstances, activePlanInstanceId, calculateTotalPrice, flushCartWrite]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushCartWrite();
    };
    window.addEventListener("pagehide", flushCartWrite);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flushCartWrite);
      document.removeEventListener("visibilitychange", onHidden);
      // SPA navigation unmounts this hook — write the final state now.
      flushCartWrite();
    };
  }, [flushCartWrite]);

  const getTotalItemsCount = useCallback((): number => {
    return (
      planInstances.reduce((total, pi) => total + pi.items.length, 0) +
      planInstances.length
    );
  }, [planInstances]);

  const getTotalMealPlanCount = useCallback((): number => {
    return planInstances.length;
  }, [planInstances]);

  // Reset active plan if it no longer exists
  useEffect(() => {
    if (
      activePlanInstanceId &&
      !planInstances.some((pi) => pi.id === activePlanInstanceId)
    ) {
      setActivePlanInstanceId(null);
    }
  }, [planInstances, activePlanInstanceId]);

  return {
    menuData,
    plans,
    planInstances,
    activePlanInstanceId,
    mealPlanOrders,
    selectedItems,
    loading,
    error,
    handleMealPlanSelect,
    handleMealPlanQuantityChange,
    handleItemAdd,
    handleItemAddMany,
    handleItemRemoveMany,
    clearCourse,
    getOpenSlotsForType,
    getTotalPlacedCount,
    handleItemQuantityDecrease,
    handleItemRemove,
    handleAssignedItemRemove,
    getMealPlanLimits,
    getMealPlanPrice,
    getMaxAllowedItemsByType,
    getActivePlanMaxAllowed,
    getActivePlanSelectedCount,
    getCurrentItemQuantity,
    isItemSelected,
    getItemsByCategory,
    calculateTotalPrice,
    getTotalItemsCount,
    getTotalMealPlanCount,
    setActivePlanInstanceId,
    removePlanInstance,
    reorderPlanInstances,
    getRemainingCapacity,
    moveItemBetweenPlans,
    clearSessionCart,
  };
}
