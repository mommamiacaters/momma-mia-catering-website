import React, { useEffect, useMemo, useState } from "react";
import {
  fetchAllSettings,
  updateSetting,
  MINIMUM_MEAL_PLANS_BOUNDS,
  MINIMUM_QTY_PER_DISH_BOUNDS,
  type AppSettingRow,
} from "../../services/settingsService";
import { SETTING_KEYS } from "../../services/settingsService";
import type { Json } from "@momma-mia/db";
import AdminCompanyProfile from "./AdminCompanyProfile";

/** Per-key limits, mirroring the DB CHECK constraints. */
const NUMBER_BOUNDS: Record<string, { min: number; max: number }> = {
  minimum_meal_plans: MINIMUM_MEAL_PLANS_BOUNDS,
  minimum_qty_per_dish: MINIMUM_QTY_PER_DISH_BOUNDS,
};
const DEFAULT_BOUNDS = { min: 0, max: 999 };

/**
 * Store Settings — admin-tunable configuration backed by public.app_settings.
 * Each row renders an input chosen from the value's JSON type, so new settings
 * added to the table show up here automatically (number → stepper, boolean →
 * toggle, string → text field).
 */
const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Json>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Hide internal infra config (notify URLs + shared secrets) from this
      // storefront-tuning page — those are server-side wiring, not store settings.
      // Covers the retired n8n_* keys and the live order_notify_* / *secret* / *token*.
      const rows = (await fetchAllSettings()).filter(
        (r) => !/^(n8n_|order_notify_)/.test(r.key) && !/secret|token/i.test(r.key),
      );
      setSettings(rows);
      setDrafts(Object.fromEntries(rows.map((r) => [r.key, r.value])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const dirty = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const s of settings) {
      map[s.key] = JSON.stringify(drafts[s.key]) !== JSON.stringify(s.value);
    }
    return map;
  }, [settings, drafts]);

  // Validate rather than clamp. Clamping silently rewrites the admin's number
  // and then reports "Saved ✓" for a value they never typed.
  const invalidByKey = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const s of settings) {
      const d = drafts[s.key];
      if (typeof s.value !== "number") {
        map[s.key] = false;
        continue;
      }
      const b = NUMBER_BOUNDS[s.key] ?? DEFAULT_BOUNDS;
      map[s.key] =
        typeof d !== "number" ||
        !Number.isInteger(d) ||
        d < b.min ||
        d > b.max;
    }
    return map;
  }, [settings, drafts]);

  const handleSave = async (row: AppSettingRow) => {
    setSavingKey(row.key);
    setSavedKey(null);
    setError(null);
    try {
      await updateSetting(row.key, drafts[row.key]);
      setSettings((prev) =>
        prev.map((s) => (s.key === row.key ? { ...s, value: drafts[row.key] } : s))
      );
      setSavedKey(row.key);
      setTimeout(() => setSavedKey((k) => (k === row.key ? null : k)), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div>
      <h1 className="font-arvo-bold text-2xl text-brand-text mb-1">Store Settings</h1>
      <p className="font-poppins text-sm text-brand-text/60 mb-6">
        Tune how the storefront behaves — no code deploy needed. Changes reach a
        customer the next time they load the site; an already-open tab picks
        them up within about 5 minutes.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700">
          {error}
        </div>
      )}

      {/* Two flexible columns: ordering rules on the left, business details on
          the right. Stacks on narrow screens. */}
      <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
        <section aria-label="Ordering rules">
          <h2 className="font-arvo-bold text-lg text-brand-text mb-3">Ordering rules</h2>
      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : settings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center font-poppins text-brand-text/60">
          No settings found.
        </div>
      ) : (
        <div className="space-y-4">
          {settings.map((row) => (
            <div
              key={row.key}
              className="bg-white rounded-xl shadow-sm border border-brand-divider p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`setting-${row.key}`}
                    className="block font-arvo-bold text-brand-text text-sm"
                  >
                    {row.label}
                  </label>
                  {row.description && (
                    <p className="font-poppins text-xs text-brand-text/55 mt-1 leading-relaxed">
                      {row.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-2">
                  <SettingInput
                    id={`setting-${row.key}`}
                    value={drafts[row.key]}
                    bounds={NUMBER_BOUNDS[row.key] ?? DEFAULT_BOUNDS}
                    invalid={invalidByKey[row.key]}
                    onChange={(v) =>
                      setDrafts((prev) => ({ ...prev, [row.key]: v }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => handleSave(row)}
                    disabled={
                      !dirty[row.key] ||
                      invalidByKey[row.key] ||
                      savingKey === row.key
                    }
                    className="rounded-lg bg-brand-primary px-4 py-2 font-arvo-bold text-sm text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {savingKey === row.key
                      ? "Saving…"
                      : savedKey === row.key
                        ? "Saved ✓"
                        : "Save"}
                  </button>
                  </div>
                  {invalidByKey[row.key] && (
                    <p className="font-poppins text-xs text-red-600">
                      Must be a whole number between{" "}
                      {(NUMBER_BOUNDS[row.key] ?? DEFAULT_BOUNDS).min} and{" "}
                      {(NUMBER_BOUNDS[row.key] ?? DEFAULT_BOUNDS).max}.
                    </p>
                  )}
                </div>
              </div>

              {row.key === SETTING_KEYS.showBulkDishActions && (
                <BulkActionsPreview
                  show={(drafts[row.key] ?? row.value) === true}
                />
              )}
            </div>
          ))}
        </div>
      )}
        </section>

        <section aria-label="Company profile">
          <h2 className="font-arvo-bold text-lg text-brand-text mb-3">Company profile</h2>
          <AdminCompanyProfile embedded />
        </section>
      </div>
    </div>
  );
};

/** Renders the right control for a JSON setting value. */
/**
 * A dish card as the customer sees it, reflecting the UNSAVED toggle — a
 * setting whose only effect is two buttons appearing or not is much easier to
 * agree to when you can see the card it changes.
 */
const BulkActionsPreview: React.FC<{ show: boolean }> = ({ show }) => (
  <div className="mt-4 border-t border-brand-divider pt-4">
    <p className="font-poppins text-[0.7rem] font-semibold uppercase tracking-wider text-brand-text/50">
      Preview
    </p>
    <div className="mt-2 w-56 rounded-2xl bg-white shadow-md ring-1 ring-brand-divider overflow-hidden">
      <div className="flex items-center justify-center h-16 bg-brand-secondary/70">
        <i className="pi pi-image text-xl text-brand-text/25" aria-hidden="true" />
      </div>
      <div className="px-3 pt-3">
        <p className="font-arvo-bold text-xs text-brand-text">Pork Adobo</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-secondary font-poppins text-sm text-brand-text">
            &minus;
          </span>
          <span className="flex h-8 w-12 items-center justify-center rounded-lg border border-brand-divider font-poppins text-xs font-bold tabular-nums">
            15
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary font-poppins text-sm text-white">
            +
          </span>
        </div>
      </div>
      <div className="px-3 pb-3 pt-2">
        {show ? (
          <div className="grid grid-cols-2 gap-1.5">
            <span className="flex h-8 items-center justify-center rounded-lg bg-brand-primary font-poppins text-[0.7rem] font-bold text-white">
              Fill all 30
            </span>
            <span className="flex h-8 items-center justify-center rounded-lg border border-brand-divider font-poppins text-[0.7rem] font-bold text-brand-text/70">
              Clear 15
            </span>
          </div>
        ) : (
          <p className="text-center font-poppins text-[0.7rem] italic text-brand-text/40">
            Bulk buttons hidden
          </p>
        )}
      </div>
    </div>
  </div>
);

const SettingInput: React.FC<{
  id: string;
  value: Json;
  bounds: { min: number; max: number };
  invalid: boolean;
  onChange: (v: Json) => void;
}> = ({ id, value, bounds, invalid, onChange }) => {
  const inputClass = `w-28 rounded-lg border bg-brand-secondary/40 px-3 py-2 font-poppins text-sm text-brand-text text-right tabular-nums focus:outline-none focus:ring-2 focus:border-transparent ${
    invalid
      ? "border-red-400 focus:ring-red-400"
      : "border-brand-divider focus:ring-brand-primary"
  }`;

  if (typeof value === "boolean") {
    return (
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
          value ? "bg-brand-primary" : "bg-brand-divider"
        }`}
      >
        <span
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </button>
    );
  }

  if (typeof value === "number") {
    return (
      <input
        id={id}
        type="number"
        min={bounds.min}
        max={bounds.max}
        step={1}
        aria-invalid={invalid}
        value={value}
        // Commit on every keystroke (deferring to blur would deadlock: Save is
        // disabled until `drafts` changes, and a disabled button never blurs
        // the input). Parsed but NOT clamped — out-of-range is surfaced, not
        // silently rewritten.
        onChange={(e) =>
          onChange(
            e.target.value === "" ? 0 : Math.floor(Number(e.target.value)),
          )
        }
        className={inputClass}
      />
    );
  }

  return (
    <input
      id={id}
      type="text"
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} w-56 text-left`}
    />
  );
};

export default AdminSettings;
