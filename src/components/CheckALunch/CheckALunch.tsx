import React from 'react';
import ProductCatalog from '../ProductCatalog/ProductCatalog';
import { MealPlanType, MealPlanOrder, MenuItem, SelectedItemWithQuantity, MenuTypeData, CategoryType } from '../../types';
import { MEAL_PLAN_DESCRIPTIONS, CATEGORIES } from '../../constants';

interface CheckALunchProps {
  mealPlanOrders: MealPlanOrder[];
  selectedItems: SelectedItemWithQuantity[];
  menuData: MenuTypeData | null;
  loading: boolean;
  error: string | null;
  onMealPlanSelect: (type: MealPlanType) => void;
  onMealPlanQuantityChange: (type: MealPlanType, quantity: number) => void;
  onItemAdd: (item: MenuItem) => void;
  onItemRemove: (item: SelectedItemWithQuantity) => void;
  onItemQuantityDecrease: (item: MenuItem) => void;
  getMealPlanPrice: (type: MealPlanType) => number;
  getItemsByCategory: (category: CategoryType) => MenuItem[];
  getCategoryDisplayName: (category: string) => string;
  isItemSelected: (item: MenuItem) => boolean;
  getCurrentItemQuantity: (item: MenuItem) => number;
  getMaxAllowedItemsByType: () => Record<string, number>;
}

const CheckALunch: React.FC<CheckALunchProps> = ({
  mealPlanOrders,
  selectedItems,
  menuData,
  loading,
  error,
  onMealPlanSelect,
  onMealPlanQuantityChange,
  onItemAdd,
  onItemRemove,
  onItemQuantityDecrease,
  getMealPlanPrice,
  getItemsByCategory,
  getCategoryDisplayName,
  isItemSelected,
  getCurrentItemQuantity,
  getMaxAllowedItemsByType
}) => {
  if (loading || error || !menuData) {
    return null;
  }

  const mealPlanTypes: MealPlanType[] = ["Double The Protein", "Balanced Diet"];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Meal Plan Selection Buttons */}
      <div className="mb-12 text-center">
        <h2 className="text-2xl font-semibold text-brand-text mb-6">
          Choose Your Meal Plan
        </h2>
        <div className="flex flex-wrap gap-4 justify-center">
          {mealPlanTypes.map((type) => {
            const order = mealPlanOrders.find((order) => order.type === type);

            return (
              <div
                key={type}
                className="bg-white rounded-lg p-6 shadow-lg max-w-sm"
              >
                <h3 className="text-xl font-semibold text-brand-text mb-2">
                  {type}
                </h3>
                <p className="text-gray-600 mb-2">
                  {MEAL_PLAN_DESCRIPTIONS[type]}
                </p>
                <span className="font-bold text-brand-primary text-lg">
                  ₱{getMealPlanPrice(type)}
                </span>
                <div className="mt-4">
                  {order ? (
                    <div className="flex items-center gap-2 justify-center">
                      {/* Minus button */}
                      <button
                        onClick={() =>
                          onMealPlanQuantityChange(type, order.quantity - 1)
                        }
                        className="flex items-center justify-center w-8 h-8 bg-gray-300 hover:bg-gray-400 text-white rounded-full transition-colors"
                        title="Decrease quantity"
                      >
                        <i className="pi pi-minus" />
                      </button>

                      {/* Quantity input */}
                      <input
                        type="number"
                        value={order.quantity}
                        onChange={(e) =>
                          onMealPlanQuantityChange(
                            type,
                            parseInt(e.target.value) || 1
                          )
                        }
                        className="w-12 h-8 text-center border rounded"
                        min="1"
                      />

                      {/* Plus button */}
                      <button
                        onClick={() =>
                          onMealPlanQuantityChange(type, order.quantity + 1)
                        }
                        className="flex items-center justify-center w-8 h-8 bg-brand-primary hover:bg-brand-primary/80 text-white rounded-full transition-colors"
                        title="Increase quantity"
                      >
                        <i className="pi pi-plus"></i>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onMealPlanSelect(type)}
                      className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-lg font-medium bg-brand-primary hover:bg-brand-primary/80 text-white transition-colors"
                    >
                      <i className="pi pi-plus"></i>
                      Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Menu Items by Category */}
      <div className="space-y-16">
        {CATEGORIES.map((category) => {
          const items = getItemsByCategory(category);
          if (items.length === 0) return null;

          return (
            <div key={category}>
              <ProductCatalog
                items={items}
                selectedItems={items.filter((item) => isItemSelected(item))}
                onItemAdd={onItemAdd}
                onItemRemove={onItemRemove}
                onItemQuantityDecrease={onItemQuantityDecrease}
                title={getCategoryDisplayName(category)}
                isDisabled={mealPlanOrders.length === 0}
                getCurrentItemQuantity={getCurrentItemQuantity}
                getMaxAllowedItemsByType={getMaxAllowedItemsByType}
                selectedItemsWithQuantity={selectedItems}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CheckALunch;
