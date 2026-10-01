"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Download, Info, ShoppingBag } from "lucide-react";
import { clsx } from "clsx";
import { api, formatValue } from "@/lib/format";
import { STORE_KEY, STORE_SWITCH_EVENT } from "@/components/StoreOverview";
import type { Granularity, ProfitLines, ProfitReport as Report } from "@/lib/profit";

type StoreOption = { id: string; label: string; shopDomain: string; currency: string | null; timezone: string };

const PRESETS = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  thisMonth: "This month",
  lastMonth: "Last month",
  last12m: "Last 12 months",
  thisYear: "This year",
  custom: "Custom",
} as const;
type Preset = keyof typeof PRESETS;

/** Today's date (YYYY-MM-DD) in the store's timezone. */
function todayIn(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function shift(d: string, days: number) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
}

function presetRange(p: Exclude<Preset, "custom">, today: string): { from: string; to: string } {
  const month = today.slice(0, 7);
  switch (p) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: shift(today, -1), to: shift(today, -1) };
    case "last7":
      return { from: shift(today, -6), to: today };
    case "last30":
      return { from: shift(today, -29), to: today };
    case "thisMonth":
      return { from: `${month}-01`, to: today };
    case "lastMonth": {
      const end = shift(`${month}-01`, -1);
      return { from: `${end.slice(0, 7)}-01`, to: end };
    }
    case "last12m": {
      const d = new Date(`${month}-01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 11);
      return { from: d.toISOString().slice(0, 10), to: today };
    }
    case "thisYear":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

function periodLabel(key: string, g: Granularity) {
  const d = new Date(`${key.length === 7 ? `${key}-01` : key}T00:00:00Z`);
  return d.toLocaleDateString(
    "en-AU",
    g === "month" ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" },
  );
}

type Row = { key: keyof ProfitLines; label: string; section?: string; kind?: "money" | "count" | "percent"; strong?: boolean };

const ROWS: Row[] = [
  { key: "grossSales", label: "Gross sales", section: "Revenue" },
  { key: "discounts", label: "Discounts" },
  { key: "returns", label: "Returns" },
  { key: "netSales", label: "Net sales, excl. tax", strong: true },
  { key: "tax", label: "Tax collected" },
  { key: "shipping", label: "Shipping charged" },
  { key: "totalSales", label: "Total sales" },
  { key: "orders", label: "Orders", section: "Store performance", kind: "count" },
  { key: "aov", label: "Average order value" },
  { key: "units", label: "Units sold", kind: "count" },
  { key: "cogs", label: "Product costs", section: "Expenses" },
  { key: "adSpend", label: "Ad spend" },
  { key: "labour", label: "Labour" },
  { key: "totalExpenses", label: "Total expenses", strong: true },
  { key: "grossProfit", label: "Gross profit", section: "Profit" },
  { key: "netProfit", label: "Net profit", strong: true },
  { key: "margin", label: "Profit margin", kind: "percent" },
];

export function ProfitReport({ stores }: { stores: StoreOption[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && stores.some((s) => s.id === saved)) setStoreId(saved);
    } catch {}
  }, [stores]);
  const pickStore = (id: string) => {
    setStoreId(id);
    try {
      localStorage.setItem(STORE_KEY, id);
    } catch {}
    window.dispatchEvent(new CustomEvent(STORE_SWITCH_EVENT, { detail: id }));
  };
  const store = stores.find((s) => s.id === storeId) ?? stores[0];

  const today = todayIn(store.timezone);
  const [preset, setPreset] = useState<Preset>("yesterday");
  const [custom, setCustom] = useState(() => presetRange("last30", today));
  const [includeToday, setIncludeToday] = useState(true);
  const [g, setG] = useState<Granularity>("day");
  const [chart, setChart] = useState<"line" | "bar" | "area">("bar");

  const range = useMemo(() => {
    const r = preset === "custom" ? custom : presetRange(preset, today);
    // "Include incomplete days" off: stop at yesterday, since today is still selling.
    if (!includeToday && r.to >= today) {
      const to = shift(today, -1);
      return { from: r.from > to ? to : r.from, to };
    }
    return r;
  }, [preset, custom, today, includeToday]);

  const report = useQuery({
    queryKey: ["profit", store.id, range.from, range.to, g],
    queryFn: () => api<Report>(`/api/profit?${new URLSearchParams({ storeId: store.id, from: range.from, to: range.to, g })}`),
    placeholderData: (prev) => prev,
  });
  const data = report.data;
  const currency = data?.currency ?? store.currency;
  const money = (v: number | null) => (v === null ? "–" : formatValue(v, "currency", currency));
  const cell = (r: Row, l: ProfitLines) => {
    const v = l[r.key];
    if (v === null) return "–";
    if (r.kind === "count") return formatValue(v, "number", null);
    if (r.kind === "percent") return `${v.toFixed(1)}%`;
    return money(v);
  };

  const chartData = (data?.periods ?? []).map((p) => ({
    label: periodLabel(p.key, data!.granularity),
    net: p.lines.netSales,
    expenses: p.lines.totalExpenses,
  }));

  const exportCsv = () => {
    if (!data) return;
    const raw = (r: Row, l: ProfitLines) => {
      const v = l[r.key];
      return v === null ? "" : r.kind === "count" ? String(v) : v.toFixed(2);
    };
    const rows = [
      ["Metric", "Period total", ...data.periods.map((p) => p.key)],
      ...ROWS.map((r) => [r.label, raw(r, data.total), ...data.periods.map((p) => raw(r, p.lines))]),
    ];
    const csv = rows.map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `profit-report-${store.shopDomain}-${range.from}-to-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const notIncluded = [!data?.hasAds && "ad spend", "fixed costs", !data?.hasLabour && "labour"].filter(Boolean).join(", ");
  const reportedDays = data ? data.periods.filter((p) => p.lines.orders > 0).length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">The complete picture</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your profit, line by line.</h1>
          <p className="mt-1 text-muted">Every sale and every cost, with the details that matter.</p>
        </div>
        <button className="btn" onClick={exportCsv} disabled={!data}>
          <Download className="size-4" /> Export report
        </button>
      </div>

      <div className="space-y-2 border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-2">
          {stores.length > 1 && (
            <label className="flex items-center gap-2">
              <ShoppingBag className="size-4 text-muted" />
              <select className="input w-auto" value={store.id} onChange={(e) => pickStore(e.target.value)} aria-label="Store">
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          )}
          <CalendarDays className="size-4 text-muted" />
          <input
            type="date"
            className="input w-auto"
            aria-label="From"
            value={range.from}
            max={today}
            onChange={(e) => {
              if (!e.target.value) return;
              setPreset("custom");
              setCustom({ from: e.target.value, to: range.to < e.target.value ? e.target.value : range.to });
            }}
          />
          <span className="text-sm text-muted">to</span>
          <input
            type="date"
            className="input w-auto"
            aria-label="To"
            value={range.to}
            max={today}
            onChange={(e) => {
              if (!e.target.value) return;
              setPreset("custom");
              setCustom({ from: range.from > e.target.value ? e.target.value : range.from, to: e.target.value });
            }}
          />
          <select
            className="input w-auto"
            value={preset}
            aria-label="Date range"
            onChange={(e) => {
              const p = e.target.value as Preset;
              if (p === "custom") setCustom(range);
              setPreset(p);
            }}
          >
            {Object.entries(PRESETS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <label className="ml-auto flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="accent-[var(--accent)]" checked={includeToday} onChange={(e) => setIncludeToday(e.target.checked)} />
            Include incomplete days
          </label>
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
          <span>{currency ?? ""} · {store.timezone} · Revenue excludes tax</span>
          <span>{reportedDays} reported {reportedDays === 1 ? "day" : "days"}</span>
        </div>
      </div>

      <Segmented value={g} onChange={setG} options={[["day", "Daily"], ["month", "Monthly"]]} />

      {report.error && <div className="card p-4 text-sm text-negative">{(report.error as Error).message}</div>}

      <div className={clsx("card p-5 transition", report.isFetching && "opacity-70")}>
        <h2 className="font-semibold">Net sales vs expenses</h2>
        <p className="text-sm text-muted">Per period in the selected range</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Net sales</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted" /> Total expenses</span>
          <Segmented small value={chart} onChange={setChart} options={[["line", "Line"], ["bar", "Bar"], ["area", "Area"]]} />
        </div>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ProfitChart kind={chart} data={chartData} fmt={money} />
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="sticky left-0 bg-surface px-5 py-3 text-left font-medium">Metric</th>
              <th className="bg-surface-2 px-5 py-3 text-right font-medium">Period total</th>
              {data?.periods.map((p) => (
                <th key={p.key} className="px-5 py-3 text-right font-medium">{periodLabel(p.key, data.granularity)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data &&
              ROWS.map((r) => (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <td className={clsx("sticky left-0 bg-surface px-5 py-3", r.strong && "font-semibold")}>
                    {r.section && (
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-accent">{r.section}</span>
                    )}
                    {r.label}
                  </td>
                  <td
                    className={clsx(
                      "bg-surface-2 px-5 py-3 text-right font-mono font-semibold tabular-nums",
                      r.key === "netProfit" && data.total.netProfit < 0 && "text-negative",
                    )}
                  >
                    {cell(r, data.total)}
                  </td>
                  {data.periods.map((p) => (
                    <td
                      key={p.key}
                      className={clsx(
                        "px-5 py-3 text-right font-mono tabular-nums",
                        r.strong && "font-semibold",
                        r.key === "netProfit" && p.lines.netProfit < 0 && "text-negative",
                      )}
                    >
                      {cell(r, p.lines)}
                    </td>
                  ))}
                </tr>
              ))}
            {!data && (
              <tr>
                <td className="px-5 py-6 text-muted" colSpan={2}>Loading…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card flex gap-3 p-4 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p>
            Revenue lines follow Shopify&apos;s sales report (tax-exclusive net sales). Product costs use each variant&apos;s current
            Shopify &quot;Cost per item&quot;. A dash means unavailable, never a confirmed zero. Profit margin uses revenue excluding tax.
          </p>
          <p>Not included (not set up): {notIncluded}.</p>
          {!!data?.unitsWithoutCost && (
            <p>{data.unitsWithoutCost} unit(s) sold have no Shopify &quot;Cost per item&quot;, so their product cost is not included.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  small,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
  small?: boolean;
}) {
  return (
    <div className={clsx("inline-flex rounded-lg border border-border bg-surface p-1", small ? "text-xs" : "text-sm")}>
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={clsx(
            "rounded-md font-medium transition",
            small ? "px-2.5 py-1" : "px-3.5 py-1.5",
            v === value ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

type Point = { label: string; net: number; expenses: number };

// ResponsiveContainer passes width/height through to its child chart.
function ProfitChart({ kind, data, fmt, ...size }: { kind: "line" | "bar" | "area"; data: Point[]; fmt: (v: number) => string }) {
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} minTickGap={16} />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={64}
        tick={{ fill: "var(--muted)", fontSize: 11 }}
        tickFormatter={(v: number) => fmt(v).replace(/\.00$/, "")}
      />
      <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTip fmt={fmt} />} />
    </>
  );
  const common = { data, margin: { top: 24, right: 8, left: 0, bottom: 0 }, ...size };
  const dots = data.length < 40;
  if (kind === "line") {
    return (
      <LineChart {...common}>
        {axes}
        <Line dataKey="net" stroke="var(--accent)" strokeWidth={2} dot={dots} />
        <Line dataKey="expenses" stroke="var(--muted)" strokeWidth={2} dot={dots} />
      </LineChart>
    );
  }
  if (kind === "area") {
    return (
      <AreaChart {...common}>
        {axes}
        <Area dataKey="net" stroke="var(--accent)" strokeWidth={2} fill="var(--accent)" fillOpacity={0.15} />
        <Area dataKey="expenses" stroke="var(--muted)" strokeWidth={2} fill="var(--muted)" fillOpacity={0.12} />
      </AreaChart>
    );
  }
  // Value labels on bars only while they have room.
  const label = data.length <= 14
    ? { position: "top" as const, fill: "var(--foreground)", fontSize: 11, formatter: (v: unknown) => fmt(Number(v)) }
    : undefined;
  return (
    <BarChart {...common} barGap={6}>
      {axes}
      <Bar dataKey="net" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={140} label={label} />
      <Bar dataKey="expenses" fill="var(--muted)" radius={[4, 4, 0, 0]} maxBarSize={140} label={label} />
    </BarChart>
  );
}

function ChartTip({ active, payload, fmt }: { active?: boolean; payload?: readonly { payload: Point }[]; fmt: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const profit = p.net - p.expenses;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-muted">{p.label}</p>
      <p className="mt-1">Net sales <span className="font-mono font-medium tabular-nums">{fmt(p.net)}</span></p>
      <p>Expenses <span className="font-mono font-medium tabular-nums">{fmt(p.expenses)}</span></p>
      <p>
        Profit <span className={clsx("font-mono font-medium tabular-nums", profit < 0 && "text-negative")}>{fmt(profit)}</span>
      </p>
    </div>
  );
}
