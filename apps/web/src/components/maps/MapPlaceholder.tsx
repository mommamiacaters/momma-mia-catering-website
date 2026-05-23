import React from "react";

interface MapPlaceholderProps {
  title?: string;
  subtitle?: string;
  /** Tailwind height class, e.g. "h-64" | "h-96". */
  heightClass?: string;
  /** Optional caption shown in a chip, e.g. a delivery address. */
  caption?: string;
}

/**
 * Branded placeholder for the live-map feature (Phase 5). Renders an intentional,
 * on-brand "map" surface with a pulsing pin so the layout is real now and the
 * actual Mapbox/Google map can drop straight into this slot later.
 */
const MapPlaceholder: React.FC<MapPlaceholderProps> = ({
  title = "Live map coming soon",
  subtitle = "Track your rider in real time once delivery tracking goes live.",
  heightClass = "h-72",
  caption,
}) => {
  return (
    <div
      className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-brand-divider bg-brand-secondary`}
      role="img"
      aria-label={title}
    >
      {/* faux street grid */}
      <svg
        className="absolute inset-0 w-full h-full text-brand-text/10"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id="mm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mm-grid)" />
        {/* a couple of diagonal "main roads" */}
        <line x1="0" y1="20%" x2="100%" y2="55%" stroke="currentColor" strokeWidth="6" />
        <line x1="15%" y1="100%" x2="70%" y2="0" stroke="currentColor" strokeWidth="4" />
      </svg>

      {/* soft warm wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/10 to-brand-primary/5" />

      {/* center pin + label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        <span className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand-primary/30 motion-safe:animate-ping" />
          <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary shadow-md">
            <i className="pi pi-map-marker text-white text-lg" aria-hidden="true" />
          </span>
        </span>
        <h3 className="mt-4 font-arvo-bold text-brand-text text-lg">{title}</h3>
        <p className="mt-1 max-w-sm font-poppins text-sm text-brand-text/60">{subtitle}</p>
        {caption && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-poppins text-brand-text/70 shadow-sm">
            <i className="pi pi-home text-brand-primary" aria-hidden="true" />
            {caption}
          </span>
        )}
      </div>
    </div>
  );
};

export default MapPlaceholder;
