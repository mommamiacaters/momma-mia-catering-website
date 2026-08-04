import React from "react";

interface PaginationBarProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  /** Plural noun for the count, e.g. "dishes" / "orders". */
  noun?: string;
  /** Announced to screen readers, e.g. "Check-a-Lunch pages". */
  label?: string;
}

/**
 * Builds the page buttons with ellipses: always first and last, plus a window
 * around the current page. Returns numbers to render and "…" for the gaps, so a
 * 30-page list never blows the bar out to 30 buttons.
 */
function pageItems(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const out: (number | "…")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);

  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < pageCount - 1) out.push("…");

  out.push(pageCount);
  return out;
}

const base =
  "min-w-[2.25rem] h-9 px-2 rounded-lg font-poppins text-sm transition-colors cursor-pointer " +
  "focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:cursor-not-allowed";

/** Shared pager for every admin list, so paging looks and behaves the same everywhere. */
const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  pageCount,
  onPageChange,
  rangeStart,
  rangeEnd,
  total,
  noun = "items",
  label = "Pages",
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-brand-divider bg-white">
    {/* Stating the range and the total keeps a paged list honest — you can always
        see how much is NOT on screen. */}
    <p className="font-poppins text-xs text-brand-text/55 tabular-nums" aria-live="polite">
      Showing {rangeStart}–{rangeEnd} of {total} {noun}
    </p>

    {pageCount > 1 && (
      <nav className="flex items-center gap-1" aria-label={label}>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={`${base} text-brand-text/70 hover:bg-brand-secondary disabled:opacity-35 disabled:hover:bg-transparent`}
        >
          <i className="pi pi-chevron-left text-xs" aria-hidden="true" />
        </button>

        {pageItems(page, pageCount).map((item, i) =>
          item === "…" ? (
            <span
              key={`gap-${i}`}
              className="px-1 font-poppins text-sm text-brand-text/35 select-none"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
              className={`${base} ${
                item === page
                  ? "bg-brand-primary text-white font-arvo-bold"
                  : "text-brand-text/70 hover:bg-brand-secondary"
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className={`${base} text-brand-text/70 hover:bg-brand-secondary disabled:opacity-35 disabled:hover:bg-transparent`}
        >
          <i className="pi pi-chevron-right text-xs" aria-hidden="true" />
        </button>
      </nav>
    )}
  </div>
);

export default PaginationBar;
