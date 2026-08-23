import React from "react";
import type { MenuItemRecord } from "../../types/menu";
import { formatPeso } from "../../utils/format";
import SafeImage from "../ui/SafeImage";

interface MenuItemRowProps {
  item: MenuItemRecord;
  /** Resolved sub-category label; falls back to the legacy item_type. */
  subCategoryName?: string;
  onToggle: (item: MenuItemRecord) => void;
  onEdit: (item: MenuItemRecord) => void;
  onDelete: (item: MenuItemRecord) => void;
}

/** No photo at all — the storefront falls back to a generic placeholder. */
export const needsPhoto = (item: MenuItemRecord): boolean =>
  !item.image_url || item.image_url.trim() === "";

/** A single editable dish row in the admin manage list. */
const MenuItemRow: React.FC<MenuItemRowProps> = ({
  item,
  subCategoryName,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const missing = needsPhoto(item);

  return (
  <li
    className={`flex items-center gap-4 border-l-4 px-4 py-3 ${
      missing ? "border-amber-400 bg-amber-50/60" : "border-transparent"
    } ${!item.is_available ? "opacity-60" : ""}`}
  >
    <div
      className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg flex items-center justify-center ${
        missing ? "bg-amber-100 ring-1 ring-amber-300" : "bg-brand-secondary"
      }`}
    >
      <SafeImage src={item.image_url} alt="" className="h-full w-full object-cover" />
    </div>

    <div className="min-w-0 flex-1">
      <p className="font-poppins font-medium text-brand-text truncate">{item.name}</p>
      <p className="font-poppins text-xs text-brand-text/50">
        {(() => {
          const group = subCategoryName ?? item.item_type;
          return group ? `${group} · ` : "";
        })()}
        {formatPeso(item.price_cents)}
      </p>
      {missing && (
        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 font-poppins text-[11px] font-semibold text-amber-900">
          <i className="pi pi-exclamation-triangle text-[9px]" aria-hidden="true" />
          No photo
        </p>
      )}
    </div>

    <button
      onClick={() => onToggle(item)}
      title={item.is_available ? "Showing on website — click to hide" : "Hidden — click to show"}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-poppins font-medium cursor-pointer transition-colors ${
        item.is_available
          ? "bg-green-100 text-green-700 hover:bg-green-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      <i className={`pi ${item.is_available ? "pi-eye" : "pi-eye-slash"} text-[10px]`} aria-hidden="true" />
      {item.is_available ? "Showing" : "Hidden"}
    </button>

    <button onClick={() => onEdit(item)} className="p-2 rounded-lg text-brand-text/60 hover:bg-brand-secondary cursor-pointer" aria-label={`Edit ${item.name}`}>
      <i className="pi pi-pencil" aria-hidden="true" />
    </button>
    <button onClick={() => onDelete(item)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer" aria-label={`Delete ${item.name}`}>
      <i className="pi pi-trash" aria-hidden="true" />
    </button>
  </li>
  );
};

export default MenuItemRow;
