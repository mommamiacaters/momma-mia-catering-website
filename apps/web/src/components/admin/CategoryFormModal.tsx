import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { slugify } from "../../utils/format";
import Modal from "../ui/Modal";
import ModalActions from "../ui/ModalActions";

/** Links the footer's submit button back to the form it lives outside of. */
const FORM_ID = "admin-category-form";

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
    <Modal
      open={open}
      onClose={onClose}
      title="New category"
      size="sm"
      footer={
        <ModalActions
          onCancel={onClose}
          formId={FORM_ID}
          busy={saving}
          busyLabel="Adding…"
          submitLabel="Add category"
        />
      }
    >
      <form id={FORM_ID} onSubmit={save} className="p-6 space-y-4">
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
      </form>
    </Modal>
  );
};

export default CategoryFormModal;
