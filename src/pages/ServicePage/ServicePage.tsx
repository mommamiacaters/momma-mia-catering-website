import React, { useEffect, useState } from "react";
import { RiMessengerFill } from "react-icons/ri";
import { useParams, Link } from "react-router-dom";
import Carousel from "../../components/Carousel/Carousel";
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
  // rental2,
} from "../../images";

const ServicePage: React.FC = () => {
  const { slug } = useParams();

  const getServiceContent = (serviceSlug: string) => {
    switch (serviceSlug) {
      case "check-a-lunch":
        return {
          title: "Check-A-Lunch",
          description:
            "Fresh, healthy lunch options delivered daily to your workplace or event. Our check-a-lunch service provides nutritious meals that keep you energized throughout the day.",
          images: [lunch1, lunch2, lunch3, lunch4, lunch5],
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
        };
      case "fun-boxes":
        return {
          title: "Fun Boxes",
          description:
            "Individual meal boxes packed with flavor and fun! Perfect for picnics, lunch meetings, or when you want a complete meal in a convenient package. Each box is carefully curated with fresh ingredients.",
          images: [box1, box2, box3],
        };
      case "catering":
        return {
          title: "Catering Services",
          description:
            "Full-service catering for weddings, corporate events, and special occasions. We handle everything from menu planning to setup, ensuring your event is memorable and stress-free.",
          images: [catering1, catering2, catering3, catering4],
        };
      case "equipment-rental":
        return {
          title: "Equipment Rental",
          description:
            "Professional-grade catering equipment available for rent. From chafing dishes and serving platters to tables and linens, we have everything you need to host the perfect event.",
          images: [rental1],
        };
      default:
        return {
          title: "Service Not Found",
          description: "The requested service could not be found.",
          images: [],
        };
    }
  };

  const serviceContent = getServiceContent(slug || "");

  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setIsPageLoaded(false);
    const t = setTimeout(() => setIsPageLoaded(true), 50);
    return () => clearTimeout(t);
  }, [slug]);

  // Close preview on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={`min-h-screen bg-brand-secondary transition-opacity duration-700 ease-in ${
        isPageLoaded ? "opacity-100" : "opacity-5"
      }`}
    >
      <div className="mx-auto px-[68px] pt-8 pb-16 md:pt-16 md:pb-20 lg:pt-20 lg:pb-24">
        {/* Back link */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-brand-text hover:text-brand-text"
            aria-label="Go back to main page"
          >
            <span aria-hidden="true" className="text-xl">
              ←
            </span>
            <span className="text-sm sm:text-base">Back to Home</span>
          </Link>
        </div>

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

        {/* Contact Section (full-bleed) */}
        <div className="mt-20 text-center relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-brand-primary">
          <div className="max-w-7xl mx-auto px-16 py-24">
            <h2 className="text-3xl font-bold text-brand-secondary mb-4">
              {/* Interested in {serviceContent.title}? */}
              Start Your Order
            </h2>
            <p className="text-brand-secondary mb-8 max-w-2xl mx-auto">
              Contact us today to discuss your needs and get a personalized
              quote. We're here to make your event unforgettable.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center w-56 px-8 py-3 bg-brand-secondary text-brand-text font-medium text-center transition-colors"
              >
                Contact Us
              </Link>
              <a
                href="https://m.me/61559809667297"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Message us on Facebook Messenger"
                className="inline-flex items-center justify-center gap-2 w-56 px-8 py-3 border-2 border-brand-secondary text-brand-secondary font-medium text-center hover:bg-brand-secondary hover:text-brand-text transition-colors"
              >
                <RiMessengerFill size={20} />
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
