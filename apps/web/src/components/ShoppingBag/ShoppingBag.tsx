import React, { useState } from "react";
import { ShoppingBag as ShoppingBagIcon } from "lucide-react";
import ShoppingBagSidebar from "../Sidebar/Sidebar";
import type {
  MealPlanType,
  PlanInstance,
} from "../../types";

interface ShoppingBagProps {
  isVisible?: boolean;
  planInstances: PlanInstance[];
  activePlanInstanceId: string | null;
  onSetActivePlan: (id: string | null) => void;
  onRemovePlanInstance: (id: string) => void;
  onReorderPlanInstances: (fromIndex: number, toIndex: number) => void;
  onAssignedItemRemove: (instanceId: string) => void;
  getMealPlanPrice: (type: MealPlanType) => number;
  getMealPlanLimits: (type: MealPlanType) => Record<string, number>;
  calculateTotalPrice: () => number;
  getTotalMealPlanCount: () => number;
  onMoveItem: (
    sourcePlanId: string,
    itemInstanceId: string,
    targetPlanId: string,
    targetItemInstanceId?: string
  ) => void;
  onCheckout?: () => void;
}

const ShoppingBag: React.FC<ShoppingBagProps> = ({
  isVisible = true,
  planInstances,
  activePlanInstanceId,
  onSetActivePlan,
  onRemovePlanInstance,
  onReorderPlanInstances,
  onAssignedItemRemove,
  getMealPlanPrice,
  getMealPlanLimits,
  calculateTotalPrice,
  getTotalMealPlanCount,
  onMoveItem,
  onCheckout,
}) => {
  const [isShoppingBagOpen, setIsShoppingBagOpen] = useState(false);

  if (!isVisible) return null;

  const itemCount = getTotalMealPlanCount();

  return (
    <>
      {/* Shopping Bag Button - Fixed Top Right */}
      <button
        id="bag-button"
        onClick={() => setIsShoppingBagOpen(!isShoppingBagOpen)}
        className="fixed top-6 right-6 z-40 group flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white border border-brand-divider text-brand-text shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all font-poppins font-semibold text-sm"
        aria-label={`Shopping Bag with ${itemCount} items`}
      >
        <ShoppingBagIcon
          size={18}
          className="text-brand-primary transition-transform group-hover:scale-110"
        />
        <span className="hidden sm:inline">Your Order</span>
        {itemCount > 0 && (
          <span className="bg-brand-primary text-white rounded-full min-w-[1.5rem] h-6 px-2 flex items-center justify-center text-xs font-bold tabular-nums">
            {itemCount}
          </span>
        )}
      </button>

      {/* Shopping Bag Sidebar */}
      <ShoppingBagSidebar
        visible={isShoppingBagOpen}
        onHide={() => setIsShoppingBagOpen(false)}
        planInstances={planInstances}
        activePlanInstanceId={activePlanInstanceId}
        onSetActivePlan={onSetActivePlan}
        onRemovePlanInstance={onRemovePlanInstance}
        onReorderPlanInstances={onReorderPlanInstances}
        onAssignedItemRemove={onAssignedItemRemove}
        getMealPlanPrice={getMealPlanPrice}
        getMealPlanLimits={getMealPlanLimits}
        calculateTotalPrice={calculateTotalPrice}
        getTotalMealPlanCount={getTotalMealPlanCount}
        onMoveItem={onMoveItem}
        onCheckout={onCheckout}
      />
    </>
  );
};

export default ShoppingBag;
