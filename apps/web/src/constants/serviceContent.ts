export interface ServiceContent {
  title: string;
  description: string;
  hasMenu: boolean;
}

const SERVICE_CONTENT_MAP: Record<string, ServiceContent> = {
  "check-a-lunch": {
    title: "Check-A-Lunch",
    description:
      "Fresh, healthy lunch options delivered daily to your workplace or event. Our check-a-lunch service provides nutritious meals that keep you energized throughout the day.",
    hasMenu: true,
  },
  "party-trays": {
    title: "Party Trays",
    description:
      "Perfect for celebrations, office gatherings, and special events. Our party trays feature an assortment of delicious appetizers, main courses, and desserts that will impress your guests.",
    hasMenu: true,
  },
  "merienda-meals": {
    title: "Merienda Meals",
    description:
      "Individual merienda boxes packed with flavor! Perfect for picnics, meetings, or afternoon gatherings — a satisfying bite in a convenient package. Each box is carefully curated with fresh ingredients.",
    hasMenu: true,
  },
  catering: {
    title: "Catering Services",
    description:
      "Full-service catering for weddings, corporate events, and special occasions. We handle everything from menu planning to setup, ensuring your event is memorable and stress-free.",
    hasMenu: false,
  },
  "equipment-rental": {
    title: "Equipment Rental",
    description:
      "Professional-grade catering equipment available for rent. From chafing dishes and serving platters to tables and linens, we have everything you need to host the perfect event.",
    hasMenu: false,
  },
};

const NOT_FOUND: ServiceContent = {
  title: "Service Not Found",
  description: "The requested service could not be found.",
  hasMenu: false,
};

/**
 * The service pages where customers order and pay online through the box
 * builder. Catering and equipment rental stay quote-based.
 */
export const ORDERABLE_SERVICE_SLUGS = [
  "check-a-lunch",
  "party-trays",
  "merienda-meals",
] as const;

export function getServiceContent(slug: string): ServiceContent {
  return SERVICE_CONTENT_MAP[slug] ?? NOT_FOUND;
}

/** The service pages that have a carousel — drives the admin's page picker. */
export const CAROUSEL_SERVICES: { slug: string; title: string }[] = Object.entries(
  SERVICE_CONTENT_MAP,
).map(([slug, content]) => ({ slug, title: content.title }));

