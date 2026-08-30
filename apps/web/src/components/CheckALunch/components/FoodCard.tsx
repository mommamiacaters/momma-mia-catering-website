import React, { memo, useState } from "react";
import { Plus, Minus, Check } from "lucide-react";
import { MenuItem } from "../../../types";
import { pesoAmount } from "../../../constants/orders";
import CachedImage from "../../CachedImage";
import ImageLightbox from "../../ui/ImageLightbox";

interface FoodCardProps {
  item: MenuItem;
  isSelected: boolean;
  isDisabled: boolean;
  /** Open slots for this dish's type across EVERY box, not just the active one. */
  openSlots: number;
  /** Copies of this dish placed across every box. */
  placedCount: number;
  /** Per-order floor once this dish is picked; null = unknown, 0 = none. */
  requiredMin: number | null;
  /**
   * Price per piece, in pesos. Extras only: a plan course costs whatever the
   * plan costs, so showing a price there would be a lie.
   */
  unitPrice?: number | null;
  /** Admin switch: the bulk "Fill all" / "Clear" pair under each card. */
  showBulkActions: boolean;
  onAddMany: (count: number) => void;
  onRemoveMany: (count: number) => void;
}

const FoodCard: React.FC<FoodCardProps> = memo(({
  item,
  isSelected,
  isDisabled,
  openSlots,
  placedCount,
  requiredMin,
  unitPrice = null,
  showBulkActions,
  onAddMany,
  onRemoveMany,
}) => {
  // Bulk actions span all boxes, so they gate on global capacity — NOT on
  // isDisabled, which only means "the active box is full for this course".
  // Filling the other 23 boxes is still perfectly valid in that state.
  const canAddMore = openSlots > 0;
  const canRemoveMore = placedCount > 0;
  // Internal state keeps the memo comparator honest — no new props involved.
  const [showPhoto, setShowPhoto] = useState(false);
  // One click = one order-minimum's worth. A dish with a floor of 15 can't be
  // ordered in any smaller amount, so stepping by 1 only ever built up an
  // invalid order the shopper then had to be nagged about; stepping by the
  // floor makes the first click land on a valid order. No floor ⇒ step of 1.
  const step = Math.max(1, requiredMin ?? 0);
  // Picked, but under this dish's per-order floor — the order can't be placed
  // like this, so the card says so instead of showing a reassuring tick.
  const belowMin = (requiredMin ?? 0) > 0 && placedCount > 0 && placedCount < (requiredMin ?? 0);
  // Short of the floor, the useful bulk action isn't "every open slot" — it's
  // "get me legal", so the button offers exactly the shortfall.
  const toMinimum = belowMin ? (requiredMin ?? 0) - placedCount : 0;
  // Typing a quantity edits a DRAFT; it only reaches the order on blur/Enter,
  // so a half-typed "1" of an intended "15" never briefly strips 14 boxes.
  const [draft, setDraft] = useState<string | null>(null);
  const maxQty = placedCount + openSlots;
  const commitDraft = () => {
    if (draft === null) return;
    setDraft(null);
    if (draft.trim() === "") return; // cleared then abandoned — leave it be
    const parsed = Math.round(Number(draft));
    if (!Number.isFinite(parsed)) return;
    const delta = Math.max(0, Math.min(maxQty, parsed)) - placedCount;
    if (delta > 0) onAddMany(delta);
    else if (delta < 0) onRemoveMany(-delta);
  };
  const bulkBtn =
    "h-11 rounded-lg font-poppins text-xs font-bold tabular-nums transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed enabled:cursor-pointer";
  return (
    <div
      data-dish-id={item.id}
      className={`group relative bg-white rounded-2xl overflow-hidden transition-[box-shadow,transform,opacity] duration-300 ${
        belowMin
          ? "ring-2 ring-amber-400 shadow-lg shadow-amber-200/60"
          : isSelected
          ? "ring-2 ring-brand-primary shadow-lg shadow-brand-primary/10"
          : isDisabled
            ? "opacity-50 shadow-sm"
            : "shadow-md hover:shadow-xl hover:-translate-y-1"
      }`}
    >
      {/* Selection indicator — a warning outranks a tick, and unlike the tick
          it shows on phones too, because it's a blocker rather than a receipt. */}
      {belowMin ? (
        <div
          className="flex absolute top-3 right-3 z-10 bg-amber-500 text-white rounded-full w-7 h-7 items-center justify-center shadow-lg font-poppins text-base font-bold leading-none"
          title={`Needs ${requiredMin} per order — ${placedCount} so far`}
          aria-label={`Below the minimum of ${requiredMin} per order`}
        >
          !
        </div>
      ) : isSelected ? (
        <div className="hidden sm:flex absolute top-3 right-3 z-10 bg-brand-primary text-white rounded-full w-7 h-7 items-center justify-center shadow-lg animate-[scale-in_0.2s_ease-out]">
          <Check size={14} strokeWidth={3} />
        </div>
      ) : null}

      {/* Quantity badge (when more than 1) */}
      {placedCount > 1 && (
        <div className="hidden sm:flex absolute top-3 left-3 z-10 bg-brand-accent text-white rounded-full min-w-[1.75rem] h-7 px-1.5 items-center justify-center shadow-lg">
          <span className="text-xs font-bold font-poppins">
            x{placedCount}
          </span>
        </div>
      )}

      {/* Phones get a list row (thumb left, text right) — the vertical card
          only earns its height once the grid goes multi-column at sm. */}
      <div className="flex items-start gap-3 p-3 sm:block sm:p-0">
      {/* Image — clicking opens the full-view photo with the description. */}
      <button
        type="button"
        onClick={() => setShowPhoto(true)}
        aria-label={`View a larger photo of ${item.name}`}
        className="relative w-20 h-20 rounded-xl shrink-0 sm:w-full sm:h-auto sm:rounded-none sm:aspect-[4/3] overflow-hidden block cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
      >
        <CachedImage
          src={item.image}
          alt={item.name}
          containerClassName="w-full h-full"
          className={`w-full h-full object-cover transition-transform duration-500 ${
            !isDisabled ? "group-hover:scale-105" : ""
          }`}
        />
        {/* Subtle bottom gradient for text readability */}
        <div className="hidden sm:block absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
      </button>

      <ImageLightbox
        open={showPhoto}
        src={typeof item.image === "string" ? item.image : ""}
        title={item.name}
        description={item.description}
        onClose={() => setShowPhoto(false)}
      />

      {/* Content */}
      <div className="min-w-0 flex-1 sm:px-4 sm:pt-4">
        <h3 className="font-arvo font-bold text-brand-text text-sm leading-tight mb-1 capitalize line-clamp-2">
          {item.name}
        </h3>
        {item.description && (
          <p className="font-poppins text-xs text-brand-text/60 line-clamp-1 sm:line-clamp-2 mb-2 sm:mb-3 leading-relaxed">
            {item.description}
          </p>
        )}
        {unitPrice != null && (
          <p className="font-arvo font-bold text-sm text-brand-primary mb-2 sm:mb-3 tabular-nums">
            {pesoAmount(unitPrice)}
            <span className="font-poppins font-normal text-xs text-brand-text/50">
              {" "}
              each
            </span>
          </p>
        )}

        {/* Actions — one centered stepper. Every press moves the whole order
            by `step`, so the count shown is the order-wide one the Fill all /
            Clear buttons below also speak to. */}
        <div className="flex items-center justify-center pt-1 pb-3 min-h-[2.75rem]">
          {canRemoveMore ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRemoveMany(step)}
                className="w-11 h-11 rounded-full bg-brand-secondary hover:bg-brand-divider flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                aria-label={`Remove ${step} ${item.name} from your order`}
                title={`Remove ${step}`}
              >
                <Minus size={16} className="text-brand-text" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={maxQty}
                value={draft ?? String(placedCount)}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  else if (e.key === "Escape") {
                    setDraft(null);
                    e.currentTarget.blur();
                  }
                }}
                aria-label={`How many ${item.name} in your order`}
                className="w-14 h-11 rounded-lg border border-brand-divider bg-white text-center font-poppins text-sm font-bold text-brand-text tabular-nums transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => onAddMany(step)}
                disabled={!canAddMore}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                  !canAddMore
                    ? "bg-brand-divider cursor-not-allowed text-brand-text/30"
                    : "bg-brand-primary hover:bg-brand-primary/80 text-white shadow-sm shadow-brand-primary/20 cursor-pointer"
                }`}
                aria-label={
                  canAddMore
                    ? `Add ${step} more ${item.name}`
                    : "Every box already has this course"
                }
                title={canAddMore ? `Add ${step}` : undefined}
              >
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAddMany(step)}
              disabled={!canAddMore}
              className={`flex items-center gap-1.5 px-5 min-h-[44px] rounded-full font-poppins text-sm font-medium transition-colors active:scale-95 ${
                !canAddMore
                  ? "bg-brand-divider text-brand-text/30 cursor-not-allowed"
                  : "bg-brand-primary hover:bg-brand-primary/90 text-white shadow-md shadow-brand-primary/20 hover:shadow-lg cursor-pointer"
              }`}
              aria-label={
                canAddMore
                  ? `Add ${step} ${item.name} to your order`
                  : "No open slots left for this course"
              }
            >
              <Plus size={16} />
              Add
            </button>
          )}
        </div>
      </div>
      </div>

      {showBulkActions && (
      <div className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
        {/* Bulk actions — these span every box, which is why they survive
            `isDisabled` (that only means the ACTIVE box is full). */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() =>
              onAddMany(belowMin ? toMinimum : Number.POSITIVE_INFINITY)
            }
            disabled={!canAddMore}
            className={`${bulkBtn} whitespace-nowrap ${
              belowMin
                ? "bg-amber-100 text-amber-800 border border-amber-300 enabled:hover:bg-amber-200"
                : "bg-brand-primary text-white enabled:hover:bg-brand-primary/90 enabled:shadow-sm enabled:shadow-brand-primary/20"
            }`}
            title={
              !canAddMore
                ? "Every box already has this course"
                : belowMin
                  ? `Bring ${item.name} up to its per-order minimum of ${requiredMin}`
                  : `Put ${item.name} in all ${openSlots} boxes still missing this course`
            }
            aria-label={
              !canAddMore
                ? "No open slots left for this course"
                : belowMin
                  ? `Add ${toMinimum} more ${item.name} to reach the minimum of ${requiredMin}`
                  : `Fill all ${openSlots} remaining slots with ${item.name}`
            }
          >
            {belowMin
              ? `Fill min. ${requiredMin}`
              : `Fill all${canAddMore ? ` ${openSlots}` : ""}`}
          </button>
          <button
            type="button"
            onClick={() => onRemoveMany(Number.POSITIVE_INFINITY)}
            disabled={!canRemoveMore}
            className={`${bulkBtn} border border-brand-divider text-brand-text/70 enabled:hover:border-red-300 enabled:hover:text-red-600`}
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
      )}
    </div>
  );
}, (prev, next) =>
  prev.item === next.item &&
  prev.isSelected === next.isSelected &&
  prev.isDisabled === next.isDisabled &&
  prev.openSlots === next.openSlots &&
  prev.placedCount === next.placedCount &&
  prev.requiredMin === next.requiredMin &&
  prev.unitPrice === next.unitPrice &&
  prev.showBulkActions === next.showBulkActions
);

FoodCard.displayName = "FoodCard";

export default FoodCard;
