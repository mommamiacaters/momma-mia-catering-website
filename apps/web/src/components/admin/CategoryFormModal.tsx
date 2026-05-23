import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { slugify } from "../../utils/format";
import Modal from "../ui/Modal";

interface CategoryFormModalProps {
  open: boolean;
  onClose: () => void;
  nextSortOrder: number;
  onSaved: () => void;
}

const CategoryFormModal: React.FC<CategoryFormModalProps> = ({ open, onClose, nextSortOrder, onSaved }) => {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("categories")
      .insert({ name: trimmed, slug: slugify(trimmed), sort_order: nextSortOrder });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New category" maxWidthClass="max-w-sm">
      <form onSubmit={save} className="p-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-poppins font-medium text-brand-text mb-1.5">Category name</label>
          <input
            className="w-full rounded-lg border border-brand-divider bg-white px-3 py-2.5 font-poppins text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            required
            autoFocus
            value={name}
            placeholder="e.g. Desserts"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-brand-divider px-4 py-2.5 font-arvo-bold text-sm text-brand-text hover:bg-brand-secondary cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-primary px-5 py-2.5 font-arvo-bold text-sm text-white hover:bg-brand-primary/90 disabled:opacity-60 cursor-pointer">
            {saving ? "Adding…" : "Add category"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CategoryFormModal;
