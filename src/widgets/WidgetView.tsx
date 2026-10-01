"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Lock } from "lucide-react";
import { api, formatChange, formatValue } from "@/lib/format";
import { CAPABILITIES } from "@/metrics/capabilities";
import { clsx } from "clsx";
import { DIMENSIONS, METRICS, metricFilterFields, type MetricFormat, missingCapabilities, type Filters, type MetricQuery, type MetricResult } from "@/metrics/registry";
import { activeFilterCount, describeRange, resolveQueryFilters } from "@/metrics/filters";
import type { Widget } from "@/widgets/types";

const PALETTE = [1, 2, 3, 4, 5, 6, 7].map((n) => `var(--chart-${n})`);

type Props = { widget: Widget; storeId: string; enabled: Set<string>; shopDomain: string | null; dashboardFilters?: Filters;
  /** Show money in another currency: values are multiplied by `rate`. */
  fx?: { currency: string; rate: number };
  /** Smaller KPI for dense grids (no inner padding). */
  compact?: boolean;
  /** Render tables as labelled progress bars instead of rows. */
  bars?: boolean;
  /** Slice/series colours; defaults to the theme's chart palette. */
  palette?: readonly string[];
  /** Called when a point/bar/slice/row is clicked (key null = the whole total). */
  onPoint?: (p: DrillPoint, query: MetricQuery) => void;
  /** Draw a line/area/bar chart as another type without changing the saved widget. */
  chartType?: "line" | "area" | "bar" };

export type DrillPoint = { key: string | null; label: string; value: number };

export function WidgetView({ widget, storeId, enabled, shopDomain, dashboardFilters = {}, fx, compact, bars, palette = PALETTE, onPoint, chartType }: Props) {
  const { config } = widget;
  const metric = METRICS[config.metric];
  const missing = missingCapabilities(config.metric, enabled);
  const resolved = resolveQueryFilters(config.range, config.filters, dashboardFilters);
  // Only send filters this metric's data supports, so the cache key stays stable.
  const fields = metricFilterFields(config.metric);
  const filters: Filters = { from: resolved.filters.from, to: resolved.filters.to };
  for (const k of fields) if (resolved.filters[k]) filters[k] = resolved.filters[k];

  const query: MetricQuery = {
    storeId,
    metric: config.metric,
    dimension: config.dimension,
    range: resolved.range,
    granularity: config.granularity,
    compare: config.compare,
    limit: config.limit,
    filters,
  };
  const q = useQuery({
    queryKey: ["metric", storeId, config, resolved.range, filters],
    enabled: missing.length === 0,
    queryFn: () =>
      api<MetricResult | { locked: true }>("/api/query", {
        method: "POST",
        body: JSON.stringify(query),
      }),
  });

  const emit = (p: DrillPoint) => onPoint?.(p, query);
  if (missing.length) return <LockedCard missing={missing} shopDomain={shopDomain} />;
  if (q.isLoading) return <div className="m-4 h-[calc(100%-2rem)] animate-pulse rounded-lg bg-surface-2" />;
  if (q.isError) return <p className="p-4 text-sm text-negative">{(q.error as Error).message}</p>;
  if (!q.data || "locked" in q.data) return null;

  const data =
    fx && metric.format === "currency"
      ? {
          ...q.data,
          currency: fx.currency,
          total: q.data.total * fx.rate,
          previousTotal: q.data.previousTotal === undefined ? undefined : q.data.previousTotal * fx.rate,
          rows: q.data.rows.map((r) => ({ ...r, value: r.value * fx.rate })),
          previousRows: q.data.previousRows?.map((r) => ({ ...r, value: r.value * fx.rate })),
        }
      : q.data;
  const fmt = (v: number, compact = false) => formatValue(v, metric.format, data.currency, compact);
  const color = config.color ?? palette[0];
  const empty = data.rows.length === 0 && widget.type !== "kpi" && widget.type !== "gauge";
  if (empty) {
    return (
      <p className="p-4 text-sm text-muted">
        No data in {describeRange(resolved.range, filters)}
        {activeFilterCount({ ...filters, from: undefined, to: undefined }) ? " for these filters" : ""}.
      </p>
    );
  }

  switch (widget.type) {
    case "kpi": {
      const change = formatChange(data.total, data.previousTotal);
      const up = (change ?? 0) >= 0;
      return (
        <div
          className={clsx(compact ? "flex flex-col" : "flex h-full flex-col justify-center px-4 pb-3", onPoint && "cursor-pointer")}
          onClick={onPoint ? () => emit({ key: null, label: widget.title, value: data.total }) : undefined}
        >
          <p className={`${compact ? "text-2xl" : "text-3xl"} font-semibold tracking-tight`}>{fmt(data.total)}</p>
          {change !== null && (
            <p className={`mt-1 flex items-center gap-1 ${compact ? "text-xs" : "text-sm"} ${up ? "text-positive" : "text-negative"}`}>
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(change).toFixed(1)}% <span className="text-muted">vs previous period</span>
            </p>
          )}
        </div>
      );
    }
    case "gauge": {
      const goal = config.goal ?? 0;
      const pct = goal > 0 ? Math.min(100, (data.total / goal) * 100) : 0;
      return (
        <div className="flex h-full flex-col justify-center gap-3 px-4 pb-3">
          <p className="text-2xl font-semibold">{fmt(data.total)}</p>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </div>
          <p className="text-xs text-muted">
            {goal > 0 ? `${pct.toFixed(0)}% of ${fmt(goal)} goal` : "Set a goal in widget settings"}
          </p>
        </div>
      );
    }
    case "table": {
      // Share only makes sense for additive metrics (not averages/percentages).
      const additive = metric.format !== "percent" && config.metric !== "aov" && config.dimension !== "date";
      const sum = data.rows.reduce((a, r) => a + r.value, 0);
      const share = (v: number) => (sum ? `${((v / sum) * 100).toFixed(1)}%` : "–");
      if (bars) {
        const max = Math.max(...data.rows.map((r) => r.value), 0);
        return (
          <div className="h-full space-y-3 overflow-auto px-4 pb-3 pt-1">
            {data.rows.map((r) => (
              <div
                key={r.key}
                className={clsx(onPoint && "-mx-2 cursor-pointer rounded-md px-2 py-1 hover:bg-surface-2")}
                onClick={onPoint ? () => emit(r) : undefined}
              >
                <div className="mb-1 flex items-baseline gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate" title={r.label}>{r.label}</span>
                  <span className="font-mono tabular-nums">{fmt(r.value)}</span>
                  {additive && <span className="w-12 text-right text-xs tabular-nums text-muted">{share(r.value)}</span>}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${max ? (r.value / max) * 100 : 0}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        );
      }
      const dimLabel = DIMENSIONS[config.dimension].replace(/^By (sales )?/, "").replace(/^\w/, (c) => c.toUpperCase());
      return (
        <div className="h-full overflow-auto px-4 pb-3">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-xs text-muted">
              <tr className="border-b border-border">
                <th className="w-8 py-1.5 text-left font-medium">#</th>
                <th className="py-1.5 text-left font-medium">{dimLabel}</th>
                <th className="py-1.5 text-right font-medium">{metric.label}</th>
                {additive && <th className="w-20 py-1.5 text-right font-medium">% of total</th>}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr
                  key={r.key}
                  className={clsx("border-b border-border last:border-0", onPoint && "cursor-pointer hover:bg-surface-2")}
                  onClick={onPoint ? () => emit(r) : undefined}
                >
                  <td className="py-1.5 tabular-nums text-muted">{i + 1}</td>
                  <td className="max-w-0 truncate py-1.5 pr-3" title={r.label}>{r.label}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{fmt(r.value)}</td>
                  {additive && <td className="py-1.5 text-right tabular-nums text-muted">{share(r.value)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "pie": {
      const sum = data.rows.reduce((a, r) => a + r.value, 0);
      return (
        <div className="@container flex h-full flex-col gap-2 p-3 pt-0 @[22rem]:flex-row @[22rem]:items-center">
          <div className="min-h-0 flex-1 @[22rem]:h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.rows}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  stroke="var(--surface)"
                  className={clsx(onPoint && "cursor-pointer")}
                  onClick={onPoint ? (_d, i) => data.rows[i] && emit(data.rows[i]) : undefined}
                >
                  {data.rows.map((r, i) => <Cell key={r.key} fill={palette[i % palette.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip fmt={fmt} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend: each color is one slice of the breakdown, largest first. */}
          <ul className="max-h-[45%] shrink-0 space-y-1 overflow-y-auto overflow-x-hidden px-1 text-xs @[22rem]:max-h-full @[22rem]:w-1/2" aria-label="Legend">
            {data.rows.map((r, i) => (
              <li
                key={r.key}
                className={clsx("flex items-center gap-2", onPoint && "-mx-1 cursor-pointer rounded px-1 hover:bg-surface-2")}
                onClick={onPoint ? () => emit(r) : undefined}
              >
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: palette[i % palette.length] }} aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={r.label}>{r.label}</span>
                <span className="tabular-nums text-muted">{fmt(r.value, true)}</span>
                <span className="w-10 text-right tabular-nums">{sum ? `${((r.value / sum) * 100).toFixed(r.value / sum < 0.1 ? 1 : 0)}%` : "–"}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    default: {
      const isDate = config.dimension === "date";
      const type = chartType ?? widget.type;
      const prev = data.previousRows;
      const rows = prev ? data.rows.map((r, i) => ({ ...r, prev: prev[i]?.value ?? 0 })) : data.rows;
      const common = {
        data: rows,
        margin: { top: 8, right: 16, bottom: 4, left: 0 },
        className: onPoint ? "cursor-pointer" : undefined,
        onClick: onPoint
          ? (state: { activeIndex?: unknown }) => {
              const r = data.rows[Number(state.activeIndex)];
              if (r) emit(r);
            }
          : undefined,
      };
      const axes = (
        <>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickFormatter={isDate ? shortDate : (v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} width={60} tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickFormatter={(v: number) => axisValue(v, metric.format, data.currency)} />
          <Tooltip content={<ChartTooltip fmt={fmt} isDate={isDate} clickable={!!onPoint} />} cursor={{ fill: "var(--surface-2)" }} />
        </>
      );
      const prevStyle = { stroke: "var(--muted)", strokeWidth: 1.5, strokeDasharray: "4 4", dot: false, isAnimationActive: false } as const;
      return (
        <ResponsiveContainer width="100%" height="100%">
          {type === "line" ? (
            <LineChart {...common}>
              {axes}
              {prev && <Line dataKey="prev" name="Previous period" {...prevStyle} />}
              <Line dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          ) : type === "area" ? (
            <AreaChart {...common}>
              {axes}
              {prev && <Area dataKey="prev" name="Previous period" fill="transparent" {...prevStyle} />}
              <Area dataKey="value" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.12} activeDot={{ r: 5 }} />
            </AreaChart>
          ) : (
            <BarChart {...common}>
              {axes}
              {prev && <Bar dataKey="prev" name="Previous period" fill="var(--muted)" fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={40} />}
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          )}
        </ResponsiveContainer>
      );
    }
  }
}

/** Short y-axis labels that always fit: $950, $1.4K, $25K, 1.2M, 45%. */
function axisValue(v: number, format: MetricFormat, currency: string | null) {
  if (format === "percent") return `${v.toFixed(0)}%`;
  const big = Math.abs(v) >= 1000;
  return new Intl.NumberFormat("en-AU", {
    ...(format === "currency" ? { style: "currency", currency: currency ?? "USD", currencyDisplay: "narrowSymbol" } : {}),
    notation: big ? "compact" : "standard",
    maximumFractionDigits: big ? 1 : 0,
  }).format(v);
}

function shortDate(v: string) {
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({
  active,
  payload,
  fmt,
  isDate,
  clickable,
}: {
  active?: boolean;
  payload?: readonly { payload: { label: string; value: number; prev?: number } }[];
  fmt: (v: number) => string;
  isDate?: boolean;
  clickable?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const change = p.prev !== undefined && p.prev !== 0 ? ((p.value - p.prev) / Math.abs(p.prev)) * 100 : null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-muted">{isDate ? shortDate(p.label) : p.label}</p>
      <p className="mt-0.5 font-mono font-medium tabular-nums">{fmt(p.value)}</p>
      {p.prev !== undefined && (
        <p className="mt-0.5 text-muted">
          Previous: <span className="font-mono tabular-nums">{fmt(p.prev)}</span>
          {change !== null && <span className={change >= 0 ? "text-positive" : "text-negative"}> ({change >= 0 ? "+" : ""}{change.toFixed(1)}%)</span>}
        </p>
      )}
      {clickable && <p className="mt-1 text-[10px] text-accent">Click for details</p>}
    </div>
  );
}

/** Shown when the metric needs something the store hasn't enabled yet. */
export function LockedCard({ missing, shopDomain }: { missing: string[]; shopDomain: string | null }) {
  const first = CAPABILITIES[missing[0] as keyof typeof CAPABILITIES];
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-4 pb-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <Lock className="size-3.5 text-warning" /> Needs {first?.label.toLowerCase() ?? missing[0]}
      </p>
      <p className="text-xs text-muted">{first?.howToEnable}</p>
      <div className="flex flex-wrap gap-2">
        {first?.requestScope && shopDomain && (
          <a className="btn px-2 py-1 text-xs"
            href={`/api/shopify/install?shop=${shopDomain}&extra=${first.requestScope}`}>
            Grant access
          </a>
        )}
        {first?.adminPath && shopDomain && (
          <a className="btn px-2 py-1 text-xs" target="_blank" rel="noreferrer"
            href={`https://${shopDomain}${first.adminPath}`}>
            Open Shopify admin
          </a>
        )}
      </div>
      <p className="text-[11px] text-muted">This card unlocks automatically once enabled.</p>
    </div>
  );
}
