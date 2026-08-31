import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Category, MenuItemCategory, MenuItemRecord, SubCategory } from "../../types/menu";
import Modal from "../ui/Modal";
import ModalActions from "../ui/ModalActions";
import Select from "../ui/Select";
import HelpTip from "../ui/HelpTip";
import ImageUploader from "./ImageUploader";

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  subCategories: SubCategory[];
  /** item being edited, or null when adding */
  initial: MenuItemRecord | null;
  /** the services that dish is already sold in, with their prices */
  initialCategories?: MenuItemCategory[];
  /** preselected category when adding from a category header */
  defaultCategoryId?: number;
  onSaved: () => void;
}

const blank = {
  name: "",
  category_id: 0,
  sub_category_id: 0,
  price: "",
  min_qty: "",
  image_url: "",
  description: "",
  is_available: true,
  is_catering: false,
};

const inputClass =
  "w-full rounded-lg border border-brand-divider bg-white px-3 py-2.5 font-poppins text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent";

/** Links the footer's submit button back to the form it lives outside of. */
const FORM_ID = "admin-item-form";

// item_type mirrors the sub-category's slot. It is snapshotted onto order lines,
// so it is what the kitchen ticket reads.

const ItemFormModal: React.FC<ItemFormModalProps> = ({
  open,
  onClose,
  categories,
  subCategories,
  initial,
  initialCategories = [],
  defaultCategoryId,
  onSaved,
}) => {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** categoryId -> price string. Presence in the map IS the tick. */
  const [services, setServices] = useState<Map<number, string>>(new Map());

  /** Archived categories are not offerable; a dish already in one still shows. */
  const selectableCategories = categories.filter(
    (c) => c.is_active !== false || services.has(c.id),
  );

  const toggleService = (id: number) =>
    setServices((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, "");
      return next;
    });

  const setServicePrice = (id: number, price: string) =>
    setServices((prev) => new Map(prev).set(id, price));

  // Main is the default course: nearly every dish is one, and a blank
  // sub-category has no slot, which quietly hides the dish from every picker.
  const defaultSubCategoryId =
    subCategories.find((s) => s.slot === "main")?.id ?? 0;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setForm({
        name: initial.name,
        category_id: initial.category_id ?? categories[0]?.id ?? 0,
        sub_category_id: initial.sub_category_id ?? defaultSubCategoryId,
        price: initial.price_cents == null ? "" : String(initial.price_cents / 100),
        min_qty: initial.min_qty == null ? "" : String(initial.min_qty),
        image_url: initial.image_url ?? "",
        description: initial.description ?? "",
        is_available: initial.is_available,
        is_catering: initial.is_catering,
      });
      setServices(
        new Map(
          initialCategories.length > 0
            ? initialCategories.map((m) => [
                m.category_id,
                m.price_cents == null ? "" : String(m.price_cents / 100),
              ])
            : initial.category_id
              ? [[initial.category_id, ""]]
              : [],
        ),
      );
    } else {
      const home = defaultCategoryId ?? categories[0]?.id ?? 0;
      setForm({ ...blank, category_id: home, sub_category_id: defaultSubCategoryId });
      setServices(home ? new Map([[home, ""]]) : new Map());
    }
    // initialCategories is a fresh array each render; the item id is what
    // actually identifies the dish being loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, defaultCategoryId, categories, defaultSubCategoryId]);

  const selectedSub = subCategories.find((s) => s.id === form.sub_category_id);
  /**
   * Extras (Add-ons, Café Menu) are the only dishes whose price is billed, and
   * a dish sold in one of those IS charged there — even if it also sits in a
   * plan service where it is not. Any universal tick means "this gets paid".
   */
  const isUniversalCategory = [...services.keys()].some(
    (id) => categories.find((c) => c.id === id)?.is_universal,
  );
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const picked = [...services.keys()];
    if (picked.length === 0) {
      setError("Pick at least one service for this dish to appear in.");
      return;
    }
    // The home service is what create_order reads for the per-dish minimum, so
    // it must be one the dish is actually sold in. Keep the existing one when
    // it survived the edit; otherwise fall back to the first tick.
    const home = picked.includes(form.category_id) ? form.category_id : picked[0];
    setSaving(true);
    setError(null);
    const payload = {
      category_id: home,
      name: form.name.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      price_cents: form.price.trim() === "" ? null : Math.round(Number(form.price) * 100),
      min_qty: form.min_qty.trim() === "" ? null : Math.floor(Number(form.min_qty)),
      sub_category_id: form.sub_category_id || null,
      item_type: selectedSub ? (selectedSub.slot ?? selectedSub.slug) : null,
      is_available: form.is_available,
      is_catering: form.is_catering,
    };
    const res = initial
      ? await supabase.from("menu_items").update(payload).eq("id", initial.id).select("id").single()
      : await supabase.from("menu_items").insert(payload).select("id").single();
    if (res.error || !res.data) {
      setSaving(false);
      setError(res.error?.message ?? "Could not save the dish.");
      return;
    }

    // Memberships: upsert what is ticked, then drop what is not. Upsert first
    // so the dish is never briefly in no service at all — the storefront views
    // join through this table.
    const itemId = (res.data as { id: string }).id;
    const rows = picked.map((categoryId) => ({
      menu_item_id: itemId,
      category_id: categoryId,
      price_cents:
        (services.get(categoryId) ?? "").trim() === ""
          ? null
          : Math.round(Number(services.get(categoryId)) * 100),
    }));
    const up = await supabase
      .from("menu_item_categories")
      .upsert(rows, { onConflict: "menu_item_id,category_id" });
    if (up.error) {
      setSaving(false);
      setError(`Dish saved, but its services did not: ${up.error.message}`);
      return;
    }
    const del = await supabase
      .from("menu_item_categories")
      .delete()
      .eq("menu_item_id", itemId)
      .not("category_id", "in", `(${picked.join(",")})`);
    setSaving(false);
    if (del.error) {
      setError(`Dish saved, but removing old services failed: ${del.error.message}`);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit dish" : "Add a dish"}
      /*
       * The actions live in the pinned footer while the fields scroll, so Save is
       * reachable on any viewport. The buttons sit OUTSIDE <form>, so they're tied
       * back to it with the `form` attribute rather than by nesting.
       */
      footer={
        <ModalActions
          onCancel={onClose}
          formId={FORM_ID}
          busy={saving}
          submitLabel={initial ? "Save changes" : "Add dish"}
        />
      }
    >
      <form id={FORM_ID} onSubmit={save} className="p-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700">
            {error}
          </div>
        )}

        {/* Name first: it is what the dish IS, and it is the field the admin
            came to type. The photo used to push it below the fold. */}
        <div>
          <label
            htmlFor="item-name"
            className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
          >
            Dish name
          </label>
          <input
            id="item-name"
            className={inputClass}
            required
            autoFocus
            value={form.name}
            placeholder="e.g. Chicken Adobo"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="block text-sm font-poppins font-medium text-brand-text">Photo</span>
            <span className="font-poppins text-xs text-brand-text/50">
              Cropped to 4:3 — customers see exactly this
            </span>
          </div>
          {/* Same shape as the menu card (aspect-[4/3], object-cover) and about
              its real width, so whatever gets trimmed here is trimmed on the
              live site too. The old full-width letterbox showed a crop that
              never matched what a customer got. */}
          <div className="max-w-[20rem]">
            <ImageUploader
              value={form.image_url}
              onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
              onError={setError}
              heightClass="aspect-[4/3]"
            />
          </div>
        </div>

        {/* Services: a dish can be sold in several, each with its own price.
            A checkbox list rather than a dropdown, because the whole point is
            seeing every service and which ones are ticked at a glance. */}
        <fieldset>
          <legend className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
            Sold in
          </legend>
          <div className="space-y-1.5">
            {selectableCategories.map((c) => {
              const on = services.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border px-3 py-2 transition-colors ${
                    on ? "border-brand-primary/50 bg-brand-secondary/40" : "border-brand-divider"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <label className="flex min-h-[2.25rem] flex-1 cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleService(c.id)}
                        className="h-4 w-4 cursor-pointer accent-brand-primary"
                      />
                      <span className="font-poppins text-sm text-brand-text">{c.name}</span>
                      {c.is_universal && (
                        <span className="rounded-full bg-brand-secondary px-2 py-0.5 font-poppins text-[0.7rem] text-brand-text/60">
                          every service
                        </span>
                      )}
                    </label>
                    {on && (
                      <label className="flex items-center gap-2">
                        <span className="font-poppins text-xs text-brand-text/60">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          aria-label={`Price in ${c.name}`}
                          value={services.get(c.id) ?? ""}
                          onChange={(e) => setServicePrice(c.id, e.target.value)}
                          placeholder={form.price.trim() === "" ? "price" : form.price}
                          className="w-28 rounded-lg border border-brand-divider bg-white px-2.5 py-1.5 font-poppins text-sm text-brand-text focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 font-poppins text-xs text-brand-text/50">
            Leave a price blank to use the dish price below. The first one ticked
            is the dish&rsquo;s home service.
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {/* The tip sits BESIDE the label, not inside it — a button within
                a <label> steals the click that should focus the select. */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <label
                htmlFor="item-sub-category"
                className="block text-sm font-poppins font-medium text-brand-text"
              >
                Sub-category
              </label>
              <HelpTip label="Sub-category" align="right">
                Which course this dish fills when a meal plan asks for one — a
                plan wanting “1 main dish” draws from <strong>Main</strong>.
                Every dish needs one: without it the dish has no course, and
                the builder never offers it.
              </HelpTip>
            </div>
            {/*
              Was a free-text "Group" field, which is how the data drifted into
              "vegetable" vs "vegetables" and 38 untyped rows. A meal plan asks
              for "1 main dish" and resolves that through the sub-category's
              slot, so a typo here silently drops a dish out of the builder.
            */}
            {/* No blank option: a dish with no sub-category has no slot, and
                the picker's query skips those — it would vanish silently. */}
            <Select
              id="item-sub-category"
              value={form.sub_category_id}
              onChange={(e) => setForm({ ...form, sub_category_id: Number(e.target.value) })}
            >
              {/* One sub-category per plan slot, so the name IS the slot —
                  spelling it out again only made the list harder to read. */}
              {subCategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 font-poppins text-xs text-brand-text/50">
              <strong className="font-semibold">Main</strong> is the default.
            </p>
          </div>
        </div>

        {/*
          What this price actually does, verified against create_order:
            - a-la-carte line (no meal plan)  -> CHARGED. This is Add-ons and
              Cafe Menu extras today.
            - inside a fixed-price plan       -> NOT charged; the plan line
              carries the money, and every plan in the catalogue is fixed.
            - inside a "price range" plan     -> charged.
          The old copy mentioned only the last two, so it read as "this is
          essentially never charged" while Menu Manager showed the figure beside
          every dish. Say plainly which case is in play.
        */}
        <div>
          <label htmlFor="item-price" className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
            Price (₱)
          </label>
          <input
            id="item-price"
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={form.price}
            placeholder="Leave blank for “price on request”"
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <span className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-brand-secondary/50 px-3 py-2 font-poppins text-xs text-brand-text/65">
            <i className="pi pi-info-circle mt-0.5 text-[11px]" aria-hidden="true" />
            {isUniversalCategory ? (
              <span>
                Customers <strong>pay this</strong> for each one — Add-ons and
                Café items are charged per piece on top of the order.
              </span>
            ) : (
              <span>
                Inside a meal plan this is <strong>not charged</strong> — the
                plan&rsquo;s own price is what the customer pays. Every plan is
                fixed-price right now, so treat this as a reference figure, not
                the amount billed.
              </span>
            )}
          </span>
        </div>

        <div>
          <label htmlFor="item-min-qty" className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
            Minimum per order <span className="text-brand-text/40 font-normal">(optional)</span>
          </label>
          <input
            id="item-min-qty"
            type="number"
            min="0"
            max="500"
            step="1"
            className={inputClass}
            value={form.min_qty}
            placeholder="Blank = store default"
            onChange={(e) => setForm({ ...form, min_qty: e.target.value })}
          />
          <span className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-brand-secondary/50 px-3 py-2 font-poppins text-xs text-brand-text/65">
            <i className="pi pi-info-circle mt-0.5 text-[11px]" aria-hidden="true" />
            <span>
              Once this dish is in an order, the order must include at least
              this many of it. Blank falls back to the service&rsquo;s own{" "}
              <strong>Minimum dishes</strong>, then to Store Settings →{" "}
              <strong>Default minimum dishes</strong>; <strong>0</strong>{" "}
              removes the minimum for this dish only.
            </span>
          </span>
        </div>

        <div>
          <label className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
            Description <span className="text-brand-text/40 font-normal">(optional)</span>
          </label>
          <textarea className={inputClass} rows={2} value={form.description} placeholder="A short, tasty description" onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <div className="flex items-center gap-6 rounded-lg bg-brand-secondary/50 px-4 py-3">
          <label className="flex items-center gap-2 font-poppins text-sm text-brand-text cursor-pointer">
            <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} className="accent-brand-primary w-4 h-4" />
            Show on website
          </label>
        </div>

      </form>
    </Modal>
  );
};

export default ItemFormModal;
