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

export const MEAL_PLAN_LIMITS: Record<string, Record<string, number>> = {
  "Double The Protein": { main: 2, side: 1, starch: 1 },
  "Balanced Diet": { main: 1, side: 1, starch: 1 },
};

export const MEAL_PLAN_DESCRIPTIONS: Record<string, string> = {
  "Double The Protein": "2 Main Dishes, 1 Side Dish, 1 Starch",
  "Balanced Diet": "1 Main Dish, 1 Side Dish, 1 Starch",
};

export const MINIMUM_MEAL_PLANS = 2;

export const CATEGORIES: readonly ["main", "side", "starch"] = ["main", "side", "starch"] as const;

export function getCategoryDisplayName(category: string): string {
  switch (category) {
    case "main":
      return "Main Dish";
    case "side":
      return "Side Dish";
    case "starch":
      return "Starch";
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}
