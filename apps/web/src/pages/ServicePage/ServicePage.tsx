import React, { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Carousel from "../../components/Carousel/Carousel";
import ContactSection from "../../components/ContactSection/ContactSection";
import ShoppingBag from "../../components/ShoppingBag/ShoppingBag";
import CheckALunch from "../../components/CheckALunch/CheckALunch";
import {
  getServiceContent,
  ORDERABLE_SERVICE_SLUGS,
  CAROUSEL_SERVICES,
} from "../../constants/serviceContent";
import { getCategoryDisplayName, SOCIAL_LINKS } from "../../constants";
import { useOrderManagement } from "../../hooks/useOrderManagement";
import { useCarouselImages } from "../../hooks/useCarouselImages";
import { useServices } from "../../hooks/useServices";

const ServicePage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const serviceContent = useMemo(() => getServiceContent(slug || ""), [slug]);
  // The heading the admin edits. Falls back to the bundled copy so a failed
  // fetch still renders a title rather than an empty <h1>.
  const { services } = useServices();
  const pageTitle =
    services.find((s) => s.slug === slug)?.pageTitle || serviceContent.title;
  const order = useOrderManagement(slug, serviceContent.hasMenu);
  const { slides: dbSlides, loading: carouselLoading } = useCarouselImages(slug || "");

  // The carousel is exactly what the admin uploaded — nothing else. There is no
  // bundled set behind it any more: a stale sample photo standing in for the
  // real menu (and flashing before the real one loaded) was worse than showing
  // no carousel at all.
  const carouselImages = useMemo(
    () => dbSlides.map((s) => s.src),
    [dbSlides]
  );
  const carouselAlts = useMemo(
    () => (dbSlides.length > 0 ? dbSlides.map((s) => s.alt) : undefined),
    [dbSlides]
  );

  const handleCheckout = () => {
    navigate("/checkout", {
      state: {
        slug,
        mealPlanOrders: order.mealPlanOrders,
        selectedItems: order.selectedItems,
        planInstances: order.planInstances,
        subtotal: order.calculateTotalPrice(),
      },
    });
  };

  return (
    <div className="min-h-screen bg-brand-secondary overflow-x-clip">
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

        {/* Shopping Bag and Sidebar — pointless on a page with nothing to order */}
        <ShoppingBag
          isVisible={serviceContent.hasMenu && order.plans.length > 0}
          categoryMinBoxes={order.plans[0]?.categoryMinBoxes ?? null}
          planInstances={order.planInstances}
          activePlanInstanceId={order.activePlanInstanceId}
          onSetActivePlan={order.setActivePlanInstanceId}
          onRemovePlanInstance={order.removePlanInstance}
          onReorderPlanInstances={order.reorderPlanInstances}
          onAssignedItemRemove={order.handleAssignedItemRemove}
          getMealPlanPrice={order.getMealPlanPrice}
          getMealPlanLimits={order.getMealPlanLimits}
          calculateTotalPrice={order.calculateTotalPrice}
          getTotalMealPlanCount={order.getTotalMealPlanCount}
          onMoveItem={order.moveItemBetweenPlans}
          onCheckout={handleCheckout}
        />

        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-brand-text mb-4">
            {pageTitle}
          </h1>
        </div>

        {/* Skeleton filmstrip while the photo ROWS are still on the wire.
            Same geometry as the real strip, so the page reserves the space
            up front instead of rendering nothing and then jumping. */}
        {carouselLoading && carouselImages.length === 0 && (
          <div
            className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen"
            aria-hidden="true"
          >
            <div className="flex justify-center gap-3 sm:gap-4 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="shrink-0 w-[86vw] sm:w-[74vw] md:w-[62vw] lg:w-[56rem] aspect-[3/2] max-h-[560px] rounded-xl sm:rounded-2xl bg-brand-divider/30 animate-pulse"
                />
              ))}
            </div>
          </div>
        )}

        {/* A known service page with no menu and no photos yet must say so
            rather than sit empty. No button of its own: the Start Your Order
            section right below already carries the Message Us action. */}
        {!carouselLoading &&
          carouselImages.length === 0 &&
          !serviceContent.hasMenu &&
          CAROUSEL_SERVICES.some((s) => s.slug === slug) && (
            <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-brand-divider bg-white/60 px-6 py-14 text-center">
              <p className="font-arvo font-bold text-brand-text text-xl mb-2">
                We&rsquo;re still setting this page up
              </p>
              <p className="font-poppins text-sm text-brand-text/60 leading-relaxed">
                Photos and details for {serviceContent.title} are on their way.
                In the meantime, send us a message below and we&rsquo;ll gladly
                walk you through what&rsquo;s available.
              </p>
            </div>
          )}

        {/* Carousel Section - Full Bleed at every size. The strip fills the
            viewport edge to edge with repeating photos; each slide carries its
            own rounding now, so the old lg box constraint is gone. */}
        {carouselImages.length > 0 && (
          <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">
            {/* Keyed on the image set: swapping in DB photos remounts the
                carousel so its internal slide index cannot point past the end. */}
            <Carousel
              key={carouselImages.join("|")}
              images={carouselImages}
              alts={carouselAlts}
              title={pageTitle}
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

            {/* Any food service with plans gets the builder; one that has no
                plans yet (Party Trays until the admin creates some) says so
                instead of rendering an empty picker. */}
            {(ORDERABLE_SERVICE_SLUGS as readonly string[]).includes(slug ?? "") &&
              !order.loading &&
              !order.error &&
              order.plans.length === 0 && (
                <div className="text-center py-12">
                  <div className="mx-auto max-w-md rounded-2xl border border-brand-divider bg-white px-6 py-10 shadow-sm">
                    <p className="font-arvo font-bold text-brand-text text-lg mb-2">
                      Online ordering is coming soon
                    </p>
                    <p className="font-poppins text-sm text-brand-text/60 leading-relaxed">
                      We&rsquo;re still plating up this menu. Message us below for a
                      quote in the meantime — we&rsquo;d love to feed your crowd.
                    </p>
                  </div>
                </div>
              )}

            {(ORDERABLE_SERVICE_SLUGS as readonly string[]).includes(slug ?? "") &&
              order.plans.length > 0 && (
              <CheckALunch
                mealPlanOrders={order.mealPlanOrders}
                selectedItems={order.selectedItems}
                planInstances={order.planInstances}
                activePlanInstanceId={order.activePlanInstanceId}
                onSetActivePlan={order.setActivePlanInstanceId}
                menuData={order.menuData}
                plans={order.plans}
                loading={order.loading}
                error={order.error}
                onMealPlanSelect={order.handleMealPlanSelect}
                onMealPlanQuantityChange={order.handleMealPlanQuantityChange}
                onItemRemove={order.handleItemRemove}
                onItemAddMany={order.handleItemAddMany}
                onItemRemoveMany={order.handleItemRemoveMany}
                clearCourse={order.clearCourse}
                getMealPlanPrice={order.getMealPlanPrice}
                getMealPlanLimits={order.getMealPlanLimits}
                getItemsByCategory={order.getItemsByCategory}
                getCategoryDisplayName={getCategoryDisplayName}
                getMaxAllowedItemsByType={order.getMaxAllowedItemsByType}
                getActivePlanMaxAllowed={order.getActivePlanMaxAllowed}
                getActivePlanSelectedCount={order.getActivePlanSelectedCount}
                onMoveItem={order.moveItemBetweenPlans}
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
