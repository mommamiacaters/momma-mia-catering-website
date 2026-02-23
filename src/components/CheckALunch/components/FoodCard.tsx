import React from "react";
import { Plus, Minus, Check } from "lucide-react";
import { MenuItem } from "../../../types";

interface FoodCardProps {
  item: MenuItem;
  isSelected: boolean;
  isDisabled: boolean;
  currentQuantity: number;
  onAdd: () => void;
  onDecrease: () => void;
}

const FALLBACK_IMAGE =
  "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop";

const FoodCard: React.FC<FoodCardProps> = ({
  item,
  isSelected,
  isDisabled,
  currentQuantity,
  onAdd,
  onDecrease,
}) => {
  return (
    <div
      className={`group relative bg-white rounded-2xl overflow-hidden transition-all duration-300 ${
        isSelected
          ? "ring-2 ring-brand-primary shadow-lg shadow-brand-primary/10"
          : isDisabled
            ? "opacity-50 shadow-sm"
            : "shadow-md hover:shadow-xl hover:-translate-y-1"
      }`}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 z-10 bg-brand-primary text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg animate-[scale-in_0.2s_ease-out]">
          <Check size={14} strokeWidth={3} />
        </div>
      )}

      {/* Quantity badge (when more than 1) */}
      {currentQuantity > 1 && (
        <div className="absolute top-3 left-3 z-10 bg-brand-accent text-white rounded-full min-w-[1.75rem] h-7 px-1.5 flex items-center justify-center shadow-lg">
          <span className="text-xs font-bold font-poppins">
            x{currentQuantity}
          </span>
        </div>
      )}

      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-brand-secondary/50">
        <img
          src={item.image || FALLBACK_IMAGE}
          alt={item.name}
          className={`w-full h-full object-cover transition-transform duration-500 ${
            !isDisabled ? "group-hover:scale-105" : ""
          }`}
          loading="lazy"
        />
        {/* Subtle bottom gradient for text readability */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-arvo font-bold text-brand-text text-sm leading-tight mb-1 capitalize line-clamp-2">
          {item.name}
        </h3>
        {item.description && (
          <p className="font-poppins text-xs text-brand-text/50 line-clamp-2 mb-3 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end pt-1">
          {isSelected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onDecrease}
                className="w-9 h-9 rounded-full bg-brand-secondary hover:bg-brand-divider flex items-center justify-center transition-colors active:scale-95"
                aria-label={
                  currentQuantity <= 1
                    ? `Remove ${item.name}`
                    : `Decrease ${item.name} quantity`
                }
              >
                <Minus size={14} className="text-brand-text" />
              </button>
              <span className="font-poppins text-sm font-bold text-brand-text w-7 text-center tabular-nums">
                {currentQuantity}
              </span>
              <button
                onClick={onAdd}
                disabled={isDisabled}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                  isDisabled
                    ? "bg-brand-divider cursor-not-allowed text-brand-text/30"
                    : "bg-brand-primary hover:bg-brand-primary/80 text-white shadow-sm shadow-brand-primary/20"
                }`}
                aria-label={
                  isDisabled
                    ? "Maximum reached"
                    : `Add another ${item.name}`
                }
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={onAdd}
              disabled={isDisabled}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-poppins text-sm font-medium transition-all active:scale-95 ${
                isDisabled
                  ? "bg-brand-divider text-brand-text/30 cursor-not-allowed"
                  : "bg-brand-primary hover:bg-brand-primary/90 text-white shadow-md shadow-brand-primary/20 hover:shadow-lg"
              }`}
              aria-label={
                isDisabled
                  ? "Maximum reached for this category"
                  : `Add ${item.name}`
              }
            >
              <Plus size={14} />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodCard;
