import React from "react";
import { Package, CheckCircle2, Plus, ShoppingBag, ArrowRight } from "lucide-react";
import { SelectedItemWithQuantity, CategoryType } from "../../../types";

interface TrayPreviewProps {
  selectedItems: SelectedItemWithQuantity[];
  maxAllowed: Record<string, number>;
}

const CATEGORY_META: {
  type: CategoryType;
  label: string;
  emoji: string;
}[] = [
  { type: "main", label: "Main Dish", emoji: "\u{1F356}" },
  { type: "side", label: "Side Dish", emoji: "\u{1F957}" },
  { type: "starch", label: "Starch", emoji: "\u{1F35A}" },
];

const TrayPreview: React.FC<TrayPreviewProps> = ({
  selectedItems,
  maxAllowed,
}) => {
  const totalSlots = Object.values(maxAllowed).reduce((a, b) => a + b, 0);
  const totalSelected = selectedItems.length;
  const isComplete = totalSlots > 0 && totalSelected >= totalSlots;

  const getItemsByType = (type: CategoryType) =>
    selectedItems.filter((item) => item.type === type);

  return (
    <div
      className={`rounded-2xl p-5 transition-all duration-500 ${
        isComplete
          ? "bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 shadow-lg shadow-green-100/50"
          : "bg-white border border-brand-divider shadow-md"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        {isComplete ? (
          <CheckCircle2 size={22} className="text-green-600" />
        ) : (
          <Package size={22} className="text-brand-primary" />
        )}
        <h3 className="font-arvo font-bold text-brand-text text-lg">
          {isComplete ? "Lunch Box Complete!" : "Your Lunch Box"}
        </h3>
        <span
          className={`ml-auto font-poppins text-sm font-medium px-3 py-1 rounded-full ${
            isComplete
              ? "bg-green-200/60 text-green-700"
              : "bg-brand-secondary text-brand-text/60"
          }`}
        >
          {totalSelected} / {totalSlots}
        </span>
      </div>

      {/* Category slots */}
      <div className="grid grid-cols-3 gap-4">
        {CATEGORY_META.map(({ type, label, emoji }) => {
          const items = getItemsByType(type);
          const max = maxAllowed[type] || 0;
          const filled = items.length;
          const categoryComplete = filled >= max && max > 0;

          return (
            <div key={type}>
              {/* Category label */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm" aria-hidden="true">
                  {emoji}
                </span>
                <span className="font-poppins text-xs font-semibold text-brand-text/70 uppercase tracking-wide">
                  {label}
                </span>
              </div>

              {/* Item thumbnails + empty slots */}
              <div className="flex flex-wrap gap-1.5">
                {items.map((item, i) => (
                  <div
                    key={item.instanceId || i}
                    className="w-10 h-10 rounded-lg overflow-hidden bg-brand-secondary border-2 border-brand-primary/30 shadow-sm"
                    title={item.name}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand-primary/10 text-brand-primary">
                        <span className="text-xs font-bold">
                          {item.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: Math.max(0, max - filled) }).map(
                  (_, i) => (
                    <div
                      key={`empty-${type}-${i}`}
                      className="w-10 h-10 rounded-lg border-2 border-dashed border-brand-divider flex items-center justify-center bg-brand-secondary/30"
                    >
                      <Plus size={14} className="text-brand-divider" />
                    </div>
                  )
                )}
              </div>

              {/* Count */}
              <p
                className={`font-poppins text-xs mt-1.5 ${
                  categoryComplete
                    ? "text-green-600 font-semibold"
                    : "text-brand-text/40"
                }`}
              >
                {filled}/{max} {categoryComplete && "\u2713"}
              </p>
            </div>
          );
        })}
      </div>

      {/* "Let's dig in!" CTA when complete */}
      {isComplete && (
        <div className="mt-5 pt-5 border-t border-green-200">
          <button
            onClick={() =>
              document.getElementById("bag-button")?.click()
            }
            className="w-full group flex items-center justify-center gap-3 py-4 rounded-xl bg-gradient-to-r from-brand-primary to-brand-accent text-white font-arvo font-bold text-lg shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:shadow-brand-primary/30 transition-all active:scale-[0.98] hover:-translate-y-0.5"
            aria-label="View your order in the shopping bag"
          >
            <ShoppingBag size={22} />
            Let&rsquo;s Dig In!
            <ArrowRight
              size={18}
              className="transition-transform group-hover:translate-x-1"
            />
          </button>
        </div>
      )}
    </div>
  );
};

export default TrayPreview;
