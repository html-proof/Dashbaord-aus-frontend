"use client";
import { AreaChart, BarChart3, Gauge, LineChart, Lock, PieChart, Sigma, Table2 } from "lucide-react";
import { CAPABILITIES, type CapabilityKey } from "@/metrics/capabilities";
import { METRICS, METRIC_IDS, missingCapabilities, type MetricId } from "@/metrics/registry";
import { WIDGET_TYPES, WIDGET_TYPE_IDS, type WidgetType } from "@/widgets/types";
import { allowedDimensions, useBuilder } from "@/builder/store";

export const TYPE_ICONS: Record<WidgetType, React.ComponentType<{ className?: string }>> = {
  kpi: Sigma,
  line: LineChart,
  area: AreaChart,
  bar: BarChart3,
  pie: PieChart,
  table: Table2,
  gauge: Gauge,
};

/** Drag payload shared with the grid's onDrop (HTML5 DnD can't read data during dragover). */
export const dragPayload: { current: { type: WidgetType; metric: MetricId } | null } = { current: null };

/** Best default metric for a widget type among those the store can power. */
export function defaultMetricFor(type: WidgetType, enabled: Set<string>): MetricId | null {
  return (
    METRIC_IDS.find(
      (m) => missingCapabilities(m, enabled).length === 0 && allowedDimensions(type, m).length > 0,
    ) ?? null
  );
}

export function WidgetLibrary({ enabled, shopDomain }: { enabled: Set<string>; shopDomain: string | null }) {
  const add = useBuilder((s) => s.add);

  const available = METRIC_IDS.filter((m) => missingCapabilities(m, enabled).length === 0);
  const locked = METRIC_IDS.filter((m) => missingCapabilities(m, enabled).length > 0);
  // Group locked metrics by the first thing they need, so each hint appears once.
  const lockedBy = new Map<CapabilityKey, MetricId[]>();
  for (const m of locked) {
    const k = missingCapabilities(m, enabled)[0];
    lockedBy.set(k, [...(lockedBy.get(k) ?? []), m]);
  }

  return (
    <aside className="space-y-5">
      <section>
        <h3 className="label">Charts — drag onto the canvas or click</h3>
        <div className="grid grid-cols-2 gap-2">
          {WIDGET_TYPE_IDS.map((type) => {
            const Icon = TYPE_ICONS[type];
            const metric = defaultMetricFor(type, enabled);
            return (
              <button
                key={type}
                disabled={!metric}
                draggable={!!metric}
                onDragStart={(e) => {
                  dragPayload.current = { type, metric: metric! };
                  e.dataTransfer.setData("text/plain", type);
                }}
                onDragEnd={() => (dragPayload.current = null)}
                onClick={() => metric && add(type, metric)}
                className="card flex cursor-grab flex-col items-center gap-1.5 p-3 text-xs hover:border-accent active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon className="size-5 text-accent" />
                {WIDGET_TYPES[type].label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="label">Available metrics</h3>
        <ul className="space-y-1">
          {available.map((m) => (
            <li key={m}>
              <button
                draggable
                onDragStart={(e) => {
                  dragPayload.current = { type: "kpi", metric: m };
                  e.dataTransfer.setData("text/plain", m);
                }}
                onClick={() => add("kpi", m)}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                title={METRICS[m].description}
              >
                {METRICS[m].label}
              </button>
            </li>
          ))}
          {available.length === 0 && <li className="text-xs text-muted">Waiting for store data…</li>}
        </ul>
      </section>

      {lockedBy.size > 0 && (
        <section>
          <h3 className="label">Unlock more</h3>
          <ul className="space-y-2">
            {[...lockedBy.entries()].map(([cap, metrics]) => {
              const info = CAPABILITIES[cap];
              return (
                <li key={cap} className="rounded-lg border border-dashed border-border p-2.5 text-xs">
                  <p className="flex items-center gap-1.5 font-medium">
                    <Lock className="size-3 text-warning" /> {info.label}
                  </p>
                  <p className="mt-1 text-muted">{metrics.map((m) => METRICS[m].label).join(", ")}</p>
                  <p className="mt-1 text-muted">{info.howToEnable}</p>
                  {info.requestScope && shopDomain && (
                    <a className="mt-1.5 inline-block font-medium text-accent"
                      href={`/api/shopify/install?shop=${shopDomain}&extra=${info.requestScope}`}>
                      Grant access →
                    </a>
                  )}
                  {!info.requestScope && info.adminPath && shopDomain && (
                    <a className="mt-1.5 inline-block font-medium text-accent" target="_blank" rel="noreferrer"
                      href={`https://${shopDomain}${info.adminPath}`}>
                      Open in Shopify →
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
