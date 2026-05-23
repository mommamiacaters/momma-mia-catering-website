import React from "react";

interface CategoryAccordionProps {
  name: string;
  count: number;
  /** total before filtering, to show "3 of 29" when a search is active */
  totalCount?: number;
  isOpen: boolean;
  onToggle: () => void;
  onAdd: () => void;
  children: React.ReactNode;
}

/** Collapsible category section. Header shows the name + counts and an
 *  "Add to <category>" shortcut; the body animates open/closed. */
const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
  name,
  count,
  totalCount,
  isOpen,
  onToggle,
  onAdd,
  children,
}) => {
  const showingFiltered = totalCount != null && totalCount !== count;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-brand-divider overflow-hidden">
      <div className="flex items-center">
        <button
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex flex-1 items-center gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-brand-secondary/40 transition-colors"
        >
          <i
            className={`pi pi-chevron-right text-brand-text/40 text-sm transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
          <span className="font-arvo-bold text-lg text-brand-text">{name}</span>
          <span className="rounded-full bg-brand-accent/20 px-2 py-0.5 text-xs font-poppins text-brand-text/70">
            {showingFiltered ? `${count} of ${totalCount}` : count}
          </span>
        </button>
        <button
          onClick={onAdd}
          className="mr-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-arvo-bold text-brand-primary hover:bg-brand-primary/10 cursor-pointer"
        >
          <i className="pi pi-plus text-xs" aria-hidden="true" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>

      <div className={`grid transition-all duration-200 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-brand-divider">{children}</div>
        </div>
      </div>
    </section>
  );
};

export default CategoryAccordion;
