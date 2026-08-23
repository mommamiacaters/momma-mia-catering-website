import React, { useRef } from "react";

export interface SectionTab {
  id: string;
  label: string;
  /** PrimeIcons class, e.g. "pi-images". */
  icon: string;
}

interface SectionTabsProps {
  tabs: SectionTab[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

/**
 * The section switcher on a record page. A real ARIA tablist: one tab stop for
 * the whole bar, arrows move between tabs. No sliding indicator — this gets
 * clicked dozens of times a day, so the only motion is a colour fade.
 */
const SectionTabs: React.FC<SectionTabsProps> = ({ tabs, value, onChange, ariaLabel }) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const move: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    if (e.key in move) {
      e.preventDefault();
      focusTab(index + move[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      // Scrolls rather than wraps on a phone; the cut-off tab signals more.
      className="flex gap-1 overflow-x-auto border-b border-brand-divider [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab, i) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`-mb-px flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-4 font-arvo-bold text-sm whitespace-nowrap transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
              active
                ? "border-brand-primary text-brand-text"
                : "border-transparent text-brand-text/70 hover:border-brand-divider hover:text-brand-text"
            }`}
          >
            <i className={`pi ${tab.icon} text-xs`} aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default SectionTabs;
