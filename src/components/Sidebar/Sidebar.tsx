import React, { useEffect } from "react";
import {
  X,
  ShoppingBag,
  Trash2,
  Package,
  Plus,
  ChevronRight,
  AlertCircle,
  Check,
} from "lucide-react";
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

const PLAN_EMOJIS: Record<MealPlanType, string> = {
  "Double The Protein": "\u{1F356}\u{1F356} \u{1F957} \u{1F35A}",
  "Balanced Diet": "\u{1F356} \u{1F957} \u{1F35A}",
};

const CATEGORY_META: { type: string; label: string; emoji: string }[] = [
  { type: "main", label: "Main Dish", emoji: "\u{1F356}" },
  { type: "side", label: "Side Dish", emoji: "\u{1F957}" },
  { type: "starch", label: "Starch", emoji: "\u{1F35A}" },
];

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
  getTotalMealPlanCount,
}) => {
  const isCartEmpty =
    mealPlanOrders.length === 0 && selectedItems.length === 0;
  const totalMealPlans = getTotalMealPlanCount();
  const meetsMinimum = totalMealPlans >= MINIMUM_MEAL_PLANS;

  // Escape key + body scroll lock
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) onHide();
    };
    document.addEventListener("keydown", handleEscape);

    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [visible, onHide]);

  const removeSingleMealPlan = (type: MealPlanType) => {
    const currentOrder = mealPlanOrders.find((order) => order.type === type);
    if (currentOrder && currentOrder.quantity > 1) {
      onMealPlanQuantityChange(type, currentOrder.quantity - 1);
    } else {
      onMealPlanQuantityChange(type, 0);
    }
  };

  const { instances, distribution } = distributeItemsAcrossMealPlans(
    mealPlanOrders,
    selectedItems,
    getMealPlanLimits
  );

  return (
    <div
      className={`fixed inset-0 z-50 ${
        visible ? "" : "pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onHide}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`absolute top-0 right-0 h-full w-full sm:w-[26rem] bg-brand-secondary shadow-2xl flex flex-col transition-transform duration-200 ease-out will-change-transform ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Your order"
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-divider bg-white">
          <div className="flex items-center gap-3">
            <Package size={20} className="text-brand-primary" />
            <h2 className="font-arvo font-bold text-brand-text text-lg">
              Your Order
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            {totalMealPlans > 0 && (
              <span className="bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full font-poppins text-xs font-semibold tabular-nums">
                {totalMealPlans} {totalMealPlans === 1 ? "box" : "boxes"}
              </span>
            )}
            <button
              onClick={onHide}
              className="w-8 h-8 rounded-full bg-brand-secondary hover:bg-brand-divider flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X size={16} className="text-brand-text" />
            </button>
          </div>
        </div>

        {/* ─── Progress Bar ─── */}
        {!isCartEmpty && (
          <div className="px-5 py-3.5 bg-white border-b border-brand-divider">
            <div className="flex items-center justify-between mb-2">
              <span className="font-poppins text-xs text-brand-text/50">
                Minimum {MINIMUM_MEAL_PLANS} meal plans
              </span>
              <span
                className={`font-poppins text-xs font-semibold px-2 py-0.5 rounded-full ${
                  meetsMinimum
                    ? "bg-green-100 text-green-700"
                    : "bg-brand-secondary text-brand-text/50"
                }`}
              >
                {totalMealPlans} / {MINIMUM_MEAL_PLANS}
                {meetsMinimum && " \u2713"}
              </span>
            </div>
            <div className="h-1.5 bg-brand-divider/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  meetsMinimum ? "bg-green-500" : "bg-brand-primary"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (totalMealPlans / MINIMUM_MEAL_PLANS) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* ─── Content (scrollable) ─── */}
        <div
          className="flex-1 overflow-y-auto p-5 space-y-4"
          style={{ scrollbarWidth: "none" }}
        >
          {isCartEmpty ? (
            /* ─── Empty State ─── */
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-20 h-20 rounded-full bg-brand-primary/10 flex items-center justify-center mb-5">
                <ShoppingBag
                  size={32}
                  className="text-brand-primary/40"
                />
              </div>
              <h3 className="font-arvo font-bold text-brand-text text-lg mb-2">
                Your bag is empty
              </h3>
              <p className="font-poppins text-sm text-brand-text/40 leading-relaxed">
                Start by choosing a meal plan and picking your favorite
                dishes.
              </p>
            </div>
          ) : (
            /* ─── Meal Plan Instance Cards ─── */
            instances.map((instance) => {
              const limits = getMealPlanLimits(instance.type);
              const instanceItems =
                distribution[instance.globalIndex] || [];

              return (
                <div
                  key={`${instance.type}-${instance.globalIndex}`}
                  className="bg-white rounded-2xl border border-brand-divider overflow-hidden shadow-sm"
                >
                  {/* Card Header */}
                  <div className="p-4 flex items-center gap-3">
                    <span
                      className="text-base select-none shrink-0"
                      aria-hidden="true"
                    >
                      {PLAN_EMOJIS[instance.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-arvo font-bold text-brand-text text-sm leading-tight">
                        {instance.type} #{instance.instanceIndex + 1}
                      </h3>
                      <span className="font-poppins text-sm font-semibold text-brand-primary">
                        &#8369;{getMealPlanPrice(instance.type)}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        removeSingleMealPlan(instance.type)
                      }
                      className="w-8 h-8 rounded-full bg-brand-secondary hover:bg-red-50 flex items-center justify-center transition-colors group shrink-0"
                      aria-label={`Remove ${instance.type} #${
                        instance.instanceIndex + 1
                      }`}
                    >
                      <Trash2
                        size={14}
                        className="text-brand-text/30 group-hover:text-red-500 transition-colors"
                      />
                    </button>
                  </div>

                  {/* Category Sections */}
                  <div className="border-t border-brand-divider">
                    {CATEGORY_META.map(
                      ({ type: catType, label, emoji }) => {
                        const categoryItems = instanceItems.filter(
                          (item) => item.type === catType
                        );
                        const limit = limits[catType] || 0;
                        if (limit === 0) return null;
                        const isComplete =
                          categoryItems.length >= limit;

                        return (
                          <div
                            key={catType}
                            className="px-4 py-3 border-b border-brand-divider/50 last:border-b-0"
                          >
                            {/* Category Header */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="text-xs"
                                  aria-hidden="true"
                                >
                                  {emoji}
                                </span>
                                <span className="font-poppins text-[0.65rem] font-semibold text-brand-text/50 uppercase tracking-wider">
                                  {label}
                                </span>
                              </div>
                              <span
                                className={`font-poppins text-[0.65rem] font-semibold px-2 py-0.5 rounded-full ${
                                  isComplete
                                    ? "bg-green-100 text-green-700"
                                    : "bg-brand-secondary text-brand-text/40"
                                }`}
                              >
                                {categoryItems.length}/{limit}
                                {isComplete && " \u2713"}
                              </span>
                            </div>

                            {/* Filled Items */}
                            <div className="space-y-1.5">
                              {categoryItems.map((item) => (
                                <div
                                  key={item.instanceId}
                                  className="flex items-center gap-2.5 p-2 rounded-xl bg-brand-secondary/50"
                                >
                                  {item.image ? (
                                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-brand-divider/50">
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                                      <span className="text-xs font-bold text-brand-primary">
                                        {item.name.charAt(0)}
                                      </span>
                                    </div>
                                  )}
                                  <span className="font-poppins text-sm text-brand-text flex-1 min-w-0 truncate capitalize">
                                    {item.name}
                                  </span>
                                  <button
                                    onClick={() =>
                                      onItemRemove(item)
                                    }
                                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors group shrink-0"
                                    aria-label={`Remove ${item.name}`}
                                  >
                                    <X
                                      size={12}
                                      className="text-brand-text/25 group-hover:text-red-500 transition-colors"
                                    />
                                  </button>
                                </div>
                              ))}

                              {/* Empty Slots */}
                              {Array.from({
                                length: Math.max(
                                  0,
                                  limit - categoryItems.length
                                ),
                              }).map((_, i) => (
                                <div
                                  key={`empty-${catType}-${instance.globalIndex}-${i}`}
                                  className="flex items-center gap-2.5 p-2 rounded-xl border border-dashed border-brand-divider"
                                >
                                  <div className="w-9 h-9 rounded-lg border border-dashed border-brand-divider flex items-center justify-center bg-brand-secondary/30">
                                    <Plus
                                      size={12}
                                      className="text-brand-divider"
                                    />
                                  </div>
                                  <span className="font-poppins text-xs text-brand-text/25 italic">
                                    Choose a{" "}
                                    {label.toLowerCase()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── Footer ─── */}
        {!isCartEmpty && (
          <div className="px-5 py-4 border-t border-brand-divider bg-white">
            <div className="flex items-center justify-between mb-4">
              <span className="font-poppins text-sm text-brand-text/50">
                Subtotal
              </span>
              <span className="font-arvo font-bold text-xl text-brand-primary tabular-nums">
                &#8369;{calculateTotalPrice()}
              </span>
            </div>

            <button
              disabled={!meetsMinimum}
              className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-poppins font-semibold text-sm transition-all ${
                meetsMinimum
                  ? "bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]"
                  : "bg-brand-divider text-brand-text/40 cursor-not-allowed"
              }`}
            >
              {meetsMinimum ? (
                <>
                  <Check size={16} />
                  Proceed to Checkout
                  <ChevronRight size={16} />
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  Add{" "}
                  {MINIMUM_MEAL_PLANS - totalMealPlans} more{" "}
                  {MINIMUM_MEAL_PLANS - totalMealPlans === 1
                    ? "box"
                    : "boxes"}
                </>
              )}
            </button>

            <button
              onClick={onHide}
              className="w-full mt-2 py-3 rounded-xl border border-brand-primary/20 text-brand-primary font-poppins font-medium text-sm hover:bg-brand-primary/5 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};

export default ShoppingBagSidebar;
