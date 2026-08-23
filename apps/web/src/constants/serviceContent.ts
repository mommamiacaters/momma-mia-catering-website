export interface ServiceContent {
  title: string;
  hasMenu: boolean;
}

const SERVICE_CONTENT_MAP: Record<string, ServiceContent> = {
  "check-a-lunch": {
    title: "Check-A-Lunch",
    hasMenu: true,
  },
  "party-trays": {
    title: "Party Trays",
    hasMenu: true,
  },
  "merienda-meals": {
    title: "Merienda Meals",
    hasMenu: true,
  },
  catering: {
    title: "Catering Services",
    hasMenu: false,
  },
  "equipment-rental": {
    title: "Equipment Rental",
    hasMenu: false,
  },
};

const NOT_FOUND: ServiceContent = {
  title: "Service Not Found",
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

