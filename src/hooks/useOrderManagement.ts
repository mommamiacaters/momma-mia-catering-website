import { useState, useEffect } from "react";
import type {
  MealPlanType,
  MealPlanOrder,
  SelectedItemWithQuantity,
  MenuItem,
  MenuTypeData,
} from "../types";
import { menuService } from "../services/menuService";
import { MEAL_PLAN_LIMITS } from "../constants";

export function useOrderManagement(
  slug: string | undefined,
  hasMenu: boolean
) {
  const [menuData, setMenuData] = useState<MenuTypeData | null>(null);
  const [mealPlanOrders, setMealPlanOrders] = useState<MealPlanOrder[]>([]);
  const [selectedItems, setSelectedItems] = useState<
    SelectedItemWithQuantity[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const getMealPlanLimits = (type: MealPlanType): Record<string, number> => {
    return MEAL_PLAN_LIMITS[type];
  };

  const getMaxAllowedItemsByType = (): Record<string, number> => {
    const limits = { main: 0, side: 0, starch: 0 };
    mealPlanOrders.forEach((order) => {
      const planLimits = getMealPlanLimits(order.type);
      limits.main += planLimits.main * order.quantity;
      limits.side += planLimits.side * order.quantity;
      limits.starch += planLimits.starch * order.quantity;
    });
    return limits;
  };

  const getCurrentItemQuantity = (item: MenuItem): number => {
    return selectedItems.filter((selected) => selected.name === item.name)
      .length;
  };

  const updateSelectedItemLimits = () => {
    const maxAllowed = getMaxAllowedItemsByType();
    const itemsToRemove = new Set<string>();

    // Count total items per category type
    const typeCounts: Record<string, number> = {};
    selectedItems.forEach((item) => {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    });

    // For each type over the limit, mark excess items for removal (LIFO)
    Object.entries(typeCounts).forEach(([type, count]) => {
      const max = maxAllowed[type] || 0;
      if (count > max) {
        const excess = count - max;
        const itemsOfType = selectedItems.filter(
          (item) => item.type === type
        );
        // Remove from the end (most recently added first)
        for (let i = 0; i < excess; i++) {
          const itemToRemove = itemsOfType[itemsOfType.length - 1 - i];
          if (itemToRemove) {
            itemsToRemove.add(itemToRemove.instanceId);
          }
        }
      }
    });

    if (itemsToRemove.size > 0) {
      setSelectedItems((prev) =>
        prev.filter((item) => !itemsToRemove.has(item.instanceId))
      );
    }
  };

  const handleMealPlanSelect = (type: MealPlanType) => {
    const existingOrder = mealPlanOrders.find((order) => order.type === type);

    if (existingOrder) {
      setMealPlanOrders((prev) =>
        prev.filter((order) => order.type !== type)
      );
      if (mealPlanOrders.length === 1) {
        setSelectedItems([]);
      }
    } else {
      setMealPlanOrders((prev) => [...prev, { type, quantity: 1 }]);
    }
  };

  const handleMealPlanQuantityChange = (
    type: MealPlanType,
    newQuantity: number
  ) => {
    if (newQuantity < 1) {
      setMealPlanOrders((prev) =>
        prev.filter((order) => order.type !== type)
      );
      const remainingPlans = mealPlanOrders.filter(
        (order) => order.type !== type
      );
      if (remainingPlans.length === 0) {
        setSelectedItems([]);
      }
      return;
    }

    setMealPlanOrders((prev) =>
      prev.map((order) =>
        order.type === type ? { ...order, quantity: newQuantity } : order
      )
    );
  };

  const handleItemAdd = (item: MenuItem) => {
    if (mealPlanOrders.length === 0) return;

    const maxAllowed = getMaxAllowedItemsByType();
    const currentQuantity = getCurrentItemQuantity(item);

    if (currentQuantity >= maxAllowed[item.type]) {
      alert(
        `Maximum ${maxAllowed[item.type]} ${item.type} dish(es) allowed based on your meal plans`
      );
      return;
    }

    const newInstance: SelectedItemWithQuantity = {
      ...item,
      quantity: 1,
      instanceId: `${item.name}-${Date.now()}-${Math.random()}`,
    };

    setSelectedItems((prev) => [...prev, newInstance]);
  };

  const handleItemQuantityDecrease = (item: MenuItem) => {
    const itemInstances = selectedItems.filter(
      (selected) => selected.name === item.name
    );
    if (itemInstances.length > 0) {
      const lastInstance = itemInstances[itemInstances.length - 1];
      handleItemRemove(lastInstance);
    }
  };

  const handleItemRemove = (item: SelectedItemWithQuantity) => {
    setSelectedItems((prev) =>
      prev.filter((selected) => selected.instanceId !== item.instanceId)
    );
  };

  const isItemSelected = (item: MenuItem): boolean => {
    return selectedItems.some((selected) => selected.name === item.name);
  };

  const getItemsByCategory = (
    category: "main" | "side" | "starch"
  ): MenuItem[] => {
    if (!menuData) return [];
    return menuData[category] || [];
  };

  const getMealPlanPrice = (type: MealPlanType): number => {
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
  };

  const calculateTotalPrice = (): number => {
    return mealPlanOrders.reduce(
      (total, order) => total + getMealPlanPrice(order.type) * order.quantity,
      0
    );
  };

  const getTotalItemsCount = (): number => {
    return (
      selectedItems.length +
      mealPlanOrders.reduce((total, order) => total + order.quantity, 0)
    );
  };

  const getTotalMealPlanCount = (): number => {
    return mealPlanOrders.reduce((total, order) => total + order.quantity, 0);
  };

  // Sync item limits when meal plans change
  useEffect(() => {
    if (mealPlanOrders.length > 0) {
      updateSelectedItemLimits();
    }
  }, [mealPlanOrders]);

  return {
    menuData,
    mealPlanOrders,
    selectedItems,
    loading,
    error,
    handleMealPlanSelect,
    handleMealPlanQuantityChange,
    handleItemAdd,
    handleItemQuantityDecrease,
    handleItemRemove,
    getMealPlanLimits,
    getMealPlanPrice,
    getMaxAllowedItemsByType,
    getCurrentItemQuantity,
    isItemSelected,
    getItemsByCategory,
    calculateTotalPrice,
    getTotalItemsCount,
    getTotalMealPlanCount,
  };
}
