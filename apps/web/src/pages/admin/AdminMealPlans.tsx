import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { PLAN_SLOTS, type MealPlan } from "../../types/menu";
import MealPlanFormModal from "../../components/admin/MealPlanFormModal";
import { peso } from "../../constants/orders";

const SELECT =
  "id, name, description, price_cents, main_count, side_count, dessert_count, rice_count, sort_order, is_active";

const AdminMealPlans: React.FC = () => {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; initial: MealPlan | null }>({
    open: false,
    initial: null,
  });

  const load = async () => {
    const { data, error } = await supabase.from("meal_plans").select(SELECT).order("sort_order");
    if (error) setError(error.message);
    setPlans((data as MealPlan[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

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
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-arvo-bold text-2xl text-brand-text">Meal Plans</h1>
          <p className="font-poppins text-sm text-brand-text/60 mt-0.5">
            The Check-a-Lunch boxes customers can order, and what each one includes.
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, initial: null })}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 font-arvo-bold text-sm text-white hover:bg-brand-primary/90 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
        >
          <i className="pi pi-plus" aria-hidden="true" /> Add plan
        </button>
      </div>

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
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-brand-divider bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/20">
            <i className="pi pi-box text-xl text-brand-primary" aria-hidden="true" />
          </div>
          <p className="font-poppins text-brand-text/60">No meal plans yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-opacity ${
                plan.is_active ? "border-brand-divider" : "border-brand-divider opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-arvo-bold text-lg text-brand-text">{plan.name}</h2>
                <span className="shrink-0 font-arvo-bold text-xl text-brand-primary tabular-nums">
                  {peso(plan.price_cents)}
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

      <MealPlanFormModal
        open={modal.open}
        onClose={() => setModal({ open: false, initial: null })}
        initial={modal.initial}
        nextSortOrder={(plans.at(-1)?.sort_order ?? 0) + 1}
        onSaved={load}
      />
    </div>
  );
};

export default AdminMealPlans;
