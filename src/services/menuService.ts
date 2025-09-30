// services/menuService.ts
export interface MenuItem {
  name: string;
  description: string;
  price: number; // Changed from string to number to match your response
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

class MenuService {
  private baseUrl: string;
  private cache: { data: MenuData | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor(
    baseUrl = `${
      process.env.REACT_APP_N8N_BASE_URL || process.env.REACT_APP_N8N_LOCAL
    }/webhook/menu`
  ) {
    this.baseUrl = baseUrl;
  }

  private isDataFresh(): boolean {
    return Date.now() - this.cache.timestamp < this.cacheDuration;
  }

  async getAllMenuData(forceRefresh = false): Promise<MenuData> {
    if (!forceRefresh && this.cache.data && this.isDataFresh()) {
      return this.cache.data;
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: MenuResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to fetch menu data");
      }

      // Cache the result
      this.cache.data = result.data as MenuData;
      this.cache.timestamp = Date.now();

      return this.cache.data;
    } catch (error) {
      console.error("Failed to fetch menu data:", error);

      // Return cached data if available, otherwise fallback data
      if (this.cache.data) {
        return this.cache.data;
      }

      // Fallback to empty data structure
      return {
        "check-a-lunch": { main: [], side: [], starch: [] },
        "fun-boxes": { main: [], side: [], starch: [] },
      };
    }
  }

  async getCategoryMenuData(
    category: "check-a-lunch" | "fun-boxes"
  ): Promise<MenuTypeData> {
    try {
      const response = await fetch(`${this.baseUrl}?category=${category}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: MenuResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to fetch category data");
      }

      return result.data as MenuTypeData;
    } catch (error) {
      console.error(`Failed to fetch ${category} data:`, error);

      // Fallback to getting all data and filtering
      const allData = await this.getAllMenuData();
      return allData[category] || { main: [], side: [], starch: [] };
    }
  }

  async getTypeMenuData(
    type: "main" | "side" | "starch"
  ): Promise<{ "check-a-lunch": MenuItem[]; "fun-boxes": MenuItem[] }> {
    try {
      const response = await fetch(`${this.baseUrl}?type=${type}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: MenuResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to fetch type data");
      }

      return result.data as {
        "check-a-lunch": MenuItem[];
        "fun-boxes": MenuItem[];
      };
    } catch (error) {
      console.error(`Failed to fetch ${type} data:`, error);

      // Fallback to getting all data and filtering
      const allData = await this.getAllMenuData();
      return {
        "check-a-lunch": allData["check-a-lunch"][type] || [],
        "fun-boxes": allData["fun-boxes"][type] || [],
      };
    }
  }

  async getCategoryTypeMenuData(
    category: "check-a-lunch" | "fun-boxes",
    type: "main" | "side" | "starch"
  ): Promise<MenuItem[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}?category=${category}&type=${type}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: MenuResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to fetch category type data");
      }

      return result.data as MenuItem[];
    } catch (error) {
      console.error(`Failed to fetch ${category} ${type} data:`, error);

      // Fallback to getting all data and filtering
      const allData = await this.getAllMenuData();
      return allData[category]?.[type] || [];
    }
  }

  // Helper method to get all items of a specific type across all categories
  async getAllItemsByType(
    type: "main" | "side" | "starch"
  ): Promise<MenuItem[]> {
    const allData = await this.getAllMenuData();
    const items: MenuItem[] = [];

    // Collect items from both categories
    items.push(...(allData["check-a-lunch"][type] || []));
    items.push(...(allData["fun-boxes"][type] || []));

    return items;
  }

  // Helper method to get all items of a specific category as a flat array
  async getAllItemsByCategory(
    category: "check-a-lunch" | "fun-boxes"
  ): Promise<MenuItem[]> {
    const categoryData = await this.getCategoryMenuData(category);
    const items: MenuItem[] = [];

    // Collect items from all types
    items.push(...categoryData.main);
    items.push(...categoryData.side);
    items.push(...categoryData.starch);

    return items;
  }

  // Helper method to get all menu items as a flat array
  async getAllItems(): Promise<MenuItem[]> {
    const allData = await this.getAllMenuData();
    const items: MenuItem[] = [];

    // Collect all items from all categories and types
    for (const categoryKey in allData) {
      const category = allData[categoryKey as keyof MenuData];
      for (const typeKey in category) {
        items.push(...category[typeKey as keyof MenuTypeData]);
      }
    }

    return items;
  }

  async refreshMenuData(): Promise<void> {
    try {
      await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "refresh" }),
      });

      // Clear cache to force fresh data on next request
      this.cache.data = null;
      this.cache.timestamp = 0;
    } catch (error) {
      console.error("Failed to refresh menu data:", error);
    }
  }

  // Clear cache manually if needed
  clearCache(): void {
    this.cache.data = null;
    this.cache.timestamp = 0;
  }

  // Utility method to format price for display
  formatPrice(price: number): string {
    return `₱${price.toFixed(2)}`;
  }
}

// Create singleton instance
export const menuService = new MenuService();

// Export for use in React components
export default MenuService;
