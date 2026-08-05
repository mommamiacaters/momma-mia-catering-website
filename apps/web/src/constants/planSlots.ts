import type { PlanSlot } from "../types";

/**
 * The one definition of a meal-plan slot: order, label and emoji.
 *
 * This existed as four separate hardcoded lists (CheckALunch, TrayPreview,
 * Sidebar, CheckoutPage) that all had to agree. They didn't: renaming "starch"
 * to "rice" and adding "dessert" updated two of them, so the cart silently
 * stopped rendering the rice and dessert rows and no box could be completed
 * from the sidebar. Adding a slot should be one edit, here.
 */
export const PLAN_SLOT_META: {
  slot: PlanSlot;
  label: string;
  emoji: string;
  description: string;
}[] = [
  { slot: "main", label: "Main Dish", emoji: "\u{1F356}", description: "Choose your protein" },
  { slot: "side", label: "Side Dish", emoji: "\u{1F957}", description: "Pick your greens & veggies" },
  { slot: "rice", label: "Rice", emoji: "\u{1F35A}", description: "Select your rice" },
  { slot: "dessert", label: "Dessert", emoji: "\u{1F370}", description: "Finish with something sweet" },
];

export const PLAN_SLOTS: PlanSlot[] = PLAN_SLOT_META.map((m) => m.slot);

const BY_SLOT = new Map(PLAN_SLOT_META.map((m) => [m.slot, m]));

export const slotLabel = (slot: string): string =>
  BY_SLOT.get(slot as PlanSlot)?.label ??
  slot.charAt(0).toUpperCase() + slot.slice(1);

export const slotEmoji = (slot: string): string => BY_SLOT.get(slot as PlanSlot)?.emoji ?? "";

/** One emoji per included dish, so the picture matches the composition exactly. */
export const compositionEmoji = (slots: Partial<Record<PlanSlot, number>>): string =>
  PLAN_SLOT_META.flatMap(({ slot, emoji }) =>
    Array.from({ length: slots[slot] ?? 0 }, () => emoji),
  ).join(" ");
