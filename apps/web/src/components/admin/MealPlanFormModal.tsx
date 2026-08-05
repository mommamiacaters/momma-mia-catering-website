import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PLAN_SLOTS, type MealPlan, type MealPlanPriceRange, type PricingMode } from "../../types/menu";
import Modal from "../ui/Modal";
import { peso } from "../../constants/orders";

interface MealPlanFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Plan being edited, or null when adding. */
  initial: MealPlan | null;
  /** Live min–max for this plan, used to preview what "range" mode would charge. */
  priceRange?: MealPlanPriceRange;
  nextSortOrder: number;
  onSaved: () => void;
}

const FORM_ID = "admin-meal-plan-form";

const inputClass =
  "w-full rounded-lg border border-brand-divider bg-white px-3 py-2.5 font-poppins text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent";

type Counts = Record<string, number>;

const blankCounts: Counts = {
  main_count: 1,
  side_count: 1,
  dessert_count: 0,
  rice_count: 1,
};

const MealPlanFormModal: React.FC<MealPlanFormModalProps> = ({
  open,
  onClose,
  initial,
  priceRange,
  nextSortOrder,
  onSaved,
}) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [counts, setCounts] = useState<Counts>(blankCounts);
  const [pricingMode, setPricingMode] = useState<PricingMode>("fixed");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setName(initial.name);
      setPrice(String(initial.price_cents / 100));
      setCounts({
        main_count: initial.main_count,
        side_count: initial.side_count,
        dessert_count: initial.dessert_count,
        rice_count: initial.rice_count,
      });
      setPricingMode(initial.pricing_mode);
      setIsActive(initial.is_active);
    } else {
      setName("");
      setPrice("");
      setCounts(blankCounts);
      setPricingMode("fixed");
      setIsActive(true);
    }
  }, [open, initial]);

  /**
   * The description customers read is DERIVED from the counts rather than typed,
   * so a plan can never advertise "1 Main Dish" while actually granting two.
   * This is the same string the storefront renders under the plan name.
   */
  const composition = PLAN_SLOTS.filter(({ key }) => counts[key] > 0)
    .map(({ key, label }) => {
      const n = counts[key];
      const singular = label.replace(/e?s$/, "");
      return `${n} ${n === 1 ? singular : label}`;
    })
    .join(", ");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const totalItems = PLAN_SLOTS.reduce((sum, { key }) => sum + counts[key], 0);
    if (totalItems === 0) {
      setError("A plan must include at least one dish.");
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      name: trimmed,
      description: composition,
      // Kept even in range mode: it is what the plan falls back to if the mode is
      // switched back, so flipping to range and back doesn't lose the figure.
      price_cents: Math.round(Number(price || 0) * 100),
      main_count: counts.main_count,
      side_count: counts.side_count,
      dessert_count: counts.dessert_count,
      rice_count: counts.rice_count,
      pricing_mode: pricingMode,
      is_active: isActive,
      ...(initial ? {} : { sort_order: nextSortOrder }),
    };

    const res = initial
      ? await supabase.from("meal_plans").update(payload).eq("id", initial.id)
      : await supabase.from("meal_plans").insert(payload);

    setSaving(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit meal plan" : "New meal plan"}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-brand-divider px-4 py-2.5 font-arvo-bold text-sm text-brand-text hover:bg-brand-secondary cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={FORM_ID}
            disabled={saving}
            className="rounded-lg bg-brand-primary px-5 py-2.5 font-arvo-bold text-sm text-white hover:bg-brand-primary/90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Add plan"}
          </button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={save} className="p-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="plan-name" className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
            Plan name
          </label>
          <input
            id="plan-name"
            className={inputClass}
            required
            autoFocus
            value={name}
            placeholder="e.g. Standard Bento"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* ── How this plan charges ─────────────────────────────────────── */}
        <fieldset>
          <legend className="block text-sm font-poppins font-medium text-brand-text mb-2">
            How this plan is priced
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  mode: "fixed" as const,
                  title: "One fixed price",
                  blurb: "Every box costs the same. The dishes picked don't change the total.",
                },
                {
                  mode: "range" as const,
                  title: "Price range",
                  blurb: "The customer pays for the dishes they choose, shown as a range.",
                },
              ]
            ).map(({ mode, title, blurb }) => (
              <label
                key={mode}
                className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors ${
                  pricingMode === mode
                    ? "border-brand-primary bg-brand-primary/5"
                    : "border-brand-divider hover:border-brand-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name="pricing-mode"
                  value={mode}
                  checked={pricingMode === mode}
                  onChange={() => setPricingMode(mode)}
                  className="mt-0.5 accent-brand-primary"
                />
                <span className="min-w-0">
                  <span className="block font-arvo-bold text-sm text-brand-text">{title}</span>
                  <span className="block font-poppins text-xs text-brand-text/60 leading-snug">
                    {blurb}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {pricingMode === "fixed" ? (
          <div>
            <label htmlFor="plan-price" className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
              Price per box (₱)
            </label>
            <input
              id="plan-price"
              type="number"
              min="0"
              step="1"
              required
              className={inputClass}
              value={price}
              placeholder="210"
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        ) : (
          /*
            In range mode the total is the sum of whatever the customer picks, so
            there is no figure to type. The range is READ from the database view
            rather than computed here — the same number the storefront and the
            order maths will use, so they cannot disagree.
          */
          <div className="rounded-lg border border-brand-divider bg-brand-secondary/40 px-4 py-3">
            <p className="font-poppins text-xs text-brand-text/55">Customers will be quoted</p>
            <p className="font-arvo-bold text-lg text-brand-primary">
              {priceRange
                ? priceRange.min_cents === priceRange.max_cents
                  ? peso(priceRange.min_cents)
                  : `${peso(priceRange.min_cents)} – ${peso(priceRange.max_cents)}`
                : "—"}
            </p>
            <p className="mt-1 font-poppins text-xs text-brand-text/55">
              Worked out from the cheapest and dearest dishes currently on sale in each
              slot. Change a dish's price and this moves with it.
            </p>
          </div>
        )}

        <fieldset>
          <legend className="block text-sm font-poppins font-medium text-brand-text mb-1">
            What's included
          </legend>
          <p className="font-poppins text-xs text-brand-text/55 mb-3">
            How many of each the customer picks. Mains come from Pork, Chicken and Seafood.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {PLAN_SLOTS.map(({ key, label }) => (
              <div key={key} className="rounded-lg border border-brand-divider p-3">
                <label
                  htmlFor={`plan-${key}`}
                  className="block font-poppins text-xs text-brand-text/60 mb-1.5"
                >
                  {label}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Decrease ${label}`}
                    onClick={() =>
                      setCounts((c) => ({ ...c, [key]: Math.max(0, c[key] - 1) }))
                    }
                    className="h-8 w-8 shrink-0 rounded-full bg-brand-secondary text-brand-text transition-colors hover:bg-brand-divider cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    −
                  </button>
                  <input
                    id={`plan-${key}`}
                    type="number"
                    min={0}
                    max={9}
                    value={counts[key]}
                    onChange={(e) =>
                      setCounts((c) => ({
                        ...c,
                        [key]: Math.min(9, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    className="w-full rounded-lg border border-brand-divider bg-white px-2 py-1.5 text-center font-arvo-bold text-sm text-brand-text tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  <button
                    type="button"
                    aria-label={`Increase ${label}`}
                    onClick={() =>
                      setCounts((c) => ({ ...c, [key]: Math.min(9, c[key] + 1) }))
                    }
                    className="h-8 w-8 shrink-0 rounded-full bg-brand-primary text-white transition-colors hover:bg-brand-primary/90 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        {/* Live preview of exactly what a customer will read. */}
        <div className="rounded-lg bg-brand-secondary/50 px-4 py-3">
          <p className="font-poppins text-xs text-brand-text/55 mb-0.5">Customers will see</p>
          <p className="font-arvo-bold text-sm text-brand-text">
            {name.trim() || "Plan name"} —{" "}
            {pricingMode === "range"
              ? priceRange
                ? `${peso(priceRange.min_cents)} – ${peso(priceRange.max_cents)}`
                : "price range"
              : `₱${Number(price || 0).toFixed(0)}`}
          </p>
          <p className="font-poppins text-xs text-brand-text/70">
            {composition || "No dishes selected yet"}
          </p>
        </div>

        <label className="flex items-center gap-2 rounded-lg bg-brand-secondary/50 px-4 py-3 font-poppins text-sm text-brand-text cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-brand-primary w-4 h-4"
          />
          Show on website
        </label>
      </form>
    </Modal>
  );
};

export default MealPlanFormModal;
