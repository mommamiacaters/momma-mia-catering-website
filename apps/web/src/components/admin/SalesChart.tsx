import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../../lib/supabase";
import { peso } from "../../constants/orders";

interface DayRow {
  day: string; // YYYY-MM-DD (Manila)
  orders: number;
  sales: number; // pesos
}

/** Today's date in Manila as YYYY-MM-DD, regardless of the admin's timezone. */
const manilaToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

/** The last `n` Manila days ending today, oldest first. */
function lastDays(n: number): string[] {
  // Anchor at UTC noon so day arithmetic can't slip across midnight.
  const end = new Date(`${manilaToday()}T12:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

const shortDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

/** White card matching the console's tiles; text in ink, not series color. */
const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: { payload: DayRow }[];
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-brand-divider bg-white px-3 py-2 shadow-md">
      <p className="font-poppins text-xs text-brand-text/55">{shortDay(row.day)}</p>
      <p className="font-arvo-bold text-sm text-brand-text tabular-nums">
        {peso(Math.round(row.sales * 100))}
      </p>
      <p className="font-poppins text-xs text-brand-text/55 tabular-nums">
        {row.orders} {row.orders === 1 ? "order" : "orders"}
      </p>
    </div>
  );
};

/**
 * Sales for the last 30 Manila days. One series, so the title carries the
 * identity and there is no legend; the orders list below is the table view of
 * the same data. Lazy-loaded so the storefront never ships recharts.
 */
const SalesChart: React.FC = () => {
  const [rows, setRows] = useState<Map<string, { orders: number; sales: number }>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.from("admin_daily_sales").select("*");
      if (!active) return;
      setRows(
        new Map(
          (data ?? [])
            .filter((r) => r.day)
            .map((r) => [
              r.day as string,
              { orders: r.orders ?? 0, sales: (r.sales_cents ?? 0) / 100 },
            ]),
        ),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // The view only returns days that HAVE orders; quiet days become zero bars
  // so the axis is a continuous month, not a misleading compression.
  const series: DayRow[] = useMemo(
    () =>
      lastDays(30).map((day) => ({
        day,
        orders: rows.get(day)?.orders ?? 0,
        sales: rows.get(day)?.sales ?? 0,
      })),
    [rows],
  );
  const total = series.reduce((s, r) => s + r.sales, 0);

  return (
    <section
      aria-label="Sales for the last 30 days"
      className="bg-white rounded-xl border border-brand-divider shadow-sm px-4 pt-4 pb-2 mb-6"
    >
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-arvo-bold text-sm text-brand-text">Sales — last 30 days</h2>
        <p className="font-poppins text-xs text-brand-text/55 tabular-nums">
          {peso(Math.round(total * 100))} total
        </p>
      </div>

      {loading ? (
        <div className="h-[200px] animate-pulse rounded-lg bg-brand-secondary/40 mt-3" />
      ) : (
        <div className="h-[200px] mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 12, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="#D9CDBE" strokeOpacity={0.45} />
              <XAxis
                dataKey="day"
                tickFormatter={shortDay}
                interval="preserveStartEnd"
                minTickGap={48}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#2E2A25", opacity: 0.5, fontSize: 11, fontFamily: "Poppins" }}
              />
              <YAxis
                width={44}
                tickFormatter={(v: number) => (v >= 1000 ? `₱${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `₱${v}`)}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#2E2A25", opacity: 0.5, fontSize: 11, fontFamily: "Poppins" }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#E36A2E", opacity: 0.08 }} />
              <Bar dataKey="sales" fill="#E36A2E" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

export default SalesChart;
