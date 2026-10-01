"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, ShoppingBag } from "lucide-react";
import { clsx } from "clsx";
import { api, formatValue } from "@/lib/format";
import { STORE_KEY, STORE_SWITCH_EVENT } from "@/components/StoreOverview";
import type { AnnualPlan as Plan } from "@/lib/annual-plan";
import type { PlanMonth } from "@/db/schema";

type StoreOption = { id: string; label: string; shopDomain: string; currency: string | null; timezone: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type Field = "baseline" | "theme" | "forecast" | "stockBudget" | "units" | "ordered";
/** Form state is raw input text, so a blank field means "Auto" and "0" means zero. */
type MonthForm = Record<Field, string>;
type Form = { growth: string; cost: string; landed: string; months: MonthForm[] };

/** Blank -> null (Auto); otherwise the non-negative number, or null if it isn't one. */
const num = (s: string) => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const bad = (s: string) => s.trim() !== "" && num(s) === null;
const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

function toForm(p: Plan): Form {
  const s = p.saved;
  return {
    growth: s && s.growthPct !== 0 ? String(s.growthPct) : "",
    cost: str(s?.productCostPct ?? p.defaults.productCostPct),
    landed: str(s?.landedCost ?? p.defaults.landedCost),
    months: MONTHS.map((_, m) => {
      const o: PlanMonth = s?.months[m] ?? {};
      return {
        baseline: str(o.baseline ?? p.defaults.baseline[m]),
        theme: o.theme ?? "",
        forecast: str(o.forecast),
        stockBudget: str(o.stockBudget),
        units: str(o.units),
        ordered: str(o.ordered),
      };
    }),
  };
}

/** Annual plan: monthly revenue targets turned into a stock budget and unit counts. */
export function AnnualPlan({ stores }: { stores: StoreOption[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
       
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

  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const queryClient = useQueryClient();
  const plan = useQuery({
    queryKey: ["annual-plan", store.id, year],
    queryFn: () => api<Plan>(`/api/annual-plan?${new URLSearchParams({ storeId: store.id, year: String(year) })}`),
  });
  const data = plan.data;

  const [form, setForm] = useState<Form | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    // Reset the form whenever a different store or year loads.
     
    setForm(data ? toForm(data) : null);
    setDirty(false);
  }, [data]);

  const currency = data?.currency ?? store.currency;
  const money = (v: number) => formatValue(v, "currency", currency);
  const cents = (v: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: currency ?? "AUD" }).format(v);

  const calc = useMemo(() => {
    if (!data || !form) return null;
    const growth = Number(form.growth) || 0;
    const cost = num(form.cost) ?? 0;
    const landed = num(form.landed) ?? 0;
    const rows = form.months.map((f, m) => {
      const baseline = num(f.baseline) ?? data.defaults.baseline[m];
      const autoForecast = baseline * (1 + growth / 100);
      const forecast = num(f.forecast) ?? autoForecast;
      const autoStock = (forecast * cost) / 100;
      const stock = num(f.stockBudget) ?? autoStock;
      const autoUnits = landed > 0 ? Math.ceil(stock / landed - 1e-9) : 0;
      const days = data.defaults.daysInMonth[m];
      const done = data.defaults.completedDays[m];
      const actual = data.defaults.actual[m];
      // Progress against the share of the forecast due by the completed days.
      const due = (forecast * done) / days;
      return {
        autoForecast, forecast, autoStock, stock, autoUnits, actual, done,
        units: num(f.units) ?? autoUnits,
        ordered: num(f.ordered) ?? 0,
        daily: forecast / days,
        pace: done > 0 && due > 0 ? (100 * actual) / due : null,
      };
    });
    const sum = (k: "forecast" | "stock" | "units" | "ordered" | "actual") => rows.reduce((a, r) => a + r[k], 0);
    return { rows, forecast: sum("forecast"), stock: sum("stock"), units: sum("units"), ordered: sum("ordered"), actual: sum("actual") };
  }, [data, form]);

  const touch = () => {
    setDirty(true);
    setStatus(null);
  };
  const set = (patch: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    touch();
  };
  const setMonth = (m: number, k: Field, v: string) => {
    setForm((f) => (f ? { ...f, months: f.months.map((x, i) => (i === m ? { ...x, [k]: v } : x)) } : f));
    touch();
  };

  const save = async () => {
    if (!form || !data) return;
    const growth = form.growth.trim() === "" ? 0 : Number(form.growth);
    const numeric = [form.cost, form.landed, ...form.months.flatMap((f) => [f.baseline, f.forecast, f.stockBudget, f.units, f.ordered])];
    if (numeric.some(bad) || !Number.isFinite(growth) || growth < -100) {
      setStatus({ kind: "error", text: "Fix the highlighted fields: numbers only, no negatives." });
      return;
    }
    const whole = (s: string) => (num(s) === null ? undefined : Math.round(num(s)!));
    setSaving(true);
    try {
      await api("/api/annual-plan", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          year,
          growthPct: growth,
          productCostPct: num(form.cost),
          landedCost: num(form.landed),
          months: form.months.map((f, m) => {
            const baseline = num(f.baseline);
            return {
              // Keep the baseline only when it differs from Shopify's figure, so it follows new data.
              baseline: baseline === null || baseline === data.defaults.baseline[m] ? undefined : baseline,
              theme: f.theme.trim() || undefined,
              forecast: num(f.forecast) ?? undefined,
              stockBudget: num(f.stockBudget) ?? undefined,
              units: whole(f.units),
              ordered: whole(f.ordered),
            };
          }),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["annual-plan", store.id, year] });
      setStatus({ kind: "ok", text: "Annual plan saved" });
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const d = data?.defaults;
  const saveButton = (
    <button className="btn btn-primary whitespace-nowrap" onClick={save} disabled={!form || saving}>
      {saving ? "Saving…" : "Save annual plan"}
    </button>
  );
  const savedHint = !data
    ? "Loading…"
    : data.saved
      ? `Saved ${new Date(data.saved.updatedAt).toLocaleString("en-AU")}`
      : "Not saved yet — showing Shopify-based defaults";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Look ahead with confidence</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">A plan for the year ahead.</h1>
          <p className="mt-1 text-muted">Turn your sales targets into a stock and revenue plan.</p>
        </div>
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
      </div>

      {plan.error && <div className="card p-4 text-sm text-negative">{(plan.error as Error).message}</div>}

      <div className="card grid gap-5 p-6 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <Setting label="Planning year" hint={savedHint}>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </Setting>
        <Setting label="Default growth (%)" hint="Applied to every month's baseline">
          <input className="input" inputMode="decimal" placeholder="0" value={form?.growth ?? ""} onChange={(e) => set({ growth: e.target.value })} />
        </Setting>
        <Setting
          label="Product cost (% of net sales)"
          hint={
            d?.productCostPct != null
              ? `Measured last 12 months: ${d.productCostPct}% (costs cover ${Math.round(100 * (d.costCoverage ?? 0))}% of sales)`
              : "No Shopify product costs yet — enter your own"
          }
        >
          <input className={clsx("input", form && bad(form.cost) && "ring-1 ring-negative")} inputMode="decimal" value={form?.cost ?? ""} onChange={(e) => set({ cost: e.target.value })} />
        </Setting>
        <Setting
          label={`Landed cost per unit (${currency ?? "$"})`}
          hint={d?.landedCost != null ? `Average cost of units sold, last 12 months: ${cents(d.landedCost)}` : "No cost data yet — enter your own"}
        >
          <input className={clsx("input", form && bad(form.landed) && "ring-1 ring-negative")} inputMode="decimal" value={form?.landed ?? ""} onChange={(e) => set({ landed: e.target.value })} />
        </Setting>
        <div className="flex items-start xl:pt-7">{saveButton}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          label="Annual revenue target"
          value={calc ? money(calc.forecast) : "–"}
          sub={calc ? `Forecasts + your monthly overrides (excl. tax) · actual so far ${money(calc.actual)}` : ""}
        />
        <Kpi label="Stock budget" value={calc ? money(calc.stock) : "–"} sub="Planned purchasing budget; excludes stock on hand" />
        <Kpi
          label="Required units"
          value={calc ? formatValue(calc.units, "number", null) : "–"}
          sub={calc ? `${formatValue(calc.ordered, "number", null)} units ordered` : ""}
        />
      </div>

      <div className="card flex gap-3 p-4 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Edit the baseline, sales theme, forecast, stock budget, required units and ordered units. Blank override fields use Auto; entering 0 is an
          intentional zero. The baseline defaults to last year&apos;s Shopify net sales for the same month; actual revenue always comes from Shopify
          and cannot be edited.
        </p>
      </div>

      <div className={clsx("card overflow-x-auto transition", plan.isFetching && "opacity-70")}>
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              {["Month", "Baseline excl. tax", "Sales theme", "Revenue forecast", "Daily target", "Actual revenue", "Stock budget", "Required units", "Ordered units"].map(
                (h, i) => (
                  <th key={h} className={clsx("px-4 py-3 font-medium", i === 0 && "sticky left-0 bg-surface", (i === 4 || i === 5) && "text-right")}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {form && calc && d
              ? calc.rows.map((r, m) => {
                  const f = form.months[m];
                  const input = (k: Field, label: string, w = "w-32") => (
                    <input
                      className={clsx("input", w, bad(f[k]) && "ring-1 ring-negative")}
                      inputMode="decimal"
                      placeholder="Auto"
                      value={f[k]}
                      onChange={(e) => setMonth(m, k, e.target.value)}
                      aria-label={`${MONTHS[m]} ${label}`}
                    />
                  );
                  return (
                    <tr key={m} className="border-b border-border/60 align-top last:border-0">
                      <td className="sticky left-0 bg-surface px-4 py-3 font-semibold">{MONTHS[m]}</td>
                      <td className="px-4 py-3">
                        {input("baseline", "baseline")}
                        <p className="mt-1.5 text-xs text-muted">Shopify {year - 1}: {cents(d.baseline[m])}</p>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="input w-48"
                          maxLength={120}
                          placeholder="e.g. Black Friday"
                          value={f.theme}
                          onChange={(e) => setMonth(m, "theme", e.target.value)}
                          aria-label={`${MONTHS[m]} sales theme`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {input("forecast", "revenue forecast")}
                        <p className="mt-1.5 text-xs text-muted">Auto: {cents(r.autoForecast)}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{cents(r.daily)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono tabular-nums">{cents(r.actual)}</span>
                        <p className="mt-1.5 text-xs text-muted">
                          {r.done} completed {r.done === 1 ? "day" : "days"}
                          {r.pace !== null && (
                            <span className={clsx(r.pace >= 100 ? "text-positive" : r.pace < 80 && "text-warning")}>
                              {" "}· {Math.round(r.pace)}% of forecast
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {input("stockBudget", "stock budget")}
                        <p className="mt-1.5 text-xs text-muted">Auto: {cents(r.autoStock)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {input("units", "required units", "w-24")}
                        <p className="mt-1.5 text-xs text-muted">Auto: {formatValue(r.autoUnits, "number", null)}</p>
                      </td>
                      <td className="px-4 py-3">{input("ordered", "ordered units", "w-24")}</td>
                    </tr>
                  );
                })
              : !plan.error && (
                  <tr>
                    <td colSpan={9} className="p-5">
                      <div className="h-40 animate-pulse rounded-md bg-surface-2" />
                    </td>
                  </tr>
                )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted">
        Auto forecast = baseline × (1 + growth). Auto stock budget = forecast × product cost %. Auto units = stock budget ÷ landed cost per unit,
        rounded up. Manual overrides are kept when defaults change. These are planning scenarios, not guaranteed outcomes.
      </p>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        {status && <span className={clsx("text-sm", status.kind === "ok" ? "text-positive" : "text-negative")}>{status.text}</span>}
        {dirty && !status && <span className="text-sm text-muted">Unsaved changes</span>}
        {saveButton}
      </div>
    </div>
  );
}

function Setting({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
      <span className="mt-2 block text-xs text-muted">{hint}</span>
    </label>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-6">
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-sm text-muted">{sub}</p>
    </div>
  );
}
