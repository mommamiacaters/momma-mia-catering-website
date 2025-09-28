import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Carousel from "../../components/Carousel/Carousel";
import MealPlanAccordion from "../../components/Accordion/Accordion";
import ShoppingBagSidebar from "../../components/Sidebar/Sidebar";
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
import ProductCatalog from "../../components/ProductCatalog/ProductCatalog";
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

  // Shopping bag state
  const [isShoppingBagOpen, setIsShoppingBagOpen] = useState(false);

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

  const serviceContent = getServiceContent(slug || "");

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

  // Fetch menu data when component mounts or slug changes
  useEffect(() => {
    const fetchMenuData = async () => {
      if (!serviceContent.hasMenu || !slug) return;

      // Only fetch for services that have menu data
      if (slug !== "check-a-lunch" && slug !== "fun-boxes") return;

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

    setSelectedItems((prev) =>
      prev
        .map((item) => ({
          ...item,
          quantity: Math.min(item.quantity, maxAllowed[item.type] || 0),
        }))
        .filter((item) => item.quantity > 0)
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

  // Handle adding items to selection
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

    setSelectedItems((prev) => {
      const existing = prev.find((selected) => selected.name === item.name);
      if (existing) {
        return prev.map((selected) =>
          selected.name === item.name
            ? { ...selected, quantity: selected.quantity + 1 }
            : selected
        );
      } else {
        return [...prev, { ...item, quantity: 1 }];
      }
    });
  };

  const handleItemQuantityDecrease = (item: MenuItem) => {
    const selectedItem = selectedItems.find(
      (selected) => selected.name === item.name
    );

    if (selectedItem) {
      if (selectedItem.quantity <= 1) {
        // Remove completely if quantity is 1 or less
        handleItemRemove(selectedItem);
      } else {
        // Decrease quantity by 1
        handleItemQuantityChange(selectedItem, selectedItem.quantity - 1);
      }
    }
  };

  // Handle removing items from selection - MODIFIED to remove only 1 instance
  const handleItemRemove = (item: SelectedItemWithQuantity) => {
    setSelectedItems((prev) => {
      const existingItem = prev.find((selected) => selected.name === item.name);
      if (!existingItem) return prev;

      if (existingItem.quantity <= 1) {
        // Remove completely if only 1 left
        return prev.filter((selected) => selected.name !== item.name);
      } else {
        // Decrease quantity by 1
        return prev.map((selected) =>
          selected.name === item.name
            ? { ...selected, quantity: selected.quantity - 1 }
            : selected
        );
      }
    });
  };

  // Handle quantity change for selected items
  const handleItemQuantityChange = (
    item: SelectedItemWithQuantity,
    newQuantity: number
  ) => {
    if (newQuantity <= 0) {
      // Remove completely when quantity is 0 or less
      setSelectedItems((prev) =>
        prev.filter((selected) => selected.name !== item.name)
      );
      return;
    }

    const maxAllowed = getMaxAllowedItemsByType();
    const finalQuantity = Math.min(newQuantity, maxAllowed[item.type] || 0);

    setSelectedItems((prev) =>
      prev.map((selected) =>
        selected.name === item.name
          ? { ...selected, quantity: finalQuantity }
          : selected
      )
    );
  };

  // Get current quantity of an item
  const getCurrentItemQuantity = (item: MenuItem): number => {
    const selectedItem = selectedItems.find(
      (selected) => selected.name === item.name
    );
    return selectedItem ? selectedItem.quantity : 0;
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

  // Get total items count (includes both meal plans and selected items)
  const getTotalItemsCount = (): number => {
    return (
      selectedItems.reduce((total, item) => total + item.quantity, 0) +
      mealPlanOrders.reduce((total, order) => total + order.quantity, 0)
    );
  };

  // Get total meal plan count (only meal plan instances)
  const getTotalMealPlanCount = (): number => {
    return mealPlanOrders.reduce((total, order) => total + order.quantity, 0);
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    updateSelectedItemLimits();
  }, [mealPlanOrders]);

  return (
    <div className="min-h-screen bg-brand-secondary">
      <div className="mx-auto px-[68px] pt-8 pb-16 md:pt-16 md:pb-20 lg:pt-20 lg:pb-24">
        {/* Back link */}
        <div className="mb-8">
          <Link
            to="/meals"
            className="inline-flex items-center gap-2 text-brand-text hover:text-brand-text"
            aria-label="Go back to main page"
          >
            <span aria-hidden="true" className="text-xl">
              ←
            </span>
            <span className="text-sm sm:text-base">Back to Home</span>
          </Link>
        </div>

        {/* Shopping Bag Button - Fixed Top Right */}
        {serviceContent.hasMenu && (
          <button
            id="bag-button"
            onClick={() => setIsShoppingBagOpen(!isShoppingBagOpen)}
            className="fixed top-6 right-6 z-40 bg-brand-primary hover:bg-brand-primary/80 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg transition-colors"
          >
            <i className="pi pi-shopping-bag"></i>
            Shopping Bag
            {getTotalMealPlanCount() > 0 && (
              <span className="bg-white text-brand-primary rounded-full px-2 py-1 text-xs font-bold min-w-[20px]">
                {getTotalMealPlanCount()}
              </span>
            )}
          </button>
        )}

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

        {serviceContent.hasMenu && (
          <ShoppingBagSidebar
            visible={isShoppingBagOpen}
            onHide={() => setIsShoppingBagOpen(false)}
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
        )}

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

            {!loading && !error && menuData && (
              <div className="max-w-6xl mx-auto">
                {/* Meal Plan Selection Buttons */}
                <div className="mb-12 text-center">
                  <h2 className="text-2xl font-semibold text-brand-text mb-6">
                    Choose Your Meal Plan
                  </h2>
                  <div className="flex flex-wrap gap-4 justify-center">
                    {(
                      ["Double The Protein", "Balanced Diet"] as MealPlanType[]
                    ).map((type) => {
                      const order = mealPlanOrders.find(
                        (order) => order.type === type
                      );

                      return (
                        <div
                          key={type}
                          className="bg-white rounded-lg p-6 shadow-lg max-w-sm"
                        >
                          <h3 className="text-xl font-semibold text-brand-text mb-2">
                            {type}
                          </h3>
                          <p className="text-gray-600 mb-2">
                            {type === "Double The Protein"
                              ? "2 Main Dishes, 1 Side Dish, 1 Starch"
                              : "1 Main Dish, 1 Side Dish, 1 Starch"}
                          </p>
                          <span className="font-bold text-brand-primary text-lg">
                            ₱{getMealPlanPrice(type)}
                          </span>
                          <div className="mt-4">
                            {order ? (
                              <div className="flex items-center gap-2 justify-center">
                                {/* Minus button - matching ProductItem style */}
                                <button
                                  onClick={() =>
                                    handleMealPlanQuantityChange(
                                      type,
                                      order.quantity - 1
                                    )
                                  }
                                  className="flex items-center justify-center w-8 h-8 bg-gray-300 hover:bg-gray-400 text-white rounded-full transition-colors"
                                  title="Decrease quantity"
                                >
                                  <i className="pi pi-minus" />
                                </button>

                                {/* Quantity input */}
                                <input
                                  type="number"
                                  value={order.quantity}
                                  onChange={(e) =>
                                    handleMealPlanQuantityChange(
                                      type,
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  className="w-12 h-8 text-center border rounded"
                                  min="1"
                                />

                                {/* Plus button - matching ProductItem style */}
                                <button
                                  onClick={() =>
                                    handleMealPlanQuantityChange(
                                      type,
                                      order.quantity + 1
                                    )
                                  }
                                  className="flex items-center justify-center w-8 h-8 bg-brand-primary hover:bg-brand-primary/80 text-white rounded-full transition-colors"
                                  title="Increase quantity"
                                >
                                  <i className="pi pi-plus"></i>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleMealPlanSelect(type)}
                                className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-lg font-medium bg-brand-primary hover:bg-brand-primary/80 text-white transition-colors"
                              >
                                <i className="pi pi-plus"></i>
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Menu Items by Category */}
                <div className="space-y-16">
                  {(["main", "side", "starch"] as const).map((category) => {
                    const items = getItemsByCategory(category);
                    if (items.length === 0) return null;

                    return (
                      <div key={category}>
                        <ProductCatalog
                          items={items}
                          selectedItems={items.filter((item) =>
                            isItemSelected(item)
                          )}
                          onItemAdd={handleItemAdd}
                          onItemRemove={handleItemRemove}
                          onItemQuantityDecrease={handleItemQuantityDecrease}
                          title={getCategoryDisplayName(category)}
                          isDisabled={mealPlanOrders.length === 0}
                          getCurrentItemQuantity={getCurrentItemQuantity}
                          getMaxAllowedItemsByType={getMaxAllowedItemsByType}
                          selectedItemsWithQuantity={selectedItems}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contact Section (full-bleed) */}
        <div className="mt-20 text-center relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-brand-primary">
          <div className="max-w-7xl mx-auto px-16 py-24">
            <h2 className="text-3xl font-bold text-brand-secondary mb-4">
              Start Your Order
            </h2>
            <p className="text-brand-secondary mb-8 max-w-2xl mx-auto">
              Got a custom order or want a personalized quote? Reach out to us
              via Facebook Messenger or our Virtual Assistant Mia. We're here to
              make your event unforgettable.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="https://m.me/61559809667297"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Message us on Facebook Messenger"
                className="inline-flex items-center justify-center gap-2 w-56 px-8 py-3 border-2 border-brand-secondary text-brand-secondary font-medium text-center hover:bg-brand-secondary hover:text-brand-text transition-colors"
              >
                <i className="pi pi-comment mr-2"></i>
                Message Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServicePage;