import React, { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

interface HelpTipProps {
  /** What the field means, in a sentence or two. */
  children: React.ReactNode;
  /** Names the field in the button's accessible label ("What is Sub-category?"). */
  label: string;
  /** Side to open on when there is no room below. Defaults to below. */
  align?: "left" | "right";
}

/**
 * A question-mark button that reveals a short note about the field beside it.
 *
 * Opens on hover AND on focus AND on click: hover alone is unreachable by
 * keyboard, and on a touch screen there is no hover at all. Escape closes it,
 * and the note is wired to the button with aria-describedby so a screen reader
 * announces it rather than just reading "help".
 */
const HelpTip: React.FC<HelpTipProps> = ({ children, label, align = "left" }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const id = useId();

  // Click-away and Escape. Only mounted while open, so the page carries no
  // listeners for the (usual) closed case.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // after: pseudo-element widens the tap target to ~44px without taking
        // up any layout space next to the label.
        className="relative inline-flex cursor-pointer items-center justify-center rounded-full text-brand-text/40 transition-colors duration-150 hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary after:absolute after:-inset-3 after:content-['']"
      >
        <HelpCircle size={14} aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          // Opens UPWARD: the tip labels a field that sits directly below it,
          // and dropping down would cover the very control being explained.
          className={`absolute bottom-full z-50 mb-2 w-64 rounded-lg bg-brand-text px-3 py-2 font-poppins text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </span>
      )}
    </span>
  );
};

export default HelpTip;
