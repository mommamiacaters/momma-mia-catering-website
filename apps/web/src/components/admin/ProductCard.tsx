import React from "react";
import type { MenuItemRecord } from "../../types/menu";
import { formatPeso } from "../../utils/format";

/** Customer-facing product card (used in the "View as customer" preview, and
 *  reusable by the public storefront / mobile app later). */
const ProductCard: React.FC<{ item: MenuItemRecord }> = ({ item }) => (
  <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-brand-divider">
    <div className="aspect-square bg-brand-secondary overflow-hidden flex items-center justify-center">
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <i className="pi pi-image text-brand-text/20 text-3xl" aria-hidden="true" />
      )}
    </div>
    <div className="p-3">
      <p className="font-poppins font-medium text-brand-text text-sm leading-snug">{item.name}</p>
      {item.description && (
        <p className="font-poppins text-xs text-brand-text/50 mt-0.5 line-clamp-2">{item.description}</p>
      )}
      <p className="font-arvo-bold text-brand-primary text-sm mt-1">{formatPeso(item.price_cents)}</p>
    </div>
  </div>
);

export default ProductCard;
