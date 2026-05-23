// Storefront-facing settings hook. Fetches the public app settings once and
// caches them at module scope so every cart/checkout mount shares one request.
// Falls back to sensible defaults so the cart gate never breaks while loading.
import { useEffect, useState } from "react";
import {
  fetchPublicSettings,
  SETTING_KEYS,
  DEFAULT_MINIMUM_MEAL_PLANS,
} from "../services/settingsService";
import type { Json } from "@momma-mia/db";

let cache: Record<string, Json> | null = null;
let inflight: Promise<Record<string, Json>> | null = null;

export interface StoreSettings {
  minimumMealPlans: number;
  loading: boolean;
}

export function useStoreSettings(): StoreSettings {
  const [settings, setSettings] = useState<Record<string, Json> | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    // Share a single in-flight request across simultaneous mounts.
    if (!inflight) {
      inflight = fetchPublicSettings()
        .then((s) => {
          cache = s;
          return s;
        })
        .catch(() => ({}));
    }
    let active = true;
    inflight.then((s) => {
      if (!active) return;
      setSettings(s);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const raw = settings?.[SETTING_KEYS.minimumMealPlans];
  const parsed = Number(raw);
  const minimumMealPlans =
    Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MINIMUM_MEAL_PLANS;

  return { minimumMealPlans, loading };
}
