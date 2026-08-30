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
import type { PlanInstance } from "../types";

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
  /** Store-default floor for every dish in a lunch-box order. Same null rule. */
  minimumQtyPerDish: number | null;
  /**
   * Whether dish cards show their bulk "Fill all" / "Clear" buttons.
   *
   * Presentation, not money, so it doesn't get the null-unknown treatment the
   * minimums do — but it stays FALSE until a real value arrives. Defaulting to
   * true while loading would flash both buttons onto every card and then snatch
   * them away a moment later.
   */
  showBulkDishActions: boolean;
  /**
   * Whether the homepage shows its Other Services band and serves the page it
   * opens.
   *
   * Same presentation-not-money rule as the bulk actions, and it fails CLOSED
   * for the same reason in reverse: the switch exists so the business can take
   * the section down, so a failed read must not put it back up. The section
   * lives below the fold, so arriving a moment after the settings do is
   * invisible.
   */
  showOtherServices: boolean;
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
  let minimumQtyPerDish: number | null = null;
  // Absent key = the seed hasn't run yet, which is the pre-toggle world: show.
  let showBulkDishActions = false;
  let showOtherServices = false;
  if (!loading && !error && settings) {
    const raw = settings[SETTING_KEYS.showBulkDishActions];
    showBulkDishActions = raw === undefined || raw === null ? true : raw === true;
    const other = settings[SETTING_KEYS.showOtherServices];
    showOtherServices = other === undefined || other === null ? true : other === true;
    minimumMealPlans = parseSetting(settings[SETTING_KEYS.minimumMealPlans]);
    minimumQtyPerDish = parseSetting(settings[SETTING_KEYS.minimumQtyPerDish]);
  }

  return {
    minimumMealPlans,
    minimumQtyPerDish,
    showBulkDishActions,
    showOtherServices,
    loading,
    error,
    retry,
  };
}

function parseSetting(raw: Json | undefined): number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? raw : 0;
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

export interface DishMinimumViolation {
  menuItemId: string;
  name: string;
  required: number;
  current: number;
  remaining: number;
}

export interface DishMinimumState {
  /** The store default came from the DB (as opposed to loading/failed). */
  known: boolean;
  /** Every selected dish currently under its floor, alphabetical. */
  violations: DishMinimumViolation[];
  /** Must not proceed to checkout — true while unknown too, if dishes exist. */
  blocked: boolean;
}

/**
 * Per-dish floors, mirroring create_order v7: every distinct dish placed in
 * the boxes must reach coalesce(its min_qty snapshot, the store default).
 * Shared by the menu banner, the cart drawer and checkout — same reason as
 * deriveMinimumState. Counts by menuItemId, never by name.
 */
export function deriveDishMinimumState(
  minimumQtyPerDish: number | null,
  planInstances: PlanInstance[],
  // Extras ride the same floor: an Add-on is still a kitchen batch. Optional
  // so surfaces without extras in hand keep their old call shape.
  extras: { menuItemId: string; name: string; qty: number; minQty: number | null }[] = [],
): DishMinimumState {
  const known = minimumQtyPerDish !== null;
  const tally = new Map<
    string,
    { name: string; count: number; minQty: number | null }
  >();
  for (const e of extras) {
    const row =
      tally.get(e.menuItemId) ?? { name: e.name, count: 0, minQty: null };
    row.count += e.qty;
    if (e.minQty !== null) {
      row.minQty = row.minQty === null ? e.minQty : Math.max(row.minQty, e.minQty);
    }
    tally.set(e.menuItemId, row);
  }
  for (const pi of planInstances) {
    for (const ai of pi.items) {
      const row =
        tally.get(ai.menuItemId) ?? { name: ai.name, count: 0, minQty: null };
      row.count += 1;
      // Box order is NOT add order (boxes reorder), so "latest wins" is not
      // knowable here. Strictest defined snapshot wins: over-blocking is
      // recoverable in the UI, an under-block is pay-then-reject. Checkout
      // re-reads the live overrides either way.
      if (ai.minQty !== undefined && ai.minQty !== null) {
        row.minQty = row.minQty === null ? ai.minQty : Math.max(row.minQty, ai.minQty);
      }
      tally.set(ai.menuItemId, row);
    }
  }

  const violations: DishMinimumViolation[] = [];
  if (minimumQtyPerDish !== null) {
    for (const [menuItemId, row] of tally) {
      const required = row.minQty ?? minimumQtyPerDish;
      if (required > 0 && row.count < required) {
        violations.push({
          menuItemId,
          name: row.name,
          required,
          current: row.count,
          remaining: required - row.count,
        });
      }
    }
    violations.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    known,
    violations,
    blocked: tally.size > 0 && (!known || violations.length > 0),
  };
}
