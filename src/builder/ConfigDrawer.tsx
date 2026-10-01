"use client";
import { Copy, Trash2, X } from "lucide-react";
import { DIMENSIONS, METRICS, METRIC_IDS, metricFilterFields, missingCapabilities, type MetricId } from "@/metrics/registry";
import { DateRangeControl, WidgetFilterFields } from "@/components/FilterControls";
import { WIDGET_TYPES, WIDGET_TYPE_IDS, type WidgetType } from "@/widgets/types";
import { allowedDimensions, useBuilder } from "@/builder/store";

const COLORS = ["#4f46e5", "#0ea5a4", "#f59e0b", "#ec4899", "#22c55e", "#8b5cf6", "#64748b"];

export function ConfigDrawer({ enabled, storeId }: { enabled: Set<string>; storeId: string }) {
  const { widgets, selectedId, select, update, remove, duplicate } = useBuilder();
  const w = widgets.find((x) => x.id === selectedId);
  if (!w) return null;
  const c = w.config;
  const dims = allowedDimensions(w.type, c.metric);

  const setMetric = (metric: MetricId) => {
    const next = allowedDimensions(w.type, metric);
    const wasDefaultTitle = w.title === METRICS[c.metric].label;
    update(w.id, {
      ...(wasDefaultTitle ? { title: METRICS[metric].label } : {}),
      config: { ...c, metric, dimension: next.includes(c.dimension) ? c.dimension : next[0] },
    });
  };
  const setType = (type: WidgetType) => {
    const next = allowedDimensions(type, c.metric);
    // Keep the metric if it works with the new chart type, otherwise pick one that does.
    const metric = next.length
      ? c.metric
      : METRIC_IDS.find((m) => allowedDimensions(type, m).length && !missingCapabilities(m, enabled).length) ?? c.metric;
    const d = allowedDimensions(type, metric);
    update(w.id, { type, config: { ...c, metric, dimension: d.includes(c.dimension) ? c.dimension : d[0] ?? "none" } });
  };

  return (
    <aside className="card sticky top-20 space-y-4 p-4" aria-label="Widget settings">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Widget settings</h3>
        <button className="text-muted hover:text-foreground" onClick={() => select(null)} aria-label="Close settings">
          <X className="size-4" />
        </button>
      </div>

      <Field label="Title" id="cfg-title">
        <input id="cfg-title" className="input" value={w.title} onChange={(e) => update(w.id, { title: e.target.value })} />
      </Field>

      <Field label="Chart type" id="cfg-type">
        <select id="cfg-type" className="input" value={w.type} onChange={(e) => setType(e.target.value as WidgetType)}>
          {WIDGET_TYPE_IDS.map((t) => <option key={t} value={t}>{WIDGET_TYPES[t].label}</option>)}
        </select>
      </Field>

      <Field label="Metric" id="cfg-metric">
        <select id="cfg-metric" className="input" value={c.metric} onChange={(e) => setMetric(e.target.value as MetricId)}>
          {METRIC_IDS.map((m) => {
            const locked = missingCapabilities(m, enabled).length > 0;
            const incompatible = allowedDimensions(w.type, m).length === 0;
            return (
              <option key={m} value={m} disabled={incompatible}>
                {METRICS[m].label}{locked ? " 🔒" : ""}{incompatible ? " (not for this chart)" : ""}
              </option>
            );
          })}
        </select>
      </Field>

      {dims.length > 1 && (
        <Field label="Breakdown" id="cfg-dim">
          <select id="cfg-dim" className="input" value={c.dimension}
            onChange={(e) => update(w.id, { config: { ...c, dimension: e.target.value as typeof c.dimension } })}>
            {dims.map((d) => <option key={d} value={d}>{DIMENSIONS[d]}</option>)}
          </select>
        </Field>
      )}

      {!("snapshot" in METRICS[c.metric]) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <span className="label">Date range</span>
            <DateRangeControl
              preset={c.range}
              from={c.filters?.from}
              to={c.filters?.to}
              onChange={(d) =>
                update(w.id, {
                  config: {
                    ...c,
                    range: d.range ?? c.range,
                    filters: cleanFilters({ ...c.filters, from: d.from, to: d.to }),
                  },
                })
              }
            />
          </div>
          {c.dimension === "date" && (
            <Field label="Interval" id="cfg-gran">
              <select id="cfg-gran" className="input" value={c.granularity}
                onChange={(e) => update(w.id, { config: { ...c, granularity: e.target.value as typeof c.granularity } })}>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </Field>
          )}
        </div>
      )}

      <details className="rounded-lg border border-border p-3" open={!!c.filters}>
        <summary className="cursor-pointer text-sm font-medium">Filters for this widget</summary>
        <p className="mb-2 mt-1 text-xs text-muted">Anything set here overrides the dashboard filter bar.</p>
        <WidgetFilterFields
          storeId={storeId}
          fields={metricFilterFields(c.metric)}
          value={c.filters ?? {}}
          onChange={(f) => update(w.id, { config: { ...c, filters: cleanFilters({ ...f, from: c.filters?.from, to: c.filters?.to }) } })}
        />
      </details>

      {w.type === "kpi" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.compare}
            onChange={(e) => update(w.id, { config: { ...c, compare: e.target.checked } })} />
          Compare with previous period
        </label>
      )}

      {w.type === "gauge" && (
        <Field label="Goal" id="cfg-goal">
          <input id="cfg-goal" className="input" type="number" min={0} value={c.goal ?? ""}
            onChange={(e) => update(w.id, { config: { ...c, goal: e.target.value ? Number(e.target.value) : undefined } })} />
        </Field>
      )}

      {c.dimension !== "date" && c.dimension !== "none" && (
        <Field label="Show top" id="cfg-limit">
          <input id="cfg-limit" className="input" type="number" min={1} max={50} value={c.limit}
            onChange={(e) => update(w.id, { config: { ...c, limit: Math.min(50, Math.max(1, Number(e.target.value) || 1)) } })} />
        </Field>
      )}

      {["line", "area", "bar", "gauge"].includes(w.type) && (
        <div>
          <span className="label">Color</span>
          <div className="flex gap-1.5">
            {COLORS.map((col) => (
              <button key={col} aria-label={`Color ${col}`}
                className={`size-6 rounded-full border-2 ${c.color === col ? "border-foreground" : "border-transparent"}`}
                style={{ background: col }}
                onClick={() => update(w.id, { config: { ...c, color: col } })} />
            ))}
            <button className="text-xs text-muted" onClick={() => update(w.id, { config: { ...c, color: undefined } })}>Auto</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-t border-border pt-4">
        <button className="btn flex-1" onClick={() => duplicate(w.id)}><Copy className="size-4" /> Duplicate</button>
        <button className="btn flex-1 text-negative" onClick={() => remove(w.id)}><Trash2 className="size-4" /> Delete</button>
      </div>
    </aside>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

/** Drops empty fields; returns undefined when no filter is left. */
function cleanFilters<T extends Record<string, unknown>>(f: T): T | undefined {
  const out = Object.fromEntries(
    Object.entries(f).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)),
  ) as T;
  return Object.keys(out).length ? out : undefined;
}
