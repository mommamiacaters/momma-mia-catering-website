import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { SERVICE_TO_CATEGORY } from "../../constants/serviceContent";
import { useStoreSettings } from "../../hooks/useStoreSettings";

/**
 * The order rules that differ per service. Both live on the service's menu
 * CATEGORY because that is what create_order enforces — this card is just the
 * tap on those two columns.
 *
 *   min_order_boxes  → fewest meals in the whole order
 *   min_qty_per_dish → fewest of EACH dish in the order
 *
 * Blank means the store default from Settings applies. Party Trays is the
 * reason this exists: a tray is sold by the piece, so both of its floors are 1
 * where the lunch-box defaults are 15.
 */
const ServiceOrderRulesCard: React.FC<{ serviceSlug: string }> = ({ serviceSlug }) => {
  const categorySlug = SERVICE_TO_CATEGORY[serviceSlug];
  const { minimumMealPlans, minimumQtyPerDish } = useStoreSettings();

  const [loaded, setLoaded] = useState(false);
  const [meals, setMeals] = useState("");
  const [dishes, setDishes] = useState("");
  const [savedMeals, setSavedMeals] = useState("");
  const [savedDishes, setSavedDishes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!categorySlug) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("categories")
        .select("min_order_boxes, min_qty_per_dish")
        .eq("slug", categorySlug)
        .single();
      if (cancelled) return;
      if (err) {
        setError("Couldn't load this service's rules. Refresh to retry.");
        return;
      }
      const m = data?.min_order_boxes == null ? "" : String(data.min_order_boxes);
      const d = data?.min_qty_per_dish == null ? "" : String(data.min_qty_per_dish);
      setMeals(m);
      setDishes(d);
      setSavedMeals(m);
      setSavedDishes(d);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [categorySlug]);

  // Quote-only services (Catering, Equipment Rental) have no online ordering
  // and therefore no minimums to set.
  if (!categorySlug) return null;

  const dirty = meals !== savedMeals || dishes !== savedDishes;

  /** "" → null (inherit the store default); anything else → a whole 0-500. */
  const parse = (raw: string): number | null | "bad" => {
    if (raw.trim() === "") return null;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0 || n > 500) return "bad";
    return n;
  };

  const save = async () => {
    setError(null);
    const m = parse(meals);
    const d = parse(dishes);
    if (m === "bad" || d === "bad") {
      setError("Enter a whole number from 0 to 500, or leave it blank to inherit.");
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from("categories")
      .update({ min_order_boxes: m, min_qty_per_dish: d })
      .eq("slug", categorySlug);
    setSaving(false);
    if (err) {
      setError("Couldn't save. Please try again.");
      return;
    }
    setSavedMeals(meals);
    setSavedDishes(dishes);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  const field = (
    id: string,
    label: string,
    hint: string,
    value: string,
    onChange: (v: string) => void,
    storeDefault: number | null,
  ) => (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block font-poppins text-xs font-semibold uppercase tracking-wide text-brand-text/60"
      >
        {label}
      </label>
      <input
        id={id}
        aria-describedby={`${id}-hint`}
        type="number"
        min={0}
        max={500}
        inputMode="numeric"
        value={value}
        disabled={!loaded}
        onChange={(e) => onChange(e.target.value)}
        placeholder={storeDefault == null ? "store default" : `store default (${storeDefault})`}
        className="min-h-[44px] w-44 rounded-lg border border-brand-divider px-3 py-2.5 font-poppins text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
      />
      <p id={`${id}-hint`} className="mt-1.5 font-poppins text-xs text-brand-text/50">
        {hint}
      </p>
    </div>
  );

  return (
    <div className="rounded-xl border border-brand-divider bg-white p-5 shadow-sm">
      <h2 className="font-arvo-bold text-base text-brand-text">Order rules</h2>
      <p className="mt-1 font-poppins text-xs text-brand-text/60">
        These <strong className="font-semibold">override the store defaults</strong>{" "}
        for this service. Leave a box blank to inherit it; 0 turns that rule off.
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-5">
        {field(
          "svc-min-meals",
          "Minimum meals",
          "Fewest meals in the order.",
          meals,
          setMeals,
          minimumMealPlans,
        )}
        {field(
          "svc-min-dishes",
          "Minimum dishes",
          "Fewest of each dish.",
          dishes,
          setDishes,
          minimumQtyPerDish,
        )}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || !loaded}
          className="mt-[1.6rem] min-h-[44px] cursor-pointer rounded-lg bg-brand-primary px-5 font-arvo-bold text-sm text-white transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : savedFlash && !dirty ? "Saved ✓" : "Save rules"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 font-poppins text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

export default ServiceOrderRulesCard;
