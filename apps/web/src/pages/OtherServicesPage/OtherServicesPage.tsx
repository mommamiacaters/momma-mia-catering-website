import React from "react";
import { Navigate } from "react-router-dom";
import MealCard from "../../components/MealCard/MealCard";
import { useServices } from "../../hooks/useServices";
import { useStoreSettings } from "../../hooks/useStoreSettings";

/**
 * Catering and Equipment Rental. Both are quote-based, so they'd sit
 * permanently unbuyable next to the three services you can actually order —
 * they get their own page instead, reached from the homepage's Other Services
 * band.
 */
const OtherServicesPage: React.FC = () => {
  const { showOtherServices, loading } = useStoreSettings();
  // From the database, not the bundled constant: the admin's edits and each
  // service's own on/off switch have to reach this page too, or deactivating
  // Catering hides its homepage band while this page still lists and links it.
  const { services } = useServices();
  const quoteServices = services.filter((s) => s.kind === "quote" && s.isActive);

  // Wait for the real answer before deciding. Redirecting while the setting is
  // still loading would bounce a visitor off a page they are allowed to see.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-secondary">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary/30 border-t-brand-primary" />
      </div>
    );
  }
  if (!showOtherServices) return <Navigate to="/" replace />;

  return (
  <div className="min-h-screen bg-brand-secondary">
    <div className="px-4 pb-16 pt-10 sm:px-6 md:px-10 md:pb-20 md:pt-14 lg:px-16 lg:pb-24 lg:pt-16">
      <div className="mb-10 text-center">
        <h1 className="mb-3 font-arvo-bold text-3xl text-brand-text md:text-4xl lg:text-5xl">
          Other Services
        </h1>
        <p className="mx-auto max-w-xl font-poppins text-sm text-brand-text/60 md:text-base">
          Hosting something bigger? We&rsquo;ll cater it — and lend you the gear
          to serve it. Message us and we&rsquo;ll quote your event.
        </p>
        <div className="mt-6 flex justify-center">
          <div className="h-0.5 w-16 rounded-full bg-brand-primary" />
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
        {quoteServices.map((service, i) => (
          <MealCard
            key={service.slug}
            post={{
              id: i,
              title: service.name,
              slug: service.slug,
              description: service.description,
              image: service.image,
              size: "large",
            }}
          />
        ))}
      </div>
    </div>
  </div>
  );
};

export default OtherServicesPage;
