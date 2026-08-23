import React, { useMemo } from "react";
import type { MenuItemRecord } from "../../types/menu";
import { usePagination } from "../../hooks/usePagination";
import PaginationBar from "../ui/PaginationBar";
import MenuItemRow, { needsPhoto } from "./MenuItemRow";

interface CategoryItemListProps {
  categoryName: string;
  items: MenuItemRecord[];
  subCategoryNames: Map<number, string>;
  onToggle: (item: MenuItemRecord) => void;
  onEdit: (item: MenuItemRecord) => void;
  onDelete: (item: MenuItemRecord) => void;
  onAddFirst: () => void;
}

const PAGE_SIZE = 8;

/**
 * The paged dish list inside one category accordion.
 *
 * This is a component rather than a loop in AdminProducts because each category
 * needs its OWN page state, and hooks can't be called per iteration. Giving each
 * category its own instance also means paging Café Menu doesn't reset
 * Check-a-Lunch.
 */
const CategoryItemList: React.FC<CategoryItemListProps> = ({
  categoryName,
  items,
  subCategoryNames,
  onToggle,
  onEdit,
  onDelete,
  onAddFirst,
}) => {
  // Dishes with no photo lead the list, and paging follows: the whole point is
  // that they surface without hunting through 14 pages. Array.sort is stable,
  // so everything else keeps its sort_order.
  const ordered = useMemo(
    () => [...items].sort((a, b) => Number(needsPhoto(b)) - Number(needsPhoto(a))),
    [items],
  );
  const missingCount = useMemo(() => ordered.filter(needsPhoto).length, [ordered]);

  const { slice, page, pageCount, setPage, rangeStart, rangeEnd, total } = usePagination(
    ordered,
    PAGE_SIZE,
  );

  if (items.length === 0) {
    return (
      <button
        onClick={onAddFirst}
        className="w-full px-4 py-8 font-poppins text-sm text-brand-text/50 hover:bg-brand-secondary/50 cursor-pointer text-center focus:outline-none focus:ring-2 focus:ring-brand-primary"
      >
        No dishes here yet — click to add the first one.
      </button>
    );
  }

  return (
    <>
      {missingCount > 0 && (
        <p className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 font-poppins text-xs text-amber-900">
          <i className="pi pi-exclamation-triangle text-[10px]" aria-hidden="true" />
          <span>
            <strong className="font-semibold">
              {missingCount} {missingCount === 1 ? "dish has" : "dishes have"} no photo.
            </strong>{" "}
            They show a grey placeholder to customers, so they are listed first here.
          </span>
        </p>
      )}
      <ul className="divide-y divide-brand-divider">
        {slice.map((item) => (
          <MenuItemRow
            key={item.id}
            item={item}
            subCategoryName={
              item.sub_category_id ? subCategoryNames.get(item.sub_category_id) : undefined
            }
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
      <PaginationBar
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        total={total}
        noun="dishes"
        label={`${categoryName} pages`}
      />
    </>
  );
};

export default CategoryItemList;
