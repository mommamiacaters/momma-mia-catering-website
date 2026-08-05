import React from "react";
import { Minus, Plus, Check } from "lucide-react";
import { MealPlanType, MealPlanOrder, PlanSlot } from "../../../types";
import type { MealPlan } from "../../../services/menuService";

interface MealPlanSelectorProps {
  plans: MealPlan[];
  mealPlanOrders: MealPlanOrder[];
  onSelect: (type: MealPlanType) => void;
  onQuantityChange: (type: MealPlanType, quantity: number) => void;
  getPrice: (type: MealPlanType) => number;
}

const SLOT_EMOJI: Record<PlanSlot, string> = {
  main: "\u{1F356}",
  side: "\u{1F957}",
  rice: "\u{1F35A}",
  dessert: "\u{1F370}",
};

const SLOT_ORDER: PlanSlot[] = ["main", "side", "rice", "dessert"];

/** One emoji per included dish, so the picture matches the composition exactly. */
function compositionEmoji(plan: MealPlan): string {
  return SLOT_ORDER.flatMap((slot) =>
    Array.from({ length: plan.slots[slot] ?? 0 }, () => SLOT_EMOJI[slot]),
  ).join(" ");
}

const peso = (n: number) => `₱${n.toFixed(0)}`;

const MealPlanSelector: React.FC<MealPlanSelectorProps> = ({
  plans,
  mealPlanOrders,
  onSelect,
  onQuantityChange,
  getPrice,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
      {plans.map((plan) => {
        const type = plan.name;
        const order = mealPlanOrders.find((o) => o.type === type);
        const isSelected = !!order;
        // A range plan can't quote one number, so it shows the span the dishes
        // span. Both figures come from the database view.
        const priceLabel =
          plan.pricingMode === "range"
            ? plan.minPrice === plan.maxPrice
              ? peso(plan.minPrice)
              : `${peso(plan.minPrice)} – ${peso(plan.maxPrice)}`
            : peso(getPrice(type));

        return (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl overflow-hidden transition-all duration-300 ${
              isSelected
                ? "ring-2 ring-brand-primary shadow-xl shadow-brand-primary/15"
                : "shadow-md hover:shadow-xl hover:-translate-y-1"
            }`}
          >
            {isSelected && (
              <div className="absolute top-3 right-3 z-10 bg-brand-primary text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                <Check size={14} strokeWidth={3} />
              </div>
            )}

            <div
              className="p-6 text-center"
              role="button"
              tabIndex={0}
              aria-label={`${type} meal plan - ${plan.description ?? ""} - ${priceLabel} per box`}
              onClick={() => !isSelected && onSelect(type)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !isSelected) {
                  e.preventDefault();
                  onSelect(type);
                }
              }}
            >
              <div className="text-3xl mb-3 select-none" aria-hidden="true">
                {compositionEmoji(plan)}
              </div>

              <h3 className="font-arvo font-bold text-brand-text text-xl mb-1">
                {type}
              </h3>

              <p className="font-poppins text-sm text-brand-text/50 mb-4 min-h-[2.5rem]">
                {plan.description}
              </p>

              <div className="mb-5">
                <span className="font-arvo font-bold text-brand-primary text-2xl">
                  {priceLabel}
                </span>
                <span className="font-poppins text-sm text-brand-text/40 ml-1">
                  / box
                </span>
              </div>

              {isSelected ? (
                <div
                  className="flex items-center gap-3 justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onQuantityChange(type, order!.quantity - 1)}
                    className="w-10 h-10 rounded-full bg-brand-divider hover:bg-brand-text/20 flex items-center justify-center transition-colors"
                    aria-label={`Decrease ${type} quantity`}
                  >
                    <Minus size={16} className="text-brand-text" />
                  </button>
                  <span className="font-poppins text-xl font-bold text-brand-text min-w-[2.5rem] text-center tabular-nums">
                    {order!.quantity}
                  </span>
                  <button
                    onClick={() => onQuantityChange(type, order!.quantity + 1)}
                    className="w-10 h-10 rounded-full bg-brand-primary hover:bg-brand-primary/80 text-white flex items-center justify-center transition-colors shadow-md shadow-brand-primary/20"
                    aria-label={`Increase ${type} quantity`}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(type);
                  }}
                  className="w-full py-3 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-poppins font-semibold transition-all hover:shadow-lg hover:shadow-brand-primary/20 active:scale-[0.98]"
                >
                  Select This Plan
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MealPlanSelector;
