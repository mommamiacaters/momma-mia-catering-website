// App settings — a small key/value store (public.app_settings) the business can
// tune from the admin console. Public settings (is_public) are readable by the
// storefront; all settings are admin-writable.
import { supabase } from "../lib/supabase";
import type { Json } from "@momma-mia/db";

/** Stable keys so callers never hardcode raw strings. */
export const SETTING_KEYS = {
  minimumMealPlans: "minimum_meal_plans",
  minimumQtyPerDish: "minimum_qty_per_dish",
  showBulkDishActions: "show_bulk_dish_actions",
} as const;

/** Mirrors the app_settings_minimum_meal_plans_bounds CHECK constraint. */
export const MINIMUM_MEAL_PLANS_BOUNDS = { min: 0, max: 500 } as const;

/** Mirrors the app_settings_minimum_qty_per_dish_bounds CHECK constraint. */
export const MINIMUM_QTY_PER_DISH_BOUNDS = { min: 0, max: 500 } as const;

export interface AppSettingRow {
  key: string;
  value: Json;
  label: string;
  description: string | null;
  is_public: boolean;
  updated_at: string;
}

/** Storefront read: only the settings flagged public. Returns a key→value map. */
export async function fetchPublicSettings(): Promise<Record<string, Json>> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("is_public", true);
  if (error) throw error;
  const map: Record<string, Json> = {};
  for (const row of data ?? []) map[row.key] = row.value;
  return map;
}

/** Admin read: every setting, ordered for display. */
export async function fetchAllSettings(): Promise<AppSettingRow[]> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value, label, description, is_public, updated_at")
    .order("label");
  if (error) throw error;
  return (data ?? []) as AppSettingRow[];
}

/**
 * Admin write: update a single setting's value.
 *
 * Selects back the row it wrote. Without that, an RLS-denied PATCH returns 204
 * with no error and the console reports "Saved ✓" for a write that never
 * landed — fatal for a setting whose whole point is that the admin can change it.
 */
export async function updateSetting(key: string, value: Json): Promise<void> {
  const { data, error } = await supabase
    .from("app_settings")
    .update({ value })
    .eq("key", key)
    .select("key");

  if (error) {
    console.error("updateSetting failed:", error);
    if (/app_settings_minimum_qty_per_dish_bounds/.test(error.message)) {
      throw new Error(
        `Minimum per dish must be a whole number between ${MINIMUM_QTY_PER_DISH_BOUNDS.min} and ${MINIMUM_QTY_PER_DISH_BOUNDS.max}.`,
      );
    }
    if (
      error.code === "23514" ||
      /app_settings_minimum_meal_plans_bounds/.test(error.message)
    ) {
      throw new Error(
        `Minimum lunch boxes must be a whole number between ${MINIMUM_MEAL_PLANS_BOUNDS.min} and ${MINIMUM_MEAL_PLANS_BOUNDS.max}.`,
      );
    }
    throw new Error("Couldn't save that setting. Please try again.");
  }
  if (!data?.length) {
    throw new Error(
      "Nothing was saved — your account may not have admin access. Sign out and back in, then try again.",
    );
  }
}
