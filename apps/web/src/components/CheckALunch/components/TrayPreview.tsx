import React, { useState } from "react";
import {
  Package,
  CheckCircle2,
  Plus,
  ShoppingBag,
  ArrowRight,
  Crosshair,
} from "lucide-react";
import {
  CategoryType,
  PlanInstance,
  MealPlanType,
  AssignedItem,
} from "../../../types";
import { FALLBACK_IMAGE } from "../../CachedImage";
import { MEAL_PLAN_LIMITS } from "../../../constants";
import { isPlanInstanceComplete } from "../../../utils/mealPlanUtils";

interface TrayPreviewProps {
  planInstances: PlanInstance[];
  activePlanInstanceId: string | null;
  onSetActivePlan: (id: string | null) => void;
  onMoveItem: (
    sourcePlanId: string,
    itemInstanceId: string,
    targetPlanId: string,
    targetItemInstanceId?: string
  ) => void;
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
  planInstances,
  activePlanInstanceId,
  onSetActivePlan,
  onMoveItem,
}) => {
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
    planInstances.every((pi) => isPlanInstanceComplete(pi));

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
      className={`rounded-2xl p-5 transition-colors duration-500 ${
        allComplete
          ? "bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 shadow-lg shadow-green-100/50"
          : "bg-white border border-brand-divider shadow-md"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
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
        <span
          className={`ml-auto font-poppins text-sm font-medium px-3 py-1 rounded-full ${
            allComplete
              ? "bg-green-200/60 text-green-700"
              : "bg-brand-secondary text-brand-text/60"
          }`}
        >
          {
            sortedInstances.filter((pi) => isPlanInstanceComplete(pi))
              .length
          }
          /{sortedInstances.length} done
        </span>
      </div>

      {/* Plan instance cards — clickable to select */}
      <div className="space-y-4">
        {sortedInstances.map((pi) => {
          const limits = MEAL_PLAN_LIMITS[pi.type] || {};
          const totalSlots = Object.values(limits).reduce(
            (a: number, b) => a + (b as number),
            0
          );
          const filledSlots = pi.items.length;
          const isComplete = isPlanInstanceComplete(pi);
          const instanceNum = instanceNumbers.get(pi.id) || 1;
          const isActive = activePlanInstanceId === pi.id;

          return (
            <div
              key={pi.id}
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
                >
                  {filledSlots}/{totalSlots}
                  {isComplete && " \u2713"}
                </span>
              </div>

              {/* Category slots */}
              <div className="grid grid-cols-3 gap-3">
                {CATEGORY_META.map(({ type, label, emoji }) => {
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
                      {/* Category label */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-sm" aria-hidden="true">
                          {emoji}
                        </span>
                        <span className="font-poppins text-[0.65rem] font-semibold text-brand-text/70 uppercase tracking-wide">
                          {label}
                        </span>
                      </div>

                      {/* Item thumbnails — draggable */}
                      <div className="flex flex-wrap gap-1.5">
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
                              className={`w-10 h-10 rounded-lg overflow-hidden bg-brand-secondary cursor-grab active:cursor-grabbing transition-[border-color,opacity,transform] duration-150 ${
                                isDragging
                                  ? "opacity-40 scale-90 border-2 border-brand-primary/50"
                                  : isSwapTarget
                                    ? "ring-2 ring-brand-accent border-2 border-brand-accent shadow-md scale-110"
                                    : "border-2 border-brand-primary/30 shadow-sm hover:border-brand-primary/50 hover:shadow-md"
                              }`}
                              title={`${item.name} — drag to swap`}
                            >
                              <img
                                src={item.image || FALLBACK_IMAGE}
                                alt={item.name}
                                className="w-full h-full object-cover pointer-events-none"
                              />
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
                              className={`w-10 h-10 rounded-lg border-2 border-dashed flex items-center justify-center transition-[border-color,opacity,transform] duration-150 ${
                                isSlotDropTarget
                                  ? "border-brand-accent bg-brand-accent/10 scale-110 shadow-md"
                                  : isValidDrop
                                    ? "border-brand-primary/30 bg-brand-primary/5"
                                    : "border-brand-divider bg-brand-secondary/30"
                              }`}
                            >
                              <Plus
                                size={14}
                                className={
                                  isSlotDropTarget
                                    ? "text-brand-accent"
                                    : "text-brand-divider"
                                }
                              />
                            </div>
                          );
                        })}
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
            </div>
          );
        })}
      </div>

      {/* Drag hint — shown when multiple plans exist */}
      {sortedInstances.length > 1 &&
        sortedInstances.some((pi) => pi.items.length > 0) && (
          <p className="font-poppins text-[0.6rem] text-brand-text/30 text-center mt-3 italic">
            Drag items between boxes to rearrange
          </p>
        )}

      {/* "Let's dig in!" CTA when all complete */}
      {allComplete && (
        <div className="mt-5 pt-5 border-t border-green-200">
          <button
            onClick={() =>
              document.getElementById("bag-button")?.click()
            }
            className="w-full group flex items-center justify-center gap-3 py-4 rounded-xl bg-gradient-to-r from-brand-primary to-brand-accent text-white font-arvo font-bold text-lg shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:shadow-brand-primary/30 transition-[box-shadow,transform] active:scale-[0.98] hover:-translate-y-0.5"
            aria-label="View your order in the shopping bag"
          >
            <ShoppingBag size={22} />
            Let&apos;s Dig In!
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
