import { getServiceContent } from "./serviceContent";
import { ORDERABLE_SERVICES, OTHER_SERVICES, type HomeService } from "./services";
import { DEFAULT_SERVICE_ICON, type ServiceIconId } from "./serviceIcons";

/**
 * One row per service the admin can manage, built from the same list the
 * storefront renders so the console can never describe a service the site
 * doesn't have.
 *
 * It also owns the one mapping nothing else should re-derive: a service page's
 * slug is NOT its menu category's slug ('party-trays' is plural, its category
 * 'party-tray' is not).
 */
export interface AdminService extends HomeService {
  /** Heading on the service page. Drifts from `name` today. */
  pageTitle: string;
  icon: ServiceIconId;
  /** public.categories.slug, or null when the service sells nothing online. */
  categorySlug: string | null;
  /** Orderable services take online payment; quote services do not. */
  kind: "orderable" | "quote";
}

const CATEGORY_BY_SERVICE: Record<string, string> = {
  "check-a-lunch": "check-a-lunch",
  "party-trays": "party-tray",
  "merienda-meals": "fun-boxes",
};

const build = (service: HomeService, kind: AdminService["kind"]): AdminService => ({
  ...service,
  pageTitle: getServiceContent(service.slug).title,
  icon: DEFAULT_SERVICE_ICON[service.slug] ?? "lunch-box",
  categorySlug: CATEGORY_BY_SERVICE[service.slug] ?? null,
  kind,
});

/** The three services on the homepage — each has meal plans and dishes. */
export const ADMIN_ORDERABLE_SERVICES: AdminService[] = ORDERABLE_SERVICES.map((s) =>
  build(s, "orderable"),
);

/** Quote-only services. They have a page and a carousel, nothing to price. */
export const ADMIN_QUOTE_SERVICES: AdminService[] = OTHER_SERVICES.map((s) =>
  build(s, "quote"),
);

export const ADMIN_SERVICES: AdminService[] = [
  ...ADMIN_ORDERABLE_SERVICES,
  ...ADMIN_QUOTE_SERVICES,
];

export const findAdminService = (slug: string | undefined): AdminService | undefined =>
  ADMIN_SERVICES.find((s) => s.slug === slug);
