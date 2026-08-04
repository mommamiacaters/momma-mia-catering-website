import { useEffect, useMemo, useState } from "react";

export interface Pagination<T> {
  /** 1-based, always within [1, pageCount]. */
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  /** The rows for the current page. */
  slice: T[];
  total: number;
  /** 1-based inclusive display range, e.g. "Showing 11–20 of 29". */
  rangeStart: number;
  rangeEnd: number;
}

/**
 * Client-side pagination for lists already held in memory.
 *
 * The clamp matters more than the slicing: the source array shrinks underneath
 * this hook all the time — a search filters it, or the admin deletes the last
 * row on page 3 — and without clamping the caller would render an empty page
 * with no obvious way back.
 */
export function usePagination<T>(items: T[], pageSize: number): Pagination<T> {
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);

  // Write the clamp back so the buttons and the rendered slice can never disagree.
  useEffect(() => {
    if (page !== current) setPage(current);
  }, [page, current]);

  const start = (current - 1) * pageSize;
  const slice = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  return {
    page: current,
    pageCount,
    setPage,
    slice,
    total: items.length,
    rangeStart: items.length === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, items.length),
  };
}
