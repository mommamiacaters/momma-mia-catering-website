import { Cake, CookingPot, Leaf, Sandwich, Soup, UtensilsCrossed, Wheat, type LucideIcon } from "lucide-react";
import type { PlanSlot } from "../types";

/**
 * The one definition of a meal-plan slot: order, label and icon.
 *
 * This existed as four separate hardcoded lists (CheckALunch, TrayPreview,
 * Sidebar, CheckoutPage) that all had to agree. They didn't: renaming "starch"
 * to "rice" and adding "dessert" updated two of them, so the cart silently
 * stopped rendering the rice and dessert rows and no box could be completed
 * from the sidebar. Adding a slot should be one edit, here.
 *
 * `Icon` lives here too. It used to be a separate local map in CheckALunch
 * ("only the icons are local") purely to keep React out of a constants file —
 * but a lucide icon is just a component reference, no JSX required, so the
 * split only recreated the duplication this file exists to prevent.
 */
export const PLAN_SLOT_META: {
  slot: PlanSlot;
  label: string;
  /** Narrow-screen label. Explicit, because the first word of "Rice Bowl" is
      "Rice", which is a different course. */
  short: string;
  Icon: LucideIcon;
  description: string;
}[] = [
  { slot: "main", label: "Main Dish", short: "Main", Icon: UtensilsCrossed, description: "Choose your protein" },
  { slot: "side", label: "Side Dish", short: "Side", Icon: Leaf, description: "Pick your greens & veggies" },
  { slot: "rice", label: "Rice", short: "Rice", Icon: Wheat, description: "Select your rice" },
  {
    slot: "rice_bowl",
    label: "Rice Bowl",
    short: "Bowl",
    Icon: Soup,
    description: "One bowl, rice and topping together",
  },
  { slot: "sandwich", label: "Sandwich", short: "Sarnie", Icon: Sandwich, description: "Pick your sandwich" },
  { slot: "pasta", label: "Pasta", short: "Pasta", Icon: CookingPot, description: "Choose your pasta" },
  { slot: "dessert", label: "Dessert", short: "Dessert", Icon: Cake, description: "Finish with something sweet" },
];

export const PLAN_SLOTS: PlanSlot[] = PLAN_SLOT_META.map((m) => m.slot);

const BY_SLOT = new Map(PLAN_SLOT_META.map((m) => [m.slot, m]));

export const slotLabel = (slot: string): string =>
  BY_SLOT.get(slot as PlanSlot)?.label ??
  slot.charAt(0).toUpperCase() + slot.slice(1);

export const slotIcon = (slot: string): LucideIcon | null =>
  BY_SLOT.get(slot as PlanSlot)?.Icon ?? null;

/**
 * One entry per included dish, so the picture matches the composition exactly
 * (a plan with 2 mains yields two "main" entries). Returns data rather than
 * markup so this stays a plain constants module; render it with
 * <CompositionIcons /> from components/ui/SlotIcons.
 */
export const compositionSlots = (
  slots: Partial<Record<PlanSlot, number>>,
): { slot: PlanSlot; Icon: LucideIcon; key: string }[] =>
  PLAN_SLOT_META.flatMap(({ slot, Icon }) =>
    Array.from({ length: slots[slot] ?? 0 }, (_, i) => ({
      slot,
      Icon,
      key: `${slot}-${i}`,
    })),
  );
