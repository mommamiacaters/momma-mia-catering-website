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
  const [isUniversal, setIsUniversal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setIsUniversal(false);
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
      .insert({
        name: trimmed,
        slug: slugify(trimmed),
        sort_order: nextSortOrder,
        is_universal: isUniversal,
      });
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

        {/* Where it appears — the two groups behave very differently, so the
            choice is explicit rather than a checkbox afterthought. */}
        <fieldset>
          <legend className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
            Where does it appear?
          </legend>
          <div className="space-y-2">
            {(
              [
                [false, "Main category", "Has its own service and meal plans (like Check-a-Lunch)."],
                [true, "In every service", "Extras offered alongside all orders (like Add-ons and Café Menu)."],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={String(value)}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  isUniversal === value
                    ? "border-brand-primary bg-brand-primary/5"
                    : "border-brand-divider hover:border-brand-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name="category-kind"
                  checked={isUniversal === value}
                  onChange={() => setIsUniversal(value)}
                  className="mt-0.5 accent-[var(--brand-primary,#D96C2C)]"
                />
                <span>
                  <span className="block font-poppins text-sm font-semibold text-brand-text">{label}</span>
                  <span className="block font-poppins text-xs text-brand-text/60">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
};

export default CategoryFormModal;
