import React from "react";
import MealCard from "../../components/MealCard/MealCard";
import { OTHER_SERVICES } from "../../constants/services";

/**
 * Catering and Equipment Rental. Both are quote-based, so they'd sit
 * permanently unbuyable next to the three services you can actually order —
 * they get their own page instead, reachable from the nav.
 */
const OtherServicesPage: React.FC = () => (
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
        {OTHER_SERVICES.map((post) => (
          <MealCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  </div>
);

export default OtherServicesPage;
