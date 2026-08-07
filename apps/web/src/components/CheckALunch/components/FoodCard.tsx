import React, { memo } from "react";
import { Plus, Minus, Check } from "lucide-react";
import { MenuItem } from "../../../types";
import CachedImage from "../../CachedImage";

interface FoodCardProps {
  item: MenuItem;
  isSelected: boolean;
  isDisabled: boolean;
  currentQuantity: number;
  onAdd: () => void;
  onDecrease: () => void;
  /** Open slots for this dish's type across EVERY box, not just the active one. */
  openSlots: number;
  /** Copies of this dish placed across every box. */
  placedCount: number;
  onAddMany: (count: number) => void;
  onRemoveMany: (count: number) => void;
}

const BULK_STEP = 10;

const FoodCard: React.FC<FoodCardProps> = memo(({
  item,
  isSelected,
  isDisabled,
  currentQuantity,
  onAdd,
  onDecrease,
  openSlots,
  placedCount,
  onAddMany,
  onRemoveMany,
}) => {
  // Bulk actions span all boxes, so they gate on global capacity — NOT on
  // isDisabled, which only means "the active box is full for this course".
  // Filling the other 23 boxes is still perfectly valid in that state.
  const canAddMore = openSlots > 0;
  const canRemoveMore = placedCount > 0;
  const bulkBtn =
    "h-9 rounded-lg font-poppins text-xs font-bold tabular-nums transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed enabled:cursor-pointer";
  return (
    <div
      className={`group relative bg-white rounded-2xl overflow-hidden transition-[box-shadow,transform,opacity] duration-300 ${
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

      {/* Image — relative container fixes gradient overlay positioning */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <CachedImage
          src={item.image}
          alt={item.name}
          containerClassName="w-full h-full"
          className={`w-full h-full object-cover transition-transform duration-500 ${
            !isDisabled ? "group-hover:scale-105" : ""
          }`}
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
        <div className="flex items-center justify-end pt-1 min-h-[2.25rem]">
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
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
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
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-poppins text-sm font-medium transition-colors active:scale-95 ${
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

        {/* Bulk actions — a single order can run to 24 boxes / 72 picks, so
            one-at-a-time is not a realistic way to fill it. These act across
            every box, which is why they survive `isDisabled`. */}
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <button
            type="button"
            onClick={() => onRemoveMany(BULK_STEP)}
            disabled={!canRemoveMore}
            className={`${bulkBtn} bg-brand-secondary text-brand-text/70 enabled:hover:bg-brand-divider`}
            title={`Take ${item.name} out of the last ${BULK_STEP} boxes it was added to`}
            aria-label={`Remove ${BULK_STEP} ${item.name} from your boxes`}
          >
            −{BULK_STEP}
          </button>
          <button
            type="button"
            onClick={() => onAddMany(BULK_STEP)}
            disabled={!canAddMore}
            className={`${bulkBtn} bg-brand-primary/10 text-brand-primary enabled:hover:bg-brand-primary/20`}
            title={`Put ${item.name} in the next ${BULK_STEP} boxes that still need this course`}
            aria-label={`Add ${item.name} to the next ${BULK_STEP} boxes`}
          >
            +{BULK_STEP}
          </button>
          <button
            type="button"
            onClick={() => onAddMany(Number.POSITIVE_INFINITY)}
            disabled={!canAddMore}
            className={`${bulkBtn} bg-brand-primary text-white enabled:hover:bg-brand-primary/90 enabled:shadow-sm enabled:shadow-brand-primary/20`}
            title={
              canAddMore
                ? `Put ${item.name} in all ${openSlots} boxes still missing this course`
                : "Every box already has this course"
            }
            aria-label={
              canAddMore
                ? `Fill all ${openSlots} remaining slots with ${item.name}`
                : "No open slots left for this course"
            }
          >
            Fill all{canAddMore ? ` ${openSlots}` : ""}
          </button>
          <button
            type="button"
            onClick={() => onRemoveMany(Number.POSITIVE_INFINITY)}
            disabled={!canRemoveMore}
            className={`${bulkBtn} border border-brand-divider text-brand-text/60 enabled:hover:border-red-300 enabled:hover:text-red-600`}
            title={
              canRemoveMore
                ? `Take ${item.name} out of all ${placedCount} boxes it's in`
                : `${item.name} isn't in any box yet`
            }
            aria-label={
              canRemoveMore
                ? `Remove all ${placedCount} ${item.name} from your boxes`
                : `${item.name} is not in any box`
            }
          >
            Clear{canRemoveMore ? ` ${placedCount}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.item === next.item &&
  prev.isSelected === next.isSelected &&
  prev.isDisabled === next.isDisabled &&
  prev.openSlots === next.openSlots &&
  prev.placedCount === next.placedCount &&
  prev.currentQuantity === next.currentQuantity
);

FoodCard.displayName = "FoodCard";

export default FoodCard;
