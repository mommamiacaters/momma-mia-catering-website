import React from "react";
import { NavLink, Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { PageTransition } from "../../components/ui/PageTransition";
import { logo } from "../../images";

// Orders lead: they are the time-sensitive surface. The menu changes weekly, an
// order changes by the hour.
const navItems = [
  { to: "/admin", label: "Orders", icon: "pi-receipt", end: true },
  { to: "/admin/menu", label: "Products & Menu", icon: "pi-box", end: false },
  { to: "/admin/company", label: "Company Profile", icon: "pi-building", end: false },
  { to: "/admin/settings", label: "Settings", icon: "pi-cog", end: false },
];

const AdminLayout: React.FC = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
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
          {/* Scrollable tab strip on mobile; the native bar is hidden because the
              cut-off pill already signals there is more to the right. */}
          <nav className="flex md:flex-col gap-1 p-3 overflow-x-auto md:overflow-visible md:sticky md:top-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 font-poppins text-sm whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-accent ${
                    isActive ? "bg-brand-primary text-white" : "text-white/70 hover:bg-white/10"
                  }`
                }
              >
                <i className={`pi ${item.icon}`} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
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
