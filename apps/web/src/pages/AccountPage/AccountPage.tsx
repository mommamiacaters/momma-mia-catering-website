import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import MapPlaceholder from "../../components/maps/MapPlaceholder";
import {
  itemCountLabel,
  orderDate,
  orderStatusClass,
  orderStatusLabel,
  peso,
} from "../../constants/orders";

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

const AccountPage: React.FC = () => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Admins are redirected below; skip the fetch so it never runs for them.
    if (!user || isAdmin) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_ref, status, total_cents, delivery_date, delivery_address, created_at, order_items(id, item_name, qty)",
        )
        // Filter by client_id explicitly. RLS permits `client_id = auth.uid() OR
        // is_admin()`, which is the right AUTHORIZATION rule but the wrong query:
        // without this filter an admin's "Order history" listed every customer's
        // orders as if they were their own. A policy that says "you MAY see this"
        // is not a statement that "this is YOURS".
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) console.error("Failed to load orders:", error.message);
      setOrders((data as OrderRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user, isAdmin]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "there";

  // This page is the CUSTOMER view — personal details, own orders, own delivery.
  // None of it is meaningful for staff, so admins go straight to the console
  // instead of seeing a half-relevant copy of it. Placed after every hook so the
  // hook order stays stable across renders.
  if (isAdmin) return <Navigate to="/admin" replace />;

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
                          {orderDate(order.created_at)}
                          {order.order_items?.length
                            ? ` · ${itemCountLabel(order.order_items.length)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-poppins font-medium capitalize ${orderStatusClass(
                            order.status,
                          )}`}
                        >
                          {orderStatusLabel(order.status)}
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
