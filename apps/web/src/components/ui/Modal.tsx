import React, { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** max-w-* tailwind class for the dialog width. */
  maxWidthClass?: string;
}

/** Reusable centered modal: overlay, header with close, scrollable body. */
const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, maxWidthClass = "max-w-lg" }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${maxWidthClass} rounded-2xl bg-white shadow-xl max-h-[92vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-divider sticky top-0 bg-white z-10">
          <h2 className="font-arvo-bold text-lg text-brand-text">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-secondary cursor-pointer" aria-label="Close">
            <i className="pi pi-times text-brand-text/60" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
