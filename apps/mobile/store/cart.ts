import { create } from 'zustand';
import type { CatalogItem } from '@momma-mia/supabase';

export interface CartLine {
  item: CatalogItem;
  qty: number;
}

interface CartState {
  lines: Record<string, CartLine>; // keyed by item id
  add: (item: CatalogItem, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>((set) => ({
  lines: {},
  add: (item, qty = 1) =>
    set((s) => {
      const existing = s.lines[item.id];
      return {
        lines: {
          ...s.lines,
          [item.id]: { item, qty: (existing?.qty ?? 0) + qty },
        },
      };
    }),
  setQty: (id, qty) =>
    set((s) => {
      if (qty <= 0) {
        const { [id]: _, ...rest } = s.lines;
        return { lines: rest };
      }
      const line = s.lines[id];
      if (!line) return s;
      return { lines: { ...s.lines, [id]: { ...line, qty } } };
    }),
  remove: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.lines;
      return { lines: rest };
    }),
  clear: () => set({ lines: {} }),
}));

// Derived selectors — call with the hook, e.g. useCartCount().
export const useCartCount = () =>
  useCart((s) => Object.values(s.lines).reduce((n, l) => n + l.qty, 0));

export const useCartSubtotal = () =>
  useCart((s) =>
    Object.values(s.lines).reduce((sum, l) => sum + (l.item.price ?? 0) * l.qty, 0),
  );
