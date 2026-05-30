import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Persisted with AsyncStorage so the cart survives OS app evictions mid-order —
// the cart is real intent (a customer who picked 15 meals shouldn't lose it if
// they swap apps and Android reclaims memory). Only `lines` is persisted;
// derived selectors (count, subtotal) recompute on hydration. SSR isn't a
// concern here — Expo runs the JS bundle on-device, not on a server.
export const useCart = create<CartState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'momma-mia-cart-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist ONLY the cart lines — never derived totals/counts, those are
      // recomputed from `lines` on every render so they can't go stale.
      partialize: (state) => ({ lines: state.lines }),
      version: 1,
      // No-op migrate today; lets us bump `version` and reshape persisted
      // data without throwing away existing carts in the future.
      migrate: (persistedState, _version) => persistedState as CartState,
      // skipHydration defaults to false → hydration happens automatically on
      // store creation; no app-level Provider needed.
    },
  ),
);

// Derived selectors — call with the hook, e.g. useCartCount().
export const useCartCount = () =>
  useCart((s) => Object.values(s.lines).reduce((n, l) => n + l.qty, 0));

export const useCartSubtotal = () =>
  useCart((s) =>
    Object.values(s.lines).reduce((sum, l) => sum + (l.item.price ?? 0) * l.qty, 0),
  );
