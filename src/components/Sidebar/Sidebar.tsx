import React, { useEffect, useState, useRef } from "react";
import {
  X,
  ShoppingBag,
  Trash2,
  Package,
  Plus,
  ChevronRight,
  AlertCircle,
  Check,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Crosshair,
} from "lucide-react";
import type {
  MealPlanType,
  PlanInstance,
} from "../../types";
import { MINIMUM_MEAL_PLANS, getCategoryDisplayName } from "../../constants";
import { isPlanInstanceComplete } from "../../utils/mealPlanUtils";
import { FALLBACK_IMAGE } from "../CachedImage";

interface ShoppingBagSidebarProps {
  visible: boolean;
  onHide: () => void;
  planInstances: PlanInstance[];
  activePlanInstanceId: string | null;
  onSetActivePlan: (id: string | null) => void;
  onRemovePlanInstance: (id: string) => void;
  onReorderPlanInstances: (fromIndex: number, toIndex: number) => void;
  onAssignedItemRemove: (instanceId: string) => void;
  getMealPlanPrice: (type: MealPlanType) => number;
  getMealPlanLimits: (type: MealPlanType) => Record<string, number>;
  calculateTotalPrice: () => number;
  getTotalMealPlanCount: () => number;
  onMoveItem: (
    sourcePlanId: string,
    itemInstanceId: string,
    targetPlanId: string,
    targetItemInstanceId?: string
  ) => void;
  onCheckout?: () => void;
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
  planInstances,
  activePlanInstanceId,
  onSetActivePlan,
  onRemovePlanInstance,
  onReorderPlanInstances,
  onAssignedItemRemove,
  getMealPlanPrice,
  getMealPlanLimits,
  calculateTotalPrice,
  getTotalMealPlanCount,
  onMoveItem,
  onCheckout,
}) => {
  const isCartEmpty = planInstances.length === 0;
  const totalMealPlans = getTotalMealPlanCount();
  const meetsMinimum = totalMealPlans >= MINIMUM_MEAL_PLANS;
  const allBoxesFilled =
    planInstances.length > 0 &&
    planInstances.every((pi) => isPlanInstanceComplete(pi));
  const canCheckout = meetsMinimum && allBoxesFilled;

  // Plan reorder drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  // Item swap drag state (for swapping dishes between plans)
  const [itemDragState, setItemDragState] = useState<{
    sourcePlanId: string;
    itemInstanceId: string;
    itemType: string;
  } | null>(null);
  const [itemDropTarget, setItemDropTarget] = useState<{
    planId: string;
    category: string;
    itemInstanceId?: string;
  } | null>(null);

  // Detect coarse pointer (touch devices)
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Sort by displayOrder for rendering
  const sortedInstances = [...planInstances].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  // Instance numbering per type
  const instanceNumbers = new Map<string, number>();
  const typeCounters = new Map<MealPlanType, number>();
  for (const pi of sortedInstances) {
    const n = (typeCounters.get(pi.type) || 0) + 1;
    typeCounters.set(pi.type, n);
    instanceNumbers.set(pi.id, n);
  }

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

  // ─── Plan reorder drag handlers (grip handle only) ───
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragEnter = (index: number) => {
    if (itemDragState) return;
    dragCounter.current++;
    setDropIndex(index);
  };

  const handleDragLeave = () => {
    if (itemDragState) return;
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDropIndex(null);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (itemDragState) return;
    e.preventDefault();
  };

  const handleDrop = (toIndex: number) => {
    if (itemDragState) return;
    if (dragIndex !== null && dragIndex !== toIndex) {
      onReorderPlanInstances(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
    dragCounter.current = 0;
  };

  // ─── Item swap drag handlers (swap dishes between plans) ───
  const handleItemDragStart = (
    e: React.DragEvent,
    planId: string,
    item: { instanceId: string; type: string }
  ) => {
    e.stopPropagation();
    setItemDragState({
      sourcePlanId: planId,
      itemInstanceId: item.instanceId,
      itemType: item.type,
    });
    e.dataTransfer.setData("text/plain", item.instanceId);
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleItemDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "";
    }
    setItemDragState(null);
    setItemDropTarget(null);
  };

  const handleItemDragOver = (
    e: React.DragEvent,
    planId: string,
    category: string,
    itemInstanceId?: string
  ) => {
    if (!itemDragState) return;
    if (itemDragState.sourcePlanId === planId) return;
    if (itemDragState.itemType !== category) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setItemDropTarget({ planId, category, itemInstanceId });
  };

  const handleItemDragLeave = (e: React.DragEvent) => {
    if (
      e.currentTarget instanceof HTMLElement &&
      !e.currentTarget.contains(e.relatedTarget as Node)
    ) {
      setItemDropTarget(null);
    }
  };

  const handleItemDrop = (
    e: React.DragEvent,
    targetPlanId: string,
    category: string,
    targetItemInstanceId?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!itemDragState) return;
    if (itemDragState.sourcePlanId === targetPlanId) return;
    if (itemDragState.itemType !== category) return;
    onMoveItem(
      itemDragState.sourcePlanId,
      itemDragState.itemInstanceId,
      targetPlanId,
      targetItemInstanceId
    );
    setItemDragState(null);
    setItemDropTarget(null);
  };

  const canAcceptItemDrop = (planId: string, category: string) => {
    if (!itemDragState) return false;
    return (
      itemDragState.sourcePlanId !== planId &&
      itemDragState.itemType === category
    );
  };

  const isItemTarget = (
    planId: string,
    category: string,
    itemInstanceId?: string
  ) => {
    if (!itemDropTarget) return false;
    if (itemDropTarget.planId !== planId) return false;
    if (itemDropTarget.category !== category) return false;
    if (itemInstanceId)
      return itemDropTarget.itemInstanceId === itemInstanceId;
    return !itemDropTarget.itemInstanceId;
  };

  // Mobile reorder
  const handleMoveUp = (index: number) => {
    if (index > 0) onReorderPlanInstances(index, index - 1);
  };
  const handleMoveDown = (index: number) => {
    if (index < sortedInstances.length - 1)
      onReorderPlanInstances(index, index + 1);
  };

  // Fill this plan
  const handleFillPlan = (planId: string) => {
    onSetActivePlan(planId);
    onHide();
    setTimeout(() => {
      document
        .getElementById("dish-picker-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  };

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
            /* ─── Plan Instance Cards ─── */
            sortedInstances.map((instance, index) => {
              const limits = getMealPlanLimits(instance.type);
              const instanceItems = instance.items;
              const isActive = activePlanInstanceId === instance.id;
              const isComplete = isPlanInstanceComplete(instance);
              const instanceNum = instanceNumbers.get(instance.id) || 1;

              return (
                <div
                  key={instance.id}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-[border-color,box-shadow,opacity] ${
                    isActive
                      ? "ring-2 ring-brand-primary border-brand-primary shadow-brand-primary/10"
                      : isComplete
                        ? "border-green-300"
                        : "border-brand-divider"
                  } ${
                    dragIndex === index ? "opacity-50" : ""
                  } ${
                    dropIndex === index && dragIndex !== index
                      ? "border-dashed border-2 border-brand-primary"
                      : ""
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 flex items-center gap-2">
                    {/* Drag handle / mobile arrows */}
                    {isTouch ? (
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="w-6 h-5 flex items-center justify-center rounded hover:bg-brand-secondary disabled:opacity-20 transition-colors"
                          aria-label="Move up"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === sortedInstances.length - 1}
                          className="w-6 h-5 flex items-center justify-center rounded hover:bg-brand-secondary disabled:opacity-20 transition-colors"
                          aria-label="Move down"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    ) : (
                      <div
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragEnd={handleDragEnd}
                        className="cursor-grab active:cursor-grabbing shrink-0 text-brand-text/25 hover:text-brand-text/50 transition-colors"
                      >
                        <GripVertical size={16} />
                      </div>
                    )}

                    <span
                      className="text-base select-none shrink-0"
                      aria-hidden="true"
                    >
                      {PLAN_EMOJIS[instance.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-arvo font-bold text-brand-text text-sm leading-tight">
                        {instance.type} #{instanceNum}
                      </h3>
                      <span className="font-poppins text-sm font-semibold text-brand-primary">
                        &#8369;{getMealPlanPrice(instance.type)}
                      </span>
                    </div>

                    {/* Active badge */}
                    {isActive && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-poppins text-[0.6rem] font-semibold uppercase tracking-wider shrink-0">
                        Filling
                      </span>
                    )}

                    <button
                      onClick={() => onRemovePlanInstance(instance.id)}
                      className="w-8 h-8 rounded-full bg-brand-secondary hover:bg-red-50 flex items-center justify-center transition-colors group shrink-0"
                      aria-label={`Remove ${instance.type} #${instanceNum}`}
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
                        const catComplete =
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
                                  catComplete
                                    ? "bg-green-100 text-green-700"
                                    : "bg-brand-secondary text-brand-text/40"
                                }`}
                              >
                                {categoryItems.length}/{limit}
                                {catComplete && " \u2713"}
                              </span>
                            </div>

                            {/* Filled Items — draggable between plans */}
                            <div className="space-y-1.5">
                              {categoryItems.map((item) => {
                                const isDragging =
                                  itemDragState?.itemInstanceId ===
                                  item.instanceId;
                                const isSwapTarget = isItemTarget(
                                  instance.id,
                                  catType,
                                  item.instanceId
                                );
                                const isValidDrop = canAcceptItemDrop(
                                  instance.id,
                                  catType
                                );

                                return (
                                  <div
                                    key={item.instanceId}
                                    draggable={!isTouch}
                                    onDragStart={(e) =>
                                      handleItemDragStart(e, instance.id, item)
                                    }
                                    onDragEnd={handleItemDragEnd}
                                    onDragOver={
                                      isValidDrop
                                        ? (e) => {
                                            e.stopPropagation();
                                            handleItemDragOver(
                                              e,
                                              instance.id,
                                              catType,
                                              item.instanceId
                                            );
                                          }
                                        : undefined
                                    }
                                    onDrop={
                                      isValidDrop
                                        ? (e) => {
                                            e.stopPropagation();
                                            handleItemDrop(
                                              e,
                                              instance.id,
                                              catType,
                                              item.instanceId
                                            );
                                          }
                                        : undefined
                                    }
                                    className={`flex items-center gap-2.5 p-2 rounded-xl transition-[background-color,opacity,transform,box-shadow] duration-150 ${
                                      isDragging
                                        ? "opacity-40 scale-95 bg-brand-secondary/50"
                                        : isSwapTarget
                                          ? "bg-brand-accent/10 ring-2 ring-brand-accent shadow-md scale-[1.02]"
                                          : "bg-brand-secondary/50"
                                    } ${!isTouch && sortedInstances.length > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
                                    title={
                                      sortedInstances.length > 1
                                        ? `${item.name} — drag to swap`
                                        : item.name
                                    }
                                  >
                                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-brand-divider/50 pointer-events-none">
                                      <img
                                        src={item.image || FALLBACK_IMAGE}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <span className="font-poppins text-sm text-brand-text flex-1 min-w-0 truncate capitalize pointer-events-none">
                                      {item.name}
                                    </span>
                                    <button
                                      onClick={() =>
                                        onAssignedItemRemove(item.instanceId)
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
                                );
                              })}

                              {/* Empty Slots — drop targets */}
                              {Array.from({
                                length: Math.max(
                                  0,
                                  limit - categoryItems.length
                                ),
                              }).map((_, i) => {
                                const isValidDrop = canAcceptItemDrop(
                                  instance.id,
                                  catType
                                );
                                const isSlotTarget =
                                  isValidDrop &&
                                  isItemTarget(instance.id, catType) &&
                                  !itemDropTarget?.itemInstanceId;

                                return (
                                  <div
                                    key={`empty-${catType}-${instance.id}-${i}`}
                                    onDragOver={
                                      isValidDrop
                                        ? (e) => {
                                            e.stopPropagation();
                                            handleItemDragOver(
                                              e,
                                              instance.id,
                                              catType
                                            );
                                          }
                                        : undefined
                                    }
                                    onDrop={
                                      isValidDrop
                                        ? (e) => {
                                            e.stopPropagation();
                                            handleItemDrop(
                                              e,
                                              instance.id,
                                              catType
                                            );
                                          }
                                        : undefined
                                    }
                                    className={`flex items-center gap-2.5 p-2 rounded-xl border border-dashed transition-[border-color,background-color] duration-150 ${
                                      isSlotTarget
                                        ? "border-brand-accent bg-brand-accent/10"
                                        : isValidDrop
                                          ? "border-brand-primary/30 bg-brand-primary/5"
                                          : "border-brand-divider"
                                    }`}
                                  >
                                    <div
                                      className={`w-9 h-9 rounded-lg border border-dashed flex items-center justify-center ${
                                        isSlotTarget
                                          ? "border-brand-accent bg-brand-accent/10"
                                          : "border-brand-divider bg-brand-secondary/30"
                                      }`}
                                    >
                                      <Plus
                                        size={12}
                                        className={
                                          isSlotTarget
                                            ? "text-brand-accent"
                                            : "text-brand-divider"
                                        }
                                      />
                                    </div>
                                    <span className="font-poppins text-xs text-brand-text/25 italic">
                                      Choose a{" "}
                                      {label.toLowerCase()}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* "Fill this plan" button */}
                  {!isComplete && (
                    <div className="px-4 pb-3 pt-1">
                      <button
                        onClick={() => handleFillPlan(instance.id)}
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-poppins text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-brand-primary/10 text-brand-primary"
                            : "bg-brand-secondary hover:bg-brand-primary/10 text-brand-text/50 hover:text-brand-primary"
                        }`}
                      >
                        <Crosshair size={13} />
                        {isActive ? "Currently filling" : "Fill this plan"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Drag hint */}
          {sortedInstances.length > 1 &&
            sortedInstances.some((pi) => pi.items.length > 0) && (
              <p className="font-poppins text-[0.6rem] text-brand-text/30 text-center mt-1 italic">
                Drag dishes between boxes to rearrange
              </p>
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
              disabled={!canCheckout}
              onClick={() => {
                if (canCheckout && onCheckout) {
                  onHide();
                  onCheckout();
                }
              }}
              className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-poppins font-semibold text-sm transition-colors ${
                canCheckout
                  ? "bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]"
                  : "bg-brand-divider text-brand-text/40 cursor-not-allowed"
              }`}
            >
              {!meetsMinimum ? (
                <>
                  <AlertCircle size={16} />
                  Add{" "}
                  {MINIMUM_MEAL_PLANS - totalMealPlans} more{" "}
                  {MINIMUM_MEAL_PLANS - totalMealPlans === 1
                    ? "box"
                    : "boxes"}
                </>
              ) : !allBoxesFilled ? (
                <>
                  <AlertCircle size={16} />
                  Fill all lunch boxes first
                </>
              ) : (
                <>
                  <Check size={16} />
                  Proceed to Checkout
                  <ChevronRight size={16} />
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
