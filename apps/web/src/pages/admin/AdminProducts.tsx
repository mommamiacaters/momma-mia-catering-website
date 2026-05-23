import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { AvailabilityFilter, Category, MenuItemRecord } from "../../types/menu";
import MenuToolbar from "../../components/admin/MenuToolbar";
import CategoryAccordion from "../../components/admin/CategoryAccordion";
import MenuItemRow from "../../components/admin/MenuItemRow";
import ItemFormModal from "../../components/admin/ItemFormModal";
import CategoryFormModal from "../../components/admin/CategoryFormModal";
import CustomerPreview from "../../components/admin/CustomerPreview";

const SELECT =
  "id, category_id, name, description, image_url, price_cents, item_type, is_available, is_catering, sort_order";

const AdminProducts: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"manage" | "preview">("manage");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [openCats, setOpenCats] = useState<Set<number>>(new Set());

  const [itemModal, setItemModal] = useState<{ open: boolean; initial: MenuItemRecord | null; defaultCategoryId?: number }>({
    open: false,
    initial: null,
  });
  const [catModalOpen, setCatModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cats }, { data: its, error: itErr }] = await Promise.all([
      supabase.from("categories").select("id, slug, name, sort_order").order("sort_order"),
      supabase.from("menu_items").select(SELECT).order("sort_order"),
    ]);
    if (itErr) setError(itErr.message);
    setCategories((cats as Category[]) ?? []);
    setItems((its as MenuItemRecord[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => {
    const byCat = new Map<number, MenuItemRecord[]>();
    for (const it of items) {
      const key = it.category_id ?? -1;
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(it);
    }
    return byCat;
  }, [items]);

  const normalizedQuery = query.trim().toLowerCase();
  const isFiltering = normalizedQuery !== "" || availability !== "all";

  const matches = (it: MenuItemRecord) => {
    if (availability === "showing" && !it.is_available) return false;
    if (availability === "hidden" && it.is_available) return false;
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
        <div>
          <h1 className="font-arvo-bold text-2xl text-brand-text">Menu Manager</h1>
          <p className="font-poppins text-sm text-brand-text/60 mt-0.5">
            Add dishes, set prices and photos. Changes show on the website right away.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
              onClick={() => setItemModal({ open: true, initial: null })}
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
        <CustomerPreview categories={categories} grouped={grouped} />
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

          <div className="space-y-3">
            {categories.map((cat) => {
              const all = grouped.get(cat.id) ?? [];
              const visible = isFiltering ? all.filter(matches) : all;
              if (isFiltering && visible.length === 0) return null;

              return (
                <CategoryAccordion
                  key={cat.id}
                  name={cat.name}
                  count={visible.length}
                  totalCount={isFiltering ? all.length : undefined}
                  isOpen={isFiltering ? true : openCats.has(cat.id)}
                  onToggle={() => toggleCat(cat.id)}
                  onAdd={() => setItemModal({ open: true, initial: null, defaultCategoryId: cat.id })}
                >
                  {visible.length === 0 ? (
                    <button
                      onClick={() => setItemModal({ open: true, initial: null, defaultCategoryId: cat.id })}
                      className="w-full px-4 py-8 font-poppins text-sm text-brand-text/50 hover:bg-brand-secondary/50 cursor-pointer text-center"
                    >
                      No dishes here yet — click to add the first one.
                    </button>
                  ) : (
                    <ul className="divide-y divide-brand-divider">
                      {visible.map((it) => (
                        <MenuItemRow
                          key={it.id}
                          item={it}
                          onToggle={toggleAvailable}
                          onEdit={(item) => setItemModal({ open: true, initial: item })}
                          onDelete={remove}
                        />
                      ))}
                    </ul>
                  )}
                </CategoryAccordion>
              );
            })}

            {isFiltering && categories.every((c) => (grouped.get(c.id) ?? []).filter(matches).length === 0) && (
              <div className="bg-white rounded-xl shadow-sm p-10 text-center font-poppins text-brand-text/60">
                No dishes match your search.
              </div>
            )}

            {!isFiltering && (
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
        initial={itemModal.initial}
        defaultCategoryId={itemModal.defaultCategoryId}
        onSaved={load}
      />
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
