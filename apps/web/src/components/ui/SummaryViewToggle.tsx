import React from "react";
import { LayoutGrid, List } from "lucide-react";

export type SummaryView = "overview" | "detailed";

interface SummaryViewToggleProps {
  value: SummaryView;
  onChange: (view: SummaryView) => void;
  /** Names what Detailed means on this surface, e.g. "edit" vs "list". */
  detailedLabel?: string;
  className?: string;
}

/**
 * The Overview / Detailed switch shared by every order surface (checkout
 * summary, bag sidebar, lunch-box panel). Overview leads — it's the default
 * everywhere. Styled like the picker's category tabs (solid primary when
 * active, bordered white otherwise) so it reads as part of the same system
 * on any panel background, including the green all-complete state.
 */
const SummaryViewToggle: React.FC<SummaryViewToggleProps> = ({
  value,
  onChange,
  detailedLabel = "Detailed",
  className = "",
}) => (
  <div
    role="group"
    aria-label="Order summary layout"
    className={`grid grid-cols-2 gap-2 ${className}`}
  >
    {(
      [
        ["overview", "Overview", LayoutGrid],
        ["detailed", detailedLabel, List],
      ] as const
    ).map(([view, label, Icon]) => (
      <button
        key={view}
        type="button"
        onClick={() => onChange(view)}
        aria-pressed={value === view}
        className={`flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-xl font-poppins text-xs font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer ${
          value === view
            ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/25"
            : "bg-white text-brand-text/70 border border-brand-divider hover:border-brand-primary/40 hover:text-brand-text"
        }`}
      >
        <Icon size={13} aria-hidden="true" />
        {label}
      </button>
    ))}
  </div>
);

export default SummaryViewToggle;
