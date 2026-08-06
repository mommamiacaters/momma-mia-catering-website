// Storefront-facing settings hook. Fetches the public app settings once and
// caches them at module scope so every cart/checkout mount shares one request.
//
// It never invents a number. "The fetch failed" and "the admin set 0" are
// different facts with opposite safety implications: the customer pays via the
// BPI InstaPay QR BEFORE create_order ever validates, so guessing "no minimum"
// on a failed read would let someone transfer money into an order the server
// then rejects. Unknown is its own state (null) and blocks checkout.
import { useCallback, useEffect, useState } from "react";
import { fetchPublicSettings, SETTING_KEYS } from "../services/settingsService";
import type { Json } from "@momma-mia/db";

/** Settings are business config, not live data — a few minutes stale is fine. */
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: Record<string, Json> | null = null;
let cachedAt = 0;
let inflight: Promise<Record<string, Json>> | null = null;

// Every mounted instance, so a retry from one surface (the cart drawer) also
// heals the others (the menu banner). Without this, retrying in the cart left
// the menu still saying "checkout is paused".
const subscribers = new Set<() => void>();

/** A request that never answers must not leave checkout on a silent spinner. */
const FETCH_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error("settings request timed out")),
      FETCH_TIMEOUT_MS,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function loadSettings(): Promise<Record<string, Json>> {
  const fresh = cache && Date.now() - cachedAt < CACHE_TTL_MS;
  if (fresh) return Promise.resolve(cache as Record<string, Json>);
  if (!inflight) {
    inflight = withTimeout(fetchPublicSettings())
      .then((s) => {
        cache = s;
        cachedAt = Date.now();
        inflight = null;
        return s;
      })
      .catch((e) => {
        // Release the slot so a retry can actually re-request. Previously a
        // single blip pinned `inflight` forever and the whole page session
        // was stuck with the wrong value.
        inflight = null;
        throw e;
      });
  }
  return inflight;
}

export interface StoreSettings {
  /** null = unknown (still loading, or the fetch failed). NEVER a guess. */
  minimumMealPlans: number | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

export function useStoreSettings(): StoreSettings {
  const [settings, setSettings] = useState<Record<string, Json> | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setError(false);
    setLoading(true);
    loadSettings()
      .then((s) => {
        if (!active) return;
        setSettings(s);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSettings(null);
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  // Re-run this instance's effect whenever any instance retries.
  useEffect(() => {
    const bump = () => setNonce((n) => n + 1);
    subscribers.add(bump);
    return () => {
      subscribers.delete(bump);
    };
  }, []);

  const retry = useCallback(() => {
    cache = null;
    cachedAt = 0;
    inflight = null;
    subscribers.forEach((fn) => fn());
  }, []);

  // A value that came back from the DB is trusted — including an absent or
  // malformed key, which means "rule off" and matches the server's
  // coalesce(..., 0) exactly. A value that never arrived stays unknown.
  let minimumMealPlans: number | null = null;
  if (!loading && !error && settings) {
    const raw = settings[SETTING_KEYS.minimumMealPlans];
    minimumMealPlans =
      typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? raw : 0;
  }

  return { minimumMealPlans, loading, error, retry };
}

export interface MinimumState {
  /** The number came from the DB (as opposed to loading/failed). */
  known: boolean;
  /** 0 when unknown or switched off. */
  minimum: number;
  /** Worth showing the minimum UI at all. */
  active: boolean;
  met: boolean;
  remaining: number;
  /** Must not proceed to checkout — true while unknown, too. */
  blocked: boolean;
}

/**
 * Single derivation shared by the cart drawer, the menu banner and checkout so
 * the three surfaces cannot drift apart.
 */
export function deriveMinimumState(
  minimumMealPlans: number | null,
  boxes: number,
): MinimumState {
  const known = minimumMealPlans !== null;
  const minimum = minimumMealPlans ?? 0;
  return {
    known,
    minimum,
    active: known && minimum > 1,
    met: known && boxes >= minimum,
    remaining: Math.max(0, minimum - boxes),
    blocked: !known || boxes < minimum,
  };
}
