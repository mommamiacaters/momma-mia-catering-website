// Shared admin/menu record shapes (mirror the Supabase tables).
export interface Category {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
}

export interface MenuItemRecord {
  id: string;
  category_id: number | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number | null;
  item_type: string | null;
  sub_category_id: number | null;
  is_available: boolean;
  is_catering: boolean;
  sort_order: number;
}

export type AvailabilityFilter = "all" | "showing" | "hidden";

/** Which slot of a meal plan a sub-category can fill. */
export type PlanSlot = "main" | "side" | "dessert" | "rice";

export interface SubCategory {
  id: number;
  slug: string;
  name: string;
  slot: PlanSlot | null;
  sort_order: number;
  is_active: boolean;
}

/**
 * How a plan charges.
 *  fixed — the customer pays price_cents; the dishes they pick cost nothing.
 *  range — the dishes carry their own prices, so the total depends on the
 *          combination and the plan advertises a min–max instead.
 */
export type PricingMode = "fixed" | "range";

export interface MealPlan {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  pricing_mode: PricingMode;
  main_count: number;
  side_count: number;
  dessert_count: number;
  rice_count: number;
  sort_order: number;
  is_active: boolean;
}

/** Row of the meal_plan_price_ranges view — what a plan would cost in range mode. */
export interface MealPlanPriceRange {
  meal_plan_id: number;
  pricing_mode: PricingMode;
  price_cents: number;
  min_cents: number;
  max_cents: number;
}

/** The slot columns, in the order they read on the printed menu. */
export const PLAN_SLOTS: { key: keyof Pick<MealPlan, "main_count" | "side_count" | "dessert_count" | "rice_count">; label: string }[] = [
  { key: "main_count", label: "Main dishes" },
  { key: "side_count", label: "Side dishes" },
  { key: "rice_count", label: "Rice" },
  { key: "dessert_count", label: "Desserts" },
];
