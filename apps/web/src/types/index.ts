// Shared types — single source of truth for the entire application
// All component-local type duplicates should import from here

export type { MenuItem, MenuTypeData, MenuData, MenuResponse } from '../services/menuService';

// ─── Checkout Flow ───
export type CheckoutStep = "delivery" | "payment" | "confirmation";

export interface PaymentProof {
  base64: string;     // data URI
  mimeType: string;
  fileName: string;
  fileSize: number;
}

/** A slot in a meal plan. Mirrors sub_categories.slot in the database. */
export type PlanSlot = "main" | "side" | "rice" | "rice_bowl" | "dessert";

/**
 * How a bulk add distributes across boxes.
 * "even" gives every box one before any box gets two; "sequential" finishes a
 * box before moving on.
 */
export type DishFillMode = "even" | "sequential";

/** Item categories are plan slots now. Alias kept so callers need no rename. */
export type CategoryType = PlanSlot;

/** Plan display name. Identity is the numeric mealPlanId, not this string. */
export type MealPlanType = string;

export interface MealPlanOrder {
  /** meal_plans.id — what create_order prices against. */
  mealPlanId: number;
  type: MealPlanType;
  quantity: number;
}

// Item explicitly assigned to a specific plan instance
export interface AssignedItem {
  instanceId: string;       // unique per-dish-selection
  planInstanceId: string;   // FK back to PlanInstance.id
  menuItemId: string;       // menu_items.id (UUID) — for server-side pricing via create_order
  name: string;
  description: string;
  price: number;
  category: string;
  type: string;             // "main" | "side" | "starch"
  image: string;
  /** menu_items.min_qty snapshot: null/absent = store default, 0 = no minimum. */
  minQty?: number | null;
}

// Stable plan instance with its own items
export interface PlanInstance {
  id: string;               // stable unique ID (e.g., "plan-1709481234567-abc")
  mealPlanId: number;       // meal_plans.id — server identity, drives pricing
  type: MealPlanType;       // plan name, for display and grouping
  displayOrder: number;     // user-controlled via drag reorder
  items: AssignedItem[];    // items explicitly assigned to this instance
}

export interface SelectedItemWithQuantity {
  menuItemId: string;       // menu_items.id — what create_order prices against
  name: string;
  description: string;
  price: number;
  category: string;
  type: string;
  image: string;
  quantity: number;
  instanceId: string;
  planInstanceId?: string;  // FK back to PlanInstance.id
}

export interface MealPost {
  id: number;
  title: string;
  slug: string;
  description: string;
  image: string;
  size: "small" | "medium" | "large";
  /** Customers can order and pay online here (vs quote-based services). */
  orderable?: boolean;
}


export interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddress: string;
  specialRequests: string;
}

export interface OrderSubmission {
  customer: CheckoutFormData;
  order: {
    mealPlans: MealPlanOrder[];
    items: { menuItemId?: string; name: string; type: string; image: string }[];
    subtotal: number;
    planInstances?: PlanInstance[];
  };
  orderRef: string;
  // QR screenshot flow — omitted when Maya Checkout API is used
  paymentProof?: { base64: string; mimeType: string; fileName: string };
}
