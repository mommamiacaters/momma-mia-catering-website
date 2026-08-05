import React from "react";
import type { MenuItemRecord } from "../../types/menu";
import { usePagination } from "../../hooks/usePagination";
import PaginationBar from "../ui/PaginationBar";
import MenuItemRow from "./MenuItemRow";

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
  const { slice, page, pageCount, setPage, rangeStart, rangeEnd, total } = usePagination(
    items,
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
