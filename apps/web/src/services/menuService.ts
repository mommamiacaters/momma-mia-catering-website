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

/** A slot in a meal plan. Mirrors sub_categories.slot in the database. */
export type PlanSlot = "main" | "side" | "dessert" | "rice";

export const PLAN_SLOT_LABELS: Record<PlanSlot, string> = {
  main: "Main Dish",
  side: "Side Dish",
  rice: "Rice",
  dessert: "Dessert",
};

/** A purchasable Check-a-Lunch box, straight from public.meal_plans. */
export interface MealPlan {
  id: number;
  name: string;
  description: string | null;
  /** Pesos. Meaningless when pricingMode is "range". */
  price: number;
  pricingMode: "fixed" | "range";
  /** How many dishes the customer picks per slot. */
  slots: Record<PlanSlot, number>;
  /** Pesos; only meaningful when pricingMode is "range". */
  minPrice: number;
  maxPrice: number;
}

/** One dish a plan may be built from, via public.meal_plan_options. */
export interface PlanOption {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  /** Pesos. Only charged when the plan's pricingMode is "range". */
  price: number;
  slot: PlanSlot;
  subCategoryId: number;
  subCategoryName: string;
  subCategorySort: number;
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
  private planCache: MealPlan[] | null = null;
  private planCacheAt = 0;

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

  /**
   * The purchasable plans, with their composition and price.
   *
   * Joined against meal_plan_price_ranges rather than deriving a range here, so
   * the storefront quotes exactly the figure the admin preview shows and
   * create_order will charge. Three copies of this arithmetic is three chances
   * to disagree.
   */
  async getMealPlans(): Promise<MealPlan[]> {
    if (this.planCache && Date.now() - this.planCacheAt < this.cacheDuration) {
      return this.planCache;
    }

    const [{ data: plans, error }, { data: ranges }] = await Promise.all([
      supabase
        .from("meal_plans")
        .select(
          "id, name, description, price_cents, pricing_mode, main_count, side_count, dessert_count, rice_count",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("meal_plan_price_ranges").select("meal_plan_id, min_cents, max_cents"),
    ]);

    if (error) {
      console.error("Failed to fetch meal plans:", error.message);
      return this.planCache ?? [];
    }

    const rangeById = new Map(
      (ranges ?? []).map((r) => [r.meal_plan_id as number, r]),
    );

    const mapped: MealPlan[] = (plans ?? []).map((p) => {
      const r = rangeById.get(p.id);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: centsToPesos(p.price_cents),
        pricingMode: (p.pricing_mode as MealPlan["pricingMode"]) ?? "fixed",
        slots: {
          main: p.main_count ?? 0,
          side: p.side_count ?? 0,
          dessert: p.dessert_count ?? 0,
          rice: p.rice_count ?? 0,
        },
        minPrice: centsToPesos((r?.min_cents as number) ?? 0),
        maxPrice: centsToPesos((r?.max_cents as number) ?? 0),
      };
    });

    this.planCache = mapped;
    this.planCacheAt = Date.now();
    return mapped;
  }

  /**
   * The dishes a given plan may be built from, grouped by slot. Scoped by the
   * view to the plan's own category, so Party Trays can never turn up as a
   * lunch-box main.
   */
  async getPlanOptions(mealPlanId: number): Promise<Record<PlanSlot, PlanOption[]>> {
    const grouped: Record<PlanSlot, PlanOption[]> = {
      main: [],
      side: [],
      dessert: [],
      rice: [],
    };

    const { data, error } = await supabase
      .from("meal_plan_options")
      .select(
        "menu_item_id, name, description, image_url, price_cents, slot, sub_category_id, sub_category_name, sub_category_sort",
      )
      .eq("meal_plan_id", mealPlanId);

    if (error) {
      console.error("Failed to fetch plan options:", error.message);
      return grouped;
    }

    for (const row of data ?? []) {
      const slot = row.slot as PlanSlot;
      if (!grouped[slot]) continue;
      grouped[slot].push({
        id: row.menu_item_id as string,
        name: row.name as string,
        description: row.description as string | null,
        image: row.image_url as string | null,
        price: centsToPesos(row.price_cents as number | null),
        slot,
        subCategoryId: row.sub_category_id as number,
        subCategoryName: row.sub_category_name as string,
        subCategorySort: row.sub_category_sort as number,
      });
    }

    // Group by sub-category first (Pork, then Chicken, then Seafood…), then
    // alphabetically — the order the printed menu reads in.
    for (const slot of Object.keys(grouped) as PlanSlot[]) {
      grouped[slot].sort(
        (a, b) => a.subCategorySort - b.subCategorySort || a.name.localeCompare(b.name),
      );
    }
    return grouped;
  }

  async refreshMenuData(): Promise<void> {
    this.planCache = null;
    await this.getFullCatalog(true);
  }

  clearCache(): void {
    this.cache.items = null;
    this.cache.timestamp = 0;
    this.planCache = null;
    this.planCacheAt = 0;
  }

  formatPrice(price: number): string {
    return `₱${price.toFixed(2)}`;
  }
}

export const menuService = new MenuService();
export default MenuService;
