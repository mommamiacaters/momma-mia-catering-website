import React, { useState, useEffect, useMemo } from "react";
import { Check, ChevronRight, Zap, Info } from "lucide-react";
import {
  deriveMinimumState,
  useStoreSettings,
} from "../../hooks/useStoreSettings";
import {
  MealPlanType,
  MenuItem,
  MenuTypeData,
  CategoryType,
  PlanInstance,
  SelectedItemWithQuantity,
} from "../../types";
import { isPlanInstanceComplete } from "../../utils/mealPlanUtils";
import { PLAN_SLOT_META, PLAN_SLOTS } from "../../constants/planSlots";
import type { MealPlan } from "../../services/menuService";
import { preloadImages } from "../CachedImage";
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
  onItemRemove: (item: SelectedItemWithQuantity) => void;
  onItemQuantityDecrease: (item: MenuItem) => void;
  /** Bulk fill/clear across every box — see useOrderManagement. */
  onItemAddMany: (item: MenuItem, count: number) => void;
  onItemRemoveMany: (item: MenuItem, count: number) => void;
  getOpenSlotsForType: (itemType: string) => number;
  getTotalPlacedCount: (item: MenuItem) => number;
  plans: MealPlan[];
  getMealPlanPrice: (type: MealPlanType, planInstanceId?: string) => number;
  getMealPlanLimits: (type: MealPlanType) => Record<string, number>;
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

/** Icons now live in the shared meta too — see planSlots.ts. */
const CATEGORY_CONFIG = PLAN_SLOT_META.map(({ slot, label, description, Icon }) => ({
  type: slot,
  label,
  description,
  icon: Icon,
}));

/** Every slot, in menu order. Which ones apply depends on the chosen plan. */
const CATEGORIES: CategoryType[] = PLAN_SLOTS;

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
  onItemAddMany,
  onItemRemoveMany,
  getOpenSlotsForType,
  getTotalPlacedCount,
  plans,
  getMealPlanPrice,
  getMealPlanLimits,
  getItemsByCategory,
  getCategoryDisplayName,
  isItemSelected,
  getCurrentItemQuantity,
  getActivePlanMaxAllowed,
  getActivePlanSelectedCount,
  onMoveItem,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>("main");

  // Order minimum, set by the admin in app_settings. planInstances.length is the
  // same figure getTotalMealPlanCount() gives the cart, and deriveMinimumState is
  // the same derivation the cart uses, so this notice and the checkout gate can
  // never disagree.
  const {
    minimumMealPlans,
    error: settingsError,
    retry: retrySettings,
  } = useStoreSettings();
  const totalBoxes = planInstances.length;
  const min = deriveMinimumState(minimumMealPlans, totalBoxes);

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

  const maxAllowed = useMemo(
    () => getActivePlanMaxAllowed(),
    [getActivePlanMaxAllowed]
  );

  // Per-slot selection counts, built over every slot so adding one to a plan
  // needs no change here.
  const categoryCounts = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((slot) => [slot, getActivePlanSelectedCount(slot)])
      ) as Record<CategoryType, number>,
    [getActivePlanSelectedCount]
  );

  // Per-slot "is full" flags (must not depend on activeCategory)
  const categoryFull = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((slot) => [
          slot,
          hasMealPlan && categoryCounts[slot] >= (maxAllowed[slot] || 0),
        ])
      ) as Record<CategoryType, boolean>,
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
  const { activePlan, activePlanNum } = useMemo(() => {
    const plan = activePlanInstanceId
      ? sortedInstances.find((p) => p.id === activePlanInstanceId)
      : null;
    return {
      activePlan: plan || null,
      activePlanNum: plan ? instanceNumbers.get(plan.id) || 1 : 0,
    };
  }, [activePlanInstanceId, sortedInstances, instanceNumbers]);

  if (loading || error || !menuData) return null;

  return (
    <div className="max-w-7xl mx-auto overflow-x-clip">
      {/* ─── Section Header ─── */}
      <div className="text-center mb-10">
        <span className="inline-block font-poppins text-xs font-semibold tracking-[0.2em] uppercase text-brand-primary mb-3">
          Step by Step
        </span>
        <h2 className="font-arvo text-3xl md:text-4xl font-bold text-brand-text px-2">
          Build Your Lunch Box
        </h2>
        {/* Short rule instead of a gradient fill — the emphasis sits beside the
            words rather than fighting them for contrast. */}
        <span
          className="mx-auto mt-4 mb-5 block h-1 w-16 rounded-full bg-brand-primary"
          aria-hidden="true"
        />
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

        {/* ── Order minimum ──
            A persistent banner rather than a hover tooltip: this rule blocks
            checkout, and hover doesn't exist on touch. Hidden when the minimum
            is 1, where it would be pure noise. */}
        {min.active && (
          <div
            role="status"
            aria-live="polite"
            className={`mb-6 rounded-xl border px-4 py-3 transition-colors ${
              min.met
                ? "bg-green-50 border-green-200"
                : "bg-brand-primary/5 border-brand-primary/25"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {min.met ? (
                <Check
                  size={18}
                  strokeWidth={3}
                  className="text-green-600 shrink-0"
                />
              ) : (
                <Info size={18} className="text-brand-primary shrink-0" />
              )}
              <p className="font-poppins text-sm text-brand-text">
                <strong className="font-semibold">
                  Minimum {min.minimum} lunch boxes per order.
                </strong>{" "}
                {min.met ? (
                  <span className="text-green-700">
                    You have {totalBoxes} — you&rsquo;re good to go.
                  </span>
                ) : (
                  <span className="text-brand-text/60">
                    You have {totalBoxes}; add {min.remaining} more to check
                    out.
                  </span>
                )}
              </p>
              <span
                className={`ml-auto shrink-0 font-poppins text-sm font-bold tabular-nums px-2.5 py-1 rounded-full ${
                  min.met
                    ? "bg-green-200/60 text-green-700"
                    : "bg-brand-primary/10 text-brand-primary"
                }`}
              >
                {totalBoxes}/{min.minimum}
              </span>
            </div>

            <div className="mt-2.5 h-1.5 bg-white/70 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                  min.met ? "bg-green-500" : "bg-brand-primary"
                }`}
                style={{
                  width: `${Math.min(100, (totalBoxes / min.minimum) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* A settings outage must be visible here, not silently hide the notice
            while the cart quietly blocks checkout with no explanation. */}
        {settingsError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-2.5"
          >
            <Info size={18} className="text-amber-600 shrink-0" />
            <p className="font-poppins text-sm text-brand-text">
              We couldn&rsquo;t load this store&rsquo;s order rules, so checkout
              is paused. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={retrySettings}
              className="ml-auto shrink-0 font-poppins text-sm font-semibold text-amber-700 underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <MealPlanSelector
          plans={plans}
          mealPlanOrders={mealPlanOrders}
          onSelect={onMealPlanSelect}
          onQuantityChange={onMealPlanQuantityChange}
          getPrice={getMealPlanPrice}
        />
      </section>

      {/* ─── Step 2: Lunch Box (sticky) + Dish Picker ───
          items-start is load-bearing: grid children stretch by default, and a
          full-height column can't scroll-stick. min-w-0 on the picker lets the
          card grid shrink instead of forcing the page wider. */}
      {hasMealPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-8 lg:items-start">
          {/* ── Lunch Box summary — sticky beside the dishes on desktop, below
                them on mobile (where the floating bag button covers checkout) ── */}
          <aside className="order-2 lg:order-1 mt-12 lg:mt-0 lg:sticky lg:top-24">
            <TrayPreview
              compact
              planInstances={planInstances}
              activePlanInstanceId={activePlanInstanceId}
              getMealPlanLimits={getMealPlanLimits}
              onSetActivePlan={onSetActivePlan}
              onMoveItem={onMoveItem}
            />
          </aside>

          <section
            id="dish-picker-section"
            className="order-1 lg:order-2 lg:col-span-2 min-w-0 mb-10"
          >
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
            <div className="flex flex-wrap gap-2 mb-6 pt-1 pb-1 -mx-1 px-1">
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
                const limits = getMealPlanLimits(pi.type);
                const isComplete = isPlanInstanceComplete(pi, limits);
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
                      #{instanceNum} {pi.type}
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
                    #{activePlanNum} {activePlan.type}
                  </strong>
                </span>
                <button
                  onClick={() => onSetActivePlan(null)}
                  className="ml-auto font-poppins text-xs text-brand-text/40 hover:text-brand-primary transition-colors"
                >
                  Switch to auto-fill
                </button>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {items.map((item, index) => (
                        <FoodCard
                          key={`${item.name}-${index}`}
                          item={item}
                          isSelected={isItemSelected(item)}
                          isDisabled={isCatFull}
                          currentQuantity={getCurrentItemQuantity(item)}
                          openSlots={getOpenSlotsForType(item.type)}
                          placedCount={getTotalPlacedCount(item)}
                          onAdd={() => onItemAdd(item)}
                          onDecrease={() =>
                            onItemQuantityDecrease(item)
                          }
                          onAddMany={(n) => onItemAddMany(item, n)}
                          onRemoveMany={(n) => onItemRemoveMany(item, n)}
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
        </div>
      )}
    </div>
  );
};

export default CheckALunch;
