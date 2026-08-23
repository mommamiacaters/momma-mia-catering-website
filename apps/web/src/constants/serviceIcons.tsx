import React from "react";

/**
 * The line glyphs that mark each service — on the homepage panels and in the
 * admin's icon picker. They live here rather than inside a page so both
 * surfaces draw from one catalogue and can't drift apart.
 */

export type IconProps = { className?: string };

/** Every glyph shares this geometry so a swap never changes the optical weight. */
const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Lunch box */
export const LunchIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...stroke} className={className}>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" />
    <path d="M3 13.5h18" />
    <path d="M12 13.5V20" />
  </svg>
);

/** Cloched serving tray */
export const TrayIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...stroke} className={className}>
    <path d="M4 15a8 8 0 0 1 16 0" />
    <path d="M12 7V5.8" />
    <circle cx="12" cy="4.6" r="1" />
    <path d="M2.5 15h19" />
    <path d="M6 18.5h12" />
  </svg>
);

/** Merienda cup */
export const MeriendaIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...stroke} className={className}>
    <path d="M6.2 13a5.8 5.8 0 0 1 11.6 0" />
    <circle cx="12" cy="4.8" r="1.1" />
    <path d="M5.5 13h13" />
    <path d="M7 13l1.1 7h7.8L17 13" />
    <path d="M10.6 15.5l.4 3" />
    <path d="M13.4 15.5l-.4 3" />
  </svg>
);

/** Chafing pan over a flame — full-service catering */
export const CateringIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...stroke} className={className}>
    <path d="M8.5 6.2c0 1.3-1.3 1.7-1.3 3" />
    <path d="M12 4.6c0 1.6-1.5 2.1-1.5 3.6" />
    <path d="M15.5 6.2c0 1.3-1.3 1.7-1.3 3" />
    <path d="M2.8 11.5h18.4" />
    <path d="M4.6 11.5l1.5 6.2h11.8l1.5-6.2" />
    <path d="M6.6 17.7v1.9" />
    <path d="M17.4 17.7v1.9" />
  </svg>
);

/** Fork and spoon — the gear you rent by the piece */
export const RentalIcon: React.FC<IconProps> = ({ className }) => (
  <svg {...stroke} className={className}>
    <path d="M6 3.2v4.4a2.6 2.6 0 0 0 5.2 0V3.2" />
    <path d="M8.6 3.2v7" />
    <path d="M8.6 10.2v10.6" />
    <ellipse cx="16.4" cy="6.6" rx="2.5" ry="3.4" />
    <path d="M16.4 10v10.8" />
  </svg>
);

export type ServiceIconId =
  | "lunch-box"
  | "cloche"
  | "merienda-cup"
  | "chafing-pan"
  | "utensils";

export interface ServiceIconOption {
  id: ServiceIconId;
  label: string;
  Icon: React.FC<IconProps>;
}

/** The pickable set. Adding a glyph here adds it to the admin picker. */
export const SERVICE_ICONS: ServiceIconOption[] = [
  { id: "lunch-box", label: "Lunch box", Icon: LunchIcon },
  { id: "cloche", label: "Serving tray", Icon: TrayIcon },
  { id: "merienda-cup", label: "Merienda cup", Icon: MeriendaIcon },
  { id: "chafing-pan", label: "Chafing pan", Icon: CateringIcon },
  { id: "utensils", label: "Fork and spoon", Icon: RentalIcon },
];

/** Which glyph each service page ships with today. */
export const DEFAULT_SERVICE_ICON: Record<string, ServiceIconId> = {
  "check-a-lunch": "lunch-box",
  "party-trays": "cloche",
  "merienda-meals": "merienda-cup",
  catering: "chafing-pan",
  "equipment-rental": "utensils",
};

export const iconById = (id: ServiceIconId | undefined): React.FC<IconProps> =>
  SERVICE_ICONS.find((o) => o.id === id)?.Icon ?? LunchIcon;

export const iconForService = (slug: string): React.FC<IconProps> =>
  iconById(DEFAULT_SERVICE_ICON[slug]);
