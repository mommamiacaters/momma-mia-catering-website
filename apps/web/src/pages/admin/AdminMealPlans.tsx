import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PLAN_SLOTS, type Category, type MealPlan, type MealPlanPriceRange } from "../../types/menu";
import MealPlanFormModal from "../../components/admin/MealPlanFormModal";
import { peso } from "../../constants/orders";

const SELECT =
  "id, name, description, price_cents, pricing_mode, main_count, side_count, dessert_count, rice_count, rice_bowl_count, sandwich_count, pasta_count, sort_order, is_active, category_id";

/** The food-service categories that always get a section, even when empty. */
const SERVICE_CATEGORY_SLUGS = ["check-a-lunch", "party-tray", "fun-boxes"];

interface AdminMealPlansProps {
  /** public.categories.slug to scope to. Omit for every service at once. */
  categorySlug?: string;
  /** Drop the page heading when another screen already supplies one. */
  embedded?: boolean;
}

const AdminMealPlans: React.FC<AdminMealPlansProps> = ({ categorySlug, embedded }) => {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ranges, setRanges] = useState<Map<number, MealPlanPriceRange>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    initial: MealPlan | null;
    defaultCategoryId?: number;
  }>({ open: false, initial: null });

  const load = async () => {
    const [{ data, error }, { data: rangeRows }, { data: cats }] = await Promise.all([
      supabase.from("meal_plans").select(SELECT).order("sort_order"),
      supabase.from("meal_plan_price_ranges").select("*"),
      supabase
        .from("categories")
        .select("id, slug, name, sort_order, min_order_boxes")
        .order("sort_order"),
    ]);
    if (error) setError(error.message);
    setPlans((data as MealPlan[]) ?? []);
    setCategories((cats as Category[]) ?? []);
    setRanges(
      new Map(((rangeRows as MealPlanPriceRange[]) ?? []).map((r) => [r.meal_plan_id, r])),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  // One section per food service (always shown, so the admin can see where a
  // new plan will land), plus a section for any other category holding plans.
  const sections = categories
    .filter((c) =>
      categorySlug
        ? c.slug === categorySlug
        : SERVICE_CATEGORY_SLUGS.includes(c.slug) || plans.some((p) => p.category_id === c.id),
    )
    .map((c) => ({ category: c, plans: plans.filter((p) => p.category_id === c.id) }));

  // Embedded under the service page's own <h2>, so the headings shift down a
  // level to keep the outline valid.
  const SectionHeading = embedded ? "h3" : "h2";
  const CardHeading = embedded ? "h4" : "h3";

  // ---- per-service order minimum (categories.min_order_boxes) ---------------
  const [minDraft, setMinDraft] = useState<{ id: number; value: string } | null>(null);
  const [minSaving, setMinSaving] = useState(false);

  const saveMin = async () => {
    if (!minDraft || minSaving) return;
    const raw = minDraft.value.trim();
    const next = raw === "" ? null : Math.floor(Number(raw));
    if (next !== null && (!Number.isFinite(next) || next < 0 || next > 500)) {
      setError("Minimum per order must be a whole number between 0 and 500, or blank for the store default.");
      return;
    }
    setMinSaving(true);
    const { data, error } = await supabase
      .from("categories")
      .update({ min_order_boxes: next })
      .eq("id", minDraft.id)
      .select("id");
    setMinSaving(false);
    if (error || !data?.length) {
      setError(error?.message ?? "Nothing was saved — you may need to sign in again.");
      return;
    }
    setCategories((prev) =>
      prev.map((c) => (c.id === minDraft.id ? { ...c, min_order_boxes: next } : c)),
    );
    setMinDraft(null);
  };

  const toggleActive = async (plan: MealPlan) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === plan.id ? { ...p, is_active: !p.is_active } : p)),
    );
    const { error } = await supabase
      .from("meal_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    if (error) {
      setError(error.message);
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, is_active: plan.is_active } : p)),
      );
    }
  };

  const remove = async (plan: MealPlan) => {
    if (!window.confirm(`Delete "${plan.name}"? This can't be undone.`)) return;
    const { error } = await supabase.from("meal_plans").delete().eq("id", plan.id);
    if (error) setError(error.message);
    await load();
  };

  return (
    <div>
      {/* Scoped to one service, the section header already carries "Add to …". */}
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-arvo-bold text-2xl text-brand-text">Meal Plans</h1>
            <p className="font-poppins text-sm text-brand-text/60 mt-0.5">
              The boxes and trays customers can order, grouped by the service page that sells them.
            </p>
          </div>
          <button
            onClick={() => setModal({ open: true, initial: null })}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 font-arvo-bold text-sm text-white hover:bg-brand-primary/90 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
          >
            <i className="pi pi-plus" aria-hidden="true" /> Add plan
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-poppins text-sm text-red-700"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer" aria-label="Dismiss">
            <i className="pi pi-times" aria-hidden="true" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary/30 border-t-brand-primary" />
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map(({ category, plans: sectionPlans }) => (
            <section key={category.id} aria-label={`${category.name} plans`}>
              <div className="mb-3 flex items-center gap-3">
                <SectionHeading className="font-arvo-bold text-lg text-brand-text">
                  {category.name}
                </SectionHeading>
                <span className="rounded-full bg-brand-accent/20 px-2 py-0.5 font-poppins text-xs text-brand-text/70">
                  {sectionPlans.length} {sectionPlans.length === 1 ? "plan" : "plans"}
                </span>

                {/* Per-service order minimum — overrides the store default. */}
                {minDraft?.id === category.id ? (
                  <span className="inline-flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={500}
                      step={1}
                      autoFocus
                      value={minDraft.value}
                      placeholder="default"
                      aria-label={`Minimum boxes per order for ${category.name} (blank = store default)`}
                      onChange={(e) => setMinDraft({ id: category.id, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveMin();
                        if (e.key === "Escape") setMinDraft(null);
                      }}
                      className="w-20 rounded-lg border border-brand-divider bg-white px-2 py-1 font-poppins text-xs text-brand-text tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <button
                      onClick={() => void saveMin()}
                      disabled={minSaving}
                      aria-label={`Save minimum for ${category.name}`}
                      className="rounded-lg bg-brand-primary px-2.5 py-1 font-poppins text-xs font-semibold text-white hover:bg-brand-primary/90 cursor-pointer disabled:opacity-60"
                    >
                      {minSaving ? "…" : "Save"}
                    </button>
                    <button
                      onClick={() => setMinDraft(null)}
                      aria-label="Cancel editing minimum"
                      className="rounded-lg px-2 py-1 font-poppins text-xs text-brand-text/60 hover:bg-brand-secondary cursor-pointer"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() =>
                      setMinDraft({
                        id: category.id,
                        value: category.min_order_boxes == null ? "" : String(category.min_order_boxes),
                      })
                    }
                    title={`Minimum boxes/trays per order on the ${category.name} page — click to change. Blank means the store default from Settings applies.`}
                    className="inline-flex items-center gap-1 rounded-full border border-brand-divider bg-white px-2.5 py-0.5 font-poppins text-xs text-brand-text/70 tabular-nums transition-colors hover:border-brand-primary/40 hover:text-brand-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    <i className="pi pi-sliders-h text-[10px]" aria-hidden="true" />
                    Min/order:{" "}
                    {category.min_order_boxes == null
                      ? "store default"
                      : category.min_order_boxes === 0
                        ? "none"
                        : category.min_order_boxes}
                  </button>
                )}

                <div className="flex-1 border-t border-brand-divider" />
                <button
                  onClick={() =>
                    setModal({ open: true, initial: null, defaultCategoryId: category.id })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-poppins text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <i className="pi pi-plus text-[10px]" aria-hidden="true" /> Add to{" "}
                  {category.name}
                </button>
              </div>

              {sectionPlans.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-brand-divider bg-white/50 px-4 py-6 text-center">
                  <p className="font-poppins text-sm text-brand-text/50">
                    No plans yet — this service page says &ldquo;online ordering coming
                    soon&rdquo; until one is added.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {sectionPlans.map((plan) => (
            <article
              key={plan.id}
              className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-opacity ${
                plan.is_active ? "border-brand-divider" : "border-brand-divider opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <CardHeading className="font-arvo-bold text-lg text-brand-text">
                  {plan.name}
                </CardHeading>
                <span className="shrink-0 text-right">
                  <span className="block font-arvo-bold text-xl text-brand-primary tabular-nums">
                    {plan.pricing_mode === "range"
                      ? (() => {
                          const r = ranges.get(plan.id);
                          if (!r) return "—";
                          return r.min_cents === r.max_cents
                            ? peso(r.min_cents)
                            : `${peso(r.min_cents)}–${peso(r.max_cents)}`;
                        })()
                      : peso(plan.price_cents)}
                  </span>
                  {plan.pricing_mode === "range" && (
                    <span className="font-poppins text-[11px] text-brand-text/50">
                      by dish choice
                    </span>
                  )}
                </span>
              </div>

              {/* The composition, read straight off the counts rather than the
                  free-text description, so the card can't drift from the data. */}
              <ul className="mt-3 space-y-1 font-poppins text-sm text-brand-text/70">
                {PLAN_SLOTS.filter(({ key }) => plan[key] > 0).map(({ key, label }) => (
                  <li key={key} className="flex items-center gap-2">
                    <i className="pi pi-check text-[10px] text-brand-primary" aria-hidden="true" />
                    {plan[key]} × {plan[key] === 1 ? label.replace(/e?s$/, "") : label}
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center gap-2 border-t border-brand-divider pt-3">
                <button
                  onClick={() => toggleActive(plan)}
                  title={plan.is_active ? "Showing on website — click to hide" : "Hidden — click to show"}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-poppins text-xs font-medium transition-colors cursor-pointer ${
                    plan.is_active
                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <i
                    className={`pi ${plan.is_active ? "pi-eye" : "pi-eye-slash"} text-[10px]`}
                    aria-hidden="true"
                  />
                  {plan.is_active ? "Showing" : "Hidden"}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setModal({ open: true, initial: plan })}
                  aria-label={`Edit ${plan.name}`}
                  className="rounded-lg p-2 text-brand-text/60 transition-colors hover:bg-brand-secondary cursor-pointer"
                >
                  <i className="pi pi-pencil" aria-hidden="true" />
                </button>
                <button
                  onClick={() => remove(plan)}
                  aria-label={`Delete ${plan.name}`}
                  className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 cursor-pointer"
                >
                  <i className="pi pi-trash" aria-hidden="true" />
                </button>
              </div>
            </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <MealPlanFormModal
        open={modal.open}
        onClose={() => setModal({ open: false, initial: null })}
        initial={modal.initial}
        categories={categories.filter((c) => SERVICE_CATEGORY_SLUGS.includes(c.slug))}
        defaultCategoryId={modal.defaultCategoryId}
        priceRange={modal.initial ? ranges.get(modal.initial.id) : undefined}
        nextSortOrder={(plans.at(-1)?.sort_order ?? 0) + 1}
        onSaved={load}
      />
    </div>
  );
};

export default AdminMealPlans;
