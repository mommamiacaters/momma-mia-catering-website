import React from "react";
import { Minus, Plus, Check, Sparkles } from "lucide-react";
import { MealPlanType, MealPlanOrder } from "../../../types";
import { MEAL_PLAN_DESCRIPTIONS } from "../../../constants";

interface MealPlanSelectorProps {
  mealPlanTypes: MealPlanType[];
  mealPlanOrders: MealPlanOrder[];
  onSelect: (type: MealPlanType) => void;
  onQuantityChange: (type: MealPlanType, quantity: number) => void;
  getPrice: (type: MealPlanType) => number;
}

const PLAN_VISUALS: Record<
  MealPlanType,
  { emoji: string; tagline: string; badge?: string }
> = {
  "Double The Protein": {
    emoji: "\u{1F356}\u{1F356} \u{1F957} \u{1F35A}",
    tagline: "Extra protein for the hungry crew",
    badge: "Popular",
  },
  "Balanced Diet": {
    emoji: "\u{1F356} \u{1F957} \u{1F35A}",
    tagline: "A well-rounded classic lunch",
  },
};

const MealPlanSelector: React.FC<MealPlanSelectorProps> = ({
  mealPlanTypes,
  mealPlanOrders,
  onSelect,
  onQuantityChange,
  getPrice,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
      {mealPlanTypes.map((type) => {
        const order = mealPlanOrders.find((o) => o.type === type);
        const isSelected = !!order;
        const visual = PLAN_VISUALS[type];

        return (
          <div
            key={type}
            className={`relative bg-white rounded-2xl overflow-hidden transition-all duration-300 ${
              isSelected
                ? "ring-2 ring-brand-primary shadow-xl shadow-brand-primary/15"
                : "shadow-md hover:shadow-xl hover:-translate-y-1"
            }`}
          >
            {/* Popular badge */}
            {visual.badge && (
              <div className="absolute top-0 left-0 right-0">
                <div className="bg-gradient-to-r from-brand-accent to-brand-primary text-white text-xs font-poppins font-semibold tracking-wide uppercase text-center py-1.5 flex items-center justify-center gap-1">
                  <Sparkles size={12} />
                  {visual.badge}
                </div>
              </div>
            )}

            {/* Selected checkmark */}
            {isSelected && (
              <div
                className={`absolute ${
                  visual.badge ? "top-10" : "top-3"
                } right-3 z-10 bg-brand-primary text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg`}
              >
                <Check size={14} strokeWidth={3} />
              </div>
            )}

            <div
              className={`p-6 text-center ${visual.badge ? "pt-10" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${type} meal plan - ${MEAL_PLAN_DESCRIPTIONS[type]} - ${getPrice(type)} pesos per box`}
              onClick={() => !isSelected && onSelect(type)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !isSelected) {
                  e.preventDefault();
                  onSelect(type);
                }
              }}
            >
              {/* Meal composition visual */}
              <div
                className="text-3xl mb-3 select-none"
                aria-hidden="true"
              >
                {visual.emoji}
              </div>

              {/* Plan name */}
              <h3 className="font-arvo font-bold text-brand-text text-xl mb-1">
                {type}
              </h3>

              {/* Description */}
              <p className="font-poppins text-sm text-brand-text/50 mb-1">
                {MEAL_PLAN_DESCRIPTIONS[type]}
              </p>
              <p className="font-poppins text-xs text-brand-text/40 italic mb-4">
                {visual.tagline}
              </p>

              {/* Price */}
              <div className="mb-5">
                <span className="font-arvo font-bold text-brand-primary text-2xl">
                  &#8369;{getPrice(type)}
                </span>
                <span className="font-poppins text-sm text-brand-text/40 ml-1">
                  / box
                </span>
              </div>

              {/* Action */}
              {isSelected ? (
                <div
                  className="flex items-center gap-3 justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() =>
                      onQuantityChange(type, order!.quantity - 1)
                    }
                    className="w-10 h-10 rounded-full bg-brand-divider hover:bg-brand-text/20 flex items-center justify-center transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={16} className="text-brand-text" />
                  </button>
                  <span className="font-poppins text-xl font-bold text-brand-text min-w-[2.5rem] text-center tabular-nums">
                    {order!.quantity}
                  </span>
                  <button
                    onClick={() =>
                      onQuantityChange(type, order!.quantity + 1)
                    }
                    className="w-10 h-10 rounded-full bg-brand-primary hover:bg-brand-primary/80 text-white flex items-center justify-center transition-colors shadow-md shadow-brand-primary/20"
                    aria-label="Increase quantity"
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
