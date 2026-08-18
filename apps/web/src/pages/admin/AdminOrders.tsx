import React, { Suspense, lazy, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import MapPlaceholder from "../../components/maps/MapPlaceholder";
import PaginationBar from "../../components/ui/PaginationBar";

// recharts is admin-only weight; the storefront bundle must not carry it.
const SalesChart = lazy(() => import("../../components/admin/SalesChart"));
import {
  ORDER_STATUSES,
  type OrderStatus,
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
  item_type: string | null;
  plan_instance_id: string | null;
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

interface OrderStats {
  total_orders: number | null;
  total_sales_cents: number | null;
  pending_orders: number | null;
  today_orders: number | null;
  archived_orders: number | null;
}

const SELECT =
  "id, order_ref, status, order_type, customer_first_name, customer_last_name, " +
  "customer_phone, delivery_address, delivery_date, total_cents, created_at, " +
  "order_items(id, item_name, qty, unit_price_cents, item_type, plan_instance_id)";

const PAGE_SIZE = 10;

type OrdersView = "active" | "archived";

/** Delivery/creation-date range, as yyyy-mm-dd Manila days ("" = unbounded). */
interface DateRange {
  from: string;
  to: string;
}

/** The day after `day`, for an exclusive upper bound. */
const nextDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Today's date in Manila as yyyy-mm-dd, regardless of the admin's timezone. */
const manilaToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Quick ranges. Computed at click time so an overnight tab can't go stale. */
const RANGE_PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Today", range: () => ({ from: manilaToday(), to: manilaToday() }) },
  {
    label: "Yesterday",
    range: () => ({ from: addDays(manilaToday(), -1), to: addDays(manilaToday(), -1) }),
  },
  { label: "Last 7 days", range: () => ({ from: addDays(manilaToday(), -6), to: manilaToday() }) },
  { label: "Last 30 days", range: () => ({ from: addDays(manilaToday(), -29), to: manilaToday() }) },
  { label: "This month", range: () => ({ from: `${manilaToday().slice(0, 7)}-01`, to: manilaToday() }) },
];

// ---------------------------------------------------------------- grouping

interface BoxGroup {
  key: string;
  planName: string;
  /** How many identical boxes collapse into this line. */
  count: number;
  /** Price of ONE box (plan line + its priced dishes). */
  perBoxCents: number;
  dishes: { name: string; qtyPerBox: number }[];
}

/**
 * Rebuild the boxes out of the flat order_items rows. A lunch-box order stores
 * one ₱ plan line plus a qty-1 dish line per slot, all sharing a
 * plan_instance_id — rendering that flat reads like 101 unrelated lines.
 * Identical boxes (same plan, same dishes) collapse into one row with a count.
 */
function groupOrderItems(items: OrderItem[]) {
  const planLines = items.filter((i) => i.item_type === "meal_plan");
  const dishLines = items.filter((i) => i.item_type !== "meal_plan");

  const dishesByBox = new Map<string, OrderItem[]>();
  const loose: OrderItem[] = [];
  for (const d of dishLines) {
    if (d.plan_instance_id) {
      const list = dishesByBox.get(d.plan_instance_id) ?? [];
      list.push(d);
      dishesByBox.set(d.plan_instance_id, list);
    } else {
      loose.push(d);
    }
  }

  const groups = new Map<string, BoxGroup>();
  for (const p of planLines) {
    const dishes = p.plan_instance_id ? (dishesByBox.get(p.plan_instance_id) ?? []) : [];
    if (p.plan_instance_id) dishesByBox.delete(p.plan_instance_id);

    // One dish name per physical serving, sorted, so "A,B" and "B,A" match.
    const servings = dishes
      .flatMap((d) => Array<string>(d.qty).fill(d.item_name))
      .sort((a, b) => a.localeCompare(b));
    const key = `${p.item_name}|${servings.join("|")}`;
    // A legacy plan line without an instance id counts qty boxes on its own.
    const boxCount = p.plan_instance_id ? 1 : p.qty;
    const perBoxCents =
      p.unit_price_cents + dishes.reduce((s, d) => s + d.unit_price_cents * d.qty, 0);

    const existing = groups.get(key);
    if (existing) {
      existing.count += boxCount;
    } else {
      const perDish = new Map<string, number>();
      for (const name of servings) perDish.set(name, (perDish.get(name) ?? 0) + 1);
      groups.set(key, {
        key,
        planName: p.item_name,
        count: boxCount,
        perBoxCents,
        dishes: [...perDish.entries()].map(([name, qtyPerBox]) => ({ name, qtyPerBox })),
      });
    }
  }
  // Dishes claiming a box with no plan line (shouldn't happen) stay visible.
  for (const rest of dishesByBox.values()) loose.push(...rest);

  // What the kitchen actually cooks: total servings of each dish.
  const tally = new Map<string, number>();
  for (const d of dishLines) tally.set(d.item_name, (tally.get(d.item_name) ?? 0) + d.qty);

  return {
    boxGroups: [...groups.values()],
    loose,
    tally: [...tally.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// ---------------------------------------------------------------- the screen

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [view, setView] = useState<OrdersView>("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });

  /**
   * Paged on the SERVER, one page per request. PostgREST caps responses at
   * max_rows (1000 here), so an unbounded select would silently truncate as the
   * store grows and the console would quietly stop showing the oldest orders.
   * `count: exact` returns the true total so the pager can size itself and the
   * footer can be honest about what is on screen.
   */
  const load = async (targetPage: number, targetView: OrdersView, targetRange: DateRange) => {
    const from = (targetPage - 1) * PAGE_SIZE;
    let query = supabase.from("orders").select(SELECT, { count: "exact" });
    query =
      targetView === "active"
        ? query.is("archived_at", null)
        : query.not("archived_at", "is", null);
    // Manila days: the +08:00 offset makes "Aug 5" mean the store's Aug 5.
    if (targetRange.from) query = query.gte("created_at", `${targetRange.from}T00:00:00+08:00`);
    if (targetRange.to) query = query.lt("created_at", `${nextDay(targetRange.to)}T00:00:00+08:00`);
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      // Embedded order_items widen the row type past a direct cast.
      setOrders((data as unknown as Order[]) ?? []);
      setTotal(count ?? 0);
    }
  };

  const loadStats = async () => {
    const { data } = await supabase.from("admin_order_stats").select("*").single();
    if (data) setStats(data as OrderStats);
  };

  useEffect(() => {
    void (async () => {
      await Promise.all([load(1, "active", { from: "", to: "" }), loadStats()]);
      setLoading(false);
    })();
    // Runs once — page/view/range changes go through their handlers.
  }, []);

  const goToPage = async (next: number) => {
    setPaging(true);
    setPage(next);
    // An expanded row belongs to the page you were on; carrying the id across
    // would leave a stale detail panel open on unrelated rows. Selection is
    // page-scoped for the same reason.
    setExpanded(null);
    setSelected(new Set());
    await load(next, view, range);
    setPaging(false);
  };

  const switchView = async (next: OrdersView) => {
    if (next === view) return;
    setPaging(true);
    setView(next);
    setPage(1);
    setExpanded(null);
    setSelected(new Set());
    await load(1, next, range);
    setPaging(false);
  };

  const applyRange = async (next: DateRange) => {
    setPaging(true);
    setRange(next);
    setPage(1);
    setExpanded(null);
    setSelected(new Set());
    await load(1, view, next);
    setPaging(false);
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const setStatus = async (order: Order, status: OrderStatus) => {
    const previous = order.status;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    if (error) {
      setError(error.message);
      // Roll the optimistic edit back rather than refetching the whole page —
      // a full reload would also discard any rows the admin paged in.
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: previous } : o)));
    } else {
      void loadStats();
    }
  };

  /** Archive (or restore) a set of orders and refresh the current page. */
  const setArchived = async (ids: string[], archive: boolean) => {
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    const { data, error } = await supabase
      .from("orders")
      .update({ archived_at: archive ? new Date().toISOString() : null })
      .in("id", ids)
      .select("id");
    if (error || !data?.length) {
      setError(error?.message ?? "Nothing was updated — you may need to sign in again.");
    } else {
      // Those rows just left this view; reload the page (clamped — archiving
      // the last row of the last page must not strand the pager past the end).
      const nextTotal = Math.max(0, total - data.length);
      const nextPage = Math.min(page, Math.max(1, Math.ceil(nextTotal / PAGE_SIZE)));
      setPage(nextPage);
      setExpanded(null);
      setSelected(new Set());
      await load(nextPage, view, range);
      void loadStats();
    }
    setBulkBusy(false);
  };

  const bulkSetStatus = async (status: OrderStatus) => {
    const ids = [...selected];
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .in("id", ids)
      .select("id");
    if (error || !data?.length) {
      setError(error?.message ?? "Nothing was updated — you may need to sign in again.");
    } else {
      const updated = new Set(data.map((r) => r.id));
      setOrders((prev) => prev.map((o) => (updated.has(o.id) ? { ...o, status } : o)));
      setSelected(new Set());
      void loadStats();
    }
    setBulkBusy(false);
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOnPageSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));
  const toggleAllOnPage = () =>
    setSelected(allOnPageSelected ? new Set() : new Set(orders.map((o) => o.id)));

  const statCards = [
    { label: "Total sales", value: stats ? peso(stats.total_sales_cents ?? 0) : "—", icon: "pi-wallet" },
    { label: "Orders", value: stats ? String(stats.total_orders ?? 0) : "—", icon: "pi-receipt" },
    { label: "Pending", value: stats ? String(stats.pending_orders ?? 0) : "—", icon: "pi-clock" },
    { label: "Today", value: stats ? String(stats.today_orders ?? 0) : "—", icon: "pi-calendar" },
  ];

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-arvo-bold text-2xl text-brand-text">Orders</h1>
          <p className="font-poppins text-sm text-brand-text/60 mt-0.5">
            Review incoming orders and update their status.
          </p>
        </div>

        {/* Active/Archived switch */}
        <div
          role="group"
          aria-label="Which orders to show"
          className="inline-flex rounded-lg border border-brand-divider bg-white p-0.5"
        >
          {(
            [
              { key: "active", label: "Active" },
              {
                key: "archived",
                label: `Archived${stats?.archived_orders ? ` (${stats.archived_orders})` : ""}`,
              },
            ] as { key: OrdersView; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => void switchView(key)}
              aria-pressed={view === key}
              className={`rounded-md px-3.5 py-1.5 font-poppins text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary ${
                view === key
                  ? "bg-brand-primary text-white font-semibold"
                  : "text-brand-text/60 hover:bg-brand-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* analytics cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map(({ label, value, icon }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-brand-divider shadow-sm px-4 py-3.5 flex items-center gap-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10">
              <i className={`pi ${icon} text-brand-primary text-sm`} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-poppins text-xs text-brand-text/50">{label}</p>
              <p className="font-arvo-bold text-lg text-brand-text tabular-nums truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sales chart — deferred so recharts stays out of the storefront bundle. */}
      <Suspense
        fallback={<div className="mb-6 h-[248px] rounded-xl border border-brand-divider bg-white animate-pulse" />}
      >
        <SalesChart />
      </Suspense>

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

      {/* Date-range filter for the list below. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Quick toggles: click to apply, click again to clear. A preset is
            "active" purely when the inputs match it, so manual edits release
            the toggle by themselves. */}
        {RANGE_PRESETS.map(({ label, range: presetRange }) => {
          const r = presetRange();
          const active = range.from === r.from && range.to === r.to;
          return (
            <button
              key={label}
              type="button"
              onClick={() => void applyRange(active ? { from: "", to: "" } : r)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1.5 font-poppins text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary ${
                active
                  ? "bg-brand-primary text-white font-semibold"
                  : "bg-white border border-brand-divider text-brand-text/60 hover:border-brand-primary/40 hover:text-brand-text"
              }`}
            >
              {label}
            </button>
          );
        })}
        <span className="mx-1 h-5 w-px bg-brand-divider" aria-hidden="true" />
        <label className="flex items-center gap-2 font-poppins text-sm text-brand-text/60">
          From
          <input
            type="date"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => void applyRange({ ...range, from: e.target.value })}
            aria-label="Show orders placed on or after this date"
            className="rounded-lg border border-brand-divider bg-white px-2.5 py-1.5 font-poppins text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </label>
        <label className="flex items-center gap-2 font-poppins text-sm text-brand-text/60">
          to
          <input
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => void applyRange({ ...range, to: e.target.value })}
            aria-label="Show orders placed on or before this date"
            className="rounded-lg border border-brand-divider bg-white px-2.5 py-1.5 font-poppins text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </label>
        {(range.from || range.to) && (
          <button
            type="button"
            onClick={() => void applyRange({ from: "", to: "" })}
            className="rounded-lg px-2.5 py-1.5 font-poppins text-sm text-brand-primary transition-colors hover:bg-brand-primary/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            Clear dates
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-brand-divider p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/20">
            <i className="pi pi-receipt text-xl text-brand-primary" aria-hidden="true" />
          </div>
          <p className="font-poppins text-brand-text/60">
            {range.from || range.to
              ? "No orders in this date range."
              : view === "archived"
                ? "No archived orders."
                : "No orders yet."}
          </p>
        </div>
      ) : (
        <>
          <div
            className={`bg-white rounded-xl shadow-sm border border-brand-divider overflow-hidden transition-opacity ${
              paging ? "opacity-60" : "opacity-100"
            }`}
            aria-busy={paging}
          >
            {/* bulk-select toolbar */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-brand-divider bg-brand-secondary/30">
              <label className="flex items-center gap-2 font-poppins text-sm text-brand-text/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  aria-label="Select every order on this page"
                  className="accent-brand-primary w-4 h-4"
                />
                Select all
              </label>

              {selected.size > 0 && (
                <>
                  <span className="font-poppins text-sm font-semibold text-brand-text tabular-nums">
                    {selected.size} selected
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <select
                      value=""
                      disabled={bulkBusy}
                      onChange={(e) => {
                        if (e.target.value) void bulkSetStatus(e.target.value as OrderStatus);
                        e.target.value = "";
                      }}
                      aria-label={`Set status for ${selected.size} selected orders`}
                      className="rounded-lg border border-brand-divider bg-white px-3 py-1.5 font-poppins text-sm text-brand-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
                    >
                      <option value="" disabled>
                        Set status…
                      </option>
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {orderStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => void setArchived([...selected], view === "active")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-1.5 font-poppins text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 disabled:opacity-60"
                    >
                      <i
                        className={`pi ${bulkBusy ? "pi-spinner pi-spin" : view === "active" ? "pi-inbox" : "pi-replay"} text-xs`}
                        aria-hidden="true"
                      />
                      {view === "active" ? "Archive" : "Restore"} {selected.size}
                    </button>
                  </div>
                </>
              )}
            </div>

            <ul className="divide-y divide-brand-divider">
              {orders.map((order) => {
                const isOpen = expanded === order.id;
                const items = order.order_items ?? [];
                return (
                  <li key={order.id} className={selected.has(order.id) ? "bg-brand-primary/5" : ""}>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.has(order.id)}
                        onChange={() => toggleSelected(order.id)}
                        aria-label={`Select order ${order.order_ref}`}
                        className="accent-brand-primary w-4 h-4 shrink-0"
                      />
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
                        onChange={(e) => setStatus(order, e.target.value as OrderStatus)}
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

                      <button
                        type="button"
                        onClick={() => void setArchived([order.id], view === "active")}
                        disabled={bulkBusy}
                        aria-label={
                          view === "active"
                            ? `Archive order ${order.order_ref}`
                            : `Restore order ${order.order_ref}`
                        }
                        title={view === "active" ? "Archive this order" : "Restore this order"}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-text/50 transition-colors hover:bg-brand-secondary hover:text-brand-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-40"
                      >
                        <i
                          className={`pi ${view === "active" ? "pi-inbox" : "pi-replay"} text-sm`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    {isOpen && (
                      <OrderDetail order={order} />
                    )}
                  </li>
                );
              })}
            </ul>
            <PaginationBar
              page={page}
              pageCount={pageCount}
              onPageChange={(p) => void goToPage(p)}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={total}
              noun="orders"
              label="Order pages"
            />
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

/** Expanded panel: contact on the left, the rebuilt boxes on the right. */
const OrderDetail: React.FC<{ order: Order }> = ({ order }) => {
  const { boxGroups, loose, tally } = groupOrderItems(order.order_items ?? []);
  return (
    <div className="px-4 pb-4 pl-9 font-poppins text-sm motion-safe:animate-page-in">
      <div className="grid sm:grid-cols-2 gap-4">
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
          <p className="text-brand-text/50 mb-1">
            {boxGroups.length > 0 ? "Lunch boxes" : "Items"}
          </p>
          <ul className="space-y-2">
            {boxGroups.map((box) => (
              <li key={box.key} className="rounded-lg border border-brand-divider bg-brand-secondary/20 px-3 py-2">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold text-brand-text">
                    {box.count}× {box.planName}
                  </span>
                  <span className="text-brand-text/60 tabular-nums shrink-0">
                    {peso(box.perBoxCents * box.count)}
                  </span>
                </div>
                {box.dishes.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {box.dishes.map((d) => (
                      <li key={d.name} className="text-brand-text/70 text-xs pl-3">
                        {d.qtyPerBox > 1 ? `${d.qtyPerBox}× ` : ""}
                        {d.name}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {loose.map((it) => (
              <li key={it.id} className="flex justify-between gap-3 text-brand-text">
                <span className="min-w-0 truncate">
                  {it.qty}× {it.item_name}
                </span>
                <span className="text-brand-text/50 tabular-nums shrink-0">
                  {peso(it.unit_price_cents)}
                </span>
              </li>
            ))}
            {boxGroups.length === 0 && loose.length === 0 && (
              <li className="text-brand-text/40">No line items</li>
            )}
          </ul>
        </div>
      </div>

      {/* Everything the kitchen cooks for this order, busiest dish first. */}
      {tally.length > 0 && (
        <div className="mt-4">
          <p className="text-brand-text/50 mb-1.5">Kitchen tally</p>
          <ul className="flex flex-wrap gap-1.5">
            {tally.map(([name, qty]) => (
              <li
                key={name}
                className="rounded-full bg-brand-secondary px-2.5 py-1 text-xs text-brand-text tabular-nums"
              >
                <strong className="font-semibold">{qty}×</strong> {name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
