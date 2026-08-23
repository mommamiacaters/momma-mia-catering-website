import React from "react";
import { Link } from "react-router-dom";
import type { HomeService } from "../../constants/services";
import { iconForService, type IconProps } from "../../constants/serviceIcons";

/**
 * A photo panel for one service: tinted image, glyph, name, and copy that opens
 * on demand.
 *
 * `vertical` is the homepage's full-height column. `horizontal` is the same
 * panel turned on its side into a full-width band, so the hairlines close in
 * from the left and right instead of the top and bottom.
 *
 * Two ways in, because touch has no hover. From `md` up it is CSS group-hover:
 * interruptible mid-transition and no re-render on a mouse move. Below `md`
 * the caller decides via `revealed` — the homepage opens whichever panel the
 * reader has scrolled to, so the copy follows them down the page instead of
 * asking to be tapped.
 */

export type PanelOrientation = "vertical" | "horizontal";

interface ServicePanelProps {
  service: HomeService;
  /** Defaults to the service's own page. */
  to?: string;
  orientation?: PanelOrientation;
  /** h3 when the panel sits under a section heading of its own. */
  headingLevel?: "h2" | "h3";
  /** Overrides the glyph the slug would pick. For the admin's icon picker. */
  icon?: React.FC<IconProps>;
  /**
   * Render as a plain block that fills its container instead of a link. The
   * admin preview needs the real panel, not a lookalike, but must not navigate.
   */
  preview?: boolean;
  /**
   * Open the copy below `md`, where there is no hover to do it. Ignored from
   * `md` up, which stays hover-driven.
   */
  revealed?: boolean;
  /** Handle for whatever decides `revealed`. */
  panelRef?: (el: HTMLDivElement | null) => void;
  /** Marks the node for the visibility observer. */
  visibleKey?: string;
}

// The hairlines, icon and copy all share the design's easing so a panel opens
// as one movement instead of three overlapping ones.
const EASE = "[transition-timing-function:cubic-bezier(.22,1,.36,1)]";

const ServicePanel: React.FC<ServicePanelProps> = ({
  service,
  to,
  orientation = "vertical",
  headingLevel: Heading = "h2",
  icon,
  preview = false,
  revealed = false,
  panelRef,
  visibleKey,
}) => {
  const Icon = icon ?? iconForService(service.slug);
  const horizontal = orientation === "horizontal";
  // A band is short and always readable, so it keeps its copy open on touch;
  // only the tall homepage columns wait to be scrolled to.
  const open = horizontal || revealed;

  // One hairline pair, drawn along whichever axis the panel runs.
  const hairline = (edge: "start" | "end") =>
    [
      "flex-1 bg-brand-primary transition-transform duration-700",
      EASE,
      horizontal
        ? `h-0.5 md:scale-x-0 md:group-hover:scale-x-100 md:group-focus-within:scale-x-100 ${
            edge === "start" ? "origin-left mr-4" : "origin-right ml-4"
          }`
        : `w-0.5 md:scale-y-0 md:group-hover:scale-y-100 md:group-focus-within:scale-y-100 ${
            edge === "start" ? "origin-top mb-4" : "origin-bottom mt-4"
          }`,
    ].join(" ");

  // Below md the chevron decides. From md up hover and focus take over, so the
  // md: rules close it again and the hover rules re-open it.
  const reveal = [
    "overflow-hidden transition-[max-height,opacity,transform] duration-700",
    EASE,
    open ? "max-h-72 opacity-100 translate-y-0" : "max-h-0 opacity-0 translate-y-3",
    "md:max-h-0 md:opacity-0 md:translate-y-3",
    "md:group-hover:max-h-72 md:group-hover:opacity-100 md:group-hover:translate-y-0",
    "md:group-focus-within:max-h-72 md:group-focus-within:opacity-100 md:group-focus-within:translate-y-0",
  ].join(" ");

  const rootClass = `group relative block overflow-hidden ${
    preview
      ? "h-full"
      : horizontal
        ? "min-h-[16rem] md:min-h-[18rem]"
        : "min-h-[38dvh] md:min-h-0"
  }`;

  const body = (
    <>
      <img
        src={service.image}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ${EASE} motion-safe:md:group-hover:scale-[1.07] motion-safe:md:group-focus-within:scale-[1.07]`}
      />
      {/* Idle panels sit at half tint so the food still reads as food; the
          hovered one darkens the rest of the way to carry body copy. Measured
          on these photos, the idle title band is ~7:1 against white. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#20140E]/55 to-[#20140E]/85 transition-opacity duration-500 md:opacity-[0.45] md:group-hover:opacity-100 md:group-focus-within:opacity-100" />

      {/* Sits above the stretched link but is transparent to the pointer, so a
          tap on the copy still follows it. Only the chevron opts back in. */}
      <div
        className={`pointer-events-none absolute inset-0 z-20 flex px-8 text-center ${
          horizontal ? "flex-row items-center" : "flex-col items-center justify-center"
        }`}
      >
        <span aria-hidden="true" className={hairline("start")} />

        <div className="flex flex-col items-center">
          <span
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white shadow-[0_6px_20px_rgba(0,0,0,.35),0_0_0_3px_rgba(255,255,255,.85)] transition-transform duration-500 ${EASE} md:group-hover:scale-110 md:group-focus-within:scale-110`}
          >
            <Icon className="h-8 w-8" />
          </span>

          <Heading className="mt-5 font-arvo text-2xl text-white [text-shadow:0_2px_14px_rgba(0,0,0,.5)] md:text-3xl">
            {service.name}
          </Heading>

          <div className={reveal}>
            <p
              className={`mx-auto mt-3.5 font-poppins text-sm leading-relaxed text-white/95 ${
                horizontal ? "max-w-md" : "max-w-xs"
              }`}
            >
              {service.description}
            </p>
          </div>

        </div>

        <span aria-hidden="true" className={hairline("end")} />
      </div>
    </>
  );

  if (preview) return <div className={rootClass}>{body}</div>;

  return (
    <div className={rootClass} ref={panelRef} data-visible-key={visibleKey}>
      {body}
      {/* A stretched link rather than a wrapper, so the chevron above can be a
          real button: interactive content cannot nest inside an anchor. */}
      <Link
        to={to ?? `/services/${service.slug}`}
        aria-label={service.name}
        className="absolute inset-0 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
      />
    </div>
  );
};

export default ServicePanel;
