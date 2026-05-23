import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import MapPlaceholder from "../../components/maps/MapPlaceholder";

interface OrderItem {
  id: string;
  item_name: string;
  qty: number;
  unit_price_cents: number;
}
interface Order {
  id: string;
  order_ref: string;
  status: string;
  order_type: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string;
  delivery_address: string | null;
  delivery_date: string | null;
  total_cents: number;
  created_at: string;
  order_items: OrderItem[];
}

const STATUSES = [
  "pending", "confirmed", "preparing", "ready",
  "assigned", "picked_up", "delivered", "cancelled",
];

const peso = (c: number) => `₱${(c / 100).toFixed(2)}`;

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_ref, status, order_type, customer_first_name, customer_last_name, customer_phone, delivery_address, delivery_date, total_cents, created_at, order_items(id, item_name, qty, unit_price_cents)")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const setStatus = async (order: Order, status: string) => {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    if (error) {
      setError(error.message);
      await load();
    }
  };

  return (
    <div>
      <h1 className="font-arvo-bold text-2xl text-brand-text mb-1">Orders</h1>
      <p className="font-poppins text-sm text-brand-text/60 mb-6">
        Review incoming orders and update their status.
      </p>

      {/* dispatch map placeholder (Phase 5: live driver dispatch) */}
      <div className="mb-6">
        <MapPlaceholder
          title="Dispatch map coming soon"
          subtitle="Assign riders and watch live deliveries here once driver tracking goes live."
          heightClass="h-56"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center font-poppins text-brand-text/60">
          No orders yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-brand-divider overflow-hidden">
          <ul className="divide-y divide-brand-divider">
            {orders.map((order) => {
              const isOpen = expanded === order.id;
              return (
                <li key={order.id}>
                  <div className="flex flex-wrap items-center gap-4 px-4 py-3">
                    <button
                      onClick={() => setExpanded(isOpen ? null : order.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <i className={`pi pi-chevron-${isOpen ? "down" : "right"} text-brand-text/40 text-xs`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-arvo-bold text-brand-text truncate">{order.order_ref}</p>
                        <p className="font-poppins text-xs text-brand-text/50 truncate">
                          {order.customer_first_name} {order.customer_last_name} ·{" "}
                          {new Date(order.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </button>
                    <span className="font-arvo-bold text-brand-text">{peso(order.total_cents)}</span>
                    <select
                      value={order.status}
                      onChange={(e) => setStatus(order, e.target.value)}
                      className="rounded-lg border border-brand-divider bg-white px-2.5 py-1.5 font-poppins text-xs text-brand-text capitalize focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 pl-9 grid sm:grid-cols-2 gap-4 font-poppins text-sm">
                      <div>
                        <p className="text-brand-text/50 mb-1">Contact</p>
                        <p className="text-brand-text">{order.customer_phone}</p>
                        <p className="text-brand-text/50 mt-2 mb-1">Delivery</p>
                        <p className="text-brand-text">{order.delivery_address || "—"}</p>
                        {order.delivery_date && (
                          <p className="text-brand-text/60 text-xs mt-0.5">{order.delivery_date}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-brand-text/50 mb-1">Items</p>
                        <ul className="space-y-0.5">
                          {order.order_items?.map((it) => (
                            <li key={it.id} className="flex justify-between text-brand-text">
                              <span>{it.qty}× {it.item_name}</span>
                              <span className="text-brand-text/50">{peso(it.unit_price_cents)}</span>
                            </li>
                          ))}
                          {!order.order_items?.length && <li className="text-brand-text/40">No line items</li>}
                        </ul>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
