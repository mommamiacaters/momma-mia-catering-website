import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import SectionTabs, { type SectionTab } from "../../components/admin/SectionTabs";
import ServiceIdentityForm from "../../components/admin/ServiceIdentityForm";
import ServiceOrderRulesCard from "../../components/admin/ServiceOrderRulesCard";
import SafeImage from "../../components/ui/SafeImage";
import { iconById } from "../../constants/serviceIcons";
import { useServices } from "../../hooks/useServices";
import AdminCarousels from "./AdminCarousels";

/**
 * Everything that makes up one service page, in the order a visitor meets it:
 * the panel that sells it, the photos at the top of the page, the plans, then
 * the dishes inside those plans.
 *
 * Each tab is the existing full screen scoped to this service — same queries,
 * same saves — so nothing here can drift from the all-services views.
 */

/**
 * Which tab each service was last left on. Module scope so it outlives the
 * route unmount: leaving Check-a-Lunch's Meal plans for Orders and coming back
 * lands on Meal plans, not back at Details. Per session by design, so it never
 * goes stale against a service that changed underneath it.
 */
const lastTab = new Map<string, string>();

const AdminServiceDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { services } = useServices();
  const service = services.find((s) => s.slug === slug);

  // Keyed on the slug, not the row object: a refetch after a save hands back a
  // new object and would otherwise re-run the restore effect below and snap the
  // admin back to Details.
  const serviceSlug = service?.slug;
  const tabs = useMemo<SectionTab[]>(() => {
    if (!serviceSlug) return [];
    // Plans and dishes live in their own sidebar sections now: they span every
    // service, and editing them one service at a time hid that.
    return [
      { id: "details", label: "Details", icon: "pi-id-card" },
      { id: "photos", label: "Carousel photos", icon: "pi-images" },
    ];
  }, [serviceSlug]);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");

  const [active, setActive] = useState("details");
  // A panel stays mounted once opened, so switching tabs never throws away an
  // unsaved carousel draft.
  const [visited, setVisited] = useState<Set<string>>(() => new Set(["details"]));

  // Restore on arrival: an explicit ?tab= wins (a shared link or a refresh),
  // then whatever this service was last left on.
  useEffect(() => {
    const ids = new Set(tabs.map((t) => t.id));
    const wanted = [urlTab, slug ? lastTab.get(slug) : null].find(
      (candidate): candidate is string => !!candidate && ids.has(candidate),
    );
    const next = wanted ?? "details";
    setActive(next);
    setVisited(new Set([next]));
    // Deliberately not keyed on urlTab: this effect WRITES that param through
    // open(), so including it would re-run the restore on every click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, tabs]);

  const open = (id: string) => {
    setActive(id);
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    if (slug) lastTab.set(slug, id);
    // `replace` so flicking through tabs doesn't bury the previous admin page
    // under four history entries.
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
  };

  if (!service) {
    return (
      <div className="rounded-xl border border-brand-divider bg-white p-10 text-center">
        <p className="font-arvo-bold text-lg text-brand-text">That service doesn&rsquo;t exist</p>
        <p className="mt-1.5 font-poppins text-sm text-brand-text/60">
          Pick one from the Services list in the sidebar.
        </p>
        <Link
          to="/admin"
          className="mt-5 inline-flex min-h-[44px] items-center rounded-lg bg-brand-primary px-5 font-arvo-bold text-sm text-white hover:bg-brand-primary/90"
        >
          Back to Orders
        </Link>
      </div>
    );
  }

  const Icon = iconById(service.icon);

  return (
    <div>
      <header className="overflow-hidden rounded-xl border border-brand-divider bg-white shadow-sm">
        <div className="relative h-28 sm:h-32">
          <SafeImage src={service.image} alt="" className="h-full w-full object-cover" />
          {/* Deepest where the name sits, so white copy clears AA on any photo. */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#20140E]/90 via-[#20140E]/70 to-[#20140E]/25" />

          <div className="absolute inset-0 flex items-center gap-4 px-4 sm:px-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white ring-2 ring-white/80 sm:h-14 sm:w-14">
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-arvo-bold text-xl text-white sm:text-2xl">
                {service.name}
              </h1>
              <p className="mt-0.5 truncate font-poppins text-xs text-white/80">
                /services/{service.slug}
                {service.kind === "quote" && " · quote only, no online ordering"}
                {!service.isActive && " · hidden from the homepage"}
              </p>
            </div>

            <a
              href={`/services/${service.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-[#20140E]/70 px-4 font-arvo-bold text-sm text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-[#20140E]/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <i className="pi pi-external-link text-xs" aria-hidden="true" />
              <span className="hidden sm:inline">View page</span>
            </a>
          </div>
        </div>

        <SectionTabs
          tabs={tabs}
          value={active}
          onChange={open}
          ariaLabel={`${service.name} sections`}
        />
      </header>

      <div className="mt-6">
        {/* The panel always exists so each tab's aria-controls resolves; only
            its contents wait until the tab is first opened. */}
        {tabs.map(({ id }) => (
          <div
            key={id}
            role="tabpanel"
            id={`panel-${id}`}
            aria-labelledby={`tab-${id}`}
            hidden={id !== active}
          >
            {visited.has(id) && (
              <>
                {id === "details" && (
                  <>
                    <ServiceIdentityForm service={service} />
                    <ServiceOrderRulesCard serviceSlug={service.slug} />
                  </>
                )}
                {id === "photos" && <AdminCarousels serviceSlug={service.slug} embedded />}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminServiceDetail;
