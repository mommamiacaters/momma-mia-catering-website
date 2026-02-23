import React, { useState } from "react";
import {
  UtensilsCrossed,
  Leaf,
  Wheat,
  Check,
  ChevronRight,
} from "lucide-react";
import {
  MealPlanType,
  MealPlanOrder,
  MenuItem,
  SelectedItemWithQuantity,
  MenuTypeData,
  CategoryType,
} from "../../types";
import { CATEGORIES } from "../../constants";
import MealPlanSelector from "./components/MealPlanSelector";
import FoodCard from "./components/FoodCard";
import TrayPreview from "./components/TrayPreview";

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

const CATEGORY_CONFIG: {
  type: CategoryType;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    type: "main",
    label: "Main Dish",
    icon: UtensilsCrossed,
    description: "Choose your protein",
  },
  {
    type: "side",
    label: "Side Dish",
    icon: Leaf,
    description: "Pick your greens & veggies",
  },
  {
    type: "starch",
    label: "Starch",
    icon: Wheat,
    description: "Select your carbs",
  },
];

const CheckALunch: React.FC<CheckALunchProps> = ({
  mealPlanOrders,
  selectedItems,
  menuData,
  loading,
  error,
  onMealPlanSelect,
  onMealPlanQuantityChange,
  onItemAdd,
  onItemQuantityDecrease,
  getMealPlanPrice,
  getItemsByCategory,
  getCategoryDisplayName,
  isItemSelected,
  getCurrentItemQuantity,
  getMaxAllowedItemsByType,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("main");

  if (loading || error || !menuData) return null;

  const hasMealPlan = mealPlanOrders.length > 0;
  const maxAllowed = getMaxAllowedItemsByType();
  const mealPlanTypes: MealPlanType[] = ["Double The Protein", "Balanced Diet"];

  const getSelectedCountByType = (type: CategoryType) =>
    selectedItems.filter((item) => item.type === type).length;

  const isCategoryComplete = (type: CategoryType) =>
    hasMealPlan &&
    (maxAllowed[type] || 0) > 0 &&
    getSelectedCountByType(type) >= (maxAllowed[type] || 0);

  const activeItems = getItemsByCategory(activeCategory);
  const activeMax = maxAllowed[activeCategory] || 0;
  const activeSelected = getSelectedCountByType(activeCategory);
  const isMaxReached = hasMealPlan && activeSelected >= activeMax;

  const nextIncompleteCategory = CATEGORIES.find(
    (cat) =>
      cat !== activeCategory &&
      (maxAllowed[cat] || 0) > 0 &&
      getSelectedCountByType(cat) < (maxAllowed[cat] || 0)
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* ─── Section Header ─── */}
      <div className="text-center mb-10">
        <span className="inline-block font-poppins text-xs font-semibold tracking-[0.2em] uppercase text-brand-primary mb-3">
          Step by Step
        </span>
        <h2 className="font-arvo text-3xl md:text-4xl font-bold text-brand-text mb-3">
          Build Your Lunch Box
        </h2>
        <p className="font-poppins text-brand-text/50 max-w-md mx-auto leading-relaxed">
          Choose a plan, pick your favorites, and we&rsquo;ll pack it fresh for
          you.
        </p>
      </div>

      {/* ─── Step 1: Meal Plan ─── */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <span
            className={`flex items-center justify-center w-9 h-9 rounded-full font-poppins text-sm font-bold shrink-0 transition-colors ${
              hasMealPlan
                ? "bg-brand-primary text-white"
                : "bg-brand-primary/10 text-brand-primary ring-2 ring-brand-primary/30"
            }`}
          >
            {hasMealPlan ? <Check size={16} strokeWidth={3} /> : "1"}
          </span>
          <div>
            <h3 className="font-arvo text-xl font-bold text-brand-text">
              Choose Your Plan
            </h3>
            <p className="font-poppins text-xs text-brand-text/40">
              How many dishes per lunch box?
            </p>
          </div>
        </div>

        <MealPlanSelector
          mealPlanTypes={mealPlanTypes}
          mealPlanOrders={mealPlanOrders}
          onSelect={onMealPlanSelect}
          onQuantityChange={onMealPlanQuantityChange}
          getPrice={getMealPlanPrice}
        />
      </section>

      {/* ─── Step 2: Pick Dishes ─── */}
      {hasMealPlan && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-8">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary ring-2 ring-brand-primary/30 font-poppins text-sm font-bold shrink-0">
              2
            </span>
            <div>
              <h3 className="font-arvo text-xl font-bold text-brand-text">
                Pick Your Dishes
              </h3>
              <p className="font-poppins text-xs text-brand-text/40">
                Fill each category to complete your lunch box
              </p>
            </div>
          </div>

          {/* ── Category Tabs ── */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-1 -mx-1 px-1">
            {CATEGORY_CONFIG.map(({ type, label, icon: Icon }) => {
              const isActive = activeCategory === type;
              const isComplete = isCategoryComplete(type);
              const count = getSelectedCountByType(type);
              const max = maxAllowed[type] || 0;

              return (
                <button
                  key={type}
                  onClick={() => setActiveCategory(type)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-poppins text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/25"
                      : isComplete
                        ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                        : "bg-white text-brand-text/60 border border-brand-divider hover:border-brand-primary/40 hover:text-brand-text"
                  }`}
                  aria-label={`${label}: ${count} of ${max} selected`}
                  aria-current={isActive ? "true" : undefined}
                >
                  {isComplete ? (
                    <Check size={15} strokeWidth={3} />
                  ) : (
                    <Icon size={15} />
                  )}
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">
                    {label.split(" ")[0]}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : isComplete
                          ? "bg-green-200/60 text-green-700"
                          : "bg-brand-secondary text-brand-text/50"
                    }`}
                  >
                    {count}/{max}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Active Category Header + Progress ── */}
          <div className="mb-6">
            <div className="flex items-end justify-between mb-2">
              <div>
                <h4 className="font-arvo text-2xl font-bold text-brand-text">
                  {getCategoryDisplayName(activeCategory)}
                </h4>
                <p className="font-poppins text-sm text-brand-text/40 mt-0.5">
                  {
                    CATEGORY_CONFIG.find((c) => c.type === activeCategory)
                      ?.description
                  }
                </p>
              </div>
              <span
                className={`font-poppins text-sm font-semibold px-3 py-1 rounded-full ${
                  isMaxReached
                    ? "bg-green-100 text-green-700"
                    : "bg-brand-secondary text-brand-text/50"
                }`}
              >
                {activeSelected} of {activeMax} selected
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-brand-divider/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  isMaxReached ? "bg-green-500" : "bg-brand-primary"
                }`}
                style={{
                  width:
                    activeMax > 0
                      ? `${Math.min(100, (activeSelected / activeMax) * 100)}%`
                      : "0%",
                }}
              />
            </div>
          </div>

          {/* ── Food Grid ── */}
          {activeItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeItems.map((item, index) => (
                <FoodCard
                  key={`${item.name}-${index}`}
                  item={item}
                  isSelected={isItemSelected(item)}
                  isDisabled={isMaxReached}
                  currentQuantity={getCurrentItemQuantity(item)}
                  onAdd={() => onItemAdd(item)}
                  onDecrease={() => onItemQuantityDecrease(item)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white/50 rounded-2xl border border-dashed border-brand-divider">
              <p className="font-poppins text-brand-text/40">
                No items available for this category yet.
              </p>
            </div>
          )}

          {/* ── Navigation Prompt ── */}
          {isMaxReached && nextIncompleteCategory && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setActiveCategory(nextIncompleteCategory)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary/10 hover:bg-brand-primary/15 text-brand-primary font-poppins font-semibold rounded-xl transition-all hover:gap-3"
              >
                Continue to{" "}
                {getCategoryDisplayName(nextIncompleteCategory)}
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </section>
      )}

      {/* ─── Tray Preview ─── */}
      {hasMealPlan && (
        <section className="mt-12">
          <TrayPreview
            selectedItems={selectedItems}
            maxAllowed={maxAllowed}
          />
        </section>
      )}
    </div>
  );
};

export default CheckALunch;
