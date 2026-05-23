import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Category, MenuItemRecord } from "../../types/menu";
import Modal from "../ui/Modal";
import ImageUploader from "./ImageUploader";

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  /** item being edited, or null when adding */
  initial: MenuItemRecord | null;
  /** preselected category when adding from a category header */
  defaultCategoryId?: number;
  onSaved: () => void;
}

const blank = {
  name: "",
  category_id: 0,
  item_type: "",
  price: "",
  image_url: "",
  description: "",
  is_available: true,
  is_catering: false,
};

const inputClass =
  "w-full rounded-lg border border-brand-divider bg-white px-3 py-2.5 font-poppins text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent";

const ItemFormModal: React.FC<ItemFormModalProps> = ({
  open,
  onClose,
  categories,
  initial,
  defaultCategoryId,
  onSaved,
}) => {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setForm({
        name: initial.name,
        category_id: initial.category_id ?? categories[0]?.id ?? 0,
        item_type: initial.item_type ?? "",
        price: initial.price_cents == null ? "" : String(initial.price_cents / 100),
        image_url: initial.image_url ?? "",
        description: initial.description ?? "",
        is_available: initial.is_available,
        is_catering: initial.is_catering,
      });
    } else {
      setForm({ ...blank, category_id: defaultCategoryId ?? categories[0]?.id ?? 0 });
    }
  }, [open, initial, defaultCategoryId, categories]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      category_id: form.category_id || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      price_cents: form.price.trim() === "" ? null : Math.round(Number(form.price) * 100),
      item_type: form.item_type.trim() || null,
      is_available: form.is_available,
      is_catering: form.is_catering,
    };
    const res = initial
      ? await supabase.from("menu_items").update(payload).eq("id", initial.id)
      : await supabase.from("menu_items").insert(payload);
    setSaving(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit dish" : "Add a dish"}>
      <form onSubmit={save} className="p-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-poppins font-medium text-brand-text mb-1.5">Photo</label>
          <ImageUploader
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            onError={setError}
          />
        </div>

        <div>
          <label className="block text-sm font-poppins font-medium text-brand-text mb-1.5">Dish name</label>
          <input className={inputClass} required value={form.name} placeholder="e.g. Chicken Adobo" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-poppins font-medium text-brand-text mb-1.5">Category</label>
            <select className={inputClass} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
              Group <span className="text-brand-text/40 font-normal">(optional)</span>
            </label>
            <input className={inputClass} value={form.item_type} placeholder="main, side, drink…" onChange={(e) => setForm({ ...form, item_type: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-poppins font-medium text-brand-text mb-1.5">Price (₱)</label>
          <input type="number" min="0" step="0.01" className={inputClass} value={form.price} placeholder="Leave blank for “price on request”" onChange={(e) => setForm({ ...form, price: e.target.value })} />
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
          <label className="flex items-center gap-2 font-poppins text-sm text-brand-text cursor-pointer">
            <input type="checkbox" checked={form.is_catering} onChange={(e) => setForm({ ...form, is_catering: e.target.checked })} className="accent-brand-primary w-4 h-4" />
            Catering / party tray
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-brand-divider px-4 py-2.5 font-arvo-bold text-sm text-brand-text hover:bg-brand-secondary cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-primary px-5 py-2.5 font-arvo-bold text-sm text-white hover:bg-brand-primary/90 disabled:opacity-60 cursor-pointer">
            {saving ? "Saving…" : initial ? "Save changes" : "Add dish"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ItemFormModal;
