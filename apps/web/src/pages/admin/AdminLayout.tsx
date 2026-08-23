import React, { useState } from "react";
import { NavLink, Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { PageTransition } from "../../components/ui/PageTransition";
import { iconById } from "../../constants/serviceIcons";
import { useServices } from "../../hooks/useServices";
import { logo } from "../../images";

// Orders lead: they are the time-sensitive surface. Everything else a service
// page owns — its photos, plans and dishes — now lives under that service.
const ordersItem = { to: "/admin", label: "Orders", icon: "pi-receipt", end: true };
// Plans and dishes span every service, so they are peers of Services rather
// than tabs inside one of them.
const catalogItems = [
  { to: "/admin/plans", label: "Meal Plans", icon: "pi-th-large" },
  { to: "/admin/menu", label: "Dishes", icon: "pi-box" },
];
const settingsItem = { to: "/admin/settings", label: "Settings", icon: "pi-cog", end: false };

const serviceLink = (slug: string) => `/admin/services/${slug}`;

const navChip =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 font-poppins text-sm whitespace-nowrap " +
  "transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-accent";

const chipState = (isActive: boolean) =>
  isActive ? "bg-brand-primary text-white" : "text-white/70 hover:bg-white/10";

const AdminLayout: React.FC = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { services } = useServices();
  const orderable = services.filter((s) => s.kind === "orderable");
  const quoteOnly = services.filter((s) => s.kind === "quote");

  // Three of the six menu categories (cafe-menu, add-on, rice-bowls) are sold
  // without a service page, so the group keeps a way through to the full menu.
  const inServices = pathname.startsWith("/admin/services");
  const [servicesOpen, setServicesOpen] = useState(inServices);
  const showServices = servicesOpen || inServices;

  const handleSignOut = async () => {
    // Leave the guarded route BEFORE dropping the session. Signing out first lets
    // ProtectedRoute re-render with no user and bounce to /login, which wins the
    // race against this navigate — so "Sign out" stranded you on the login page
    // instead of the storefront.
    navigate("/", { replace: true });
    await signOut();
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-secondary">
      {/*
        Shared brand bar. Deliberately the SAME element as the public nav —
        bg-brand-primary, h-16/md:h-20, logo h-14/md:h-20 — so navigating between
        the storefront and the console leaves the mark pinned in place. Only what
        sits below it changes, which is what makes the move read as one product
        rather than two apps.
      */}
      <header className="sticky top-0 z-50 bg-brand-primary shadow-lg">
        <div className="mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 md:h-20 gap-4">
            <Link to="/admin" className="flex items-center gap-3 min-w-0">
              <img
                src={logo}
                alt="Momma Mia Caters"
                className="h-14 md:h-20 w-auto object-contain flex-shrink-0"
              />
              <span className="hidden sm:flex flex-col leading-tight min-w-0">
                <span className="font-arvo-bold text-white text-base md:text-lg truncate">
                  Momma Mia
                </span>
                <span className="font-poppins text-[11px] text-white/70">Admin console</span>
              </span>
            </Link>

            <div className="flex items-center gap-2 md:gap-3">
              <span className="hidden lg:inline font-poppins text-sm text-white/75 truncate max-w-[16rem]">
                Signed in as{" "}
                <span className="font-medium text-white">
                  {profile?.full_name || user?.email}
                </span>
              </span>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 font-arvo-bold text-sm text-white transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 cursor-pointer"
              >
                <i className="pi pi-external-link text-xs" aria-hidden="true" />
                <span className="hidden sm:inline">View site</span>
              </Link>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 font-arvo-bold text-sm text-brand-primary transition-colors hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-white/70 cursor-pointer"
              >
                <i className="pi pi-sign-out text-xs" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* sidebar — horizontal strip on mobile, rail on desktop */}
        <aside className="md:w-64 md:flex-shrink-0 bg-brand-text text-white">
          {/* One tree, two orientations: a scrollable strip on mobile where the
              expanded services flow inline to the right, a rail from md up where
              the same nodes stack under their parent. */}
          <nav
            aria-label="Admin sections"
            className="flex md:flex-col gap-1 p-3 overflow-x-auto md:overflow-visible md:sticky md:top-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <NavLink
              to={ordersItem.to}
              end={ordersItem.end}
              className={({ isActive }) => `${navChip} ${chipState(isActive)}`}
            >
              <i className={`pi ${ordersItem.icon}`} aria-hidden="true" />
              {ordersItem.label}
            </NavLink>

            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              aria-expanded={showServices}
              aria-controls="admin-services-nav"
              className={`${navChip} ${
                inServices ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/10"
              }`}
            >
              <i className="pi pi-sitemap" aria-hidden="true" />
              Services
              <i
                className={`pi pi-chevron-right ml-auto text-[10px] motion-safe:transition-transform motion-safe:duration-150 ${
                  showServices ? "rotate-90" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {showServices && (
              <div
                id="admin-services-nav"
                className="flex md:flex-col gap-1 md:ml-4 md:border-l md:border-white/15 md:pl-2"
              >
                {orderable.map((s) => {
                  const Icon = iconById(s.icon);
                  return (
                    <NavLink
                      key={s.slug}
                      to={serviceLink(s.slug)}
                      className={({ isActive }) => `${navChip} ${chipState(isActive)}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {s.name}
                    </NavLink>
                  );
                })}

                <span
                  aria-hidden="true"
                  className="my-1 hidden md:block border-t border-white/10"
                />

                {quoteOnly.map((s) => {
                  const Icon = iconById(s.icon);
                  return (
                    <NavLink
                      key={s.slug}
                      to={serviceLink(s.slug)}
                      className={({ isActive }) => `${navChip} ${chipState(isActive)}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {s.name}
                    </NavLink>
                  );
                })}

              </div>
            )}

            {catalogItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${navChip} ${chipState(isActive)}`}
              >
                <i className={`pi ${item.icon}`} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}

            <NavLink
              to={settingsItem.to}
              end={settingsItem.end}
              className={({ isActive }) => `${navChip} ${chipState(isActive)}`}
            >
              <i className={`pi ${settingsItem.icon}`} aria-hidden="true" />
              {settingsItem.label}
            </NavLink>
          </nav>
        </aside>

        {/*
          Content — the only region that crossfades between admin routes.
          The max-width lives HERE, not per page, so every admin screen shares one
          measure. Pages that need to be narrower (forms) still cap themselves.
        */}
        <main className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-7xl">
            <PageTransition transitionKey={pathname}>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
