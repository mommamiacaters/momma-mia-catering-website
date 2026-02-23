import React, { useState } from "react";
import { ShoppingBag as ShoppingBagIcon } from "lucide-react";
import ShoppingBagSidebar from "../Sidebar/Sidebar";
import type {
  MealPlanType,
  MealPlanOrder,
  SelectedItemWithQuantity,
} from "../../types";

interface ShoppingBagProps {
  isVisible?: boolean;
  mealPlanOrders: MealPlanOrder[];
  selectedItems: SelectedItemWithQuantity[];
  onMealPlanQuantityChange: (type: MealPlanType, newQuantity: number) => void;
  onItemRemove: (item: SelectedItemWithQuantity) => void;
  getMealPlanPrice: (type: MealPlanType) => number;
  getMealPlanLimits: (type: MealPlanType) => Record<string, number>;
  calculateTotalPrice: () => number;
  getTotalItemsCount: () => number;
  getTotalMealPlanCount: () => number;
}

const ShoppingBag: React.FC<ShoppingBagProps> = ({
  isVisible = true,
  mealPlanOrders,
  selectedItems,
  onMealPlanQuantityChange,
  onItemRemove,
  getMealPlanPrice,
  getMealPlanLimits,
  calculateTotalPrice,
  getTotalItemsCount,
  getTotalMealPlanCount,
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
        mealPlanOrders={mealPlanOrders}
        selectedItems={selectedItems}
        onMealPlanQuantityChange={onMealPlanQuantityChange}
        onItemRemove={onItemRemove}
        getMealPlanPrice={getMealPlanPrice}
        getMealPlanLimits={getMealPlanLimits}
        calculateTotalPrice={calculateTotalPrice}
        getTotalItemsCount={getTotalItemsCount}
        getTotalMealPlanCount={getTotalMealPlanCount}
      />
    </>
  );
};

export default ShoppingBag;
