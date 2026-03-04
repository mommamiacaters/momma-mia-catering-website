import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type {
  MealPlanType,
  MealPlanOrder,
  SelectedItemWithQuantity,
  MenuItem,
  MenuTypeData,
  PlanInstance,
  AssignedItem,
} from "../types";
import { menuService } from "../services/menuService";
import { MEAL_PLAN_LIMITS } from "../constants";

function generatePlanId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateItemId(name: string): string {
  return `${name}-${Date.now()}-${Math.random()}`;
}

// ─── sessionStorage cart persistence ───

const CART_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCartKey(slug: string): string {
  return `cart:${slug}`;
}

function readCart(slug: string) {
  try {
    const raw = sessionStorage.getItem(getCartKey(slug));
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (Date.now() - snap.savedAt > CART_TTL_MS) {
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
      JSON.stringify({ planInstances, activePlanInstanceId, subtotal, savedAt: Date.now() })
    );
  } catch {
    /* storage full or unavailable */
  }
}

function clearCart(slug: string) {
  try {
    sessionStorage.removeItem(getCartKey(slug));
  } catch {}
}

export function useOrderManagement(
  slug: string | undefined,
  hasMenu: boolean
) {
  const [menuData, setMenuData] = useState<MenuTypeData | null>(null);
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

  // Fetch menu data when slug changes
  useEffect(() => {
    if (
      !slug ||
      !hasMenu ||
      (slug !== "check-a-lunch" && slug !== "fun-boxes")
    ) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    menuService
      .getCategoryMenuData(slug as "check-a-lunch" | "fun-boxes")
      .then((data) => {
        if (!cancelled) setMenuData(data);
      })
      .catch((err) => {
        console.error("Error fetching menu data:", err);
        if (!cancelled)
          setError("Failed to load menu items. Please try again later.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, hasMenu]);

  const clearSessionCart = useCallback(() => {
    if (slug) clearCart(slug);
  }, [slug]);

  // ─── Derived state (backward compat) ───

  const mealPlanOrders = useMemo<MealPlanOrder[]>(() => {
    const counts = new Map<MealPlanType, number>();
    for (const pi of planInstances) {
      counts.set(pi.type, (counts.get(pi.type) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([type, quantity]) => ({
      type,
      quantity,
    }));
  }, [planInstances]);

  const selectedItems = useMemo<SelectedItemWithQuantity[]>(() => {
    return planInstances
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .flatMap((pi) =>
        pi.items.map((item) => ({
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

  const getMealPlanLimits = useCallback(
    (type: MealPlanType): Record<string, number> => {
      return MEAL_PLAN_LIMITS[type];
    },
    []
  );

  const getMaxAllowedItemsByType = useCallback((): Record<string, number> => {
    const limits = { main: 0, side: 0, starch: 0 };
    for (const pi of planInstances) {
      const planLimits = getMealPlanLimits(pi.type);
      limits.main += planLimits.main;
      limits.side += planLimits.side;
      limits.starch += planLimits.starch;
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
            total + pi.items.filter((ai) => ai.name === item.name).length,
          0
        );
      }
      const pi = planInstances.find((p) => p.id === activePlanInstanceId);
      if (!pi) return 0;
      return pi.items.filter((ai) => ai.name === item.name).length;
    },
    [activePlanInstanceId, planInstances]
  );

  // ─── Meal Plan Management ───

  const handleMealPlanSelect = useCallback((type: MealPlanType) => {
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
        // Select: add one instance
        const maxOrder = prev.reduce(
          (max, pi) => Math.max(max, pi.displayOrder),
          -1
        );
        return [
          ...prev,
          {
            id: generatePlanId(),
            type,
            displayOrder: maxOrder + 1,
            items: [],
          },
        ];
      }
    });
  }, []);

  const handleMealPlanQuantityChange = useCallback(
    (type: MealPlanType, newQuantity: number) => {
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
    []
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
            const limits = MEAL_PLAN_LIMITS[pi.type];
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
            const limits = MEAL_PLAN_LIMITS[pi.type];
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
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          type: item.type,
          image: item.image,
        };

        return prev.map((pi) =>
          pi.id === targetId
            ? { ...pi, items: [...pi.items, newItem] }
            : pi
        );
      });
    },
    [] // stable — reads activePlanRef.current at call time
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
            if (ai.name === item.name) {
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
          const limits = MEAL_PLAN_LIMITS[targetPlan.type] || {};
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
    []
  );

  // ─── Query helpers ───

  const isItemSelected = useCallback(
    (item: MenuItem): boolean => {
      if (activePlanInstanceId) {
        const pi = planInstances.find((p) => p.id === activePlanInstanceId);
        if (!pi) return false;
        return pi.items.some((ai) => ai.name === item.name);
      }
      return planInstances.some((pi) =>
        pi.items.some((ai) => ai.name === item.name)
      );
    },
    [activePlanInstanceId, planInstances]
  );

  const getItemsByCategory = useCallback(
    (category: "main" | "side" | "starch"): MenuItem[] => {
      if (!menuData) return [];
      return menuData[category] || [];
    },
    [menuData]
  );

  const getMealPlanPrice = useCallback(
    (type: MealPlanType): number => {
      if (!menuData) return 0;
      const mainPrice = menuData.main?.[0]?.price ?? 0;
      const sidePrice = menuData.side?.[0]?.price ?? 0;
      const starchPrice = menuData.starch?.[0]?.price ?? 0;
      const limits = getMealPlanLimits(type);
      return (
        mainPrice * limits.main +
        sidePrice * limits.side +
        starchPrice * limits.starch
      );
    },
    [menuData, getMealPlanLimits]
  );

  const calculateTotalPrice = useCallback((): number => {
    return planInstances.reduce(
      (total, pi) => total + getMealPlanPrice(pi.type),
      0
    );
  }, [planInstances, getMealPlanPrice]);

  // ─── Persist cart to sessionStorage ───
  useEffect(() => {
    if (!slug) return;
    writeCart(slug, planInstances, activePlanInstanceId, calculateTotalPrice());
  }, [slug, planInstances, activePlanInstanceId, calculateTotalPrice]);

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
    planInstances,
    activePlanInstanceId,
    mealPlanOrders,
    selectedItems,
    loading,
    error,
    handleMealPlanSelect,
    handleMealPlanQuantityChange,
    handleItemAdd,
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
