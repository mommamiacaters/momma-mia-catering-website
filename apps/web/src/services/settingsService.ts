// App settings — a small key/value store (public.app_settings) the business can
// tune from the admin console. Public settings (is_public) are readable by the
// storefront; all settings are admin-writable.
import { supabase } from "../lib/supabase";
import type { Json } from "@momma-mia/db";

/** Stable keys so callers never hardcode raw strings. */
export const SETTING_KEYS = {
  minimumMealPlans: "minimum_meal_plans",
} as const;

/** Fallback used if the setting hasn't loaded yet or the row is missing. */
export const DEFAULT_MINIMUM_MEAL_PLANS = 15;

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

/** Admin write: update a single setting's value. */
export async function updateSetting(key: string, value: Json): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({ value })
    .eq("key", key);
  if (error) throw error;
}
