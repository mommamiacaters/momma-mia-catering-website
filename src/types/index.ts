// Shared types — single source of truth for the entire application
// All component-local type duplicates should import from here

export type { MenuItem, MenuTypeData, MenuData, MenuResponse } from '../services/menuService';

export type MealPlanType = "Double The Protein" | "Balanced Diet";

export type CategoryType = "main" | "side" | "starch";

export interface MealPlanOrder {
  type: MealPlanType;
  quantity: number;
}

// Item explicitly assigned to a specific plan instance
export interface AssignedItem {
  instanceId: string;       // unique per-dish-selection
  planInstanceId: string;   // FK back to PlanInstance.id
  name: string;
  description: string;
  price: number;
  category: string;
  type: string;             // "main" | "side" | "starch"
  image: string;
}

// Stable plan instance with its own items
export interface PlanInstance {
  id: string;               // stable unique ID (e.g., "plan-1709481234567-abc")
  type: MealPlanType;
  displayOrder: number;     // user-controlled via drag reorder
  items: AssignedItem[];    // items explicitly assigned to this instance
}

export interface SelectedItemWithQuantity {
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
}

// Legacy type — kept for backward compat with old distribution logic
export interface MealPlanInstance {
  type: MealPlanType;
  instanceIndex: number;
  globalIndex: number;
  orderIndex: number;
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
    items: { name: string; type: string; image: string }[];
    subtotal: number;
    planInstances?: PlanInstance[];  // new: per-plan breakdown (backward compat)
  };
  orderRef: string;
}
