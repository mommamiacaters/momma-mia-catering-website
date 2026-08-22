import React from "react";
import { Link } from "react-router-dom";
import { ORDERABLE_SERVICES, type HomeService } from "../../constants/services";

/**
 * Homepage: one full-height photo panel per orderable service.
 *
 * Desktop hovers a panel open; touch has no hover, so below `md` the panels
 * stack and their copy is simply always visible. The reveal is pure CSS
 * group-hover rather than React state — it stays interruptible mid-transition
 * and costs no re-render on a mouse move.
 */

type IconProps = { className?: string };

/** Lunch box */
const LunchIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" />
    <path d="M3 13.5h18" />
    <path d="M12 13.5V20" />
  </svg>
);

/** Cloched serving tray */
const TrayIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 15a8 8 0 0 1 16 0" />
    <path d="M12 7V5.8" />
    <circle cx="12" cy="4.6" r="1" />
    <path d="M2.5 15h19" />
    <path d="M6 18.5h12" />
  </svg>
);

/** Merienda cup */
const MeriendaIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M6.2 13a5.8 5.8 0 0 1 11.6 0" />
    <circle cx="12" cy="4.8" r="1.1" />
    <path d="M5.5 13h13" />
    <path d="M7 13l1.1 7h7.8L17 13" />
    <path d="M10.6 15.5l.4 3" />
    <path d="M13.4 15.5l-.4 3" />
  </svg>
);

const ICONS: Record<string, React.FC<IconProps>> = {
  "check-a-lunch": LunchIcon,
  "party-trays": TrayIcon,
  "merienda-meals": MeriendaIcon,
};

// The hairlines, icon and copy all share the design's easing so a panel opens
// as one movement instead of three overlapping ones.
const EASE = "[transition-timing-function:cubic-bezier(.22,1,.36,1)]";

// Open below md (no hover on touch), hover- or keyboard-driven from md up.
const REVEAL =
  "md:opacity-0 md:translate-y-3 md:max-h-0 " +
  "md:group-hover:opacity-100 md:group-hover:translate-y-0 md:group-hover:max-h-72 " +
  "md:group-focus-within:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:max-h-72";

const ServicePanel: React.FC<{ service: HomeService }> = ({ service }) => {
  const Icon = ICONS[service.slug] ?? LunchIcon;

  return (
    <Link
      to={`/services/${service.slug}`}
      aria-label={service.name}
      className="group relative block min-h-[38dvh] overflow-hidden md:min-h-0 focus:outline-none"
    >
      <img
        src={service.image}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ${EASE} motion-safe:md:group-hover:scale-[1.07] motion-safe:md:group-focus-within:scale-[1.07]`}
      />
      {/* Idle panels sit at half tint so the food still reads as food; the
          hovered one darkens the rest of the way to carry body copy. Measured
          on these photos, the idle title band is ~7:1 against white. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#20140E]/55 to-[#20140E]/85 transition-opacity duration-500 md:opacity-[0.45] md:group-hover:opacity-100 md:group-focus-within:opacity-100" />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <span
          aria-hidden="true"
          className={`w-0.5 flex-1 origin-top bg-brand-primary mb-4 transition-transform duration-700 ${EASE} md:scale-y-0 md:group-hover:scale-y-100 md:group-focus-within:scale-y-100`}
        />

        <span
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white shadow-[0_6px_20px_rgba(0,0,0,.35),0_0_0_3px_rgba(255,255,255,.85)] transition-transform duration-500 ${EASE} md:group-hover:scale-110 md:group-focus-within:scale-110`}
        >
          <Icon className="h-8 w-8" />
        </span>

        <h2 className="mt-5 font-arvo text-2xl text-white [text-shadow:0_2px_14px_rgba(0,0,0,.5)] md:text-3xl">
          {service.name}
        </h2>

        <div className={`overflow-hidden transition-[max-height,opacity,transform] duration-700 ${EASE} ${REVEAL}`}>
          <p className="mx-auto mt-3.5 max-w-xs font-poppins text-sm leading-relaxed text-white/95">
            {service.description}
          </p>
          {/* A span, not a link: the whole panel is already the link. */}
          <span className="mt-3.5 inline-block font-poppins text-sm font-semibold tracking-wide text-[#FFB679] transition-colors duration-300 group-hover:text-white">
            Read More&nbsp; →
          </span>
        </div>

        <span
          aria-hidden="true"
          className={`w-0.5 flex-1 origin-bottom bg-brand-primary mt-4 transition-transform duration-700 ${EASE} md:scale-y-0 md:group-hover:scale-y-100 md:group-focus-within:scale-y-100`}
        />
      </div>
    </Link>
  );
};

const MealsPage: React.FC = () => (
  <div className="bg-brand-secondary md:h-[calc(100dvh-5rem)] md:overflow-hidden">
    <h1 className="sr-only">Momma Mia — your meals &amp; more</h1>
    <div className="grid h-full grid-cols-1 md:grid-cols-3">
      {ORDERABLE_SERVICES.map((service) => (
        <ServicePanel key={service.slug} service={service} />
      ))}
    </div>
  </div>
);

export default MealsPage;
