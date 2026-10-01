import { z } from "zod";
import { DIMENSIONS, filtersSchema, METRIC_IDS, RANGE_PRESETS, type Dimension } from "@/metrics/registry";
import type { CapabilityKey } from "@/metrics/capabilities";

// React-free widget definitions: used by the builder UI, the API (validation),
// and server-side auto-add of widgets when a capability turns on.

export const WIDGET_TYPES = {
  kpi: { label: "KPI card", defaultSize: { w: 3, h: 3 }, dimensions: ["none"] },
  line: { label: "Line chart", defaultSize: { w: 6, h: 6 }, dimensions: ["date"] },
  area: { label: "Area chart", defaultSize: { w: 6, h: 6 }, dimensions: ["date"] },
  bar: {
    label: "Bar chart",
    defaultSize: { w: 6, h: 6 },
    dimensions: ["date", "product", "channel", "country", "location", "customer", "status", "platform"],
  },
  pie: {
    label: "Donut chart",
    defaultSize: { w: 4, h: 6 },
    dimensions: ["product", "channel", "country", "location", "customer", "status", "platform"],
  },
  table: {
    label: "Table",
    defaultSize: { w: 6, h: 7 },
    dimensions: ["product", "channel", "country", "location", "customer", "status", "platform", "date"],
  },
  gauge: { label: "Goal gauge", defaultSize: { w: 3, h: 4 }, dimensions: ["none"] },
} as const satisfies Record<
  string,
  { label: string; defaultSize: { w: number; h: number }; dimensions: Dimension[] }
>;

export type WidgetType = keyof typeof WIDGET_TYPES;
export const WIDGET_TYPE_IDS = Object.keys(WIDGET_TYPES) as [WidgetType, ...WidgetType[]];

export const widgetConfigSchema = z.object({
  metric: z.enum(METRIC_IDS),
  dimension: z.enum(Object.keys(DIMENSIONS) as [Dimension, ...Dimension[]]),
  range: z.enum(Object.keys(RANGE_PRESETS) as [keyof typeof RANGE_PRESETS]),
  granularity: z.enum(["day", "week", "month"]).default("day"),
  compare: z.boolean().default(true),
  limit: z.number().int().min(1).max(50).default(10),
  goal: z.number().nonnegative().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  /** Per-widget filters; any field set here overrides the dashboard filter bar. */
  filters: filtersSchema.omit({ range: true }).optional(),
});
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export const layoutSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(40),
});

export const widgetSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(WIDGET_TYPE_IDS),
  title: z.string().min(1).max(120),
  config: widgetConfigSchema,
  layout: layoutSchema,
});
export type Widget = z.infer<typeof widgetSchema>;

type WidgetSeed = Omit<Widget, "id" | "layout"> & { layout?: Partial<Widget["layout"]> };

const kpi = (metric: WidgetConfig["metric"], title: string): WidgetSeed => ({
  type: "kpi",
  title,
  config: { metric, dimension: "none", range: "30d", granularity: "day", compare: true, limit: 10 },
});
const trend = (
  metric: WidgetConfig["metric"],
  title: string,
  type: "line" | "area" = "area",
): WidgetSeed => ({
  type,
  title,
  config: { metric, dimension: "date", range: "30d", granularity: "day", compare: false, limit: 10 },
});
const breakdown = (
  metric: WidgetConfig["metric"],
  dimension: Dimension,
  title: string,
  type: "bar" | "pie" | "table" = "bar",
): WidgetSeed => ({
  type,
  title,
  config: { metric, dimension, range: "30d", granularity: "day", compare: false, limit: 10 },
});

export const DASHBOARD_TEMPLATES: Record<string, { label: string; widgets: WidgetSeed[] }> = {
  blank: { label: "Blank canvas", widgets: [] },
  sales: {
    label: "Sales overview",
    widgets: [
      kpi("revenue", "Net sales"),
      kpi("orders", "Orders"),
      kpi("aov", "Avg. order value"),
      kpi("units_sold", "Units sold"),
      trend("revenue", "Net sales over time"),
      breakdown("product_sales", "product", "Top products"),
      breakdown("revenue", "channel", "Sales by channel", "pie"),
      breakdown("revenue", "country", "Sales by country", "table"),
    ],
  },
  profit: {
    label: "Profit & margin",
    widgets: [
      kpi("gross_profit", "Gross profit"),
      kpi("margin", "Gross margin"),
      kpi("cogs", "COGS"),
      trend("gross_profit", "Gross profit over time", "line"),
      breakdown("gross_profit", "product", "Most profitable products"),
    ],
  },
  inventory: {
    label: "Inventory",
    widgets: [
      kpi("inventory_units", "Units in stock"),
      kpi("inventory_value", "Inventory value"),
      breakdown("inventory_units", "product", "Stock by product", "table"),
    ],
  },
};

/** Widgets to suggest or auto-insert when a store gains a capability. */
export const CAPABILITY_WIDGETS: Partial<Record<CapabilityKey, WidgetSeed[]>> = {
  "data:product_cost": [
    kpi("gross_profit", "Gross profit"),
    kpi("margin", "Gross margin"),
    trend("gross_profit", "Gross profit over time", "line"),
  ],
  "data:discounts": [kpi("discounts", "Discounts")],
  "data:refunds": [kpi("refunds", "Refunds")],
  "data:customers": [kpi("new_customers", "New customers")],
  "data:inventory_tracking": [kpi("inventory_units", "Units in stock")],
  "data:multi_channel": [breakdown("revenue", "channel", "Sales by channel", "pie")],
  "data:international": [breakdown("revenue", "country", "Sales by country", "bar")],
};

/** Places seeds below the existing widgets, packing left-to-right on a 12-column grid. */
type Box = { x: number; y: number; w: number; h: number };

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** First free top-left slot on the 12-column grid that fits a w×h widget. */
export function findSpot(taken: Box[], w: number, h: number): { x: number; y: number } {
  const width = Math.min(w, 12);
  for (let y = 0; ; y++) {
    for (let x = 0; x + width <= 12; x++) {
      const box = { x, y, w: width, h };
      if (!taken.some((t) => overlaps(t, box))) return { x, y };
    }
  }
}

export function placeWidgets(seeds: WidgetSeed[], existing: Widget[], newId: () => string): Widget[] {
  const taken: Box[] = existing.map((w) => w.layout);
  return seeds.map((s) => {
    const size = { ...WIDGET_TYPES[s.type].defaultSize, ...s.layout };
    const layout = { ...findSpot(taken, size.w, size.h), w: size.w, h: size.h };
    taken.push(layout);
    return { id: newId(), type: s.type, title: s.title, config: s.config, layout };
  });
}

/** Re-flows widgets (in reading order) into the first free slots, removing gaps. */
export function packWidgets(widgets: Widget[]): Widget[] {
  const taken: Box[] = [];
  const order = [...widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
  const packed = new Map(
    order.map((w) => {
      const layout = { ...findSpot(taken, w.layout.w, w.layout.h), w: w.layout.w, h: w.layout.h };
      taken.push(layout);
      return [w.id, { ...w, layout }] as const;
    }),
  );
  return widgets.map((w) => packed.get(w.id)!);
}
