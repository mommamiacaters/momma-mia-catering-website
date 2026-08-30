import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { SERVICE_TO_CATEGORY } from "../../constants/serviceContent";
import { useStoreSettings } from "../../hooks/useStoreSettings";

/**
 * The one order rule that differs per service: the minimum number of
 * boxes/trays an order must reach. It lives on the service's menu CATEGORY
 * (categories.min_order_boxes) because that is what create_order enforces —
 * this card is just the tap on that column.
 *
 * Blank = the store default from Settings applies (shown for context so the
 * admin can see what "blank" currently means). Party Trays is the reason this
 * exists: a tray feeds 8-10 people, and the lunch-box default of 15 made no
 * sense for it.
 */
const ServiceOrderRulesCard: React.FC<{ serviceSlug: string }> = ({ serviceSlug }) => {
  const categorySlug = SERVICE_TO_CATEGORY[serviceSlug];
  const { minimumMealPlans } = useStoreSettings();

  const [loaded, setLoaded] = useState(false);
  const [value, setValue] = useState<string>("");
  const [savedValue, setSavedValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!categorySlug) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("categories")
        .select("min_order_boxes")
        .eq("slug", categorySlug)
        .single();
      if (cancelled) return;
      if (err) {
        setError("Couldn't load this service's minimum. Refresh to retry.");
        return;
      }
      const v = data?.min_order_boxes == null ? "" : String(data.min_order_boxes);
      setValue(v);
      setSavedValue(v);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [categorySlug]);

  // Quote-only services (Catering, Equipment Rental) have no online ordering
  // and therefore no minimum to set.
  if (!categorySlug) return null;

  const dirty = value !== savedValue;

  const save = async () => {
    setSaving(true);
    setError(null);
    const parsed = value.trim() === "" ? null : Math.max(0, Math.floor(Number(value)));
    if (parsed !== null && (!Number.isFinite(parsed) || parsed > 500)) {
      setError("Enter a whole number up to 500, or leave it blank for the store default.");
      setSaving(false);
      return;
    }
    const { error: err } = await supabase
      .from("categories")
      .update({ min_order_boxes: parsed })
      .eq("slug", categorySlug);
    setSaving(false);
    if (err) {
      setError("Couldn't save. Please try again.");
      return;
    }
    const v = parsed == null ? "" : String(parsed);
    setValue(v);
    setSavedValue(v);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  return (
    <div className="mt-6 rounded-xl border border-brand-divider bg-white p-5 shadow-sm">
      <h2 className="font-arvo-bold text-base text-brand-text">Order rules</h2>
      <p className="mt-1 font-poppins text-xs text-brand-text/60">
        The smallest order this service accepts. Checkout and the website both
        enforce it.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block font-poppins text-xs font-semibold uppercase tracking-wide text-brand-text/60">
            Minimum per order
          </span>
          <input
            type="number"
            min={0}
            max={500}
            inputMode="numeric"
            value={value}
            disabled={!loaded}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              minimumMealPlans == null ? "store default" : `store default (${minimumMealPlans})`
            }
            className="w-44 rounded-lg border border-brand-divider px-3 py-2.5 font-poppins text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || !loaded}
          className="min-h-[44px] rounded-lg bg-brand-primary px-5 font-arvo-bold text-sm text-white transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : savedFlash && !dirty ? "Saved ✓" : "Save minimum"}
        </button>
      </div>

      <p className="mt-3 font-poppins text-xs text-brand-text/50">
        Leave it blank to use the store default from Settings
        {minimumMealPlans != null && <> (currently {minimumMealPlans})</>}. Set it
        to 1 for services sold by the piece, like Party Trays.
      </p>

      {error && (
        <p role="alert" className="mt-3 font-poppins text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default ServiceOrderRulesCard;
