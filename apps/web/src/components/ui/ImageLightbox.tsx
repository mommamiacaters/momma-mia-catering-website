import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ImageLightboxProps {
  open: boolean;
  src: string;
  title: string;
  description?: string;
  onClose: () => void;
}

/**
 * Full-view photo overlay: the image at its natural size (capped to the
 * viewport) with the dish name and description in a card beneath it. Closes on
 * backdrop click, the ✕, or Escape.
 */
const ImageLightbox: React.FC<ImageLightboxProps> = ({
  open,
  src,
  title,
  description,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Same body scroll lock the order drawer uses.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  // PORTALED to <body> on purpose: the dish cards lift on hover
  // (hover:-translate-y-1), and a transformed ancestor becomes the containing
  // block for position:fixed — rendered in place, this overlay gets trapped
  // and clipped inside the card until the hover ends. body has no transform.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} photo`}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
      >
        <X size={20} />
      </button>

      {/* stopPropagation: clicking the photo or caption must not close it —
          only the dark backdrop and the ✕ do. */}
      <figure
        className="relative max-w-3xl w-full max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={title}
          className="w-full max-h-[70vh] rounded-t-2xl object-contain bg-black/40"
        />
        <figcaption className="rounded-b-2xl bg-white px-5 py-4">
          <p className="font-arvo font-bold text-brand-text capitalize">{title}</p>
          {description && (
            <p className="mt-1 font-poppins text-sm text-brand-text/60 leading-relaxed">
              {description}
            </p>
          )}
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
};

export default ImageLightbox;
