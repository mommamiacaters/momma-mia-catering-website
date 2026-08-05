import React from "react";

interface ModalActionsProps {
  onCancel: () => void;
  /** Form id the submit button belongs to — the footer sits outside the <form>. */
  formId: string;
  submitLabel: string;
  /** Shown while saving; the button is disabled for the duration. */
  busyLabel?: string;
  busy?: boolean;
  cancelLabel?: string;
}

/**
 * The Cancel / primary pair every admin dialog ends with.
 *
 * Extracted because all three modals had hand-rolled copies that had already
 * drifted apart on focus rings and disabled states — the kind of small
 * inconsistency nobody reports but everybody feels.
 */
const ModalActions: React.FC<ModalActionsProps> = ({
  onCancel,
  formId,
  submitLabel,
  busyLabel = "Saving…",
  busy = false,
  cancelLabel = "Cancel",
}) => (
  <div className="flex justify-end gap-2">
    <button
      type="button"
      onClick={onCancel}
      className="rounded-lg border border-brand-divider px-4 py-2.5 font-arvo-bold text-sm text-brand-text transition-colors hover:bg-brand-secondary cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
    >
      {cancelLabel}
    </button>
    <button
      type="submit"
      form={formId}
      disabled={busy}
      className="rounded-lg bg-brand-primary px-5 py-2.5 font-arvo-bold text-sm text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
    >
      {busy ? busyLabel : submitLabel}
    </button>
  </div>
);

export default ModalActions;
