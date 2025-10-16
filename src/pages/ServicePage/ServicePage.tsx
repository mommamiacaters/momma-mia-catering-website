import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import Carousel from "../../components/Carousel/Carousel";
import MealPlanAccordion from "../../components/Accordion/Accordion";
import ContactSection from "../../components/ContactSection/ContactSection";
import ShoppingBag from "../../components/ShoppingBag/ShoppingBag";
import CheckALunch from "../../components/CheckALunch/CheckALunch";
import {
  // check-a-lunch
  lunch1,
  lunch2,
  lunch3,
  lunch4,
  lunch5,
  // party-trays
  tray1,
  tray2,
  tray3,
  tray4,
  tray5,
  tray6,
  tray7,
  tray8,
  tray9,
  // fun-boxes
  box1,
  box2,
  box3,
  // catering
  catering1,
  catering2,
  catering3,
  catering4,
  // equipment-rental
  rental1,
} from "../../images";
import {
  menuService,
  MenuItem,
  MenuTypeData,
} from "../../services/menuService";

type MealPlanType = "Double The Protein" | "Balanced Diet";

interface MealPlanOrder {
  type: MealPlanType;
  quantity: number;
}

interface SelectedItemWithQuantity extends MenuItem {
  quantity: number;
  instanceId: string; // Unique ID for tracking each item instance
}

const ServicePage: React.FC = () => {
  const { slug } = useParams();

  // State for menu data
  const [menuData, setMenuData] = useState<MenuTypeData | null>(null);
  const [mealPlanOrders, setMealPlanOrders] = useState<MealPlanOrder[]>([]);
  const [selectedItems, setSelectedItems] = useState<
    SelectedItemWithQuantity[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const getServiceContent = (serviceSlug: string) => {
    switch (serviceSlug) {
      case "check-a-lunch":
        return {
          title: "Check-A-Lunch",
          description:
            "Fresh, healthy lunch options delivered daily to your workplace or event. Our check-a-lunch service provides nutritious meals that keep you energized throughout the day.",
          images: [lunch1, lunch2, lunch3, lunch4, lunch5],
          hasMenu: true,
        };
      case "party-trays":
        return {
          title: "Party Trays",
          description:
            "Perfect for celebrations, office gatherings, and special events. Our party trays feature an assortment of delicious appetizers, main courses, and desserts that will impress your guests.",
          images: [
            tray1,
            tray2,
            tray3,
            tray4,
            tray5,
            tray6,
            tray7,
            tray8,
            tray9,
          ],
          hasMenu: false,
        };
      case "fun-boxes":
        return {
          title: "Fun Boxes",
          description:
            "Individual meal boxes packed with flavor and fun! Perfect for picnics, lunch meetings, or when you want a complete meal in a convenient package. Each box is carefully curated with fresh ingredients.",
          images: [box1, box2, box3],
          hasMenu: true,
        };
      case "catering":
        return {
          title: "Catering Services",
          description:
            "Full-service catering for weddings, corporate events, and special occasions. We handle everything from menu planning to setup, ensuring your event is memorable and stress-free.",
          images: [catering1, catering2, catering3, catering4],
          hasMenu: false,
        };
      case "equipment-rental":
        return {
          title: "Equipment Rental",
          description:
            "Professional-grade catering equipment available for rent. From chafing dishes and serving platters to tables and linens, we have everything you need to host the perfect event.",
          images: [rental1],
          hasMenu: false,
        };
      default:
        return {
          title: "Service Not Found",
          description: "The requested service could not be found.",
          images: [],
          hasMenu: false,
        };
    }
  };
  const serviceContent = useMemo(() => getServiceContent(slug || ""), [slug]);

  // Handle meal plan selection
  const handleMealPlanSelect = (type: MealPlanType) => {
    const existingOrder = mealPlanOrders.find((order) => order.type === type);

    if (existingOrder) {
      setMealPlanOrders((prev) => prev.filter((order) => order.type !== type));

      if (mealPlanOrders.length === 1) {
        setSelectedItems([]);
      } else {
        updateSelectedItemLimits();
      }
    } else {
      // Add new meal plan order
      setMealPlanOrders((prev) => [...prev, { type, quantity: 1 }]);
    }
  };

  // Handle quantity change for meal plan
  const handleMealPlanQuantityChange = (
    type: MealPlanType,
    newQuantity: number
  ) => {
    if (newQuantity < 1) {
      // Remove the meal plan completely when quantity goes below 1
      setMealPlanOrders((prev) => prev.filter((order) => order.type !== type));

      // Check if this was the last meal plan
      const remainingPlans = mealPlanOrders.filter(
        (order) => order.type !== type
      );
      if (remainingPlans.length === 0) {
        // Clear all selected items if no meal plans remain
        setSelectedItems([]);
      } else {
        // Update selected item quantities based on remaining meal plans
        updateSelectedItemLimits();
      }
      return;
    }

    setMealPlanOrders((prev) =>
      prev.map((order) =>
        order.type === type ? { ...order, quantity: newQuantity } : order
      )
    );

    // Update selected item quantities if needed
    updateSelectedItemLimits();
  };

  // Update selected item limits based on meal plan changes
  const updateSelectedItemLimits = () => {
    const maxAllowed = getMaxAllowedItemsByType();

    // Group items by name and type to count them
    const itemCounts: Record<string, number> = {};
    selectedItems.forEach((item) => {
      const key = `${item.name}-${item.type}`;
      itemCounts[key] = (itemCounts[key] || 0) + 1;
    });

    // Remove excess items (keeping the LAST instances)
    const itemsToKeep: SelectedItemWithQuantity[] = [];
    const itemsToRemove: Set<string> = new Set();

    Object.entries(itemCounts).forEach(([key, count]) => {
      const [name, type] = key.split("-");
      const maxForType = maxAllowed[type] || 0;

      if (count > maxForType) {
        // We need to remove (count - maxForType) items
        const excessCount = count - maxForType;
        const itemsOfType = selectedItems.filter(
          (item) => item.name === name && item.type === type
        );

        // Mark the FIRST excess items for removal (this keeps the LAST ones)
        for (let i = 0; i < excessCount; i++) {
          if (itemsOfType[i]) {
            itemsToRemove.add(itemsOfType[i].instanceId);
          }
        }
      }
    });

    // Keep all items except the ones marked for removal
    setSelectedItems((prev) =>
      prev.filter((item) => !itemsToRemove.has(item.instanceId))
    );
  };

  // Get maximum allowed items by type based on current meal plans
  const getMaxAllowedItemsByType = (): Record<string, number> => {
    const limits = { main: 0, side: 0, starch: 0 };

    mealPlanOrders.forEach((order) => {
      const planLimits = getMealPlanLimits(order.type);
      limits.main += planLimits.main * order.quantity;
      limits.side += planLimits.side * order.quantity;
      limits.starch += planLimits.starch * order.quantity;
    });

    return limits;
  };

  // Handle adding items to selection - now creates individual instances
  const handleItemAdd = (item: MenuItem) => {
    if (mealPlanOrders.length === 0) return;

    const maxAllowed = getMaxAllowedItemsByType();
    const currentQuantity = getCurrentItemQuantity(item);

    if (currentQuantity >= maxAllowed[item.type]) {
      alert(
        `Maximum ${maxAllowed[item.type]} ${
          item.type
        } dish(es) allowed based on your meal plans`
      );
      return;
    }

    // Create a new instance with unique ID
    const newInstance: SelectedItemWithQuantity = {
      ...item,
      quantity: 1,
      instanceId: `${item.name}-${Date.now()}-${Math.random()}`,
    };

    setSelectedItems((prev) => [...prev, newInstance]);
  };

  const handleItemQuantityDecrease = (item: MenuItem) => {
    // Find the LAST instance of this item
    const itemInstances = selectedItems.filter(
      (selected) => selected.name === item.name
    );

    if (itemInstances.length > 0) {
      const lastInstance = itemInstances[itemInstances.length - 1];
      handleItemRemove(lastInstance);
    }
  };

  // Handle removing a specific item instance
  const handleItemRemove = (item: SelectedItemWithQuantity) => {
    setSelectedItems((prev) =>
      prev.filter((selected) => selected.instanceId !== item.instanceId)
    );
  };

  // Handle quantity change for selected items (legacy support)
  const handleItemQuantityChange = (
    item: SelectedItemWithQuantity,
    newQuantity: number
  ) => {
    // This function is kept for interface compatibility but not used
    // since we now handle items individually
  };

  // Get current quantity of an item (count instances)
  const getCurrentItemQuantity = (item: MenuItem): number => {
    return selectedItems.filter((selected) => selected.name === item.name)
      .length;
  };

  // Get meal plan limits
  const getMealPlanLimits = (type: MealPlanType): Record<string, number> => {
    switch (type) {
      case "Double The Protein":
        return { main: 2, side: 1, starch: 1 };
      case "Balanced Diet":
        return { main: 1, side: 1, starch: 1 };
    }
  };

  // Get items by category
  const getItemsByCategory = (
    category: "main" | "side" | "starch"
  ): MenuItem[] => {
    if (!menuData) return [];
    return menuData[category] || [];
  };

  // Get category display name
  const getCategoryDisplayName = (category: string): string => {
    switch (category) {
      case "main":
        return "Main Dish";
      case "side":
        return "Side Dish";
      case "starch":
        return "Starch";
      default:
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  // Check if item is selected
  const isItemSelected = (item: MenuItem): boolean => {
    return selectedItems.some((selected) => selected.name === item.name);
  };

  // Calculate total price including meal plan prices
  const calculateTotalPrice = (): number => {
    // Calculate meal plan costs
    const mealPlanCost = mealPlanOrders.reduce(
      (total, order) => total + getMealPlanPrice(order.type) * order.quantity,
      0
    );

    return mealPlanCost;
  };

  // Get total items count (count individual instances)
  const getTotalItemsCount = (): number => {
    return (
      selectedItems.length +
      mealPlanOrders.reduce((total, order) => total + order.quantity, 0)
    );
  };

  // Get total meal plan count (only meal plan instances)
  const getTotalMealPlanCount = (): number => {
    return mealPlanOrders.reduce((total, order) => total + order.quantity, 0);
  };

  // Fetch menu data when component mounts or slug changes
  useEffect(() => {
    const fetchMenuData = async () => {
      // Only fetch for services that have menu data
      if (
        !slug ||
        !serviceContent.hasMenu ||
        (slug !== "check-a-lunch" && slug !== "fun-boxes")
      ) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await menuService.getCategoryMenuData(
          slug as "check-a-lunch" | "fun-boxes"
        );
        setMenuData(data);
      } catch (err) {
        console.error("Error fetching menu data:", err);
        setError("Failed to load menu items. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchMenuData();
  }, [slug, serviceContent.hasMenu]);

  // Get meal plan price based on menu items
  const getMealPlanPrice = (type: MealPlanType): number => {
    if (!menuData) return 0;

    // Get base prices for each category (using first item as reference)
    const mainPrice =
      menuData.main && menuData.main.length > 0 ? menuData.main[0].price : 0;
    const sidePrice =
      menuData.side && menuData.side.length > 0 ? menuData.side[0].price : 0;
    const starchPrice =
      menuData.starch && menuData.starch.length > 0
        ? menuData.starch[0].price
        : 0;

    switch (type) {
      case "Double The Protein":
        // 2 Main Dishes + 1 Side Dish + 1 Starch
        return mainPrice * 2 + sidePrice + starchPrice;
      case "Balanced Diet":
        // 1 Main Dish + 1 Side Dish + 1 Starch
        return mainPrice + sidePrice + starchPrice;
    }
  };

  // Close preview on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Update selected item limits when meal plans change
  useEffect(() => {
    if (mealPlanOrders.length > 0) {
      updateSelectedItemLimits();
    }
  }, [mealPlanOrders]);

  return (
    <div className="min-h-screen bg-brand-secondary">
      <div className="mx-auto px-[68px] pt-8 pb-16 md:pt-16 md:pb-20 lg:pt-20 lg:pb-24">
        {/* Back link */}
        <Link
          to="/meals"
          className="inline-flex items-center gap-2 text-brand-text hover:text-brand-text mb-8"
          aria-label="Go back to main page"
        >
          <span aria-hidden="true" className="text-xl">
            ←
          </span>
          <span className="text-sm sm:text-base">Back to Home</span>
        </Link>

        {/* Shopping Bag and Sidebar */}
        <ShoppingBag
          isVisible={serviceContent.hasMenu}
          mealPlanOrders={mealPlanOrders}
          selectedItems={selectedItems}
          onMealPlanQuantityChange={handleMealPlanQuantityChange}
          onItemQuantityChange={handleItemQuantityChange}
          onItemRemove={handleItemRemove}
          getMealPlanPrice={getMealPlanPrice}
          getMealPlanLimits={getMealPlanLimits}
          calculateTotalPrice={calculateTotalPrice}
          getTotalItemsCount={getTotalItemsCount}
          getTotalMealPlanCount={getTotalMealPlanCount}
        />

        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-brand-text mb-6">
            {serviceContent.title}
          </h1>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-brand-text leading-relaxed">
              {serviceContent.description}
            </p>
          </div>
        </div>

        {/* Carousel Section - Full Bleed */}
        {serviceContent.images.length > 0 && (
          <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">
            <Carousel
              images={serviceContent.images}
              title={serviceContent.title}
              onPreview={setPreviewUrl}
            />
          </div>
        )}

        {/* Main Content */}
        {serviceContent.hasMenu && (
          <div className="mt-20">
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
                <p className="mt-4 text-brand-text">Loading menu items...</p>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md mx-auto">
                  <p>{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 text-sm underline hover:no-underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Preview Modal */}
            {previewUrl && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                onClick={() => setPreviewUrl(null)}
                aria-modal="true"
                role="dialog"
              >
                <div
                  className="relative max-w-[95vw] max-h-[95vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl"
                  />
                  <button
                    type="button"
                    aria-label="Close preview"
                    className="absolute -top-3 -right-3 bg-white/90 hover:bg-white text-brand-text rounded-full w-9 h-9 shadow flex items-center justify-center"
                    onClick={() => setPreviewUrl(null)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Only render for Check - A - Lunch */}
            {slug === "check-a-lunch" && (
              <CheckALunch
                mealPlanOrders={mealPlanOrders}
                selectedItems={selectedItems}
                menuData={menuData}
                loading={loading}
                error={error}
                onMealPlanSelect={handleMealPlanSelect}
                onMealPlanQuantityChange={handleMealPlanQuantityChange}
                onItemAdd={handleItemAdd}
                onItemRemove={handleItemRemove}
                onItemQuantityDecrease={handleItemQuantityDecrease}
                getMealPlanPrice={getMealPlanPrice}
                getItemsByCategory={getItemsByCategory}
                getCategoryDisplayName={getCategoryDisplayName}
                isItemSelected={isItemSelected}
                getCurrentItemQuantity={getCurrentItemQuantity}
                getMaxAllowedItemsByType={getMaxAllowedItemsByType}
              />
            )}
          </div>
        )}

        {/* Contact Section (full-bleed) */}
        <ContactSection
          title="Start Your Order"
          description="Got a custom order or want a personalized quote? Reach out to us via Facebook Messenger or our Virtual Assistant Mia. We're here to make your event unforgettable."
          messengerUrl="https://m.me/61559809667297"
        />
      </div>
    </div>
  );
};

export default ServicePage;
