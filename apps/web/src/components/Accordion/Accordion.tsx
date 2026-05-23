import React from "react";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Plus, Minus } from "lucide-react";
import type {
  MealPlanType,
  SelectedItemWithQuantity,
} from "../../types";
import { getCategoryDisplayName } from "../../constants";
import { distributeItemsAcrossMealPlans } from "../../utils/mealPlanUtils";
import "./accordion.styles.css";

interface MealPlanAccordionProps {
  mealPlanOrders: Array<{
    type: MealPlanType;
    quantity: number;
  }>;
  selectedItems: SelectedItemWithQuantity[];
  onItemQuantityChange: (
    item: SelectedItemWithQuantity,
    newQuantity: number
  ) => void;
  onItemRemove: (item: SelectedItemWithQuantity) => void;
  getMealPlanLimits: (
    type: MealPlanType
  ) => Record<string, number>;
  calculateTotalPrice: () => number;
  getMaxAllowedItemsByType: () => Record<string, number>;
}

const MealPlanAccordion: React.FC<MealPlanAccordionProps> = ({
  mealPlanOrders,
  selectedItems,
  onItemQuantityChange,
  onItemRemove,
  getMealPlanLimits,
  calculateTotalPrice,
  getMaxAllowedItemsByType,
}) => {
  const { instances, distribution } = distributeItemsAcrossMealPlans(
    mealPlanOrders,
    selectedItems,
    getMealPlanLimits
  );

  // Create an array of all indices to have all accordion tabs open by default
  const allIndices = instances.map((_, index) => index);

  const canAddMoreItems = (type: string): boolean => {
    const maxAllowed = getMaxAllowedItemsByType();
    const currentCount = selectedItems
      .filter((item) => item.type === type)
      .reduce((sum, item) => sum + item.quantity, 0);
    return currentCount < maxAllowed[type];
  };

  const renderCategoryItems = (
    items: SelectedItemWithQuantity[],
    category: "main" | "side" | "starch",
    categoryLimit: number,
    instanceIndex: number
  ) => {
    const categoryItems = items.filter((item) => item.type === category);

    if (categoryLimit === 0) return null;

    const categoryDisplayName =
      getCategoryDisplayName(category) + (category !== "starch" ? "es" : "");

    return (
      <div className="mb-4">
        <h5 className="font-medium text-brand-text mb-2 text-sm">
          {categoryDisplayName} ({categoryItems.length}/{categoryLimit})
        </h5>
        <div className="space-y-2 ml-4">
          {categoryItems.map((item, index) => (
            <div
              key={`${category}-${instanceIndex}-${index}`}
              className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded"
            >
              <div className="flex-1">
                <span className="font-medium text-sm">{item.name}</span>
                {item.description && (
                  <p className="text-xs text-gray-600 mt-1">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {/* Minus button - matching ProductItem style */}
                  <button
                    onClick={() => onItemQuantityChange(item, 0)}
                    className="flex items-center justify-center w-8 h-8 bg-gray-300 hover:bg-gray-400 text-white rounded-full transition-colors"
                    title="Remove item"
                  >
                    <Minus size={14} />
                  </button>

                  {/* Quantity display */}
                  <span className="text-sm font-medium text-brand-text px-2">
                    {item.quantity}
                  </span>

                  {/* Plus button - matching ProductItem style */}
                  <button
                    onClick={() => {
                      // Find the original item in selectedItems and increase its quantity
                      const originalItem = selectedItems.find(
                        (si) => si.name === item.name
                      );
                      if (originalItem && canAddMoreItems(item.type)) {
                        onItemQuantityChange(
                          originalItem,
                          originalItem.quantity + 1
                        );
                      }
                    }}
                    disabled={!canAddMoreItems(item.type)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                      canAddMoreItems(item.type)
                        ? "bg-brand-primary hover:bg-brand-primary/80 text-white"
                        : "bg-gray-300 cursor-not-allowed text-gray-500"
                    }`}
                    title={
                      canAddMoreItems(item.type)
                        ? "Add another"
                        : "Maximum reached"
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* <span className="font-semibold text-brand-primary text-sm min-w-[50px] text-right">
                  ₱{item.price}
                </span> */}

                <button
                  onClick={() => onItemRemove(item)}
                  className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
                  title="Remove from meal plan"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {/* Show empty slots */}
          {Array.from({ length: categoryLimit - categoryItems.length }).map(
            (_, index) => (
              <div
                key={`empty-${category}-${instanceIndex}-${index}`}
                className="py-2 px-3 bg-gray-100 rounded border-2 border-dashed border-gray-300"
              >
                <span className="text-gray-500 text-sm italic">
                  No {categoryDisplayName.toLowerCase()} selected
                </span>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-12 bg-white rounded-lg shadow-lg p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h3 className="text-2xl font-semibold text-brand-text">
          Selected Items ({selectedItems.length})
        </h3>
      </div>

      <Accordion multiple activeIndex={allIndices} className="w-full">
        {instances.map((instance) => {
          const planLimits = getMealPlanLimits(instance.type);
          const instanceItems = distribution[instance.globalIndex] || [];

          return (
            <AccordionTab
              key={`${instance.type}-${instance.globalIndex}`}
              header={
                <div
                  className="flex items-start w-full"
                  style={{ paddingRight: "2rem" }}
                >
                  <div>
                    <h4 className="font-semibold text-brand-text text-base">
                      {instance.type}
                    </h4>
                  </div>
                </div>
              }
            >
              <div className="pl-8">
                {renderCategoryItems(
                  instanceItems,
                  "main",
                  planLimits.main,
                  instance.globalIndex
                )}
                {renderCategoryItems(
                  instanceItems,
                  "side",
                  planLimits.side,
                  instance.globalIndex
                )}
                {renderCategoryItems(
                  instanceItems,
                  "starch",
                  planLimits.starch,
                  instance.globalIndex
                )}

                {instanceItems.length === 0 && (
                  <p className="text-gray-500 text-center py-4 italic">
                    No items selected for this meal plan yet.
                  </p>
                )}
              </div>
            </AccordionTab>
          );
        })}
      </Accordion>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center text-lg font-semibold">
          <span>Total:</span>
          <span className="text-brand-primary">₱{calculateTotalPrice()}</span>
        </div>
      </div>
    </div>
  );
};

export default MealPlanAccordion;
