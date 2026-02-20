import React, { useState } from 'react';
import ShoppingBagSidebar from '../Sidebar/Sidebar';
import type {
  MealPlanType,
  MealPlanOrder,
  SelectedItemWithQuantity,
} from '../../types';

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
  getTotalMealPlanCount
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
        className="fixed top-6 right-6 z-40 bg-brand-primary hover:bg-brand-primary/80 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg transition-colors"
        aria-label={`Shopping Bag with ${itemCount} items`}
      >
        <i className="pi pi-shopping-bag"></i>
        Shopping Bag
        {itemCount > 0 && (
          <span className="bg-white text-brand-primary rounded-full px-2 py-1 text-xs font-bold min-w-[20px]">
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
