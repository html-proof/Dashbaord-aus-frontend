"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  ArrowRight,
  BadgePercent,
  BarChart3,
  Boxes,
  Calendar,
  ChartNoAxesColumn,
  ChartPie,
  CreditCard,
  Database,
  DollarSign,
  Globe,
  Package,
  Plus,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  Trophy,
  MapPin,
  Users,
  Megaphone,
  Target,
  MousePointerClick,
  Eye,
  Coins,
  Activity,
  Percent,
  type LucideIcon,
  X,
  GripVertical,
  ChartLine,
  ChartArea,
  ChartColumn,
  GitCompareArrows,
  RotateCcw as ResetIcon,
} from "lucide-react";
import { DrillDialog, type DrillRequest } from "@/components/DrillDialog";
import { ResizableGrid, type GridBox } from "@/components/ResizableGrid";
import { api } from "@/lib/format";
import { useUiState } from "@/lib/use-ui-state";
import { useLiveStore } from "@/builder/useLiveStore";
import { WidgetView } from "@/widgets/WidgetView";
import { Insights } from "@/components/Insights";
import { DateRangeControl } from "@/components/FilterControls";
import { BREAKDOWN_LABELS, OverviewCustomizer } from "@/components/OverviewCustomizer";
import { mergePrefs, PALETTES, SALES_KPIS, type BreakdownId, type OverviewPrefs, type SectionId } from "@/lib/overview-prefs";
import { DIMENSIONS, METRICS, missingCapabilities, type Dimension, type MetricId, type MetricQuery, type RangePreset } from "@/metrics/registry";
import type { DrillPoint } from "@/widgets/WidgetView";
import type { Widget, WidgetType } from "@/widgets/types";

type Option = { id: string; label: string };

export const STORE_KEY = "overview-store";
export const STORE_SWITCH_EVENT = "store-switch";
/** Top-bar slot (in Nav) the overview portals its store and date pickers into on wide screens. */
export const TOPBAR_SLOT_ID = "topbar-controls";
type Fx = { currency: string; rate: number } | undefined;

export const CURRENCIES = {
  AUD: "Australian dollar",
  USD: "US dollar",
  NZD: "New Zealand dollar",
  EUR: "Euro",
  GBP: "British pound",
  CAD: "Canadian dollar",
  SGD: "Singapore dollar",
  INR: "Indian rupee",
  JPY: "Japanese yen",
} as const;
const CURRENCY_KEY = "overview-currency";

// Icon + tint per KPI, matching the metric's meaning.
const KPIS: { metric: MetricId; icon: LucideIcon; tint: string }[] = [
  { metric: "revenue", icon: ChartNoAxesColumn, tint: "text-emerald-400 bg-emerald-400/10" },
  { metric: "orders", icon: ShoppingCart, tint: "text-sky-400 bg-sky-400/10" },
  { metric: "aov", icon: Tag, tint: "text-teal-400 bg-teal-400/10" },
  { metric: "units_sold", icon: Package, tint: "text-violet-400 bg-violet-400/10" },
  { metric: "product_sales", icon: ShoppingBag, tint: "text-indigo-400 bg-indigo-400/10" },
  { metric: "discounts", icon: BadgePercent, tint: "text-fuchsia-400 bg-fuchsia-400/10" },
  { metric: "refunds", icon: RotateCcw, tint: "text-rose-400 bg-rose-400/10" },
  { metric: "new_customers", icon: Users, tint: "text-blue-400 bg-blue-400/10" },
];
const PROFIT_KPIS: { metric: MetricId; icon: LucideIcon; tint: string }[] = [
  { metric: "gross_profit", icon: BarChart3, tint: "text-emerald-400 bg-emerald-400/10" },
  { metric: "margin", icon: ChartPie, tint: "text-indigo-400 bg-indigo-400/10" },
  { metric: "cogs", icon: Database, tint: "text-sky-400 bg-sky-400/10" },
  { metric: "inventory_units", icon: Boxes, tint: "text-violet-400 bg-violet-400/10" },
  { metric: "inventory_value", icon: Package, tint: "text-blue-400 bg-blue-400/10" },
];
const MARKETING_KPIS: { metric: MetricId; icon: LucideIcon; tint: string }[] = [
  { metric: "ad_spend", icon: Megaphone, tint: "text-orange-400 bg-orange-400/10" },
  { metric: "roas", icon: Target, tint: "text-emerald-400 bg-emerald-400/10" },
  { metric: "ad_revenue", icon: Coins, tint: "text-teal-400 bg-teal-400/10" },
  { metric: "ad_clicks", icon: MousePointerClick, tint: "text-sky-400 bg-sky-400/10" },
  { metric: "ad_cpc", icon: Tag, tint: "text-fuchsia-400 bg-fuchsia-400/10" },
  { metric: "ad_impressions", icon: Eye, tint: "text-violet-400 bg-violet-400/10" },
  { metric: "sessions", icon: Activity, tint: "text-blue-400 bg-blue-400/10" },
  { metric: "conversion_rate", icon: Percent, tint: "text-indigo-400 bg-indigo-400/10" },
];
const TREND_METRICS: MetricId[] = ["revenue", "orders", "aov", "units_sold", "new_customers", "gross_profit", "refunds", "discounts"];
const KPI_META = Object.fromEntries([...KPIS, ...PROFIT_KPIS, ...MARKETING_KPIS].map((k) => [k.metric, k])) as Record<MetricId, (typeof KPIS)[number]>;
const TREND_ICONS: Partial<Record<MetricId, LucideIcon>> = { revenue: TrendingUp, orders: ShoppingCart, new_customers: Users, gross_profit: BarChart3 };

function widget(metric: MetricId, type: WidgetType, range: RangePreset, dimension: Dimension = "none", limit = 10, color?: string): Widget {
  return {
    id: `overview-${metric}-${type}-${dimension}`,
    type,
    title: METRICS[metric].label,
    config: {
      metric,
      dimension,
      range,
      granularity: range === "12m" || range === "ytd" ? "month" : range === "90d" ? "week" : "day",
      compare: type === "kpi",
      limit,
      ...(color ? { color } : {}),
    },
    layout: { x: 0, y: 0, w: 3, h: 3 },
  };
}

/** Approximate start date for the section header (the server resolves exact bounds in the store timezone). */
function rangeLabel(range: RangePreset): string {
  const end = new Date();
  const start = new Date(end);
  const f = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  if (range === "yesterday") {
    end.setDate(end.getDate() - 1);
    return f(end);
  }
  if (range === "7d") start.setDate(end.getDate() - 6);
  else if (range === "30d") start.setDate(end.getDate() - 29);
  else if (range === "90d") start.setDate(end.getDate() - 89);
  else if (range === "12m") start.setMonth(end.getMonth() - 11, 1);
  else if (range === "ytd") start.setMonth(0, 1);
  return range === "today" ? f(end) : `${f(start)} – ${f(end)}`;
}

/** Header label for a custom from/to range (dates are YYYY-MM-DD, store timezone). */
function customLabel({ from, to }: { from?: string; to?: string }): string {
  const f = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "…");
  return from === to ? f(from) : `${f(from)} – ${to ? f(to) : "today"}`;
}

/** Live store overview: the main content of the Dashboards page. */
export function StoreOverview({
  stores,
  homeDashboard,
  sections: allowed = null,
}: {
  stores: Option[];
  homeDashboard?: { id: string; name: string } | null;
  /** Sections shared with a limited viewer; null = all. */
  sections?: SectionId[] | null;
}) {
  const [storeId, setStoreIdState] = useState(stores[0]?.id ?? "");
  const setStoreId = (id: string) => {
    setStoreIdState(id);
    try {
      localStorage.setItem(STORE_KEY, id);
    } catch {}
    window.dispatchEvent(new CustomEvent(STORE_SWITCH_EVENT, { detail: id }));
  };
  useEffect(() => {
    try {
      // Read after mount so server and client HTML match; ignore stores that were removed.
      const saved = localStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && stores.some((s) => s.id === saved)) setStoreIdState(saved);
    } catch {}
    // The sidebar's store list switches stores through this event.
    const onSwitch = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (stores.some((s) => s.id === id)) setStoreIdState(id);
    };
    // Alt+1 ... Alt+9 jump to store N.
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= stores.length) {
        e.preventDefault();
        const id = stores[n - 1].id;
        setStoreIdState(id);
        try {
          localStorage.setItem(STORE_KEY, id);
        } catch {}
        window.dispatchEvent(new CustomEvent(STORE_SWITCH_EVENT, { detail: id }));
      }
    };
    window.addEventListener(STORE_SWITCH_EVENT, onSwitch);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(STORE_SWITCH_EVENT, onSwitch);
      window.removeEventListener("keydown", onKey);
    };
  }, [stores]);
  const [range, setRange] = useState<RangePreset>("30d");
  const [custom, setCustom] = useState<{ from?: string; to?: string }>({});
  const { ui, save: saveUi } = useUiState();
  const live = useLiveStore(storeId || null);

  // Personal look and layout (user_settings.overview_prefs). `draft` previews edits before the save lands.
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ overviewPrefs: OverviewPrefs }>("/api/settings"),
  });
  const [draft, setDraft] = useState<OverviewPrefs | null>(null);
  const prefs = draft ?? mergePrefs(settings.data?.overviewPrefs);
  const [customizing, setCustomizing] = useState(false);
  const savePrefs = useMutation({
    mutationFn: (overviewPrefs: OverviewPrefs) => api("/api/settings", { method: "PATCH", body: JSON.stringify({ overviewPrefs }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editPrefs = (p: OverviewPrefs) => {
    setDraft(p);
    qc.setQueryData(["settings"], (old: Record<string, unknown> | undefined) => ({ ...old, overviewPrefs: p }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePrefs.mutate(p), 500);
  };

  // "" = the store's own currency. Every visit starts on the saved default (Customize);
  // the dropdown only changes the current view, so a stray pick can't stick.
  const [currency, setCurrency] = useState("");
  const appliedDefaults = useRef(false);
  useEffect(() => {
    if (appliedDefaults.current || !settings.data) return;
    appliedDefaults.current = true;
    const p = mergePrefs(settings.data.overviewPrefs);
    try {
      localStorage.removeItem(CURRENCY_KEY); // drop picks persisted by older versions
    } catch {}
    // Applied once after the settings load (not in useState) so server and client HTML match.
    // Where the user left off (any device) wins over the saved defaults.
    setRange(ui?.range ?? p.defaultRange);
    setCustom({ from: ui?.from ?? undefined, to: ui?.to ?? undefined });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ui?.storeId && stores.some((s) => s.id === ui.storeId)) setStoreIdState(ui.storeId);
    setCurrency(p.defaultCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.data]);
  // Save the store and range as they change (after the saved ones were applied).
  useEffect(() => {
    if (!appliedDefaults.current || !storeId) return;
    saveUi({ storeId, range, from: custom.from ?? null, to: custom.to ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, range, custom.from, custom.to]);
  const pickCurrency = setCurrency;
  // The sidebar may already have the store list cached; wait for mount so server and client HTML match.
  const [mounted, setMounted] = useState(false);
  const [topbar, setTopbar] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setTopbar(document.getElementById(TOPBAR_SLOT_ID));
  }, []);
  const storeCurrencyLoaded =
    useQuery({
      queryKey: ["stores"],
      queryFn: () => api<{ stores: { id: string; currency: string | null }[] }>("/api/stores"),
    }).data?.stores.find((s) => s.id === storeId)?.currency ?? null;
  const storeCurrency = mounted ? storeCurrencyLoaded : null;
  const target = currency && storeCurrency && currency !== storeCurrency ? currency : null;
  const rate = useQuery({
    queryKey: ["fx", storeCurrency, target],
    enabled: !!target,
    // Re-check the market rate every 15s so converted amounts stay current.
    refetchInterval: 15_000,
    queryFn: () =>
      api<{ rate: number; source: string; asOf: string; stale?: boolean }>(`/api/fx?from=${storeCurrency}&to=${target}`),
  });
  const fx: Fx = target && rate.data ? { currency: target, rate: rate.data.rate } : undefined;

  // Tap any chart point, slice, bar, row or KPI to see the records behind it.
  const [drill, setDrill] = useState<DrillRequest | null>(null);
  const onPoint = (point: DrillPoint, query: MetricQuery) =>
    setDrill({
      query,
      point,
      currency: fx?.currency ?? storeCurrency, // the clicked value is in the display currency
      title: `${METRICS[query.metric].label}${query.dimension !== "none" && query.dimension !== "date" ? ` · ${DIMENSIONS[query.dimension]}` : ""}`,
    });

  if (!storeId) return null;
  const ok = (m: MetricId) => missingCapabilities(m, live.enabled).length === 0;
  const hidden = prefs.kpis.filter((m) => !ok(m)).map((m) => METRICS[m].label);
  const palette = PALETTES[prefs.palette].colors;
  const look: Look = { accent: prefs.accent, palette, kpiStyle: prefs.kpiStyle, compact: prefs.density === "compact" };
  const view = { storeId, enabled: live.enabled, shopDomain: live.shopDomain, fx, palette, dashboardFilters: custom, onPoint };
  const saveLayout = (section: "trends" | "breakdowns", boxes: GridBox[]) =>
    editPrefs({ ...prefs, layouts: { ...prefs.layouts, [section]: boxes } });
  const clearLayout = (section: "trends" | "breakdowns") => editPrefs({ ...prefs, layouts: { ...prefs.layouts, [section]: undefined } });
  const gap = look.compact ? "gap-2" : "gap-3";
  const color = prefs.accent ?? undefined;
  // Ad spend and ROAS join the sales row as soon as an ad platform is connected in Settings.
  const salesKpis = [...prefs.kpis.filter((m) => SALES_KPIS.includes(m)), "ad_spend" as const, "roas" as const].filter((m) => ok(m));
  const marketingKpis = MARKETING_KPIS.map((k) => k.metric).filter((m) => ok(m));
  const profitKpis = prefs.kpis.filter((m) => !SALES_KPIS.includes(m) && ok(m));

  const BREAKDOWNS: Record<BreakdownId, { icon: LucideIcon; height: string; show: boolean; choices?: [MetricId, string][]; metric: MetricId; dimension: Dimension; link?: string }> = {
    products: { icon: ChartNoAxesColumn, height: "h-80", show: ok("product_sales"), metric: "product_sales", dimension: "product", choices: [["product_sales", "By net sales"], ["units_sold", "By units"], ["gross_profit", "By profit"]] },
    channel: { icon: BarChart3, height: "h-80", show: ok("revenue"), metric: "revenue", dimension: "channel" },
    country: { icon: Globe, height: "h-72", show: ok("revenue"), metric: "revenue", dimension: "country" },
    locations: { icon: MapPin, height: "h-96", show: ok("units_sold"), metric: "units_sold", dimension: "location", link: "View all locations", choices: [["units_sold", "By units delivered"], ["orders", "By orders"], ["revenue", "By net sales"]] },
    customers: { icon: Users, height: "h-96", show: ok("revenue"), metric: "revenue", dimension: "customer", link: "View all customers", choices: [["revenue", "By amount paid"], ["orders", "By orders"], ["units_sold", "By units"]] },
    status: { icon: CreditCard, height: "h-72", show: ok("orders"), metric: "orders", dimension: "status" },
    bestsellers: { icon: Trophy, height: "h-96", show: ok("units_sold"), metric: "units_sold", dimension: "product", link: "View all products" },
    stock: { icon: Boxes, height: "h-96", show: ok("inventory_units"), metric: "inventory_units", dimension: "product", link: "View inventory" },
  };

  const sections: Record<SectionId, React.ReactNode> = {
    insights: <Insights storeId={storeId} range={range} from={custom.from} to={custom.to} />,
    sales: salesKpis.length > 0 && (
      <Section title="Sales" aside={<span className="flex items-center gap-1"><TrendingUp className="size-3.5" /> vs. previous period</span>}>
        <div className={`grid grid-cols-1 ${gap} sm:grid-cols-2 xl:grid-cols-4`}>
          {salesKpis.map((m) => <Kpi key={m} metric={m} range={range} view={view} look={look} />)}
        </div>
      </Section>
    ),
    profit: profitKpis.length > 0 && (
      <Section title="Profit & inventory">
        <div className={`grid grid-cols-1 ${gap} sm:grid-cols-2 xl:grid-cols-4`}>
          {profitKpis.map((m) => <Kpi key={m} metric={m} range={range} view={view} look={look} />)}
        </div>
      </Section>
    ),
    marketing: (
      <Section title="Marketing" aside={<Link href="/settings#integrations" className="hover:text-foreground">Manage integrations</Link>}>
        {marketingKpis.length === 0 ? (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-medium">See ad spend, ROAS and website sessions here</p>
              <p className="text-sm text-muted">Connect Meta, Google Ads, TikTok Ads or Google Analytics 4 with your account ID and keys.</p>
            </div>
            <Link href="/settings#integrations" className="btn btn-primary">Connect a platform</Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`grid grid-cols-1 ${gap} sm:grid-cols-2 xl:grid-cols-4`}>
              {marketingKpis.map((m) => <Kpi key={m} metric={m} range={range} view={view} look={look} />)}
            </div>
            {ok("ad_spend") && (
              <div className={`grid grid-cols-1 ${gap} lg:grid-cols-2`}>
                <div className="card p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Megaphone className="size-4 text-muted" /> Ad spend over time</p>
                  <div className="h-60">
                    <WidgetView widget={widget("ad_spend", "area", range, "date", 10, color)} {...view} />
                  </div>
                </div>
                <div className="card p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium"><ChartPie className="size-4 text-muted" /> Ad spend by platform</p>
                  <div className="h-60">
                    <WidgetView widget={widget("ad_spend", "pie", range, "platform", 10, color)} {...view} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Section>
    ),
    trends: prefs.trends.some((t) => ok(t.metric)) && (
      <Section
        title="Trends"
        aside={
          <span className="flex items-center gap-3">
            {prefs.layouts.trends && <ResetLayoutButton onClick={() => clearLayout("trends")} />}
            <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> {custom.from || custom.to ? customLabel(custom) : rangeLabel(range)}</span>
          </span>
        }
      >
        <ResizableGrid
          gap={look.compact ? 8 : 12}
          saved={prefs.layouts.trends}
          onChange={(boxes) => saveLayout("trends", boxes)}
          items={prefs.trends.flatMap((t, i) =>
            ok(t.metric)
              ? [{
                  id: `trend-${i}`,
                  w: 6,
                  h: look.compact ? 6 : 7,
                  minW: 3,
                  minH: 4,
                  node: (
                    <TrendCard
                      trend={t}
                      icon={TREND_ICONS[t.metric] ?? TrendingUp}
                      range={range}
                      view={view}
                      ok={ok}
                      color={color}
                      onChange={(next) => editPrefs({ ...prefs, trends: prefs.trends.map((x, j) => (j === i ? next : x)) })}
                    />
                  ),
                }]
              : [],
          )}
        />
      </Section>
    ),
    breakdowns: (
      <Section title="Breakdowns" aside={prefs.layouts.breakdowns && <ResetLayoutButton onClick={() => clearLayout("breakdowns")} />}>
        <ResizableGrid
          gap={look.compact ? 8 : 12}
          saved={prefs.layouts.breakdowns}
          onChange={(boxes) => saveLayout("breakdowns", boxes)}
          items={prefs.breakdowns.flatMap((b) => {
            const def = BREAKDOWNS[b.id];
            if (!b.visible || !def.show) return [];
            return [{
              id: b.id,
              w: 6,
              h: def.height === "h-96" ? 9 : def.height === "h-80" ? 8 : 7,
              minW: 3,
              minH: 4,
              node: (
                // id: jump target for the sidebar's "Customers" link.
                <div id={b.id === "customers" ? "customers" : undefined} className="h-full scroll-mt-20">
                  <BreakdownCard icon={def.icon} title={BREAKDOWN_LABELS[b.id]} className="h-full" choices={def.choices} ok={ok} link={def.link}>
                    {(m, full) => <WidgetView widget={widget(def.choices ? m : def.metric, full ? "table" : b.type, range, def.dimension, full ? 50 : 10, color)} bars={b.id === "country" && b.type === "table"} {...view} />}
                  </BreakdownCard>
                </div>
              ),
            }];
          })}
        />
      </Section>
    ),
  };

  const pickers = (
    <>
      {stores.length > 1 && (
        <IconSelect icon={ShoppingBag} label="Store" value={storeId} onChange={setStoreId}>
          {stores.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
        </IconSelect>
      )}
      <DateRangeControl
        preset={range}
        from={custom.from}
        to={custom.to}
        onChange={(d) => {
          if (d.range) setRange(d.range);
          setCustom({ from: d.from, to: d.to });
        }}
      />
    </>
  );

  return (
    <div className={look.compact ? "space-y-4" : "space-y-6"}>
      {!allowed && <StoreSwitcher stores={stores} active={storeId} onPick={setStoreId} fx={fx} palette={palette} />}

      {/* Page header */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Each dashboard is fully yours: pick charts, drag, resize, and save.
            {live.shopDomain && <> · {live.shopDomain} · live every 15s</>}
            {live.syncStatus === "syncing" && " · syncing with Shopify…"}
          </p>
          {homeDashboard && (
            <p className="mt-1 text-xs text-muted">
              Viewing the store overview ·{" "}
              <Link href="/dashboards" className="text-accent hover:underline">Back to your home dashboard ({homeDashboard.name})</Link>
            </p>
          )}
        </div>
        <IconSelect icon={DollarSign} label="Currency" value={currency} onChange={pickCurrency}>
          <option value="">{storeCurrency ? `${storeCurrency} - ${CURRENCIES[storeCurrency as keyof typeof CURRENCIES] ?? "store currency"}` : "Store currency"}</option>
          {Object.entries(CURRENCIES)
            .filter(([c]) => c !== storeCurrency)
            .map(([c, name]) => <option key={c} value={c}>{c} - {name}</option>)}
        </IconSelect>
        {/* Shown in the top bar on wide screens (portal below), here otherwise. */}
        <div className={clsx("flex flex-wrap items-center gap-3", topbar && "xl:hidden")}>{pickers}</div>
        {topbar && createPortal(pickers, topbar)}
        <button className="btn" onClick={() => setCustomizing(true)}>
          <SlidersHorizontal className="size-4" /> Customise
        </button>
      </div>
      {target && (
        <p className="-mt-3 text-xs text-muted">
          {rate.data && (
            <>
              Amounts in {target} · 1 {storeCurrency} = {rate.data.rate.toFixed(4)} {target} ({rate.data.source},{" "}
              {rate.data.source.includes("live") ? `updated ${new Date(rate.dataUpdatedAt).toLocaleTimeString()}` : rate.data.asOf}
              {rate.data.stale ? ", last known" : ""})
            </>
          )}
          {rate.isLoading && `Loading ${target} rate…`}
          {rate.error && <span className="text-negative">{(rate.error as Error).message}, showing {storeCurrency}</span>}
        </p>
      )}

      {live.loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="card h-24 animate-pulse" />)}
        </div>
      ) : (
        <>
          {prefs.sections.filter((s) => s.visible && (!allowed || allowed.includes(s.id))).map((s) => <Fragment key={s.id}>{sections[s.id]}</Fragment>)}
          {allowed?.length === 0 && <div className="card p-5 text-sm text-muted">No overview sections are shared with you. Open a shared report from Reports.</div>}

          {hidden.length > 0 && (
            <p className="text-xs text-muted">
              Not shown (your store doesn&apos;t provide this data yet): {hidden.join(", ")}. See the Stores page for how to enable them.
            </p>
          )}
        </>
      )}

      <DrillDialog req={drill} onClose={() => setDrill(null)} />

      {customizing && (
        <OverviewCustomizer prefs={prefs} onChange={editPrefs} onClose={() => setCustomizing(false)} saving={savePrefs.isPending} currencies={CURRENCIES} />
      )}
    </div>
  );
}

type View = {
  storeId: string;
  enabled: Set<string>;
  shopDomain: string | null;
  fx: Fx;
  palette: readonly string[];
  onPoint: (p: DrillPoint, q: MetricQuery) => void;
};
type Trend = OverviewPrefs["trends"][number];
type Look = { accent: string | null; palette: readonly string[]; kpiStyle: OverviewPrefs["kpiStyle"]; compact: boolean };

function ResetLayoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="flex items-center gap-1 hover:text-foreground" onClick={onClick} title="Put cards back to their default sizes">
      <ResetIcon className="size-3" /> Reset layout
    </button>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {aside && <div className="text-xs text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function Kpi({ metric, range, view, look }: { metric: MetricId; range: RangePreset; view: View; look: Look }) {
  const { icon: Icon, tint } = KPI_META[metric];
  const iconClass = clsx("grid size-10 shrink-0 place-items-center rounded-lg", !look.accent && look.kpiStyle !== "plain" && tint);
  const iconStyle: React.CSSProperties | undefined =
    look.kpiStyle === "plain"
      ? { color: look.accent ?? "var(--muted)" }
      : look.kpiStyle === "solid"
        ? { background: look.accent ?? "var(--accent)", color: "#fff" }
        : look.accent
          ? { color: look.accent, background: `${look.accent}1a` }
          : undefined;
  return (
    <div className={clsx("card flex items-start gap-4", look.compact ? "p-3" : "p-4")}>
      <span className={iconClass} style={iconStyle}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted">{METRICS[metric].label}</p>
        <div className={clsx("mt-1", look.compact ? "min-h-10" : "min-h-14")}>
          <WidgetView widget={widget(metric, "kpi", range)} compact {...view} />
        </div>
      </div>
    </div>
  );
}

const CHART_TYPES = [
  { id: "area", label: "Area", icon: ChartArea },
  { id: "line", label: "Line", icon: ChartLine },
  { id: "bar", label: "Bars", icon: ChartColumn },
] as const;

function TrendCard({
  trend,
  icon: Icon,
  range,
  view,
  ok,
  color,
  onChange,
}: {
  trend: Trend;
  icon: LucideIcon;
  range: RangePreset;
  view: View;
  ok: (m: MetricId) => boolean;
  color?: string;
  onChange: (t: Trend) => void;
}) {
  const w = widget(trend.metric, trend.type, range, "date", 10, color);
  if (trend.granularity) w.config.granularity = trend.granularity;
  w.config.compare = !!trend.compare;
  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="drag-handle flex cursor-move flex-wrap items-center gap-2 px-3 pt-3 pb-1">
        <GripVertical className="size-4 shrink-0 text-muted" aria-hidden />
        <Icon className="size-4 shrink-0 text-accent" style={color ? { color } : undefined} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">{METRICS[trend.metric].label} over time</h3>
        <select aria-label="Metric" className="input w-auto py-1 text-xs" value={trend.metric} onChange={(e) => onChange({ ...trend, metric: e.target.value as Trend["metric"] })}>
          {TREND_METRICS.filter(ok).map((id) => <option key={id} value={id}>{METRICS[id].label}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-1">
        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Chart type">
          {CHART_TYPES.map(({ id, label, icon: TypeIcon }) => (
            <button
              key={id}
              className={clsx("rounded-md p-1", trend.type === id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground")}
              onClick={() => onChange({ ...trend, type: id })}
              aria-pressed={trend.type === id}
              title={label}
            >
              <TypeIcon className="size-3.5" />
            </button>
          ))}
        </div>
        <select
          aria-label="Interval"
          className="input w-auto py-1 text-xs"
          value={trend.granularity ?? ""}
          onChange={(e) => onChange({ ...trend, granularity: (e.target.value || undefined) as Trend["granularity"] })}
        >
          <option value="">Auto interval</option>
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
        <button
          className={clsx("flex items-center gap-1 rounded-lg border px-2 py-1 text-xs", trend.compare ? "border-accent text-accent" : "border-border text-muted hover:text-foreground")}
          onClick={() => onChange({ ...trend, compare: !trend.compare })}
          aria-pressed={!!trend.compare}
          title="Overlay the previous period"
        >
          <GitCompareArrows className="size-3.5" /> Compare
        </button>
        <span className="ml-auto text-[11px] text-muted">Tap a point for details</span>
      </div>
      <div className="min-h-0 flex-1">
        <WidgetView widget={w} {...view} />
      </div>
    </div>
  );
}

function BreakdownCard({
  icon: Icon,
  title,
  className,
  choices,
  ok,
  link,
  children,
}: {
  icon: LucideIcon;
  title: string;
  className: string;
  choices?: [MetricId, string][];
  ok?: (m: MetricId) => boolean;
  link?: string;
  children: (metric: MetricId, full?: boolean) => React.ReactNode;
}) {
  const options = (choices ?? []).filter(([m]) => !ok || ok(m));
  const [m, setM] = useState<MetricId>(options[0]?.[0] ?? "revenue");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className={`card flex flex-col overflow-hidden ${className}`}>
      <div className="drag-handle flex cursor-move items-center gap-2 px-3 pt-3 pb-2">
        <GripVertical className="size-4 shrink-0 text-muted" aria-hidden />
        <Icon className="size-4 text-accent" />
        <h3 className="truncate text-sm font-medium">{title}</h3>
        {options.length > 1 && (
          <select aria-label={`${title} by`} className="input ml-auto w-auto py-1 text-xs" value={m} onChange={(e) => setM(e.target.value as MetricId)}>
            {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        )}
      </div>
      <div className="min-h-0 flex-1">{children(m)}</div>
      {link && (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 self-start px-4 pb-3 text-xs font-medium text-accent hover:underline">
          {link} <ArrowRight className="size-3" />
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={title} className="card flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <Icon className="size-4 text-accent" />
              <h3 className="text-sm font-medium">{title}</h3>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="ml-auto text-muted hover:text-current">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{children(m, true)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconSelect({
  icon: Icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative flex items-center">
      <Icon className="pointer-events-none absolute left-3 size-4 text-muted" />
      <select aria-label={label} className="input w-auto py-2 pl-9 pr-8 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

/** Pill per connected store plus a live "today" card for each, so several stores can be watched and switched at once. */
function StoreSwitcher({ stores, active, onPick, fx, palette }: { stores: Option[]; active: string; onPick: (id: string) => void; fx: Fx; palette: readonly string[] }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {stores.length > 1 && <span className="mr-1 text-xs text-muted">Switch store:</span>}
        {stores.length > 1 &&
          stores.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              title={i < 9 ? `Alt+${i + 1}` : undefined}
              className={clsx(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition",
                s.id === active ? "bg-accent/15 font-medium text-foreground ring-1 ring-accent/40" : "border border-border text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <ShoppingBag className={clsx("size-3.5", s.id === active && "text-accent")} />
              {s.label}
            </button>
          ))}
        <Link href="/stores" className="ml-auto flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted hover:text-foreground">
          <Plus className="size-3.5" /> Add store
        </Link>
      </div>
      {stores.length > 1 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {stores.map((s) => <StoreToday key={s.id} store={s} active={s.id === active} onPick={() => onPick(s.id)} fx={fx} palette={palette} />)}
        </div>
      )}
    </div>
  );
}

function StoreToday({ store, active, onPick, fx, palette }: { store: Option; active: boolean; onPick: () => void; fx: Fx; palette: readonly string[] }) {
  const live = useLiveStore(store.id);
  const view = { storeId: store.id, enabled: live.enabled, shopDomain: live.shopDomain, fx, palette };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => e.key === "Enter" && onPick()}
      className={clsx("card cursor-pointer p-3 transition hover:border-accent", active && "border-accent/60")}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className={clsx("size-2 rounded-full", live.connected ? "bg-positive" : "bg-muted")} title={live.connected ? "Live" : "Connecting"} />
        <span className="truncate font-medium">{store.label}</span>
        <span className="ml-auto text-xs text-muted">Today</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["revenue", "orders"] as const).map((m) => (
          <div key={m} className="min-w-0">
            <p className="text-xs text-muted">{METRICS[m].label}</p>
            <div className="min-h-8">
              <WidgetView widget={widget(m, "kpi", "today")} compact {...view} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
