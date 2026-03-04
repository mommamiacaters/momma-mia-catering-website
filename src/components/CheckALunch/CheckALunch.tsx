import React, { useState, useEffect, useMemo } from "react";
import {
  UtensilsCrossed,
  Leaf,
  Wheat,
  Check,
  ChevronRight,
  Zap,
  Plus,
} from "lucide-react";
import {
  MealPlanType,
  MenuItem,
  MenuTypeData,
  CategoryType,
  PlanInstance,
} from "../../types";
import { CATEGORIES, MEAL_PLAN_LIMITS } from "../../constants";
import { isPlanInstanceComplete } from "../../utils/mealPlanUtils";
import { preloadImages, FALLBACK_IMAGE } from "../CachedImage";
import MealPlanSelector from "./components/MealPlanSelector";
import FoodCard from "./components/FoodCard";
import TrayPreview from "./components/TrayPreview";
import type { MealPlanOrder } from "../../types";

interface CheckALunchProps {
  mealPlanOrders: MealPlanOrder[];
  selectedItems: unknown[];
  planInstances: PlanInstance[];
  activePlanInstanceId: string | null;
  onSetActivePlan: (id: string | null) => void;
  menuData: MenuTypeData | null;
  loading: boolean;
  error: string | null;
  onMealPlanSelect: (type: MealPlanType) => void;
  onMealPlanQuantityChange: (type: MealPlanType, quantity: number) => void;
  onItemAdd: (item: MenuItem) => void;
  onItemRemove: (item: unknown) => void;
  onItemQuantityDecrease: (item: MenuItem) => void;
  getMealPlanPrice: (type: MealPlanType) => number;
  getItemsByCategory: (category: CategoryType) => MenuItem[];
  getCategoryDisplayName: (category: string) => string;
  isItemSelected: (item: MenuItem) => boolean;
  getCurrentItemQuantity: (item: MenuItem) => number;
  getMaxAllowedItemsByType: () => Record<string, number>;
  getActivePlanMaxAllowed: () => Record<string, number>;
  getActivePlanSelectedCount: (itemType: string) => number;
  onMoveItem: (
    sourcePlanId: string,
    itemInstanceId: string,
    targetPlanId: string,
    targetItemInstanceId?: string
  ) => void;
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

const CATEGORY_EMOJI: Record<string, string> = {
  main: "\u{1F356}",
  side: "\u{1F957}",
  starch: "\u{1F35A}",
};

const CheckALunch: React.FC<CheckALunchProps> = ({
  mealPlanOrders,
  planInstances,
  activePlanInstanceId,
  onSetActivePlan,
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
  getActivePlanMaxAllowed,
  getActivePlanSelectedCount,
  onMoveItem,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("main");

  // Preload ALL category images when menu data arrives
  useEffect(() => {
    if (!menuData) return;
    const allUrls: string[] = [];
    for (const cat of CATEGORIES) {
      const items = menuData[cat] || [];
      for (const item of items) {
        if (item.image) allUrls.push(item.image);
      }
    }
    preloadImages(allUrls);
  }, [menuData]);

  // ─── Memoized derived state ───

  const hasMealPlan = mealPlanOrders.length > 0;
  const mealPlanTypes: MealPlanType[] = useMemo(
    () => ["Double The Protein", "Balanced Diet"],
    []
  );

  const maxAllowed = useMemo(
    () => getActivePlanMaxAllowed(),
    [getActivePlanMaxAllowed]
  );

  // Per-category selection counts (stable across tab switches)
  const categoryCounts = useMemo(
    () => ({
      main: getActivePlanSelectedCount("main"),
      side: getActivePlanSelectedCount("side"),
      starch: getActivePlanSelectedCount("starch"),
    }),
    [getActivePlanSelectedCount]
  );

  // Per-category "is full" flags (don't depend on activeCategory!)
  const categoryFull = useMemo(
    () => ({
      main: hasMealPlan && categoryCounts.main >= (maxAllowed.main || 0),
      side: hasMealPlan && categoryCounts.side >= (maxAllowed.side || 0),
      starch:
        hasMealPlan && categoryCounts.starch >= (maxAllowed.starch || 0),
    }),
    [hasMealPlan, categoryCounts, maxAllowed]
  );

  const activeMax = maxAllowed[activeCategory] || 0;
  const activeSelected = categoryCounts[activeCategory];
  const isMaxReached = categoryFull[activeCategory];

  const nextIncompleteCategory = CATEGORIES.find(
    (cat) =>
      cat !== activeCategory &&
      (maxAllowed[cat] || 0) > 0 &&
      !categoryFull[cat]
  );

  // Sorted plan instances + numbering (memoized)
  const { sortedInstances, instanceNumbers } = useMemo(() => {
    const sorted = [...planInstances].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );
    const counters = new Map<MealPlanType, number>();
    const numbers = new Map<string, number>();
    for (const pi of sorted) {
      const n = (counters.get(pi.type) || 0) + 1;
      counters.set(pi.type, n);
      numbers.set(pi.id, n);
    }
    return { sortedInstances: sorted, instanceNumbers: numbers };
  }, [planInstances]);

  // Active plan for mini preview
  const { activePlan, activePlanNum, activePlanLimits } = useMemo(() => {
    const plan = activePlanInstanceId
      ? sortedInstances.find((p) => p.id === activePlanInstanceId)
      : null;
    return {
      activePlan: plan || null,
      activePlanNum: plan ? instanceNumbers.get(plan.id) || 1 : 0,
      activePlanLimits: plan ? MEAL_PLAN_LIMITS[plan.type] || {} : {},
    };
  }, [activePlanInstanceId, sortedInstances, instanceNumbers]);

  if (loading || error || !menuData) return null;

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
          Choose a plan, pick your favorites, and we&rsquo;ll pack it fresh
          for you.
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
        <section id="dish-picker-section" className="mb-10">
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

          {/* ── Plan Instance Selector ── */}
          {sortedInstances.length > 1 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pt-1 pb-1 -mx-1 px-1">
              <button
                onClick={() => onSetActivePlan(null)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-poppins text-xs font-semibold whitespace-nowrap transition-colors border ${
                  !activePlanInstanceId
                    ? "bg-brand-primary text-white border-brand-primary shadow-md"
                    : "bg-white text-brand-text/60 border-brand-divider hover:border-brand-primary/40"
                }`}
              >
                <Zap size={12} />
                Auto-fill
              </button>

              {sortedInstances.map((pi) => {
                const isActive = activePlanInstanceId === pi.id;
                const isComplete = isPlanInstanceComplete(pi);
                const limits = MEAL_PLAN_LIMITS[pi.type] || {};
                const totalSlots = Object.values(limits).reduce(
                  (a: number, b) => a + (b as number),
                  0
                );
                const filledSlots = pi.items.length;
                const instanceNum = instanceNumbers.get(pi.id) || 1;

                return (
                  <button
                    key={pi.id}
                    onClick={() => onSetActivePlan(pi.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-poppins text-xs font-semibold whitespace-nowrap transition-colors border ${
                      isActive
                        ? "ring-2 ring-brand-primary bg-brand-primary/10 text-brand-primary border-brand-primary"
                        : isComplete
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-white text-brand-text/60 border-brand-divider hover:border-brand-primary/40"
                    }`}
                  >
                    {isComplete && <Check size={11} strokeWidth={3} />}
                    <span className="truncate max-w-[8rem]">
                      {pi.type} #{instanceNum}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[0.6rem] font-bold ${
                        isActive
                          ? "bg-brand-primary/20 text-brand-primary"
                          : isComplete
                            ? "bg-green-200/60 text-green-700"
                            : "bg-brand-secondary text-brand-text/40"
                      }`}
                    >
                      {filledSlots}/{totalSlots}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Active plan indicator with mini tray preview ── */}
          {activePlan && (
            <div className="mb-6 bg-brand-primary/5 border border-brand-primary/20 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2">
                <span className="font-poppins text-xs text-brand-primary font-medium">
                  Filling:{" "}
                  <strong>
                    {activePlan.type} #{activePlanNum}
                  </strong>
                </span>
                <button
                  onClick={() => onSetActivePlan(null)}
                  className="ml-auto font-poppins text-xs text-brand-text/40 hover:text-brand-primary transition-colors"
                >
                  Switch to auto-fill
                </button>
              </div>

              <div className="px-4 pb-3 flex gap-4">
                {CATEGORIES.map((catType) => {
                  const limit =
                    (activePlanLimits[catType] as number) || 0;
                  if (limit === 0) return null;
                  const catItems = activePlan.items.filter(
                    (i) => i.type === catType
                  );
                  const catComplete = catItems.length >= limit;
                  return (
                    <div
                      key={catType}
                      className="flex items-center gap-1.5"
                    >
                      <span className="text-xs" aria-hidden="true">
                        {CATEGORY_EMOJI[catType]}
                      </span>
                      <div className="flex gap-1">
                        {catItems.map((item) => (
                          <div
                            key={item.instanceId}
                            className="w-7 h-7 rounded-md overflow-hidden border border-brand-primary/30 shadow-sm"
                            title={item.name}
                          >
                            <img
                              src={item.image || FALLBACK_IMAGE}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                        {Array.from({
                          length: Math.max(0, limit - catItems.length),
                        }).map((_, i) => (
                          <div
                            key={`e-${catType}-${i}`}
                            className="w-7 h-7 rounded-md border border-dashed border-brand-divider/60 flex items-center justify-center bg-white/50"
                          >
                            <Plus
                              size={10}
                              className="text-brand-divider"
                            />
                          </div>
                        ))}
                      </div>
                      <span
                        className={`font-poppins text-[0.6rem] font-semibold ${
                          catComplete
                            ? "text-green-600"
                            : "text-brand-text/30"
                        }`}
                      >
                        {catItems.length}/{limit}
                        {catComplete && " \u2713"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Category Tabs ── */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-1 -mx-1 px-1">
            {CATEGORY_CONFIG.map(({ type, label, icon: Icon }) => {
              const isActive = activeCategory === type;
              const isComplete = categoryFull[type];
              const count = categoryCounts[type];
              const max = maxAllowed[type] || 0;

              return (
                <button
                  key={type}
                  onClick={() => setActiveCategory(type)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-poppins text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
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
                    CATEGORY_CONFIG.find(
                      (c) => c.type === activeCategory
                    )?.description
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

            <div className="h-1.5 bg-brand-divider/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${
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

          {/* ── Food Grids — opacity-based switching for instant compositor toggle ── */}
          <div className="relative">
            {CATEGORIES.map((cat) => {
              const items = getItemsByCategory(cat);
              const isActiveTab = activeCategory === cat;
              const isCatFull = categoryFull[cat];

              return (
                <div
                  key={cat}
                  className={
                    isActiveTab
                      ? "relative"
                      : "absolute top-0 left-0 w-full opacity-0 pointer-events-none"
                  }
                  aria-hidden={!isActiveTab}
                >
                  {items.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {items.map((item, index) => (
                        <FoodCard
                          key={`${item.name}-${index}`}
                          item={item}
                          isSelected={isItemSelected(item)}
                          isDisabled={isCatFull}
                          currentQuantity={getCurrentItemQuantity(item)}
                          onAdd={() => onItemAdd(item)}
                          onDecrease={() =>
                            onItemQuantityDecrease(item)
                          }
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
                </div>
              );
            })}
          </div>

          {/* ── Navigation Prompt ── */}
          {isMaxReached && nextIncompleteCategory && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setActiveCategory(nextIncompleteCategory)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary/10 hover:bg-brand-primary/15 text-brand-primary font-poppins font-semibold rounded-xl transition-colors hover:gap-3"
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
            planInstances={planInstances}
            activePlanInstanceId={activePlanInstanceId}
            onSetActivePlan={onSetActivePlan}
            onMoveItem={onMoveItem}
          />
        </section>
      )}
    </div>
  );
};

export default CheckALunch;
