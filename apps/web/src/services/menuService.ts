// services/menuService.ts
// Reads the live menu from Supabase. Returns the SAME shapes the UI already
// consumes (MenuData grouped by category -> main/side/starch) so components
// need no changes. getFullCatalog() exposes the richer catalog (all categories
// and item types) for the new UI and the admin console.
import { supabase } from '../lib/supabase';

export interface MenuItem {
  id: string;    // menu_items.id (UUID) — threaded through to order_items for server-side pricing
  name: string;
  description: string;
  price: number; // pesos
  category: string;
  type: string;
  image: string;
}

export interface MenuTypeData {
  main: MenuItem[];
  side: MenuItem[];
  starch: MenuItem[];
}

export interface MenuData {
  "check-a-lunch": MenuTypeData;
  "fun-boxes": MenuTypeData;
}

// Richer, normalized catalog row used by the new UI / admin console.
export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null; // pesos, null = "price on request"
  category: string;     // slug
  categoryName: string;
  type: string | null;
  image: string | null;
  isAvailable: boolean;
  isCatering: boolean;
}

export interface MenuResponse {
  success: boolean;
  data?: MenuData | MenuTypeData | MenuItem[];
  category?: string;
  type?: string;
  count?: number;
  error?: string;
  message?: string;
  timestamp: string;
}

const centsToPesos = (c: number | null): number => (c == null ? 0 : c / 100);
const emptyTypeData = (): MenuTypeData => ({ main: [], side: [], starch: [] });

class MenuService {
  private cache: { items: CatalogItem[] | null; timestamp: number } = {
    items: null,
    timestamp: 0,
  };
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  private isDataFresh(): boolean {
    return Date.now() - this.cache.timestamp < this.cacheDuration;
  }

  /** Fetch the full, available catalog (cached). Source of truth for everything below. */
  async getFullCatalog(forceRefresh = false): Promise<CatalogItem[]> {
    if (!forceRefresh && this.cache.items && this.isDataFresh()) {
      return this.cache.items;
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, description, image_url, price_cents, item_type, is_available, is_catering, category:categories(slug, name)')
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch menu from Supabase:', error.message);
      return this.cache.items ?? [];
    }

    const items: CatalogItem[] = (data ?? []).map((row) => {
      // category may come back as an object (to-one relationship)
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
    });

    this.cache.items = items;
    this.cache.timestamp = Date.now();
    return items;
  }

  /** Legacy shape: MenuData for the meal-plan UI (check-a-lunch + fun-boxes). */
  async getAllMenuData(forceRefresh = false): Promise<MenuData> {
    const items = await this.getFullCatalog(forceRefresh);
    const result: MenuData = {
      "check-a-lunch": emptyTypeData(),
      "fun-boxes": emptyTypeData(),
    };

    for (const item of items) {
      const bucket = result[item.category as keyof MenuData];
      if (!bucket) continue; // skip categories the legacy UI doesn't render
      const type = item.type as keyof MenuTypeData;
      if (type !== 'main' && type !== 'side' && type !== 'starch') continue;
      bucket[type].push({
        id: item.id,
        name: item.name,
        description: item.description ?? '',
        price: item.price ?? 0,
        category: item.category,
        type: item.type ?? '',
        image: item.image ?? '',
      });
    }
    return result;
  }

  async getCategoryMenuData(category: "check-a-lunch" | "fun-boxes"): Promise<MenuTypeData> {
    const allData = await this.getAllMenuData();
    return allData[category] || emptyTypeData();
  }

  async getTypeMenuData(
    type: "main" | "side" | "starch",
  ): Promise<{ "check-a-lunch": MenuItem[]; "fun-boxes": MenuItem[] }> {
    const allData = await this.getAllMenuData();
    return {
      "check-a-lunch": allData["check-a-lunch"][type] || [],
      "fun-boxes": allData["fun-boxes"][type] || [],
    };
  }

  async getCategoryTypeMenuData(
    category: "check-a-lunch" | "fun-boxes",
    type: "main" | "side" | "starch",
  ): Promise<MenuItem[]> {
    const allData = await this.getAllMenuData();
    return allData[category]?.[type] || [];
  }

  async getAllItemsByType(type: "main" | "side" | "starch"): Promise<MenuItem[]> {
    const allData = await this.getAllMenuData();
    return [...allData["check-a-lunch"][type], ...allData["fun-boxes"][type]];
  }

  async getAllItemsByCategory(category: "check-a-lunch" | "fun-boxes"): Promise<MenuItem[]> {
    const c = await this.getCategoryMenuData(category);
    return [...c.main, ...c.side, ...c.starch];
  }

  async getAllItems(): Promise<MenuItem[]> {
    const allData = await this.getAllMenuData();
    const items: MenuItem[] = [];
    for (const categoryKey in allData) {
      const category = allData[categoryKey as keyof MenuData];
      for (const typeKey in category) {
        items.push(...category[typeKey as keyof MenuTypeData]);
      }
    }
    return items;
  }

  async refreshMenuData(): Promise<void> {
    await this.getFullCatalog(true);
  }

  clearCache(): void {
    this.cache.items = null;
    this.cache.timestamp = 0;
  }

  formatPrice(price: number): string {
    return `₱${price.toFixed(2)}`;
  }
}

export const menuService = new MenuService();
export default MenuService;
