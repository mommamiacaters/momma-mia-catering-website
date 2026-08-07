import React, { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in the customer's terms. Say what is irreversible. */
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** `danger` for anything that destroys work. */
  tone?: "danger" | "default";
}

/**
 * A yes/no dialog for destructive actions.
 *
 * The admin console uses window.confirm() for this, which is fine for an
 * internal tool but wrong on the storefront: it's unstyled, it blocks the main
 * thread, it can't carry the brand, and mobile browsers prefix it with the
 * origin so it reads like a security warning. ModalActions doesn't fit either —
 * it's built around formId + type="submit" and a confirm has no form.
 *
 * Cancel takes initial focus deliberately. For a destructive prompt the safe
 * option should be the one a hurried Enter keypress hits.
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  tone = "danger",
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Modal focuses its own panel on open (Modal.tsx, so Tab starts inside the
    // dialog and screen readers announce the title). That runs in the child's
    // effect, i.e. AFTER this one settles in a production build — focusing
    // Cancel synchronously here gets silently overwritten. Defer past it.
    const id = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="flex gap-3">
        {tone === "danger" && (
          <AlertTriangle
            size={22}
            className="text-red-500 shrink-0 mt-0.5"
            aria-hidden="true"
          />
        )}
        <div className="font-poppins text-sm text-brand-text/70 leading-relaxed">
          {message}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-5">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-brand-divider px-4 py-2.5 font-arvo-bold text-sm text-brand-text transition-colors hover:bg-brand-secondary cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-lg px-5 py-2.5 font-arvo-bold text-sm text-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            tone === "danger"
              ? "bg-red-600 hover:bg-red-700 focus:ring-red-600"
              : "bg-brand-primary hover:bg-brand-primary/90 focus:ring-brand-primary"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
