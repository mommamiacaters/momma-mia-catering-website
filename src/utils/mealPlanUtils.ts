import type {
  MealPlanOrder,
  MealPlanInstance,
  SelectedItemWithQuantity,
  MealPlanType,
  PlanInstance,
} from "../types";
import { MEAL_PLAN_LIMITS } from "../constants";

/**
 * Flattens meal plan orders into individual instances.
 * e.g., "Double The Protein" qty 2 → 2 separate instances.
 */
export function createMealPlanInstances(
  mealPlanOrders: MealPlanOrder[]
): MealPlanInstance[] {
  const instances: MealPlanInstance[] = [];
  let globalIndex = 0;

  mealPlanOrders.forEach((order, orderIndex) => {
    for (let i = 0; i < order.quantity; i++) {
      instances.push({
        type: order.type,
        instanceIndex: i,
        globalIndex: globalIndex++,
        orderIndex,
      });
    }
  });

  return instances;
}

/**
 * Distributes selected items across meal plan instances,
 * respecting per-type limits for each plan type.
 */
export function distributeItemsAcrossMealPlans(
  mealPlanOrders: MealPlanOrder[],
  selectedItems: SelectedItemWithQuantity[],
  getMealPlanLimits: (type: MealPlanType) => Record<string, number>
): {
  instances: MealPlanInstance[];
  distribution: Record<number, SelectedItemWithQuantity[]>;
} {
  const instances = createMealPlanInstances(mealPlanOrders);
  const distribution: Record<number, SelectedItemWithQuantity[]> = {};

  instances.forEach((instance) => {
    distribution[instance.globalIndex] = [];
  });

  selectedItems.forEach((item) => {
    let placed = false;

    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i];
      const limits = getMealPlanLimits(instance.type);
      const currentItems = distribution[instance.globalIndex];
      const currentTypeCount = currentItems.filter(
        (existing) => existing.type === item.type
      ).length;

      if (currentTypeCount < limits[item.type]) {
        distribution[instance.globalIndex].push(item);
        placed = true;
        break;
      }
    }

    if (!placed && instances.length > 0) {
      distribution[instances[0].globalIndex].push(item);
    }
  });

  return { instances, distribution };
}

/**
 * Checks whether a PlanInstance has all its category slots filled.
 */
export function isPlanInstanceComplete(
  planInstance: PlanInstance
): boolean {
  const limits = MEAL_PLAN_LIMITS[planInstance.type];
  if (!limits) return false;

  for (const [catType, limit] of Object.entries(limits)) {
    const filled = planInstance.items.filter(
      (item) => item.type === catType
    ).length;
    if (filled < limit) return false;
  }
  return true;
}
