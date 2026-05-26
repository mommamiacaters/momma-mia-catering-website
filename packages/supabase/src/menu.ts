// Shared menu read. Mirrors apps/web/src/services/menuService.ts:73-99 (the canonical
// query + normalization). The select string lives HERE as the single source; web keeps
// a tracked copy until it migrates onto this helper.
import { type QueryData } from '@supabase/supabase-js';
import type { AppSupabaseClient } from './client';

// CatalogItem is an intentional VIEW MODEL (renames `category.slug` → `category`,
// derives pesos from cents). It is NOT a DB row — do not replace with Tables<'menu_items'>.
export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null; // pesos, null = "price on request"
  category: string; // slug
  categoryName: string;
  type: string | null;
  image: string | null;
  isAvailable: boolean;
  isCatering: boolean;
}

const menuQuery = (client: AppSupabaseClient) =>
  client
    .from('menu_items')
    .select(
      'id, name, description, image_url, price_cents, item_type, is_available, is_catering, category:categories(slug, name)',
    )
    .eq('is_available', true)
    .order('sort_order', { ascending: true });

// Row type inferred from the query string itself — stays correct if columns change.
type MenuRow = QueryData<ReturnType<typeof menuQuery>>[number];

function normalizeRow(row: MenuRow): CatalogItem {
  // category may come back as an object or a single-element array (to-one relationship)
  const cat = Array.isArray(row.category) ? row.category[0] : row.category;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price_cents == null ? null : row.price_cents / 100,
    category: cat?.slug ?? 'uncategorized',
    categoryName: cat?.name ?? 'Uncategorized',
    type: row.item_type,
    image: row.image_url,
    isAvailable: row.is_available,
    isCatering: row.is_catering,
  };
}

/** Fetch the full, available catalog as normalized CatalogItems. Throws on error. */
export async function fetchMenuItems(client: AppSupabaseClient): Promise<CatalogItem[]> {
  const { data, error } = await menuQuery(client);
  if (error) throw error;
  return (data ?? []).map(normalizeRow);
}
