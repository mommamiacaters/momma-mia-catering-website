import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import MapPlaceholder from "../../components/maps/MapPlaceholder";

interface OrderRow {
  id: string;
  order_ref: string;
  status: string;
  total_cents: number;
  delivery_date: string | null;
  delivery_address: string | null;
  created_at: string;
  order_items: { id: string; item_name: string; qty: number }[];
}

const peso = (cents: number) => `₱${(cents / 100).toFixed(2)}`;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-indigo-100 text-indigo-700",
  ready: "bg-purple-100 text-purple-700",
  assigned: "bg-cyan-100 text-cyan-700",
  picked_up: "bg-teal-100 text-teal-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const AccountPage: React.FC = () => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_ref, status, total_cents, delivery_date, delivery_address, created_at, order_items(id, item_name, qty)")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) console.error("Failed to load orders:", error.message);
      setOrders((data as OrderRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-brand-secondary">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-arvo-bold text-3xl text-brand-text">Hi, {displayName} 👋</h1>
            <p className="font-poppins text-brand-text/60 mt-1">Manage your orders and details.</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-text px-4 py-2.5 font-arvo-bold text-sm text-white hover:bg-brand-text/90 cursor-pointer"
              >
                <i className="pi pi-cog" aria-hidden="true" /> Admin
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-divider bg-white px-4 py-2.5 font-arvo-bold text-sm text-brand-text hover:bg-brand-secondary cursor-pointer"
            >
              <i className="pi pi-sign-out" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* profile + tracking */}
          <div className="space-y-6 lg:col-span-1">
            <section className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-arvo-bold text-lg text-brand-text mb-4">Your details</h2>
              <dl className="space-y-3 font-poppins text-sm">
                <div>
                  <dt className="text-brand-text/50">Name</dt>
                  <dd className="text-brand-text">{profile?.full_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-brand-text/50">Email</dt>
                  <dd className="text-brand-text break-all">{user?.email}</dd>
                </div>
                <div>
                  <dt className="text-brand-text/50">Phone</dt>
                  <dd className="text-brand-text">{profile?.phone || "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-arvo-bold text-lg text-brand-text mb-4">Delivery tracking</h2>
              <MapPlaceholder heightClass="h-56" caption="Your most recent delivery" />
            </section>
          </div>

          {/* order history */}
          <section className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-arvo-bold text-lg text-brand-text mb-4">Order history</h2>

            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/20">
                  <i className="pi pi-shopping-bag text-xl text-brand-primary" aria-hidden="true" />
                </div>
                <p className="font-poppins text-brand-text/60">No orders yet.</p>
                <Link
                  to="/meals"
                  className="mt-4 inline-block rounded-lg bg-brand-primary px-5 py-2.5 font-arvo-bold text-sm text-white hover:bg-brand-primary/90 cursor-pointer"
                >
                  Browse the menu
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-brand-divider">
                {orders.map((order) => (
                  <li key={order.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-arvo-bold text-brand-text">{order.order_ref}</p>
                        <p className="font-poppins text-xs text-brand-text/50">
                          {new Date(order.created_at).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                          {order.order_items?.length ? ` · ${order.order_items.length} item(s)` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-poppins font-medium capitalize ${
                            STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {order.status.replace("_", " ")}
                        </span>
                        <span className="font-arvo-bold text-brand-text">{peso(order.total_cents)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;
