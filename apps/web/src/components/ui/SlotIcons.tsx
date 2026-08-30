import React from "react";
import { compositionSlots, slotIcon } from "../../constants/planSlots";
import type { PlanSlot } from "../../types";

/**
 * Slot iconography, shared by the plan cards, the cart drawer and the tray
 * panel. These replaced emoji: emoji render differently on every OS (and not at
 * all on some Android builds), can't inherit colour, and read as clip-art next
 * to the rest of the UI, which is already lucide throughout.
 *
 * Colour is per-slot rather than one brand tint — the run of icons on a plan
 * card is meant to be scannable ("what courses do I get?"), and four identical
 * grey glyphs would lose the distinction the emoji were carrying.
 */
const SLOT_CLASS: Record<PlanSlot, string> = {
  main: "text-brand-primary",
  side: "text-green-600",
  rice: "text-amber-600",
  rice_bowl: "text-orange-700",
  sandwich: "text-yellow-700",
  pasta: "text-red-600",
  dessert: "text-pink-500",
};

export const SlotIcon: React.FC<{
  slot: string;
  size?: number;
  className?: string;
}> = ({ slot, size = 16, className = "" }) => {
  const Icon = slotIcon(slot);
  if (!Icon) return null;
  const tone = SLOT_CLASS[slot as PlanSlot] ?? "text-brand-text/60";
  return (
    <Icon
      size={size}
      className={`${tone} ${className}`.trim()}
      aria-hidden="true"
    />
  );
};

/**
 * One icon per dish the plan includes. Decorative: every caller states the same
 * composition in words nearby, so this is aria-hidden rather than duplicated
 * for screen readers.
 */
export const CompositionIcons: React.FC<{
  slots: Partial<Record<PlanSlot, number>>;
  size?: number;
  className?: string;
}> = ({ slots, size = 20, className = "" }) => {
  const items = compositionSlots(slots);
  if (!items.length) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`.trim()}
      aria-hidden="true"
    >
      {items.map(({ key, Icon, slot }) => (
        <Icon key={key} size={size} className={SLOT_CLASS[slot]} />
      ))}
    </span>
  );
};
