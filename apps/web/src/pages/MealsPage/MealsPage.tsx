import React, { useEffect, useState } from "react";
import ServicePanel from "../../components/ServicePanel/ServicePanel";
import { iconById } from "../../constants/serviceIcons";
import { useInView } from "../../hooks/useInView";
import { useFocusedSection } from "../../hooks/useFocusedSection";
import { useServices, type Service } from "../../hooks/useServices";
import { useStoreSettings } from "../../hooks/useStoreSettings";

/**
 * Homepage.
 *
 * Above the fold: one full-height photo panel per active orderable service,
 * sized to exactly the viewport minus the header so the first screen is only
 * ever those. Below it: the quote-based services as the same panel turned
 * sideways.
 */

// Tailwind scans source for whole class names, so the column count has to be a
// lookup rather than an interpolated `md:grid-cols-${n}` (which it would never
// emit).
const COLUMNS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
};

/** True below `md`, where the panels stack and there is no hover to reveal copy. */
function useStackedLayout(): boolean {
  const query = "(min-width: 768px)";
  const [stacked, setStacked] = useState(
    () => typeof window !== "undefined" && !window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setStacked(!mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return stacked;
}

const MainServices: React.FC<{ services: Service[] }> = ({ services }) => {
  const stacked = useStackedLayout();
  // Stacked, the panels are read one after another, so the one you have
  // scrolled to is the one that explains itself. Side by side from `md` up they
  // are all equally on screen, so hover decides instead and this stays off.
  const { activeKey, register } = useFocusedSection<HTMLDivElement>(stacked);

  if (services.length === 0) return null;

  return (
    <div
      className={`grid grid-cols-1 md:h-[calc(100dvh-5rem)] md:overflow-hidden ${
        COLUMNS[services.length] ?? "md:grid-cols-3"
      }`}
    >
      {services.map((service) => (
        <ServicePanel
          key={service.slug}
          service={service}
          icon={iconById(service.icon)}
          revealed={activeKey === service.slug}
          panelRef={register(service.slug)}
          visibleKey={service.slug}
        />
      ))}
    </div>
  );
};

const OtherServices: React.FC<{ services: Service[] }> = ({ services }) => {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section ref={ref} aria-labelledby="other-services" className="bg-brand-secondary">
      <div className="px-6 pb-8 pt-14 text-center md:pt-16">
        <h2
          id="other-services"
          className="font-arvo-bold text-2xl text-brand-text md:text-3xl"
        >
          Other Services
        </h2>
        <p className="mx-auto mt-2.5 max-w-lg font-poppins text-sm text-brand-text/70 md:text-base">
          Hosting something bigger? We cater full events and rent out the gear to serve them.
        </p>
      </div>

      {/*
        Full-bleed bands, one per service. They enter on scroll rather than on
        load: the fold above is the first impression, and sliding these in as
        they arrive is what tells you the page continued. `motion-safe` carries
        the whole effect, so reduced motion simply gets them already in place.
      */}
      <div>
        {services.map((service, i) => (
          <div
            key={service.slug}
            style={{ transitionDelay: inView ? `${i * 80}ms` : "0ms" }}
            className={`motion-safe:transition-[opacity,transform] motion-safe:duration-700 [transition-timing-function:cubic-bezier(.22,1,.36,1)] ${
              inView
                ? "motion-safe:translate-y-0 motion-safe:opacity-100"
                : "motion-safe:translate-y-6 motion-safe:opacity-0"
            }`}
          >
            <ServicePanel
              service={service}
              icon={iconById(service.icon)}
              to="/other-services"
              orientation="horizontal"
              headingLevel="h3"
            />
          </div>
        ))}
      </div>
    </section>
  );
};

const MealsPage: React.FC = () => {
  const { services } = useServices();
  // Admin switch for the whole Other Services block, separate from whether an
  // individual service is active.
  const { showOtherServices } = useStoreSettings();

  const active = services.filter((s) => s.isActive);
  const main = active.filter((s) => s.kind === "orderable");
  const other = active.filter((s) => s.kind === "quote");

  return (
    <div className="bg-brand-secondary">
      <h1 className="sr-only">Momma Mia — your meals &amp; more</h1>
      <MainServices services={main} />
      {showOtherServices && other.length > 0 && <OtherServices services={other} />}
    </div>
  );
};

export default MealsPage;
