import React from "react";
import { Sidebar } from "primereact/sidebar";
import ProgressBar from "../ProgressBar/ProgressBar";
import type {
  MealPlanType,
  MealPlanOrder,
  SelectedItemWithQuantity,
} from "../../types";
import { MINIMUM_MEAL_PLANS, getCategoryDisplayName } from "../../constants";
import { distributeItemsAcrossMealPlans } from "../../utils/mealPlanUtils";

interface ShoppingBagSidebarProps {
  visible: boolean;
  onHide: () => void;
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

const ShoppingBagSidebar: React.FC<ShoppingBagSidebarProps> = ({
  visible,
  onHide,
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
  const isCartEmpty = mealPlanOrders.length === 0 && selectedItems.length === 0;

  // Function to remove a single meal plan instance
  const removeSingleMealPlan = (type: MealPlanType) => {
    const currentOrder = mealPlanOrders.find((order) => order.type === type);
    if (currentOrder && currentOrder.quantity > 1) {
      // If there are multiple instances, reduce by 1
      onMealPlanQuantityChange(type, currentOrder.quantity - 1);
    } else {
      // If this is the last instance, remove completely
      onMealPlanQuantityChange(type, 0);
    }
  };

  // Function to remove a specific item instance by its unique ID
  const removeSingleItemInstance = (item: SelectedItemWithQuantity) => {
    onItemRemove(item);
  };

  // Compute meal plan distribution above the return
  const { instances, distribution } = distributeItemsAcrossMealPlans(
    mealPlanOrders,
    selectedItems,
    getMealPlanLimits
  );

  return (
    <Sidebar
      visible={visible}
      position="right"
      onHide={onHide}
      className="!w-96 bg-brand-secondary text-brand-text"
      header="Shopping Bag"
    >
      <div className="h-full flex flex-col bg-brand-secondary align-items-center justify-center">
        {/* Header */}
        {!isCartEmpty && (
          <div className="p-4 border-b bg-brand-secondary sticky top-0 z-10 bg-white rounded-lg">
            <p className="text-xs text-brand-text mb-2 text-center">
              Please select a minimum of {MINIMUM_MEAL_PLANS} meals
            </p>
            <ProgressBar
              size="small"
              label=""
              showPercentage={false}
              current={getTotalMealPlanCount()}
              total={MINIMUM_MEAL_PLANS}
            />
          </div>
        )}

        {/* Content */}
        <div className="mt-4 flex-1 overflow-y-auto" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          <div className="space-y-3 h-full">
            {instances.map((instance) => {
              const limits = getMealPlanLimits(instance.type);
              const instanceItems = distribution[instance.globalIndex] || [];
              const isMealEmpty = instanceItems.length === 0;

              return (
                <div
                  key={`${instance.type}-${instance.globalIndex}`}
                  className="bg-white rounded-lg border border-brand-divider mb-3"
                >
                  {/* Meal Plan Header */}
                  <div className="p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-800 text-sm leading-tight">
                          {instance.type} #{instance.instanceIndex + 1}
                        </h3>
                        <p className="font-semibold text-orange-600 text-sm mt-1">
                          ₱{getMealPlanPrice(instance.type)}
                        </p>
                      </div>
                      {/* Remove button for single instance */}
                      <div className="flex h-full items-center gap-1.5 ml-2">
                        <button
                          onClick={() => removeSingleMealPlan(instance.type)}
                          className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white text-xs rounded-full flex items-center justify-center transition-colors"
                          title="Remove this meal plan"
                        >
                          <i className="pi pi-trash text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Selected Items for this Instance */}
                  <div className="border-t border-brand-divider bg-white bg-opacity-50">
                    {!isMealEmpty ? (
                      (["main", "side", "starch"] as const).map(
                        (category) => {
                          const categoryItems = instanceItems.filter(
                            (item) => item.type === category
                          );
                          const categoryLimit = limits[category];

                          if (categoryLimit === 0) return null;

                          const categoryDisplayName =
                            getCategoryDisplayName(category);

                          return (
                            <div
                              key={category}
                              className="p-3 border-b border-orange-100 last:border-b-0"
                            >
                              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                                {categoryDisplayName} ({categoryItems.length}/
                                {categoryLimit})
                              </h4>

                              <div className="space-y-2">
                                {/* Show selected items */}
                                {categoryItems.map((item) => (
                                  <div
                                    key={item.instanceId}
                                    className="flex justify-between items-center p-2"
                                  >
                                    <div className="flex items-center flex-1 min-w-0">
                                      {/* Product Image */}
                                      {item.image && (
                                        <div className="w-10 h-10 mr-3 rounded overflow-hidden flex-shrink-0">
                                          <img
                                            src={item.image}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                      {/* Product Name */}
                                      <div className="flex-1 min-w-0">
                                        <h5 className="font-medium text-gray-800 text-sm leading-tight">
                                          {item.name}
                                        </h5>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-2">
                                      <button
                                        onClick={() =>
                                          removeSingleItemInstance(item)
                                        }
                                        className="ml-1 w-5 h-5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full flex items-center justify-center transition-colors"
                                        title="Remove this item"
                                      >
                                        <i className="pi pi-trash text-xs"></i>
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                {/* Show empty slots */}
                                {Array.from({
                                  length:
                                    categoryLimit - categoryItems.length,
                                }).map((_, index) => (
                                  <div
                                    key={`empty-${category}-${instance.globalIndex}-${index}`}
                                    className="py-2 px-3 bg-gray-100 rounded border-2 border-dashed border-gray-300"
                                  >
                                    <span className="text-brand-text text-xs italic">
                                      No {categoryDisplayName.toLowerCase()}{" "}
                                      selected
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                      )
                    ) : (
                      <div className="p-3 text-center">
                        <span className="text-brand-text text-xs italic">
                          No items selected for this meal plan yet
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty State */}
            {isCartEmpty && (
              <div className="text-center pb-24 h-full align-items-center justify-center flex flex-col">
                <i className="pi pi-shopping-bag text-3xl text-brand-primary mb-3"></i>
                <p className="text-brand-text text-sm">
                  Your shopping bag is empty
                </p>
                <p className="text-xs text-brand-primary mt-1">
                  Start by selecting a meal plan
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Total and Actions */}
        {(mealPlanOrders.length > 0 || selectedItems.length > 0) && (
          <div className="border-t bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-gray-800">Subtotal</span>
              <span className="font-bold text-lg text-orange-600">
                ₱{calculateTotalPrice()}
              </span>
            </div>
            <p className="text-xs text-brand-text mb-4">
              Shipping and taxes calculated at checkout.
            </p>

            <div className="space-y-2">
              <button
                className={`w-full py-3 rounded-lg font-medium text-sm transition-colors ${
                  getTotalMealPlanCount() < MINIMUM_MEAL_PLANS
                    ? "bg-brand-primary text-white cursor-not-allowed"
                    : "bg-brand-primary hover:bg-brand-primary/80 text-white"
                }`}
                disabled={getTotalMealPlanCount() < MINIMUM_MEAL_PLANS}
              >
                {getTotalMealPlanCount() < MINIMUM_MEAL_PLANS
                  ? `Please select ${
                      MINIMUM_MEAL_PLANS - getTotalMealPlanCount()
                    } more meal${
                      MINIMUM_MEAL_PLANS - getTotalMealPlanCount() === 1 ? "" : "s"
                    }`
                  : "Proceed to Checkout"}
              </button>
              <button
                onClick={onHide}
                className="w-full border border-brand-primary text-brand-primary py-3 rounded-lg font-medium text-sm hover:bg-brand-primary hover:text-white transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
};

export default ShoppingBagSidebar;
