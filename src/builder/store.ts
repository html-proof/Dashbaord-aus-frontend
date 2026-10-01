"use client";
import { create } from "zustand";
import { METRICS, type Dimension, type MetricId } from "@/metrics/registry";
import { findSpot, packWidgets, WIDGET_TYPES, type Widget, type WidgetType } from "@/widgets/types";

type Layout = Widget["layout"];

type BuilderState = {
  widgets: Widget[];
  past: Widget[][];
  future: Widget[][];
  editing: boolean;
  selectedId: string | null;
  /** Bumped on every local edit; autosave watches it. */
  revision: number;
  load: (widgets: Widget[]) => void;
  setEditing: (v: boolean) => void;
  select: (id: string | null) => void;
  add: (type: WidgetType, metric: MetricId, at?: Partial<Layout>) => string;
  update: (id: string, patch: Partial<Omit<Widget, "id">>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  tidy: () => void;
  applyLayout: (layout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => void;
  undo: () => void;
  redo: () => void;
};

export function allowedDimensions(type: WidgetType, metric: MetricId): Dimension[] {
  const metricDims = METRICS[metric].dimensions as readonly Dimension[];
  return (WIDGET_TYPES[type].dimensions as readonly Dimension[]).filter((d) => metricDims.includes(d));
}

const HISTORY_LIMIT = 50;

export const useBuilder = create<BuilderState>((set, get) => {
  /** Applies a change and records the previous state for undo. */
  const commit = (next: Widget[]) =>
    set((s) => ({
      widgets: next,
      past: [...s.past, s.widgets].slice(-HISTORY_LIMIT),
      future: [],
      revision: s.revision + 1,
    }));

  return {
    widgets: [],
    past: [],
    future: [],
    editing: false,
    selectedId: null,
    revision: 0,

    load: (widgets) => set({ widgets, past: [], future: [] }),
    setEditing: (editing) => set({ editing, selectedId: editing ? get().selectedId : null }),
    select: (selectedId) => set({ selectedId }),

    add: (type, metric, at) => {
      const id = crypto.randomUUID();
      const size = WIDGET_TYPES[type].defaultSize;
      const w = at?.w ?? size.w;
      const h = at?.h ?? size.h;
      const spot = at?.x !== undefined && at?.y !== undefined
        ? { x: at.x, y: at.y }
        : findSpot(get().widgets.map((x) => x.layout), w, h);
      const dims = allowedDimensions(type, metric);
      const widget: Widget = {
        id,
        type,
        title: METRICS[metric].label,
        config: {
          metric,
          dimension: dims[0] ?? "none",
          range: "30d",
          granularity: "day",
          compare: type === "kpi",
          limit: 10,
        },
        layout: { ...spot, w, h },
      };
      commit([...get().widgets, widget]);
      set({ selectedId: id });
      return id;
    },

    update: (id, patch) =>
      commit(
        get().widgets.map((w) =>
          w.id === id
            ? { ...w, ...patch, config: { ...w.config, ...patch.config }, layout: { ...w.layout, ...patch.layout } }
            : w,
        ),
      ),

    remove: (id) => {
      commit(get().widgets.filter((w) => w.id !== id));
      if (get().selectedId === id) set({ selectedId: null });
    },

    duplicate: (id) => {
      const src = get().widgets.find((w) => w.id === id);
      if (!src) return;
      const spot = findSpot(get().widgets.map((w) => w.layout), src.layout.w, src.layout.h);
      const copy = { ...src, id: crypto.randomUUID(), title: `${src.title} (copy)`, layout: { ...src.layout, ...spot } };
      commit([...get().widgets, copy]);
      set({ selectedId: copy.id });
    },

    tidy: () => commit(packWidgets(get().widgets)),

    applyLayout: (layout) => {
      const byId = new Map(layout.map((l) => [l.i, l]));
      const current = get().widgets;
      const changed = current.some((w) => {
        const l = byId.get(w.id);
        return l && (l.x !== w.layout.x || l.y !== w.layout.y || l.w !== w.layout.w || l.h !== w.layout.h);
      });
      if (!changed) return;
      commit(
        current.map((w) => {
          const l = byId.get(w.id);
          return l ? { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : w;
        }),
      );
    },

    undo: () =>
      set((s) =>
        s.past.length
          ? {
              widgets: s.past[s.past.length - 1],
              past: s.past.slice(0, -1),
              future: [s.widgets, ...s.future],
              revision: s.revision + 1,
            }
          : s,
      ),
    redo: () =>
      set((s) =>
        s.future.length
          ? {
              widgets: s.future[0],
              past: [...s.past, s.widgets],
              future: s.future.slice(1),
              revision: s.revision + 1,
            }
          : s,
      ),
  };
});
