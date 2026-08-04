import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import MapPlaceholder from "../../components/maps/MapPlaceholder";
import {
  ORDER_STATUSES,
  itemCountLabel,
  orderDate,
  orderStatusClass,
  orderStatusLabel,
  peso,
} from "../../constants/orders";

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

const SELECT =
  "id, order_ref, status, order_type, customer_first_name, customer_last_name, " +
  "customer_phone, delivery_address, delivery_date, total_cents, created_at, " +
  "order_items(id, item_name, qty, unit_price_cents)";

const PAGE_SIZE = 25;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  /**
   * Paged deliberately. PostgREST caps responses at max_rows (1000 for this
   * project), so an unbounded select would silently truncate as the store grows
   * and the console would quietly stop showing the oldest orders. `count: exact`
   * gives the real total so the footer can be honest about what is on screen.
   */
  const load = async (nextLimit: number) => {
    const { data, error, count } = await supabase
      .from("orders")
      .select(SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, nextLimit - 1);

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setOrders((data as Order[]) ?? []);
      setTotal(count ?? 0);
    }
  };

  useEffect(() => {
    void (async () => {
      const [, todayRes] = await Promise.all([
        load(PAGE_SIZE),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfToday()),
      ]);
      setTodayCount(todayRes.count ?? 0);
      setLoading(false);
    })();
    // Intentionally runs once — paging is driven by loadMore, not by re-running this.
  }, []);

  const loadMore = async () => {
    const next = limit + PAGE_SIZE;
    setLoadingMore(true);
    setLimit(next);
    await load(next);
    setLoadingMore(false);
  };

  const setStatus = async (order: Order, status: string) => {
    const previous = order.status;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    if (error) {
      setError(error.message);
      // Roll the optimistic edit back rather than refetching the whole page —
      // a full reload would also discard any rows the admin paged in.
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: previous } : o)));
    }
  };

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-arvo-bold text-2xl text-brand-text">Orders</h1>
            {todayCount !== null && todayCount > 0 && (
              <span className="rounded-full bg-brand-primary/15 px-2.5 py-1 font-poppins text-xs font-medium text-brand-primary">
                {todayCount} today
              </span>
            )}
          </div>
          <p className="font-poppins text-sm text-brand-text/60 mt-0.5">
            Review incoming orders and update their status.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700 flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer" aria-label="Dismiss">
            <i className="pi pi-times" aria-hidden="true" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-brand-divider p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/20">
            <i className="pi pi-receipt text-xl text-brand-primary" aria-hidden="true" />
          </div>
          <p className="font-poppins text-brand-text/60">No orders yet.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-brand-divider overflow-hidden">
            <ul className="divide-y divide-brand-divider">
              {orders.map((order) => {
                const isOpen = expanded === order.id;
                const items = order.order_items ?? [];
                return (
                  <li key={order.id}>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-4 py-3.5">
                      {/*
                        Full width on mobile so the order ref gets a line of its own —
                        squeezing it into a single row truncated it to "MM-2026…",
                        which is exactly the part staff need to read.
                      */}
                      <button
                        onClick={() => setExpanded(isOpen ? null : order.id)}
                        aria-expanded={isOpen}
                        className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto sm:flex-1 text-left cursor-pointer rounded focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      >
                        <i
                          className={`pi pi-chevron-${isOpen ? "down" : "right"} text-brand-text/40 text-xs transition-transform`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="font-arvo-bold text-brand-text truncate">{order.order_ref}</p>
                          <p className="font-poppins text-xs text-brand-text/50 truncate">
                            {orderDate(order.created_at)}
                            {items.length ? ` · ${itemCountLabel(items.length)}` : ""}
                            {" · "}
                            {order.customer_first_name} {order.customer_last_name}
                          </p>
                        </div>
                      </button>

                      <span className="font-arvo-bold text-brand-text tabular-nums pl-6 sm:pl-0">
                        {peso(order.total_cents)}
                      </span>

                      {/*
                        The chip IS the control. Showing a coloured badge next to a
                        separate grey dropdown said the same thing twice; styling the
                        select with the status colour keeps one affordance that both
                        reports state and changes it.
                      */}
                      <select
                        value={order.status}
                        onChange={(e) => setStatus(order, e.target.value)}
                        aria-label={`Status for order ${order.order_ref}`}
                        className={`rounded-full border-0 px-3 py-1.5 font-poppins text-xs font-medium capitalize cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 ${orderStatusClass(
                          order.status,
                        )}`}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-white text-brand-text">
                            {orderStatusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isOpen && (
                      <div className="px-4 pb-4 pl-9 grid sm:grid-cols-2 gap-4 font-poppins text-sm motion-safe:animate-page-in">
                        <div>
                          <p className="text-brand-text/50 mb-1">Contact</p>
                          <p className="text-brand-text">{order.customer_phone}</p>
                          <p className="text-brand-text/50 mt-2 mb-1">
                            {order.order_type === "pickup" ? "Pickup" : "Delivery"}
                          </p>
                          <p className="text-brand-text">{order.delivery_address || "—"}</p>
                          {order.delivery_date && (
                            <p className="text-brand-text/60 text-xs mt-0.5">{order.delivery_date}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-brand-text/50 mb-1">Items</p>
                          <ul className="space-y-0.5">
                            {items.map((it) => (
                              <li key={it.id} className="flex justify-between gap-3 text-brand-text">
                                <span className="min-w-0 truncate">
                                  {it.qty}× {it.item_name}
                                </span>
                                <span className="text-brand-text/50 tabular-nums shrink-0">
                                  {peso(it.unit_price_cents)}
                                </span>
                              </li>
                            ))}
                            {!items.length && <li className="text-brand-text/40">No line items</li>}
                          </ul>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="font-poppins text-xs text-brand-text/50">
              Showing {orders.length} of {total}
            </p>
            {orders.length < total && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-brand-divider bg-white px-4 py-2 font-arvo-bold text-sm text-brand-text transition-colors hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </>
      )}

      {/* Phase 5 slot — kept below the work so orders stay the first thing read. */}
      <div className="mt-8">
        <MapPlaceholder
          title="Dispatch map coming soon"
          subtitle="Assign riders and watch live deliveries here once driver tracking goes live."
          heightClass="h-48"
        />
      </div>
    </div>
  );
};

export default AdminOrders;
