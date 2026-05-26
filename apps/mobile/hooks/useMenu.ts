import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMenuItems, type CatalogItem } from '@momma-mia/supabase';
import { supabase } from '../lib/supabase';

export interface MenuSection {
  slug: string;
  name: string;
  items: CatalogItem[];
}

// Module-level cache: the catalog rarely changes within a session, so we fetch
// once and reuse it across screen mounts (avoids refetch jank + transient failures).
let menuCache: CatalogItem[] | null = null;

export function useMenu() {
  const [items, setItems] = useState<CatalogItem[]>(menuCache ?? []);
  const [loading, setLoading] = useState(menuCache === null);
  const [error, setError] = useState<string | null>(null);

  // load() also powers Retry on the error state (a transient network failure
  // used to be a dead end — now recoverable without reloading the whole app).
  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchMenuItems(supabase)
      .then((data) => {
        menuCache = data;
        if (active) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch((e) => active && (setError(e.message), setLoading(false)));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (menuCache !== null) return; // already loaded this session
    return load();
  }, [load]);

  // Group once per items change (not on every render).
  const sections = useMemo(() => groupBySection(items), [items]);

  return { items, sections, loading, error, reload: load };
}

function groupBySection(items: CatalogItem[]): MenuSection[] {
  const map = new Map<string, MenuSection>();
  for (const item of items) {
    const existing = map.get(item.category);
    if (existing) existing.items.push(item);
    else map.set(item.category, { slug: item.category, name: item.categoryName, items: [item] });
  }
  return Array.from(map.values());
}
