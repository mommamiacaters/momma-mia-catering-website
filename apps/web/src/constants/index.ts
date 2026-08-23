// Shared constants used across the application
import { slotLabel } from "./planSlots";

export const NAV_LINKS = [
  { to: "/meals", label: "Your Meals & More" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/profile.php?id=61559809667297",
  instagram: "https://www.instagram.com/momma_mia_caters/",
  messenger: "https://www.facebook.com/profile.php?id=61559809667297",
} as const;

// MEAL_PLAN_LIMITS / MEAL_PLAN_DESCRIPTIONS / CATEGORIES are gone: plans and
// their slot counts now come from public.meal_plans.

/**
 * Customer-facing name for a plan slot.
 *
 * Delegates to the slot catalogue rather than keeping its own switch: the copy
 * here fell through to a title-cased fallback and rendered "Rice_bowl" on the
 * picker heading and the checkout summary the moment a fifth slot existed.
 */
export function getCategoryDisplayName(category: string): string {
  return slotLabel(category);
}
