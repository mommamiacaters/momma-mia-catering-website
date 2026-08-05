import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Three sizes, so every dialog in the console reads as the same component
 * rather than each picking its own max-w-*.
 *   sm — a single decision or one field (New category)
 *   md — a normal form; wide enough for a two-column field grid (the default)
 *   lg — dense or media-heavy content
 */
export type ModalSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /**
   * Pinned action row. Kept OUT of the scroll area so the primary button is
   * always on screen — previously the whole dialog was one scroll box and
   * "Save changes" fell below the fold on a short viewport.
   */
  footer?: React.ReactNode;
  size?: ModalSize;
}

/**
 * Reusable dialog: dimmed backdrop, pinned header + footer, scrolling body.
 * Presents as a bottom sheet under `sm` and a centered card above it.
 */
const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    // Freeze the page behind the overlay. Without this the list keeps scrolling
    // under the dialog whenever the pointer leaves the panel, which is most of
    // what made the modal feel unanchored.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog so Tab starts inside it and screen readers
    // announce the title rather than staying on the page behind.
    panelRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  /*
   * Rendered through a PORTAL to document.body, not in place.
   *
   * `position: fixed` resolves against the nearest ancestor with a transform,
   * filter or will-change — not the viewport. The page-transition wrapper
   * animates with fill-mode `both`, so it permanently retains
   * `transform: translateY(0)` and was capturing this dialog: the backdrop
   * covered only the admin content pane and the panel centred itself inside a
   * very tall column, landing far down the page. Portalling to <body> puts the
   * dialog outside every such ancestor for good.
   */
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`flex w-full ${SIZE_CLASS[size]} max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:max-h-[min(88vh,46rem)] sm:rounded-2xl motion-safe:animate-page-in`}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-brand-divider px-6 py-4">
          <h2 className="font-arvo-bold text-lg text-brand-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-brand-text/60 transition-colors hover:bg-brand-secondary hover:text-brand-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
            aria-label="Close"
          >
            <i className="pi pi-times" aria-hidden="true" />
          </button>
        </header>

        {/* min-h-0 lets this flex child actually shrink so the footer stays put. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer && (
          <footer className="shrink-0 border-t border-brand-divider bg-white px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
