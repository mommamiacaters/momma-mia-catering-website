// Shared types — single source of truth for the entire application
// All component-local type duplicates should import from here

export type { MenuItem, MenuTypeData, MenuData, MenuResponse } from '../services/menuService';

export type MealPlanType = "Double The Protein" | "Balanced Diet";

export type CategoryType = "main" | "side" | "starch";

export interface MealPlanOrder {
  type: MealPlanType;
  quantity: number;
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
}

export interface MealPost {
  id: number;
  title: string;
  slug: string;
  description: string;
  image: string;
  size: "small" | "medium" | "large";
}

export interface MealPlanInstance {
  type: MealPlanType;
  instanceIndex: number;
  globalIndex: number;
  orderIndex: number;
}
