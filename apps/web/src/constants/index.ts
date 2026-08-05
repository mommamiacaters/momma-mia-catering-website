// Shared constants used across the application

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

/** Fallback only — the live value is app_settings.minimum_meal_plans. */
export const MINIMUM_MEAL_PLANS = 15;

export function getCategoryDisplayName(category: string): string {
  switch (category) {
    case "main":
      return "Main Dish";
    case "side":
      return "Side Dish";
    case "rice":
      return "Rice";
    case "dessert":
      return "Dessert";
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}
