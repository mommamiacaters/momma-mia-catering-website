// services/menuService.ts
// Reads the live menu from Supabase. Returns the SAME shapes the UI already
// consumes (MenuData grouped by category -> main/side/starch) so components
// need no changes. getFullCatalog() exposes the richer catalog (all categories
// and item types) for the new UI and the admin console.
import { supabase } from '../lib/supabase';
import type { PlanSlot } from '../types';

export interface MenuItem {
  id: string;    // menu_items.id (UUID) — threaded through to order_items for server-side pricing
  name: string;
  description: string;
  price: number; // pesos
  category: string;
  type: string;
  image: string;
  /** menu_items.min_qty: null/absent = store default, 0 = no minimum. */
  minQty?: number | null;
}

/** Dishes grouped by plan slot. "starch" became "rice"; "dessert" is new. */
export interface MenuTypeData {
  main: MenuItem[];
  side: MenuItem[];
  rice: MenuItem[];
  rice_bowl: MenuItem[];
  sandwich: MenuItem[];
  pasta: MenuItem[];
  drink: MenuItem[];
  dessert: MenuItem[];
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

/**
 * A slot in a meal plan. Mirrors sub_categories.slot in the database.
 *
 * Re-exported, not redefined: this file used to carry its own copy of the union
 * and its own label map, which then disagreed with constants/planSlots.ts the
 * moment a slot was added. Type-only, so the cycle back to ../types costs
 * nothing at runtime.
 */
export type { PlanSlot } from "../types";

/** @deprecated Use `slotLabel` from constants/planSlots.ts. */
export const PLAN_SLOT_LABELS: Record<string, string> = {
  main: "Main Dish",
  side: "Side Dish",
  rice: "Rice",
  rice_bowl: "Rice Bowl",
  sandwich: "Sandwich",
  pasta: "Pasta",
  drink: "Drink",
  dessert: "Dessert",
};

/** A purchasable box/tray plan, straight from public.meal_plans. */
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
  /** Menu category slug the plan belongs to — which service page sells it. */
  categorySlug: string | null;
  /** The service's own order minimum; null = the store default applies. */
  categoryMinBoxes: number | null;
  /** This service's floor for EACH dish; null = use the store default. */
  categoryMinDishQty: number | null;
}

/** An extras group (Add-ons, Café Menu) offered alongside every service. */
export interface ExtrasCategory {
  slug: string;
  name: string;
  items: MenuItem[];
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
  /** Per-dish order floor: null = store default, 0 = no minimum. */
  minQty: number | null;
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
const emptyTypeData = (): MenuTypeData => ({
  main: [],
  side: [],
  rice: [],
  rice_bowl: [],
  sandwich: [],
  pasta: [],
  drink: [],
  dessert: [],
});

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
      // Legacy rows still say "starch"; the slot vocabulary calls it rice.
      const raw = item.type === 'starch' ? 'rice' : item.type;
      const type = raw as keyof MenuTypeData;
      if (type !== 'main' && type !== 'side' && type !== 'rice' && type !== 'dessert') continue;
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
    type: PlanSlot,
  ): Promise<{ "check-a-lunch": MenuItem[]; "fun-boxes": MenuItem[] }> {
    const allData = await this.getAllMenuData();
    return {
      "check-a-lunch": allData["check-a-lunch"][type] || [],
      "fun-boxes": allData["fun-boxes"][type] || [],
    };
  }

  async getCategoryTypeMenuData(
    category: "check-a-lunch" | "fun-boxes",
    type: PlanSlot,
  ): Promise<MenuItem[]> {
    const allData = await this.getAllMenuData();
    return allData[category]?.[type] || [];
  }

  async getAllItemsByType(type: PlanSlot): Promise<MenuItem[]> {
    const allData = await this.getAllMenuData();
    return [...allData["check-a-lunch"][type], ...allData["fun-boxes"][type]];
  }

  async getAllItemsByCategory(category: "check-a-lunch" | "fun-boxes"): Promise<MenuItem[]> {
    const c = await this.getCategoryMenuData(category);
    return [...c.main, ...c.side, ...c.rice, ...c.dessert];
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
   * The purchasable plans, with their composition and price. Pass a category
   * slug to get only the plans that service page sells; the cache always holds
   * every plan and the filter runs on the way out.
   *
   * Joined against meal_plan_price_ranges rather than deriving a range here, so
   * the storefront quotes exactly the figure the admin preview shows and
   * create_order will charge. Three copies of this arithmetic is three chances
   * to disagree.
   */
  async getMealPlans(categorySlug?: string): Promise<MealPlan[]> {
    const filtered = (all: MealPlan[]) =>
      categorySlug ? all.filter((p) => p.categorySlug === categorySlug) : all;

    if (this.planCache && Date.now() - this.planCacheAt < this.cacheDuration) {
      return filtered(this.planCache);
    }

    const [{ data: plans, error }, { data: ranges }] = await Promise.all([
      supabase
        .from("meal_plans")
        .select(
          "id, name, description, price_cents, pricing_mode, main_count, side_count, dessert_count, rice_count, rice_bowl_count, sandwich_count, pasta_count, drink_count, category:categories(slug, min_order_boxes, min_qty_per_dish, is_active)",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("meal_plan_price_ranges").select("meal_plan_id, min_cents, max_cents"),
    ]);

    if (error) {
      console.error("Failed to fetch meal plans:", error.message);
      return filtered(this.planCache ?? []);
    }

    const rangeById = new Map(
      (ranges ?? []).map((r) => [r.meal_plan_id as number, r]),
    );

    // Archiving a service hid its DISHES (meal_plan_options joins
    // categories.is_active) but left its PLANS on sale, so the storefront
    // still offered a box whose picker had nothing in it. Filtered here rather
    // than with an inner join, so a plan with no category is never dropped.
    const sellable = (plans ?? []).filter((p) => {
      const cat = Array.isArray(p.category) ? p.category[0] : p.category;
      return (cat as { is_active?: boolean } | null)?.is_active !== false;
    });

    const mapped: MealPlan[] = sellable.map((p) => {
      const r = rangeById.get(p.id);
      const cat = Array.isArray(p.category) ? p.category[0] : p.category;
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
          rice_bowl: p.rice_bowl_count ?? 0,
          sandwich: p.sandwich_count ?? 0,
          pasta: p.pasta_count ?? 0,
          drink: p.drink_count ?? 0,
        },
        minPrice: centsToPesos((r?.min_cents as number) ?? 0),
        maxPrice: centsToPesos((r?.max_cents as number) ?? 0),
        categorySlug: (cat as { slug: string } | null)?.slug ?? null,
        categoryMinBoxes:
          (cat as { min_order_boxes: number | null } | null)?.min_order_boxes ?? null,
        categoryMinDishQty:
          (cat as { min_qty_per_dish: number | null } | null)?.min_qty_per_dish ?? null,
      };
    });

    this.planCache = mapped;
    this.planCacheAt = Date.now();
    return filtered(mapped);
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
      rice_bowl: [],
      sandwich: [],
      pasta: [],
      drink: [],
    };

    const { data, error } = await supabase
      .from("meal_plan_options")
      .select(
        "menu_item_id, name, description, image_url, price_cents, slot, sub_category_id, sub_category_name, sub_category_sort, min_qty",
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
        minQty: (row.min_qty as number | null) ?? null,
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

  /** A plan's selectable dishes in the MenuTypeData shape the builder consumes. */
  async getPlanMenuData(mealPlanId: number): Promise<MenuTypeData> {
    const opts = await this.getPlanOptions(mealPlanId);
    const toMenuItem = (o: PlanOption): MenuItem => ({
      id: o.id,
      name: o.name,
      description: o.description ?? "",
      price: o.price,
      category: "check-a-lunch",
      type: o.slot,
      image: o.image ?? "",
      minQty: o.minQty,
    });
    return {
      main: opts.main.map(toMenuItem),
      side: opts.side.map(toMenuItem),
      rice: opts.rice.map(toMenuItem),
      rice_bowl: opts.rice_bowl.map(toMenuItem),
      sandwich: opts.sandwich.map(toMenuItem),
      pasta: opts.pasta.map(toMenuItem),
      drink: opts.drink.map(toMenuItem),
      dessert: opts.dessert.map(toMenuItem),
    };
  }

  /**
   * The always-available extras (Add-ons, Café Menu): universal categories
   * whose dishes ride along with every service's plans. Grouped by category,
   * in the category sort order. Unpriced dishes never appear — the view
   * filters them, because extras are charged à la carte.
   */
  async getExtras(): Promise<ExtrasCategory[]> {
    const { data, error } = await supabase
      .from("extras_menu_options")
      .select(
        "category_slug, category_name, category_sort, menu_item_id, name, description, image_url, price_cents, min_qty",
      );
    if (error) {
      console.error("Failed to fetch extras:", error.message);
      return [];
    }
    const byCat = new Map<string, ExtrasCategory & { sort: number }>();
    for (const row of data ?? []) {
      const slug = row.category_slug as string;
      let cat = byCat.get(slug);
      if (!cat) {
        cat = { slug, name: row.category_name as string, sort: row.category_sort as number, items: [] };
        byCat.set(slug, cat);
      }
      cat.items.push({
        id: row.menu_item_id as string,
        name: row.name as string,
        description: (row.description as string | null) ?? "",
        price: centsToPesos(row.price_cents as number),
        category: slug,
        type: "extra",
        image: (row.image_url as string | null) ?? "",
        minQty: (row.min_qty as number | null) ?? null,
      });
    }
    const cats = [...byCat.values()].sort((a, b) => a.sort - b.sort);
    for (const c of cats) c.items.sort((a, b) => a.name.localeCompare(b.name));
    return cats.map(({ slug, name, items }) => ({ slug, name, items }));
  }

  /**
   * Live, uncached read of per-dish minimums for the checkout gate. The cart's
   * minQty snapshots can be a day stale; the gate that runs before the payment
   * QR must use what the server will actually enforce. Throws on failure so
   * the caller fails closed.
   */
  async fetchDishMinimums(menuItemIds: string[]): Promise<Map<string, number | null>> {
    if (menuItemIds.length === 0) return new Map();
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, min_qty")
      .in("id", menuItemIds);
    if (error) throw new Error(error.message);
    return new Map((data ?? []).map((row) => [row.id as string, row.min_qty as number | null]));
  }

  /**
   * Live, uncached read of the per-service floors for the checkout gate: the
   * categories behind the given plans, each reduced to the strictest defined
   * value. A cart belongs to exactly one service (useOrderManagement keys it
   * by slug), so the reduction never mixes services. null = that floor falls
   * back to the store default. Throws on failure so the caller fails closed.
   */
  async fetchPlanCategoryMinimum(
    mealPlanIds: number[],
  ): Promise<{ minBoxes: number | null; minDishQty: number | null }> {
    if (mealPlanIds.length === 0) return { minBoxes: null, minDishQty: null };
    const { data, error } = await supabase
      .from("meal_plans")
      .select("category:categories(min_order_boxes, min_qty_per_dish)")
      .in("id", [...new Set(mealPlanIds)]);
    if (error) throw new Error(error.message);
    const cats = (data ?? []).map((row) => {
      const cat = Array.isArray(row.category) ? row.category[0] : row.category;
      return cat as { min_order_boxes: number | null; min_qty_per_dish: number | null } | null;
    });
    const strictest = (values: (number | null | undefined)[]): number | null => {
      const defined = values.filter((m): m is number => m != null);
      return defined.length ? Math.max(...defined) : null;
    };
    return {
      minBoxes: strictest(cats.map((c) => c?.min_order_boxes)),
      minDishQty: strictest(cats.map((c) => c?.min_qty_per_dish)),
    };
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
