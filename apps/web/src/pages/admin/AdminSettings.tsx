import React, { useEffect, useMemo, useState } from "react";
import {
  fetchAllSettings,
  updateSetting,
  type AppSettingRow,
} from "../../services/settingsService";
import type { Json } from "@momma-mia/db";

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
    <div className="max-w-3xl">
      <h1 className="font-arvo-bold text-2xl text-brand-text mb-1">Store Settings</h1>
      <p className="font-poppins text-sm text-brand-text/60 mb-6">
        Tune how the storefront behaves — no code deploy needed. Changes apply to
        new visitors immediately.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700">
          {error}
        </div>
      )}

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

                <div className="flex items-center gap-2 shrink-0">
                  <SettingInput
                    id={`setting-${row.key}`}
                    value={drafts[row.key]}
                    onChange={(v) =>
                      setDrafts((prev) => ({ ...prev, [row.key]: v }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => handleSave(row)}
                    disabled={!dirty[row.key] || savingKey === row.key}
                    className="rounded-lg bg-brand-primary px-4 py-2 font-arvo-bold text-sm text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {savingKey === row.key
                      ? "Saving…"
                      : savedKey === row.key
                        ? "Saved ✓"
                        : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Renders the right control for a JSON setting value. */
const SettingInput: React.FC<{
  id: string;
  value: Json;
  onChange: (v: Json) => void;
}> = ({ id, value, onChange }) => {
  const inputClass =
    "w-28 rounded-lg border border-brand-divider bg-brand-secondary/40 px-3 py-2 font-poppins text-sm text-brand-text text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent";

  if (typeof value === "boolean") {
    return (
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
          value ? "bg-brand-primary" : "bg-brand-divider"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
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
        min={1}
        step={1}
        value={value}
        onChange={(e) => {
          const n = Math.max(1, Math.floor(Number(e.target.value) || 0));
          onChange(n);
        }}
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
