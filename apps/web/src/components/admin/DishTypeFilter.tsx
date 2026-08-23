import React from "react";
import type { PlanSlot } from "../../types/menu";

/**
 * "No type" is not padding: 7 of the 13 sub-categories carry no slot (beef,
 * pasta, sandwich, salad, vegetables, drink, rice-bowls), so without this chip
 * 18 Check-a-Lunch dishes and 46 Party Tray dishes could not be filtered to at
 * all. It doubles as a nudge to give those dishes a type.
 */
export type DishTypeKey = PlanSlot | "none";

export interface DishTypeCount {
  key: DishTypeKey;
  label: string;
  count: number;
}

interface DishTypeFilterProps {
  counts: DishTypeCount[];
  selected: Set<DishTypeKey>;
  onToggle: (key: DishTypeKey) => void;
  onClear: () => void;
}

const DishTypeFilter: React.FC<DishTypeFilterProps> = ({
  counts,
  selected,
  onToggle,
  onClear,
}) => {
  if (counts.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="font-poppins text-xs font-semibold uppercase tracking-wide text-brand-text/70">
        Type
      </span>

      {counts.map(({ key, label, count }) => {
        const active = selected.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-pressed={active}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 font-poppins text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
              active
                ? "bg-brand-primary text-white"
                : "border border-brand-divider bg-white text-brand-text/70 hover:border-brand-primary/40 hover:text-brand-text"
            }`}
          >
            {active && <i className="pi pi-check text-[10px]" aria-hidden="true" />}
            {label}
            <span
              className={`rounded-full px-2 py-0.5 font-poppins text-[11px] tabular-nums ${
                active ? "bg-white/25 text-white" : "bg-brand-secondary text-brand-text/70"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}

      {selected.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-[44px] items-center rounded-full px-3 font-poppins text-sm text-brand-text/70 underline-offset-2 transition-colors hover:text-brand-text hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Clear
        </button>
      )}
    </div>
  );
};

export default DishTypeFilter;
