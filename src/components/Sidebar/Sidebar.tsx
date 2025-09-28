import React from "react";
import { Sidebar } from "primereact/sidebar";
import ProgressBar from "../ProgressBar/ProgressBar";

type MealPlanType = "Double The Protein" | "Balanced Diet";

interface MealPlanOrder {
  type: MealPlanType;
  quantity: number;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  type: string;
  image?: string;
}

interface SelectedItemWithQuantity extends MenuItem {
  quantity: number;
}

interface ShoppingBagSidebarProps {
  visible: boolean;
  onHide: () => void;
  mealPlanOrders: MealPlanOrder[];
  selectedItems: SelectedItemWithQuantity[];
  onMealPlanQuantityChange: (type: MealPlanType, newQuantity: number) => void;
  onItemQuantityChange: (
    item: SelectedItemWithQuantity,
    newQuantity: number
  ) => void;
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
  onItemQuantityChange,
  onItemRemove,
  getMealPlanPrice,
  getMealPlanLimits,
  calculateTotalPrice,
  getTotalItemsCount,
  getTotalMealPlanCount,
}) => {
  const MINIMUM_ITEMS = 2;
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

  // Function to remove a single instance of an item from a specific meal plan
  const removeSingleItemInstance = (item: SelectedItemWithQuantity) => {
    // Use the parent's onItemRemove function which now handles single instance removal
    onItemRemove(item);
  };

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
              Please select a minimum of {MINIMUM_ITEMS} meals
            </p>
            <ProgressBar
              size="small"
              label=""
              showPercentage={false}
              current={getTotalMealPlanCount()}
              total={MINIMUM_ITEMS}
            />
          </div>
        )}

        {/* Content */}
        <div className="mt-4 flex-1 overflow-y-auto" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          <div className="space-y-3 h-full">
            {/* Create individual meal plan instances */}
            {(() => {
              // Create separate instances for each meal plan quantity
              const createMealPlanInstances = () => {
                const instances: Array<{
                  type: "Double The Protein" | "Balanced Diet";
                  instanceIndex: number;
                  globalIndex: number;
                  orderIndex: number;
                }> = [];

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
              };

              // Distribute selected items across meal plan instances
              const distributeItemsAcrossMealPlans = () => {
                const instances = createMealPlanInstances();
                const distribution: {
                  [key: number]: SelectedItemWithQuantity[];
                } = {};

                // Initialize empty arrays for each instance
                instances.forEach((instance) => {
                  distribution[instance.globalIndex] = [];
                });

                // Group items by type
                const itemsByType = {
                  main: selectedItems.filter((item) => item.type === "main"),
                  side: selectedItems.filter((item) => item.type === "side"),
                  starch: selectedItems.filter(
                    (item) => item.type === "starch"
                  ),
                };

                // Distribute items across instances - PRIORITY FILL APPROACH
                ["main", "side", "starch"].forEach((type) => {
                  const items = itemsByType[type as keyof typeof itemsByType];

                  items.forEach((item) => {
                    for (let q = 0; q < item.quantity; q++) {
                      // Find first available instance that can accept this item type
                      let placed = false;

                      // Go through instances in order (first to last)
                      for (let i = 0; i < instances.length; i++) {
                        const instance = instances[i];
                        const limits = getMealPlanLimits(instance.type);
                        const currentItems = distribution[instance.globalIndex];
                        const currentTypeCount = currentItems.filter(
                          (item) => item.type === type
                        ).length;

                        if (currentTypeCount < limits[type]) {
                          // Add single quantity item to this instance
                          distribution[instance.globalIndex].push({
                            ...item,
                            quantity: 1,
                          });
                          placed = true;
                          break; // Stop looking once we've placed the item
                        }
                      }

                      if (!placed) {
                        // If we can't place the item, add it to the first available instance
                        const firstInstance = instances[0];
                        if (firstInstance) {
                          distribution[firstInstance.globalIndex].push({
                            ...item,
                            quantity: 1,
                          });
                        }
                      }
                    }
                  });
                });

                return { instances, distribution };
              };

              const { instances, distribution } =
                distributeItemsAcrossMealPlans();

              return instances.map((instance) => {
                const limits = getMealPlanLimits(instance.type);
                const instanceItems = distribution[instance.globalIndex] || [];
                const order = mealPlanOrders[instance.orderIndex];
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
                              category === "main"
                                ? "Main Dish"
                                : category === "side"
                                ? "Side Dish"
                                : "Starch";

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
                                  {categoryItems.map((item, itemIndex) => (
                                    <div
                                      key={`${item.name}-${itemIndex}`}
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
                                        {/* <button
                                          onClick={() =>
                                            onItemQuantityChange(
                                              item,
                                              item.quantity - 1
                                            )
                                          }
                                          className="w-5 h-5 bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs rounded-full flex items-center justify-center transition-colors"
                                        >
                                          <i className="pi pi-minus text-xs"></i>
                                        </button>
                                        <span className="w-5 text-center text-xs font-medium">
                                          {item.quantity}
                                        </span>
                                        <button
                                          onClick={() =>
                                            onItemQuantityChange(
                                              item,
                                              item.quantity + 1
                                            )
                                          }
                                          className="w-5 h-5 bg-brand-primary hover:bg-brand-primary text-white text-xs rounded-full flex items-center justify-center transition-colors"
                                        >
                                          <i className="pi pi-plus text-xs"></i>
                                        </button> */}
                                        <button
                                          onClick={() =>
                                            removeSingleItemInstance(item)
                                          }
                                          className="ml-1 w-5 h-5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full flex items-center justify-center transition-colors"
                                          title="Remove one instance of this item"
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
              });
            })()}

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
                  getTotalMealPlanCount() < MINIMUM_ITEMS
                    ? "bg-brand-primary text-white cursor-not-allowed"
                    : "bg-brand-primary hover:bg-brand-primary/80 text-white"
                }`}
                disabled={getTotalMealPlanCount() < MINIMUM_ITEMS}
              >
                {getTotalMealPlanCount() < MINIMUM_ITEMS
                  ? `Please select ${
                      MINIMUM_ITEMS - getTotalMealPlanCount()
                    } more meal${
                      MINIMUM_ITEMS - getTotalMealPlanCount() === 1 ? "" : "s"
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
