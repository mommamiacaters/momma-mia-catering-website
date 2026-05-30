import React from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { logo } from "../../images";

const navItems = [
  { to: "/admin", label: "Products & Menu", icon: "pi-box", end: true },
  { to: "/admin/orders", label: "Orders", icon: "pi-receipt", end: false },
  { to: "/admin/company", label: "Company Profile", icon: "pi-building", end: false },
  { to: "/admin/settings", label: "Settings", icon: "pi-cog", end: false },
];

const AdminLayout: React.FC = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-brand-secondary flex flex-col md:flex-row">
      {/* sidebar */}
      <aside className="md:w-64 bg-brand-text text-white md:min-h-screen flex md:flex-col">
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <img src={logo} alt="Momma Mia" className="h-10 w-auto object-contain" />
          <div className="leading-tight">
            <p className="font-arvo-bold text-sm">Momma Mia</p>
            <p className="font-poppins text-[11px] text-white/50">Admin console</p>
          </div>
        </div>

        <nav className="flex md:flex-col gap-1 p-3 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 font-poppins text-sm transition-colors cursor-pointer ${
                  isActive ? "bg-brand-primary text-white" : "text-white/70 hover:bg-white/10"
                }`
              }
            >
              <i className={`pi ${item.icon}`} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-poppins text-sm text-white/70 hover:bg-white/10 cursor-pointer"
          >
            <i className="pi pi-external-link" aria-hidden="true" /> View site
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 font-poppins text-sm text-white/70 hover:bg-white/10 cursor-pointer"
          >
            <i className="pi pi-sign-out" aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      {/* content */}
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-brand-divider px-6 py-4 flex items-center justify-between">
          <span className="font-poppins text-sm text-brand-text/60">
            Signed in as <span className="font-medium text-brand-text">{profile?.full_name || user?.email}</span>
          </span>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
