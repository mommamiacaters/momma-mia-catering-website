import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { AvailabilityFilter, Category, MenuItemRecord, SubCategory } from "../../types/menu";
import MenuToolbar from "../../components/admin/MenuToolbar";
import CategoryAccordion from "../../components/admin/CategoryAccordion";
import CategoryItemList from "../../components/admin/CategoryItemList";
import ItemFormModal from "../../components/admin/ItemFormModal";
import CategoryFormModal from "../../components/admin/CategoryFormModal";
import CustomerPreview from "../../components/admin/CustomerPreview";
import DishTypeFilter, { type DishTypeKey } from "../../components/admin/DishTypeFilter";
import { getCategoryDisplayName } from "../../constants";

const SELECT =
  "id, category_id, name, description, image_url, price_cents, item_type, sub_category_id, is_available, is_catering, sort_order, min_qty";

interface AdminProductsProps {
  /** public.categories.slug to scope to. Omit for the whole menu. */
  categorySlug?: string;
  /** Drop the page heading when another screen already supplies one. */
  embedded?: boolean;
}

const AdminProducts: React.FC<AdminProductsProps> = ({ categorySlug, embedded }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [items, setItems] = useState<MenuItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"manage" | "preview">("manage");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [openCats, setOpenCats] = useState<Set<number>>(new Set());
  const [types, setTypes] = useState<Set<DishTypeKey>>(new Set());

  const [itemModal, setItemModal] = useState<{ open: boolean; initial: MenuItemRecord | null; defaultCategoryId?: number }>({
    open: false,
    initial: null,
  });
  const [catModalOpen, setCatModalOpen] = useState(false);
  // Archive is deliberately strict: the admin types the category's name.
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null);
  const [archiveTyped, setArchiveTyped] = useState("");
  const [archiving, setArchiving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cats }, { data: subs }, { data: its, error: itErr }] = await Promise.all([
      supabase
        .from("categories")
        .select("id, slug, name, sort_order, is_universal, is_active")
        .order("sort_order"),
      supabase
        .from("sub_categories")
        .select("id, slug, name, slot, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("menu_items").select(SELECT).order("sort_order"),
    ]);
    if (itErr) setError(itErr.message);
    setCategories((cats as Category[]) ?? []);
    setSubCategories((subs as SubCategory[]) ?? []);
    setItems((its as MenuItemRecord[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const activeCategories = categories.filter((c) => c.is_active !== false);
  const visibleCategories = categorySlug
    ? activeCategories.filter((c) => c.slug === categorySlug)
    : activeCategories;
  // Main categories each feed one service; universal ones (Add-ons, Café Menu)
  // ride along with every service. Shown as two groups so the difference reads.
  const mainCategories = visibleCategories.filter((c) => !c.is_universal);
  const universalCategories = visibleCategories.filter((c) => c.is_universal);
  const archivedCategories = categorySlug
    ? []
    : categories.filter((c) => c.is_active === false);

  // Scoped to one category there is nothing to choose between, so open it
  // rather than making the admin click an accordion with one row in it.
  useEffect(() => {
    if (!categorySlug) return;
    const only = categories.find((c) => c.slug === categorySlug);
    if (only) setOpenCats(new Set([only.id]));
  }, [categorySlug, categories]);

  const grouped = useMemo(() => {
    const byCat = new Map<number, MenuItemRecord[]>();
    for (const it of items) {
      const key = it.category_id ?? -1;
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(it);
    }
    return byCat;
  }, [items]);

  // id → display name, so a row can label its group without each row re-scanning
  // the sub-category list.
  const subCategoryNames = useMemo(
    () => new Map(subCategories.map((s) => [s.id, s.name])),
    [subCategories],
  );

  // A dish's type is its sub-category's slot. item_type is legacy and dirty
  // ('packed meal', 'beef', 'vegetables', plenty of nulls), so it is not used
  // here — only the sub-category carries a trustworthy slot.
  const slotBySubCategory = useMemo(
    () => new Map(subCategories.map((s) => [s.id, s.slot])),
    [subCategories],
  );

  const typeOf = useCallback(
    (it: MenuItemRecord): DishTypeKey =>
      (it.sub_category_id ? slotBySubCategory.get(it.sub_category_id) : null) ?? "none",
    [slotBySubCategory],
  );

  // Counts come from the categories on screen, so a scoped service page tallies
  // only its own dishes. Chips with nothing behind them are not rendered.
  const typeCounts = useMemo(() => {
    const tally = new Map<DishTypeKey, number>();
    const visibleIds = new Set(visibleCategories.map((c) => c.id));
    for (const it of items) {
      if (it.category_id === null || !visibleIds.has(it.category_id)) continue;
      const key = typeOf(it);
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    const order: DishTypeKey[] = ["main", "side", "rice", "rice_bowl", "dessert", "none"];
    return order
      .filter((key) => (tally.get(key) ?? 0) > 0)
      .map((key) => ({
        key,
        label: key === "none" ? "No type" : getCategoryDisplayName(key),
        count: tally.get(key) ?? 0,
      }));
  }, [items, visibleCategories, typeOf]);

  const toggleType = (key: DishTypeKey) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const normalizedQuery = query.trim().toLowerCase();
  const isFiltering = normalizedQuery !== "" || availability !== "all" || types.size > 0;

  const matches = (it: MenuItemRecord) => {
    if (availability === "showing" && !it.is_available) return false;
    if (availability === "hidden" && it.is_available) return false;
    // No chip selected means no type restriction, not "match nothing".
    if (types.size > 0 && !types.has(typeOf(it))) return false;
    if (normalizedQuery === "") return true;
    return (
      it.name.toLowerCase().includes(normalizedQuery) ||
      (it.item_type ?? "").toLowerCase().includes(normalizedQuery)
    );
  };

  // optimistic helpers ------------------------------------------------------
  const toggleAvailable = async (it: MenuItemRecord) => {
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, is_available: !p.is_available } : p)));
    const { error } = await supabase.from("menu_items").update({ is_available: !it.is_available }).eq("id", it.id);
    if (error) {
      setError(error.message);
      await load();
    }
  };

  const remove = async (it: MenuItemRecord) => {
    if (!window.confirm(`Delete "${it.name}"? This can't be undone.`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", it.id);
    if (error) setError(error.message);
    await load();
  };

  const archiveCategory = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", archiveTarget.id);
    setArchiving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setArchiveTarget(null);
    setArchiveTyped("");
    await load();
  };

  const restoreCategory = async (cat: Category) => {
    const { error } = await supabase
      .from("categories")
      .update({ is_active: true })
      .eq("id", cat.id);
    if (error) setError(error.message);
    await load();
  };

  const toggleCat = (id: number) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        {!embedded && (
          <div>
            <h1 className="font-arvo-bold text-2xl text-brand-text">Menu Manager</h1>
            <p className="font-poppins text-sm text-brand-text/60 mt-0.5">
              Add dishes, set prices and photos. Changes show on the website right away.
            </p>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className="inline-flex rounded-full bg-white border border-brand-divider p-1 shadow-sm">
            {(["manage", "preview"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-4 py-1.5 text-sm font-arvo-bold transition-colors cursor-pointer ${
                  view === v ? "bg-brand-primary text-white" : "text-brand-text/60 hover:text-brand-text"
                }`}
              >
                <i className={`pi ${v === "manage" ? "pi-pencil" : "pi-eye"} text-xs mr-1.5`} aria-hidden="true" />
                {v === "manage" ? "Manage" : "View as customer"}
              </button>
            ))}
          </div>
          {view === "manage" && (
            <button
              onClick={() =>
                setItemModal({
                  open: true,
                  initial: null,
                  defaultCategoryId: visibleCategories[0]?.id,
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 font-arvo-bold text-sm text-white hover:bg-brand-primary/90 cursor-pointer"
            >
              <i className="pi pi-plus" aria-hidden="true" /> Add dish
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer" aria-label="Dismiss">
            <i className="pi pi-times" aria-hidden="true" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : view === "preview" ? (
        <CustomerPreview categories={visibleCategories} grouped={grouped} />
      ) : (
        <>
          <MenuToolbar
            query={query}
            onQueryChange={setQuery}
            availability={availability}
            onAvailabilityChange={setAvailability}
            onExpandAll={() => setOpenCats(new Set(categories.map((c) => c.id)))}
            onCollapseAll={() => setOpenCats(new Set())}
          />

          <DishTypeFilter
            counts={typeCounts}
            selected={types}
            onToggle={toggleType}
            onClear={() => setTypes(new Set())}
          />

          <div className="space-y-3">
            {(
              [
                {
                  key: "main",
                  cats: mainCategories,
                  heading: "Main categories",
                  hint: "Each one is a service with its own meal plans.",
                },
                {
                  key: "universal",
                  cats: universalCategories,
                  heading: "In every service",
                  hint: "Extras offered alongside all orders, whatever the plan.",
                },
              ] as const
            ).map(({ key, cats, heading, hint }) => {
              const rows = cats
                .map((cat) => {
                  const all = grouped.get(cat.id) ?? [];
                  const visible = isFiltering ? all.filter(matches) : all;
                  return { cat, all, visible };
                })
                .filter((r) => !(isFiltering && r.visible.length === 0));
              if (rows.length === 0) return null;
              return (
                <section key={key} aria-label={heading}>
                  {/* Group headings only in the all-menu view; a scoped service
                      page shows a single known category. */}
                  {!categorySlug && (
                    <div className="mt-5 mb-2 first:mt-0">
                      <h2 className="font-arvo-bold text-sm text-brand-text">{heading}</h2>
                      <p className="font-poppins text-xs text-brand-text/50">{hint}</p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {rows.map(({ cat, all, visible }) => (
                      <CategoryAccordion
                        key={cat.id}
                        name={cat.name}
                        count={visible.length}
                        totalCount={isFiltering ? all.length : undefined}
                        isOpen={isFiltering ? true : openCats.has(cat.id)}
                        onToggle={() => toggleCat(cat.id)}
                        onAdd={() => setItemModal({ open: true, initial: null, defaultCategoryId: cat.id })}
                        onArchive={
                          embedded ? undefined : () => { setArchiveTyped(""); setArchiveTarget(cat); }
                        }
                      >
                        <CategoryItemList
                          categoryName={cat.name}
                          items={visible}
                          subCategoryNames={subCategoryNames}
                          onToggle={toggleAvailable}
                          onEdit={(item) => setItemModal({ open: true, initial: item })}
                          onDelete={remove}
                          onAddFirst={() =>
                            setItemModal({ open: true, initial: null, defaultCategoryId: cat.id })
                          }
                        />
                      </CategoryAccordion>
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Archived — parked, restorable, never deleted */}
            {!isFiltering && archivedCategories.length > 0 && (
              <details className="rounded-xl border border-dashed border-brand-divider bg-white/60 px-4 py-3">
                <summary className="cursor-pointer font-poppins text-sm text-brand-text/60">
                  Archived categories ({archivedCategories.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {archivedCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-3 py-1.5">
                      <span className="font-poppins text-sm text-brand-text/70">{cat.name}</span>
                      <span className="font-poppins text-xs text-brand-text/40 tabular-nums">
                        {(grouped.get(cat.id) ?? []).length} dishes
                      </span>
                      <button
                        onClick={() => void restoreCategory(cat)}
                        className="ml-auto font-poppins text-sm font-semibold text-brand-primary hover:underline cursor-pointer"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {isFiltering && visibleCategories.every((c) => (grouped.get(c.id) ?? []).filter(matches).length === 0) && (
              <div className="bg-white rounded-xl shadow-sm p-10 text-center font-poppins text-brand-text/60">
                No dishes match your search.
              </div>
            )}

            {!isFiltering && !embedded && (
              <button
                onClick={() => setCatModalOpen(true)}
                className="w-full rounded-xl border-2 border-dashed border-brand-divider py-5 font-arvo-bold text-sm text-brand-text/60 hover:border-brand-primary hover:text-brand-primary transition-colors cursor-pointer"
              >
                <i className="pi pi-plus mr-2" aria-hidden="true" /> Add a new menu category
              </button>
            )}
          </div>
        </>
      )}

      <ItemFormModal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false, initial: null })}
        categories={categories}
        subCategories={subCategories}
        initial={itemModal.initial}
        defaultCategoryId={itemModal.defaultCategoryId}
        onSaved={load}
      />
      {/* Archive — strict confirmation: the admin types the category's name.
          Archiving hides it from the storefront AND this list; dishes and
          plans under it are kept and it can be restored below. */}
      {archiveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Archive ${archiveTarget.name}`}
          onClick={() => !archiving && setArchiveTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-arvo-bold text-lg text-brand-text">
              Archive &ldquo;{archiveTarget.name}&rdquo;?
            </h2>
            <p className="mt-2 font-poppins text-sm text-brand-text/70">
              It disappears from the website and from this list. Its{" "}
              <strong>{(grouped.get(archiveTarget.id) ?? []).length} dishes</strong>{" "}
              are kept, and you can restore it any time from the Archived
              section — nothing is deleted.
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block font-poppins text-xs font-semibold uppercase tracking-wide text-brand-text/60">
                Type <span className="normal-case font-bold">{archiveTarget.name}</span> to confirm
              </span>
              <input
                autoFocus
                value={archiveTyped}
                onChange={(e) => setArchiveTyped(e.target.value)}
                className="w-full rounded-lg border border-brand-divider px-3 py-2.5 font-poppins text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setArchiveTarget(null)}
                disabled={archiving}
                className="min-h-[44px] rounded-lg border border-brand-divider px-4 font-poppins text-sm font-medium text-brand-text hover:bg-brand-secondary cursor-pointer disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                onClick={() => void archiveCategory()}
                disabled={archiving || archiveTyped.trim() !== archiveTarget.name}
                className="min-h-[44px] rounded-lg bg-red-600 px-4 font-arvo-bold text-sm text-white hover:bg-red-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                {archiving ? "Archiving…" : "Archive category"}
              </button>
            </div>
          </div>
        </div>
      )}

      <CategoryFormModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        nextSortOrder={(categories.at(-1)?.sort_order ?? 0) + 1}
        onSaved={load}
      />
    </div>
  );
};

export default AdminProducts;
