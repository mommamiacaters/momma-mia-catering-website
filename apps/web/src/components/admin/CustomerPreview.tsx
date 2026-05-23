import React from "react";
import type { Category, MenuItemRecord } from "../../types/menu";
import ProductCard from "./ProductCard";

interface CustomerPreviewProps {
  categories: Category[];
  grouped: Map<number, MenuItemRecord[]>;
}

/** Read-only "what customers see" — only available items, as product cards. */
const CustomerPreview: React.FC<CustomerPreviewProps> = ({ categories, grouped }) => {
  const hasAnything = categories.some((c) => (grouped.get(c.id) ?? []).some((i) => i.is_available));

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 rounded-lg bg-brand-accent/15 px-4 py-3 font-poppins text-sm text-brand-text/80">
        <i className="pi pi-eye text-brand-primary" aria-hidden="true" />
        This is exactly what customers see on the website. Hidden dishes don't appear here.
      </div>

      {!hasAnything ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center font-poppins text-brand-text/60">
          Nothing is showing to customers yet.
        </div>
      ) : (
        <div className="space-y-10">
          {categories.map((cat) => {
            const visible = (grouped.get(cat.id) ?? []).filter((i) => i.is_available);
            if (visible.length === 0) return null;
            return (
              <section key={cat.id}>
                <h2 className="font-arvo-bold text-xl text-brand-text mb-4">{cat.name}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {visible.map((it) => (
                    <ProductCard key={it.id} item={it} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerPreview;
