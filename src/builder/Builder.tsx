"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from "react-grid-layout";
import { Check, GripVertical, LayoutGrid, Pencil, Redo2, Settings2, Sparkles, Undo2, X } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/format";
import { CAPABILITIES } from "@/metrics/capabilities";
import { CAPABILITY_WIDGETS, packWidgets, placeWidgets, WIDGET_TYPES, type Widget } from "@/widgets/types";
import { WidgetView } from "@/widgets/WidgetView";
import { useBuilder } from "@/builder/store";
import { useLiveStore, type LiveNotice } from "@/builder/useLiveStore";
import { WidgetLibrary, dragPayload } from "@/builder/WidgetLibrary";
import { ConfigDrawer } from "@/builder/ConfigDrawer";
import { DeleteDashboardButton } from "@/components/DeleteDashboardButton";
import { HomeToggle } from "@/components/HomeToggle";
import { FilterBar } from "@/components/FilterControls";
import { DrillDialog, type DrillRequest } from "@/components/DrillDialog";
import { filtersFromSearchParams, filtersToSearchParams } from "@/metrics/filters";
import type { Filters } from "@/metrics/registry";

type Props = {
  dashboard: { id: string; name: string; storeId: string | null; widgets: Widget[] };
  stores: { id: string; label: string }[];
};

type SaveState = "saved" | "saving" | "error";

export function Builder({ dashboard, stores }: Props) {
  const b = useBuilder();
  const [name, setName] = useState(dashboard.name);
  const [storeId, setStoreId] = useState(dashboard.storeId);
  const [save, setSave] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<LiveNotice | null>(null);
  const [drill, setDrill] = useState<DrillRequest | null>(null);
  const loadedRevision = useRef<number | null>(null);
  const { width, containerRef, mounted } = useContainerWidth();

  // Dashboard-wide filters live in the URL so filtered views can be shared/bookmarked.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dashboardFilters = useMemo(() => filtersFromSearchParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const setDashboardFilters = (f: Filters) => {
    const qs = filtersToSearchParams(f).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Load server state once per dashboard.
  useEffect(() => {
    b.load(dashboard.widgets);
    b.setEditing(dashboard.widgets.length === 0);
    loadedRevision.current = useBuilder.getState().revision;
    // Dashboards saved before gap-filling placement can have widgets piled in one
    // column; repack them once (this saves automatically and can be undone).
    const packed = packWidgets(dashboard.widgets);
    if (packed.some((w, i) => w.layout.x !== dashboard.widgets[i].layout.x || w.layout.y !== dashboard.widgets[i].layout.y)) {
      b.tidy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard.id]);

  const onCapabilitiesChanged = useCallback(
    async (n: LiveNotice) => {
      if (!n.added.length) return;
      // If the server auto-added widgets (user setting) and we have no unsaved edits, pull them in.
      if (useBuilder.getState().revision === loadedRevision.current) {
        const fresh = await api<{ widgets: Widget[] }>(`/api/dashboards/${dashboard.id}`);
        if (fresh.widgets.length !== useBuilder.getState().widgets.length) {
          useBuilder.getState().load(fresh.widgets);
        }
      }
      setNotice(n);
    },
    [dashboard.id],
  );

  const live = useLiveStore(storeId, onCapabilitiesChanged);

  // Debounced autosave of layout/config changes.
  useEffect(() => {
    if (loadedRevision.current === null || b.revision === loadedRevision.current) return;
    setSave("saving");
    const t = setTimeout(async () => {
      try {
        await api(`/api/dashboards/${dashboard.id}`, {
          method: "PATCH",
          body: JSON.stringify({ widgets: useBuilder.getState().widgets }),
        });
        loadedRevision.current = useBuilder.getState().revision;
        setSave("saved");
      } catch {
        setSave("error");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [b.revision, dashboard.id]);

  // Undo / redo shortcuts while editing.
  useEffect(() => {
    if (!b.editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      e.preventDefault();
      if (e.shiftKey) b.redo();
      else b.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [b.editing, b]);

  const patchMeta = async (patch: { name?: string; storeId?: string }) => {
    setSave("saving");
    try {
      await api(`/api/dashboards/${dashboard.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setSave("saved");
    } catch {
      setSave("error");
    }
  };

  const layout: Layout = b.widgets.map((w) => ({
    i: w.id,
    ...w.layout,
    minW: 2,
    minH: 2,
  }));

  // Widgets suggested by newly-unlocked capabilities that aren't on the canvas yet.
  const suggestions = (notice?.added ?? [])
    .flatMap((k) => CAPABILITY_WIDGETS[k] ?? [])
    .filter((s) => !b.widgets.some((w) => w.config.metric === s.config.metric && w.type === s.type));

  if (!storeId) {
    return (
      <div className="card flex items-center justify-between gap-3 p-6 text-sm">
        <span>
          This dashboard has no store. Connect one on the <a className="text-accent" href="/stores">Stores</a> page.
        </span>
        <DeleteDashboardButton id={dashboard.id} name={name} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Dashboard name"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-xl font-semibold outline-none focus:bg-surface sm:flex-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== dashboard.name && patchMeta({ name })}
        />
        <select
          aria-label="Store"
          className="input w-auto"
          value={storeId}
          onChange={(e) => {
            setStoreId(e.target.value);
            patchMeta({ storeId: e.target.value });
          }}
        >
          {stores.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <span className={clsx("text-xs", save === "error" ? "text-negative" : "text-muted")}>
          {save === "saving" ? "Saving…" : save === "error" ? "Save failed, retrying on next change" : "All changes saved"}
        </span>
        {live.syncStatus === "syncing" && <span className="text-xs text-warning">Syncing with Shopify…</span>}
        <span
          title={live.connected ? "Live updates connected" : "Reconnecting to live updates…"}
          className={clsx("size-2 rounded-full", live.connected ? "bg-positive" : "bg-muted")}
        />
        <div className="ml-auto flex gap-2">
          <HomeToggle id={dashboard.id} />
          {b.editing && (
            <>
              <DeleteDashboardButton id={dashboard.id} name={name} />
              <button className="btn px-2" onClick={b.tidy} aria-label="Tidy layout" title="Tidy layout (fill gaps)">
                <LayoutGrid className="size-4" />
              </button>
              <button className="btn px-2" onClick={b.undo} disabled={!b.past.length} aria-label="Undo" title="Undo (Ctrl+Z)">
                <Undo2 className="size-4" />
              </button>
              <button className="btn px-2" onClick={b.redo} disabled={!b.future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
                <Redo2 className="size-4" />
              </button>
            </>
          )}
          <button className={clsx("btn", b.editing && "btn-primary")} onClick={() => b.setEditing(!b.editing)}>
            {b.editing ? <><Check className="size-4" /> Done</> : <><Pencil className="size-4" /> Customize</>}
          </button>
        </div>
      </div>

      <FilterBar storeId={storeId} value={dashboardFilters} onChange={setDashboardFilters} />

      {/* Live capability notice */}
      {notice && (notice.added.length > 0 || notice.removed.length > 0) && (
        <div className="card flex flex-wrap items-center gap-3 border-accent/40 p-3 text-sm" role="status">
          <Sparkles className="size-4 text-accent" />
          <span className="flex-1">
            {notice.added.length > 0 && (
              <>Your store now supports <b>{notice.added.map((k) => CAPABILITIES[k].label).join(", ")}</b>. </>
            )}
            {notice.removed.length > 0 && (
              <>No longer available: {notice.removed.map((k) => CAPABILITIES[k].label).join(", ")}.</>
            )}
          </span>
          {suggestions.length > 0 && (
            <button
              className="btn btn-primary py-1.5"
              onClick={() => {
                const placed = placeWidgets(suggestions, b.widgets, () => crypto.randomUUID());
                placed.forEach((w) => b.add(w.type, w.config.metric, w.layout));
                setNotice(null);
              }}
            >
              Add {suggestions.length} widget{suggestions.length > 1 ? "s" : ""}
            </button>
          )}
          <button className="text-muted" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="size-4" /></button>
        </div>
      )}

      <div className={clsx("grid gap-4", b.editing && "lg:grid-cols-[240px_1fr]", b.selectedId && b.editing && "xl:grid-cols-[240px_1fr_300px]")}>
        {b.editing && (
          <div className="lg:sticky lg:top-20 lg:self-start">
            <WidgetLibrary enabled={live.enabled} shopDomain={live.shopDomain} />
          </div>
        )}

        <div
          ref={containerRef}
          className={clsx("min-h-[60vh] rounded-xl", b.editing && "bg-surface-2/60 outline-2 outline-dashed outline-border")}
        >
          {mounted && (
            <ReactGridLayout
              width={width}
              layout={layout}
              compactor={verticalCompactor}
              gridConfig={{ cols: 12, rowHeight: 40, margin: [12, 12] }}
              dragConfig={{ enabled: b.editing, handle: ".drag-handle" }}
              resizeConfig={{ enabled: b.editing }}
              dropConfig={{
                enabled: b.editing,
                defaultItem: { w: 3, h: 3 },
                onDragOver: () => {
                  const p = dragPayload.current;
                  return p ? WIDGET_TYPES[p.type].defaultSize : false;
                },
              }}
              onLayoutChange={(l) => b.editing && b.applyLayout(l)}
              onDrop={(_layout, item) => {
                const p = dragPayload.current;
                dragPayload.current = null;
                if (p && item) b.add(p.type, p.metric, { x: item.x, y: item.y });
              }}
            >
              {b.widgets.map((w) => (
                <div
                  key={w.id}
                  className={clsx(
                    "card flex flex-col overflow-hidden",
                    b.editing && b.selectedId === w.id && "ring-2 ring-accent",
                  )}
                >
                  <div className="flex items-center gap-1 px-4 pt-3 pb-1">
                    {b.editing && (
                      <GripVertical className="drag-handle -ml-2 size-4 shrink-0 cursor-move text-muted" aria-label="Drag to move" />
                    )}
                    <h3 className="truncate text-sm font-medium text-muted">{w.title}</h3>
                    {b.editing && (
                      <button
                        className="ml-auto text-muted hover:text-foreground"
                        onClick={() => b.select(w.id)}
                        aria-label={`Edit ${w.title}`}
                      >
                        <Settings2 className="size-4" />
                      </button>
                    )}
                  </div>
                  <div className="min-h-0 flex-1">
                    <WidgetView
                      widget={w}
                      storeId={storeId}
                      enabled={live.enabled}
                      shopDomain={live.shopDomain}
                      dashboardFilters={dashboardFilters}
                      onPoint={b.editing ? undefined : (point, query) => setDrill({ query, point, title: w.title, currency: null })}
                    />
                  </div>
                </div>
              ))}
            </ReactGridLayout>
          )}
          {mounted && b.widgets.length === 0 && (
            <p className="p-10 text-center text-sm text-muted">
              Drag a chart from the left onto this canvas to start building.
            </p>
          )}
        </div>

        {b.editing && b.selectedId && (
          <div className="lg:col-span-2 xl:col-span-1">
            <ConfigDrawer enabled={live.enabled} storeId={storeId} />
          </div>
        )}
      </div>
      <DrillDialog req={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
