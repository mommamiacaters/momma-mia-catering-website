import React, { useEffect, useRef, useState } from "react";
import {
  Package,
  CheckCircle2,
  Plus,
  ShoppingBag,
  ArrowRight,
  Crosshair,
  AlertCircle,
} from "lucide-react";
import {
  CategoryType,
  PlanInstance,
  MealPlanType,
  AssignedItem,
} from "../../../types";
import { FALLBACK_IMAGE, onImgError } from "../../CachedImage";
import { isPlanInstanceComplete, groupPlanInstances, aggregateDishes } from "../../../utils/mealPlanUtils";
import SummaryViewToggle, { type SummaryView } from "../../ui/SummaryViewToggle";
import {
  deriveDishMinimumState,
  useStoreSettings,
} from "../../../hooks/useStoreSettings";
import { PLAN_SLOT_META } from "../../../constants/planSlots";
import { SlotIcon } from "../../ui/SlotIcons";

interface TrayPreviewProps {
  planInstances: PlanInstance[];
  activePlanInstanceId: string | null;
  /** Per-slot counts for a plan, from the database. */
  getMealPlanLimits: (type: string) => Record<string, number>;
  onSetActivePlan: (id: string | null) => void;
  onMoveItem: (
    sourcePlanId: string,
    itemInstanceId: string,
    targetPlanId: string,
    targetItemInstanceId?: string
  ) => void;
  /**
   * Narrow-column layout for the sticky sidebar: slots stack vertically and
   * dishes are listed by name. Tailwind breakpoints measure the viewport, not
   * this column, so the variant has to be passed in explicitly.
   */
  compact?: boolean;
}

const CATEGORY_META = PLAN_SLOT_META.map(({ slot, label }) => ({
  type: slot as CategoryType,
  label,
}));

const TrayPreview: React.FC<TrayPreviewProps> = ({
  planInstances,
  activePlanInstanceId,
  getMealPlanLimits,
  onSetActivePlan,
  onMoveItem,
  compact = false,
}) => {
  // ─── Follow the box you're filling ───
  // With 20+ boxes the panel scrolls independently of the picker, so choosing
  // a box in "Pick Your Dishes" would leave the panel showing some unrelated
  // box. Bring the chosen one into view.
  const listRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!activePlanInstanceId) return;
    const container = listRef.current;
    const el = cardRefs.current[activePlanInstanceId];
    if (!container || !el) return;
    // Nothing to scroll (full-width layout isn't height-capped).
    if (container.scrollHeight <= container.clientHeight) return;

    // Measured against the container rather than scrollIntoView(), which walks
    // up to the nearest scrollable ancestor and would drag the whole PAGE when
    // the panel happens not to be it.
    const delta =
      el.getBoundingClientRect().top - container.getBoundingClientRect().top;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    container.scrollTo({
      top: Math.max(0, container.scrollTop + delta - 8),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [activePlanInstanceId]);

  // Overview (default) reads the boxes as builds; Detailed lists every box
  // for arranging. The scroll-follow effect above no-ops in overview — its
  // card refs only exist while Detailed is mounted.
  const [view, setView] = useState<SummaryView>("overview");

  // ─── Drag state ───
  const [dragState, setDragState] = useState<{
    sourcePlanId: string;
    itemInstanceId: string;
    itemType: string;
  } | null>(null);

  const [dragOverTarget, setDragOverTarget] = useState<{
    planId: string;
    category: string;
    itemInstanceId?: string;
  } | null>(null);

  const allComplete =
    planInstances.length > 0 &&
    planInstances.every((pi) => isPlanInstanceComplete(pi, getMealPlanLimits(pi.type)));

  // Same shared derivation as the banner, cart drawer and checkout — this
  // panel must never celebrate "complete" while a dish is under its floor.
  const { minimumQtyPerDish } = useStoreSettings();
  const dishMin = deriveDishMinimumState(minimumQtyPerDish, planInstances);
  const dishesShort = dishMin.violations.length > 0;

  const completedCount = planInstances.filter((pi) =>
    isPlanInstanceComplete(pi, getMealPlanLimits(pi.type))
  ).length;

  // Unfilled slots across every box — drives the disabled CTA's label.
  const remainingSlots = planInstances.reduce((sum, pi) => {
    const limits = getMealPlanLimits(pi.type);
    const total = Object.values(limits).reduce(
      (a: number, b) => a + (b as number),
      0
    );
    return sum + Math.max(0, total - pi.items.length);
  }, 0);

  // Sort by displayOrder
  const sortedInstances = [...planInstances].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  // Instance numbering per type
  const typeCounters = new Map<MealPlanType, number>();
  const instanceNumbers = new Map<string, number>();
  for (const pi of sortedInstances) {
    const n = (typeCounters.get(pi.type) || 0) + 1;
    typeCounters.set(pi.type, n);
    instanceNumbers.set(pi.id, n);
  }

  // ─── Drag handlers ───

  const handleDragStart = (
    e: React.DragEvent,
    planId: string,
    item: AssignedItem
  ) => {
    setDragState({
      sourcePlanId: planId,
      itemInstanceId: item.instanceId,
      itemType: item.type,
    });
    e.dataTransfer.setData("text/plain", item.instanceId);
    e.dataTransfer.effectAllowed = "move";

    // Make drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "";
    }
    setDragState(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (
    e: React.DragEvent,
    planId: string,
    category: string,
    itemInstanceId?: string
  ) => {
    if (!dragState) return;
    // Only allow drop on different plans, same category
    if (dragState.sourcePlanId === planId) return;
    if (dragState.itemType !== category) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget({ planId, category, itemInstanceId });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the actual target (not entering a child)
    if (
      e.currentTarget instanceof HTMLElement &&
      !e.currentTarget.contains(e.relatedTarget as Node)
    ) {
      setDragOverTarget(null);
    }
  };

  const handleDrop = (
    e: React.DragEvent,
    targetPlanId: string,
    category: string,
    targetItemInstanceId?: string
  ) => {
    e.preventDefault();
    if (!dragState) return;
    if (dragState.sourcePlanId === targetPlanId) return;
    if (dragState.itemType !== category) return;

    onMoveItem(
      dragState.sourcePlanId,
      dragState.itemInstanceId,
      targetPlanId,
      targetItemInstanceId
    );

    setDragState(null);
    setDragOverTarget(null);
  };

  // Check if a specific slot is the drag-over target
  const isDropTarget = (
    planId: string,
    category: string,
    itemInstanceId?: string
  ) => {
    if (!dragOverTarget) return false;
    if (dragOverTarget.planId !== planId) return false;
    if (dragOverTarget.category !== category) return false;
    if (itemInstanceId)
      return dragOverTarget.itemInstanceId === itemInstanceId;
    return !dragOverTarget.itemInstanceId;
  };

  // Can this category section accept a drop?
  const canAcceptDrop = (planId: string, category: string) => {
    if (!dragState) return false;
    return (
      dragState.sourcePlanId !== planId && dragState.itemType === category
    );
  };

  return (
    <div
      className={`rounded-2xl p-5 transition-colors duration-500 flex flex-col ${
        // Cap the panel to the viewport so a long list scrolls inside it rather
        // than pushing the pinned CTA off-screen. dvh (not vh) so mobile
        // browser chrome doesn't cut it off.
        // 12rem = TWICE the 6rem (lg:top-24) offset the <aside> sticks at, which
        // is what centres the panel: the leftover viewport splits evenly above
        // and below. Budget the offset and the cap together — subtracting only
        // 7rem left 96px of air on top and 16px underneath, so it read as
        // pinned to the bottom of the screen.
        compact ? "lg:max-h-[calc(100dvh-12rem)]" : ""
      } ${
        allComplete
          ? "bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 shadow-lg shadow-green-100/50"
          : "bg-white border border-brand-divider shadow-md"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5 shrink-0">
        {allComplete ? (
          <CheckCircle2 size={22} className="text-green-600" />
        ) : (
          <Package size={22} className="text-brand-primary" />
        )}
        <h3 className="font-arvo font-bold text-brand-text text-lg">
          {allComplete
            ? planInstances.length === 1
              ? "Lunch Box Complete!"
              : "All Lunch Boxes Complete!"
            : planInstances.length === 1
              ? "Your Lunch Box"
              : "Your Lunch Boxes"}
        </h3>
        {/* Every count in this panel names its own unit — "1/9" alone doesn't
            say one-of-nine WHAT. */}
        <span
          className={`ml-auto shrink-0 font-poppins text-sm font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
            allComplete
              ? "bg-green-200/60 text-green-700"
              : "bg-brand-secondary text-brand-text/60"
          }`}
          title={`${completedCount} of ${sortedInstances.length} lunch boxes have all their dishes chosen`}
        >
          {completedCount}/{sortedInstances.length} boxes
        </span>
      </div>

      <SummaryViewToggle
        value={view}
        onChange={setView}
        className="mb-4 shrink-0"
      />

      {view === "overview" ? (
        /* ─── Overview: one tile per distinct build ─── */
        <div
          className={`space-y-3 ${
            compact ? "overflow-y-auto min-h-0 -mx-1 px-1" : ""
          }`}
        >
          {groupPlanInstances(sortedInstances).map((group) => {
            const limits = getMealPlanLimits(group.type);
            const totalSlots = Object.values(limits).reduce(
              (a: number, b) => a + (b as number),
              0
            );
            const filledSlots = group.sample.items.length;
            const groupComplete = isPlanInstanceComplete(group.sample, limits);
            return (
              <div
                key={group.sample.id}
                className={`bg-white rounded-xl border px-3.5 py-3 ${
                  groupComplete ? "border-green-300" : "border-brand-divider"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-arvo font-bold text-sm text-brand-text min-w-0 truncate">
                    {group.type}
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-primary px-2 py-0.5 font-poppins text-xs font-bold text-white tabular-nums">
                    &times;{group.count}
                  </span>
                  <span
                    className={`ml-auto shrink-0 font-poppins text-[0.7rem] font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                      groupComplete
                        ? "bg-green-100 text-green-700"
                        : "bg-brand-secondary text-brand-text/70"
                    }`}
                  >
                    {filledSlots}/{totalSlots} dishes{groupComplete && " ✓"}
                  </span>
                </div>
                {aggregateDishes(group.sample.items).map((dish) => (
                  <div
                    key={`${dish.type}-${dish.name}`}
                    className="flex items-center gap-1.5 py-0.5 min-w-0"
                  >
                    <SlotIcon
                      slot={dish.type}
                      size={11}
                      className="shrink-0 text-brand-text/70"
                    />
                    <div className="w-5 h-5 rounded overflow-hidden shrink-0 border border-brand-divider/50">
                      <img
                        src={dish.image || FALLBACK_IMAGE}
                        onError={onImgError}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="font-poppins text-xs text-brand-text capitalize truncate">
                      {dish.qty > 1 && (
                        <span className="font-semibold tabular-nums">
                          {dish.qty}&times;{" "}
                        </span>
                      )}
                      {dish.name}
                    </span>
                  </div>
                ))}
                {group.sample.items.length === 0 && (
                  <p className="font-poppins text-xs text-brand-text/30 italic py-1">
                    No dishes selected
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
      <div
        ref={listRef}
        className={`space-y-4 ${
          compact ? "overflow-y-auto min-h-0 -mx-1 px-1" : ""
        }`}
      >
        {/* Plan instance cards — clickable to select. min-h-0 lets this flex
            child shrink below its content so it can actually scroll. */}
        {sortedInstances.map((pi) => {
          const limits = getMealPlanLimits(pi.type);
          const totalSlots = Object.values(limits).reduce(
            (a: number, b) => a + (b as number),
            0
          );
          const filledSlots = pi.items.length;
          const isComplete = isPlanInstanceComplete(pi, limits);
          const instanceNum = instanceNumbers.get(pi.id) || 1;
          const isActive = activePlanInstanceId === pi.id;

          return (
            <div
              key={pi.id}
              ref={(el) => {
                cardRefs.current[pi.id] = el;
              }}
              onClick={() => onSetActivePlan(pi.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSetActivePlan(pi.id);
                }
              }}
              className={`rounded-xl p-3 transition-[border-color,background-color,box-shadow] duration-200 cursor-pointer select-none ${
                isActive
                  ? "bg-brand-primary/5 border-2 border-brand-primary/40 shadow-md shadow-brand-primary/10"
                  : isComplete
                    ? "bg-green-50/50 border border-green-200 hover:border-green-300 hover:shadow-sm"
                    : "bg-brand-secondary/30 border border-brand-divider/50 hover:border-brand-primary/20 hover:shadow-sm"
              }`}
            >
              {/* Mini header */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  {isActive && (
                    <Crosshair
                      size={12}
                      className="text-brand-primary animate-pulse"
                    />
                  )}
                  <span
                    className={`font-poppins text-xs font-semibold ${
                      isActive
                        ? "text-brand-primary"
                        : "text-brand-text/70"
                    }`}
                  >
                    #{instanceNum} {pi.type}
                  </span>
                  {isActive && (
                    <span className="px-1.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-poppins text-[0.55rem] font-bold uppercase tracking-wider">
                      Filling
                    </span>
                  )}
                </div>
                <span
                  className={`font-poppins text-xs font-medium px-2 py-0.5 rounded-full ${
                    isComplete
                      ? "bg-green-200/60 text-green-700"
                      : isActive
                        ? "bg-brand-primary/10 text-brand-primary"
                        : "bg-brand-secondary text-brand-text/50"
                  }`}
                  title={`${filledSlots} of ${totalSlots} dishes chosen for this box`}
                >
                  {filledSlots}/{totalSlots} dishes
                  {isComplete && " \u2713"}
                </span>
              </div>

              {/* Category slots — stacked named rows in the narrow sidebar,
                  side-by-side thumbnails in the full-width layout. */}
              <div
                className={compact ? "space-y-2.5" : "grid grid-cols-3 gap-3"}
              >
                {CATEGORY_META.map(({ type, label }) => {
                  const catItems = pi.items.filter(
                    (item) => item.type === type
                  );
                  const max = (limits[type] as number) || 0;
                  const filled = catItems.length;
                  const categoryComplete = filled >= max && max > 0;
                  const isValidDrop = canAcceptDrop(pi.id, type);

                  if (max === 0) return null;

                  return (
                    <div
                      key={type}
                      onDragOver={
                        isValidDrop
                          ? (e) => handleDragOver(e, pi.id, type)
                          : undefined
                      }
                      onDragLeave={
                        isValidDrop ? handleDragLeave : undefined
                      }
                      onDrop={
                        isValidDrop
                          ? (e) => handleDrop(e, pi.id, type)
                          : undefined
                      }
                    >
                      {/* Category label — the count rides along on the right
                          in compact mode, where there's horizontal room. */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <SlotIcon slot={type} size={14} />
                        <span className="font-poppins text-[0.65rem] font-semibold text-brand-text/70 uppercase tracking-wide">
                          {label}
                        </span>
                        {compact && (
                          <span
                            className={`ml-auto font-poppins text-[0.65rem] font-semibold whitespace-nowrap ${
                              categoryComplete
                                ? "text-green-600"
                                : "text-brand-text/40"
                            }`}
                            title={`${filled} of ${max} ${label.toLowerCase()}${
                              max === 1 ? "" : "es"
                            } chosen for this box`}
                          >
                            {filled} of {max} {categoryComplete && "✓"}
                          </span>
                        )}
                      </div>

                      {/* Item thumbnails — draggable */}
                      <div
                        className={
                          compact ? "space-y-1" : "flex flex-wrap gap-1.5"
                        }
                      >
                        {catItems.map((item) => {
                          const isDragging =
                            dragState?.itemInstanceId ===
                            item.instanceId;
                          const isSwapTarget = isDropTarget(
                            pi.id,
                            type,
                            item.instanceId
                          );

                          return (
                            <div
                              key={item.instanceId}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                handleDragStart(e, pi.id, item);
                              }}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => {
                                e.stopPropagation();
                                handleDragOver(
                                  e,
                                  pi.id,
                                  type,
                                  item.instanceId
                                );
                              }}
                              onDrop={(e) => {
                                e.stopPropagation();
                                handleDrop(
                                  e,
                                  pi.id,
                                  type,
                                  item.instanceId
                                );
                              }}
                              className={`cursor-grab active:cursor-grabbing transition-[border-color,opacity,transform] duration-150 ${
                                compact
                                  ? // White, full-contrast rows — on the muted
                                    // secondary these read as disabled next to
                                    // the live dish cards.
                                    "flex items-center gap-2 w-full rounded-lg p-1 pr-2 text-left bg-white"
                                  : "w-10 h-10 rounded-lg overflow-hidden bg-brand-secondary"
                              } ${
                                isDragging
                                  ? `opacity-40 border-2 border-brand-primary/50 ${
                                      compact ? "" : "scale-90"
                                    }`
                                  : isSwapTarget
                                    ? `ring-2 ring-brand-accent border-2 border-brand-accent shadow-md ${
                                        compact ? "" : "scale-110"
                                      }`
                                    : "border-2 border-brand-primary/30 shadow-sm hover:border-brand-primary/50 hover:shadow-md"
                              }`}
                              title={`${item.name} — drag to swap`}
                            >
                              <img
                                src={item.image || FALLBACK_IMAGE}
                                onError={onImgError}
                                alt={item.name}
                                className={`object-cover pointer-events-none ${
                                  compact
                                    ? "w-9 h-9 rounded-md shrink-0"
                                    : "w-full h-full"
                                }`}
                              />
                              {compact && (
                                <span className="font-poppins text-[0.78rem] font-medium leading-snug text-brand-text line-clamp-2 pointer-events-none">
                                  {item.name}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {/* Empty slots — drop targets */}
                        {Array.from({
                          length: Math.max(0, max - filled),
                        }).map((_, i) => {
                          const isSlotDropTarget =
                            isValidDrop &&
                            isDropTarget(pi.id, type) &&
                            !dragOverTarget?.itemInstanceId;

                          return (
                            <div
                              key={`empty-${type}-${pi.id}-${i}`}
                              onDragOver={
                                isValidDrop
                                  ? (e) => {
                                      e.stopPropagation();
                                      handleDragOver(e, pi.id, type);
                                    }
                                  : undefined
                              }
                              onDrop={
                                isValidDrop
                                  ? (e) => {
                                      e.stopPropagation();
                                      handleDrop(e, pi.id, type);
                                    }
                                  : undefined
                              }
                              className={`border-2 border-dashed transition-[border-color,opacity,transform] duration-150 ${
                                compact
                                  ? // min-h keeps the empty row a 44px touch target
                                    "flex items-center gap-2 w-full rounded-lg p-1 pr-2 min-h-[2.75rem]"
                                  : "w-10 h-10 rounded-lg flex items-center justify-center"
                              } ${
                                isSlotDropTarget
                                  ? `border-brand-accent bg-brand-accent/10 shadow-md ${
                                      compact ? "" : "scale-110"
                                    }`
                                  : isValidDrop
                                    ? "border-brand-primary/30 bg-brand-primary/5"
                                    : "border-brand-divider bg-brand-secondary/30"
                              }`}
                            >
                              {compact ? (
                                <>
                                  <span className="w-9 h-9 flex items-center justify-center shrink-0">
                                    <Plus
                                      size={14}
                                      className={
                                        isSlotDropTarget
                                          ? "text-brand-accent"
                                          : "text-brand-divider"
                                      }
                                    />
                                  </span>
                                  <span className="font-poppins text-[0.7rem] italic text-brand-text/40">
                                    Add a {label.toLowerCase()}
                                  </span>
                                </>
                              ) : (
                                <Plus
                                  size={14}
                                  className={
                                    isSlotDropTarget
                                      ? "text-brand-accent"
                                      : "text-brand-divider"
                                  }
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Count \u2014 compact mode already shows this in the label row */}
                      {!compact && (
                        <p
                          className={`font-poppins text-xs mt-1.5 ${
                            categoryComplete
                              ? "text-green-600 font-semibold"
                              : "text-brand-text/40"
                          }`}
                        >
                          {filled}/{max} {categoryComplete && "\u2713"}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Drag hint — shown when multiple plans exist */}
      {view === "detailed" &&
        sortedInstances.length > 1 &&
        sortedInstances.some((pi) => pi.items.length > 0) && (
          <p className="font-poppins text-[0.6rem] text-brand-text/30 text-center mt-3 italic shrink-0">
            Drag items between boxes to rearrange
          </p>
        )}

      {/* Per-dish minimums — the same amber warning the cart drawer and
          checkout show, so this panel can't green-light what they will block. */}
      {dishesShort && (
        <div
          role="status"
          className="mt-4 shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3"
        >
          <p className="font-poppins text-xs text-brand-text mb-1.5">
            <strong className="font-semibold">
              Some dishes are below their per-order minimum.
            </strong>{" "}
            <span className="text-brand-text/60">
              Add more of each in the dish picker, or take them out.
            </span>
          </p>
          <ul className="space-y-0.5">
            {dishMin.violations.map((v) => (
              <li
                key={v.menuItemId}
                className="font-poppins text-xs font-semibold text-amber-800 tabular-nums"
              >
                {v.name} · {v.current}/{v.required} — add {v.remaining}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer CTA — always rendered so it stays pinned below the scrolling
          list and the panel height doesn't jump on completion. Disabled until
          every box is filled; short dish minimums turn it into an amber
          "review" state that opens the bag, where the same rule blocks
          checkout. */}
      <div
        className={`mt-5 pt-5 border-t shrink-0 ${
          allComplete && !dishesShort ? "border-green-200" : "border-brand-divider/60"
        }`}
      >
        <button
          onClick={() => document.getElementById("bag-button")?.click()}
          disabled={!allComplete}
          className={`w-full group flex items-center justify-center gap-3 py-4 rounded-xl font-arvo font-bold text-lg transition-[box-shadow,transform,background-color] ${
            !allComplete
              ? "bg-brand-secondary text-brand-text/40 cursor-not-allowed"
              : dishesShort
                ? "bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer"
                : "bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:shadow-brand-primary/30 active:scale-[0.98] hover:-translate-y-0.5 cursor-pointer"
          }`}
          aria-label={
            !allComplete
              ? `${remainingSlots} more ${
                  remainingSlots === 1 ? "dish" : "dishes"
                } needed before you can check out`
              : dishesShort
                ? `${dishMin.violations.length} ${
                    dishMin.violations.length === 1 ? "dish is" : "dishes are"
                  } below their per-order minimum — open the order to review`
                : "View your order in the shopping bag"
          }
        >
          {!allComplete ? (
            <>
              <ShoppingBag size={22} />
              <span className="font-poppins text-sm font-semibold">
                {remainingSlots} more {remainingSlots === 1 ? "dish" : "dishes"}{" "}
                to go
              </span>
            </>
          ) : dishesShort ? (
            <>
              <AlertCircle size={20} />
              <span className="font-poppins text-sm font-semibold">
                {dishMin.violations.length}{" "}
                {dishMin.violations.length === 1 ? "dish" : "dishes"} below
                minimum
              </span>
            </>
          ) : (
            <>
              <ShoppingBag size={22} />
              Let&apos;s Dig In!
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TrayPreview;
