import React from "react";
import type { AvailabilityFilter } from "../../types/menu";

interface MenuToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  availability: AvailabilityFilter;
  onAvailabilityChange: (a: AvailabilityFilter) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const FILTERS: { value: AvailabilityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "showing", label: "Showing" },
  { value: "hidden", label: "Hidden" },
];

/** Search box + availability filter + expand/collapse-all controls. */
const MenuToolbar: React.FC<MenuToolbarProps> = ({
  query,
  onQueryChange,
  availability,
  onAvailabilityChange,
  onExpandAll,
  onCollapseAll,
}) => (
  <div className="mb-5 flex flex-wrap items-center gap-3">
    {/* search */}
    <div className="relative flex-1 min-w-[200px]">
      <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-brand-text/40 text-sm" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search dishes…"
        aria-label="Search dishes"
        className="w-full rounded-lg border border-brand-divider bg-white pl-9 pr-3 py-2.5 font-poppins text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
      />
    </div>

    {/* availability filter */}
    <div className="inline-flex rounded-lg bg-white border border-brand-divider p-1">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onAvailabilityChange(f.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-poppins font-medium transition-colors cursor-pointer ${
            availability === f.value ? "bg-brand-primary text-white" : "text-brand-text/60 hover:text-brand-text"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>

    {/* expand / collapse */}
    <div className="flex items-center gap-1 text-sm font-poppins text-brand-text/60">
      <button onClick={onExpandAll} className="rounded-lg px-2.5 py-1.5 hover:bg-white hover:text-brand-text cursor-pointer">
        Expand all
      </button>
      <span aria-hidden="true">·</span>
      <button onClick={onCollapseAll} className="rounded-lg px-2.5 py-1.5 hover:bg-white hover:text-brand-text cursor-pointer">
        Collapse all
      </button>
    </div>
  </div>
);

export default MenuToolbar;
