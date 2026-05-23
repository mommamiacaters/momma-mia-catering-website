// Shared admin/menu record shapes (mirror the Supabase tables).
export interface Category {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
}

export interface MenuItemRecord {
  id: string;
  category_id: number | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number | null;
  item_type: string | null;
  is_available: boolean;
  is_catering: boolean;
  sort_order: number;
}

export type AvailabilityFilter = "all" | "showing" | "hidden";
