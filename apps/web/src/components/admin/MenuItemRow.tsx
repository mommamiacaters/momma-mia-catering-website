import React from "react";
import type { MenuItemRecord } from "../../types/menu";
import { formatPeso } from "../../utils/format";

interface MenuItemRowProps {
  item: MenuItemRecord;
  onToggle: (item: MenuItemRecord) => void;
  onEdit: (item: MenuItemRecord) => void;
  onDelete: (item: MenuItemRecord) => void;
}

/** A single editable dish row in the admin manage list. */
const MenuItemRow: React.FC<MenuItemRowProps> = ({ item, onToggle, onEdit, onDelete }) => (
  <li className={`flex items-center gap-4 px-4 py-3 ${!item.is_available ? "opacity-60" : ""}`}>
    <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-brand-secondary overflow-hidden flex items-center justify-center">
      {item.image_url ? (
        <img src={item.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <i className="pi pi-image text-brand-text/30 text-lg" aria-hidden="true" />
      )}
    </div>

    <div className="min-w-0 flex-1">
      <p className="font-poppins font-medium text-brand-text truncate">{item.name}</p>
      <p className="font-poppins text-xs text-brand-text/50">
        {item.item_type ? `${item.item_type} · ` : ""}
        {formatPeso(item.price_cents)}
      </p>
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

export default MenuItemRow;
