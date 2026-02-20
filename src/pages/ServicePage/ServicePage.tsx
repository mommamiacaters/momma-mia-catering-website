import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import Carousel from "../../components/Carousel/Carousel";
import ContactSection from "../../components/ContactSection/ContactSection";
import ShoppingBag from "../../components/ShoppingBag/ShoppingBag";
import CheckALunch from "../../components/CheckALunch/CheckALunch";
import { getServiceContent } from "../../constants/serviceContent";
import { getCategoryDisplayName, SOCIAL_LINKS } from "../../constants";
import { useOrderManagement } from "../../hooks/useOrderManagement";

const ServicePage: React.FC = () => {
  const { slug } = useParams();
  const serviceContent = useMemo(() => getServiceContent(slug || ""), [slug]);
  const order = useOrderManagement(slug, serviceContent.hasMenu);

  return (
    <div className="min-h-screen bg-brand-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-6 pb-12 md:pt-10 md:pb-16 lg:pt-12 lg:pb-20">
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
          mealPlanOrders={order.mealPlanOrders}
          selectedItems={order.selectedItems}
          onMealPlanQuantityChange={order.handleMealPlanQuantityChange}
          onItemRemove={order.handleItemRemove}
          getMealPlanPrice={order.getMealPlanPrice}
          getMealPlanLimits={order.getMealPlanLimits}
          calculateTotalPrice={order.calculateTotalPrice}
          getTotalItemsCount={order.getTotalItemsCount}
          getTotalMealPlanCount={order.getTotalMealPlanCount}
        />

        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-brand-text mb-4">
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
            />
          </div>
        )}

        {/* Main Content */}
        {serviceContent.hasMenu && (
          <div className="mt-20">
            {order.loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
                <p className="mt-4 text-brand-text">Loading menu items...</p>
              </div>
            )}

            {order.error && (
              <div className="text-center py-12">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md mx-auto">
                  <p>{order.error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 text-sm underline hover:no-underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Only render for Check - A - Lunch */}
            {slug === "check-a-lunch" && (
              <CheckALunch
                mealPlanOrders={order.mealPlanOrders}
                selectedItems={order.selectedItems}
                menuData={order.menuData}
                loading={order.loading}
                error={order.error}
                onMealPlanSelect={order.handleMealPlanSelect}
                onMealPlanQuantityChange={order.handleMealPlanQuantityChange}
                onItemAdd={order.handleItemAdd}
                onItemRemove={order.handleItemRemove}
                onItemQuantityDecrease={order.handleItemQuantityDecrease}
                getMealPlanPrice={order.getMealPlanPrice}
                getItemsByCategory={order.getItemsByCategory}
                getCategoryDisplayName={getCategoryDisplayName}
                isItemSelected={order.isItemSelected}
                getCurrentItemQuantity={order.getCurrentItemQuantity}
                getMaxAllowedItemsByType={order.getMaxAllowedItemsByType}
              />
            )}
          </div>
        )}

        {/* Contact Section (full-bleed) */}
        <ContactSection
          title="Start Your Order"
          description="Got a custom order or want a personalized quote? Reach out to us via Facebook Messenger or our Virtual Assistant Mia. We're here to make your event unforgettable."
          messengerUrl={SOCIAL_LINKS.messenger}
        />
      </div>
    </div>
  );
};

export default ServicePage;
