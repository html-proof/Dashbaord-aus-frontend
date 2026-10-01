"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Italic, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { METRICS, RANGE_PRESETS, type RangePreset } from "@/metrics/registry";
import {
  ACCENTS,
  BACKGROUNDS,
  BREAKDOWN_TYPES,
  DEFAULT_PREFS,
  FONTS,
  KPI_METRICS,
  PALETTES,
  SECTION_LABELS,
  TREND_TYPES,
  type BackgroundId,
  type BreakdownId,
  type FontId,
  type OverviewPrefs,
  type PaletteId,
} from "@/lib/overview-prefs";

export const BREAKDOWN_LABELS: Record<BreakdownId, string> = {
  products: "Top products",
  channel: "Sales by channel",
  country: "Sales by country",
  locations: "Top delivery locations",
  customers: "Top customers",
  status: "Orders by payment status",
  bestsellers: "Best sellers (units)",
  stock: "Stock by product",
};

const TEXT_COLORS = ["#ffffff", "#e8ecf6", "#fde68a", "#bae6fd", "#14171c", "#1e3a8a", "#7c2d12", "#14532d"];

const TABS = ["Theme", "Look", "Layout", "Charts", "Defaults"] as const;
type Tab = (typeof TABS)[number];

function move<T>(list: T[], i: number, by: number): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Slide-over for styling and arranging the store overview. Changes apply live; the parent saves them. */
export function OverviewCustomizer({
  prefs,
  onChange,
  onClose,
  saving,
  currencies,
}: {
  prefs: OverviewPrefs;
  onChange: (p: OverviewPrefs) => void;
  onClose: () => void;
  saving: boolean;
  currencies: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>("Theme");
  const set = <K extends keyof OverviewPrefs>(k: K, v: OverviewPrefs[K]) => onChange({ ...prefs, [k]: v });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Customise overview" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <header className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Customise overview</h2>
            <p className="text-xs text-muted">{saving ? "Saving…" : "Changes are saved automatically and only affect you."}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </header>
        <nav className="flex gap-1 border-b border-border px-3">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx("border-b-2 px-3 py-2 text-sm", tab === t ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-foreground")}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {tab === "Theme" && (
            <>
              <Field label="Background" hint="Colour of the page and cards across the whole app.">
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(BACKGROUNDS) as [BackgroundId, (typeof BACKGROUNDS)[BackgroundId]][]).map(([id, bg]) => (
                    <button
                      key={id}
                      onClick={() => onChange({ ...prefs, background: id, customBackground: null })}
                      className={clsx("rounded-lg border-2 p-1 text-left text-xs", prefs.background === id && !prefs.customBackground ? "border-accent" : "border-border hover:border-muted")}
                    >
                      <span
                        className="mb-1 flex h-10 items-end gap-1 rounded p-1.5"
                        style={bg ? { background: bg.background } : { background: "linear-gradient(135deg, #f6f7f9 50%, #0b1020 50%)" }}
                      >
                        <span className="h-4 flex-1 rounded-sm" style={{ background: bg ? bg.surface : "#ffffff", border: `1px solid ${bg ? bg.border : "#e3e6eb"}` }} />
                        <span className="h-6 flex-1 rounded-sm" style={{ background: bg ? bg.surface : "#111830", border: `1px solid ${bg ? bg.border : "#232d4b"}` }} />
                      </span>
                      {bg ? bg.label : "Default (auto)"}
                    </button>
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="color"
                    className="size-8 cursor-pointer rounded border border-border bg-transparent"
                    value={prefs.customBackground ?? "#1e293b"}
                    onChange={(e) => set("customBackground", e.target.value)}
                  />
                  <span className={clsx(prefs.customBackground ? "font-medium" : "text-muted")}>
                    {prefs.customBackground ? `Custom ${prefs.customBackground}` : "Pick any colour"}
                  </span>
                  {prefs.customBackground && (
                    <button className="text-xs text-accent hover:underline" onClick={() => set("customBackground", null)}>Clear</button>
                  )}
                </label>
              </Field>

              <Field label="Font">
                <select className="input" value={prefs.font} onChange={(e) => set("font", e.target.value as FontId)} style={{ fontFamily: FONTS[prefs.font].css }}>
                  {(Object.entries(FONTS) as [FontId, (typeof FONTS)[FontId]][]).map(([id, f]) => (
                    <option key={id} value={id} style={{ fontFamily: f.css }}>{f.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Text style">
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented value={prefs.fontWeight} onChange={(v) => set("fontWeight", v)} options={[["normal", "Regular"], ["medium", "Medium"], ["bold", "Bold"]]} />
                  <button
                    onClick={() => set("italic", !prefs.italic)}
                    aria-pressed={prefs.italic}
                    title="Italic"
                    className={clsx("grid size-9 place-items-center rounded-lg border", prefs.italic ? "border-accent bg-accent text-accent-fg" : "border-border text-muted hover:text-foreground")}
                  >
                    <Italic className="size-4" />
                  </button>
                </div>
              </Field>

              <Field label="Text size">
                <Segmented value={prefs.fontSize} onChange={(v) => set("fontSize", v)} options={[["small", "Small"], ["normal", "Normal"], ["large", "Large"]]} />
              </Field>

              <Field label="Text colour" hint="Auto picks a colour that reads well on your background.">
                <div className="flex flex-wrap items-center gap-2">
                  <Swatch active={prefs.textColor === null} onClick={() => set("textColor", null)} label="Auto">
                    <span className="grid size-full place-items-center rounded-full border border-border text-[10px]">A</span>
                  </Swatch>
                  {TEXT_COLORS.map((c) => (
                    <Swatch key={c} active={prefs.textColor === c} onClick={() => set("textColor", c)} label={c}>
                      <span className="size-full rounded-full border border-border" style={{ background: c }} />
                    </Swatch>
                  ))}
                  <input type="color" className="size-8 cursor-pointer rounded border border-border bg-transparent" value={prefs.textColor ?? "#e8ecf6"} onChange={(e) => set("textColor", e.target.value)} />
                </div>
              </Field>

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs text-muted">Preview</p>
                <p className="text-lg">Aa · Net sales $1,234.56</p>
                <p className="text-sm text-muted">14 orders waiting to ship</p>
              </div>
            </>
          )}

          {tab === "Look" && (
            <>
              <Field label="Accent colour" hint="Used for charts and KPI icons. Auto keeps a different colour per KPI.">
                <div className="flex flex-wrap items-center gap-2">
                  <Swatch active={prefs.accent === null} onClick={() => set("accent", null)} label="Auto">
                    <span className="size-full rounded-full bg-[conic-gradient(#34d399,#38bdf8,#818cf8,#f472b6,#fb923c,#34d399)]" />
                  </Swatch>
                  {ACCENTS.map((c) => (
                    <Swatch key={c} active={prefs.accent === c} onClick={() => set("accent", c)} label={c}>
                      <span className="size-full rounded-full" style={{ background: c }} />
                    </Swatch>
                  ))}
                  <label className="ml-1 flex items-center gap-2 text-xs text-muted">
                    Custom
                    <input type="color" className="size-8 cursor-pointer rounded border border-border bg-transparent" value={prefs.accent ?? "#818cf8"} onChange={(e) => set("accent", e.target.value)} />
                  </label>
                </div>
              </Field>
              <Field label="Chart palette" hint="Colours for pie slices and multi-colour charts.">
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(PALETTES) as [PaletteId, (typeof PALETTES)[PaletteId]][]).map(([id, p]) => (
                    <button
                      key={id}
                      onClick={() => set("palette", id)}
                      className={clsx("rounded-lg border p-2 text-left text-xs", prefs.palette === id ? "border-accent" : "border-border hover:border-muted")}
                    >
                      <span className="mb-1.5 flex h-3 overflow-hidden rounded">
                        {p.colors.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
                      </span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="KPI card style">
                <Segmented value={prefs.kpiStyle} onChange={(v) => set("kpiStyle", v)} options={[["tinted", "Tinted"], ["solid", "Solid"], ["plain", "Plain"]]} />
              </Field>
              <Field label="Density">
                <Segmented value={prefs.density} onChange={(v) => set("density", v)} options={[["comfortable", "Comfortable"], ["compact", "Compact"]]} />
              </Field>
            </>
          )}

          {tab === "Layout" && (
            <>
              <Field label="Sections" hint="Show, hide and reorder the parts of the overview.">
                <ul className="space-y-1.5">
                  {prefs.sections.map((s, i) => (
                    <Row key={s.id} label={SECTION_LABELS[s.id]} dim={!s.visible}>
                      <Reorder onUp={() => set("sections", move(prefs.sections, i, -1))} onDown={() => set("sections", move(prefs.sections, i, 1))} />
                      <VisibleToggle visible={s.visible} onClick={() => set("sections", prefs.sections.map((x) => (x.id === s.id ? { ...x, visible: !x.visible } : x)))} />
                    </Row>
                  ))}
                </ul>
              </Field>
              <Field label="KPI cards" hint="Tick the numbers you want and put them in order. Sales KPIs show under Sales, the rest under Profit & inventory.">
                <ul className="space-y-1.5">
                  {prefs.kpis.map((m, i) => (
                    <Row key={m} label={METRICS[m].label}>
                      <Reorder onUp={() => set("kpis", move(prefs.kpis, i, -1))} onDown={() => set("kpis", move(prefs.kpis, i, 1))} />
                      <IconButton label="Remove" onClick={() => set("kpis", prefs.kpis.filter((x) => x !== m))}><Trash2 className="size-4" /></IconButton>
                    </Row>
                  ))}
                  {KPI_METRICS.filter((m) => !prefs.kpis.includes(m)).map((m) => (
                    <Row key={m} label={METRICS[m].label} dim>
                      <IconButton label="Add" onClick={() => set("kpis", [...prefs.kpis, m])}><Plus className="size-4" /></IconButton>
                    </Row>
                  ))}
                </ul>
              </Field>
            </>
          )}

          {tab === "Charts" && (
            <>
              <Field label="Trend charts" hint="Pick the metric and chart type for each card.">
                <ul className="space-y-2">
                  {prefs.trends.map((t, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
                      <select aria-label="Metric" className="input flex-1 py-1 text-sm" value={t.metric} onChange={(e) => set("trends", prefs.trends.map((x, j) => (j === i ? { ...x, metric: e.target.value as typeof t.metric } : x)))}>
                        {KPI_METRICS.map((m) => <option key={m} value={m}>{METRICS[m].label}</option>)}
                      </select>
                      <select aria-label="Chart type" className="input w-24 py-1 text-sm" value={t.type} onChange={(e) => set("trends", prefs.trends.map((x, j) => (j === i ? { ...x, type: e.target.value as typeof t.type } : x)))}>
                        {TREND_TYPES.map((ty) => <option key={ty} value={ty}>{ty[0].toUpperCase() + ty.slice(1)}</option>)}
                      </select>
                      <Reorder onUp={() => set("trends", move(prefs.trends, i, -1))} onDown={() => set("trends", move(prefs.trends, i, 1))} />
                      <IconButton label="Remove" onClick={() => set("trends", prefs.trends.filter((_, j) => j !== i))}><Trash2 className="size-4" /></IconButton>
                    </li>
                  ))}
                </ul>
                {prefs.trends.length < 6 && (
                  <button className="btn mt-2 text-sm" onClick={() => set("trends", [...prefs.trends, { metric: "revenue", type: "line" }])}>
                    <Plus className="size-4" /> Add trend chart
                  </button>
                )}
              </Field>
              <Field label="Breakdowns" hint="Show or hide each card and choose how it is drawn.">
                <ul className="space-y-1.5">
                  {prefs.breakdowns.map((b, i) => (
                    <Row key={b.id} label={BREAKDOWN_LABELS[b.id]} dim={!b.visible}>
                      <select aria-label="Chart type" className="input w-20 py-1 text-xs" value={b.type} onChange={(e) => set("breakdowns", prefs.breakdowns.map((x) => (x.id === b.id ? { ...x, type: e.target.value as typeof b.type } : x)))}>
                        {BREAKDOWN_TYPES.map((ty) => <option key={ty} value={ty}>{ty[0].toUpperCase() + ty.slice(1)}</option>)}
                      </select>
                      <Reorder onUp={() => set("breakdowns", move(prefs.breakdowns, i, -1))} onDown={() => set("breakdowns", move(prefs.breakdowns, i, 1))} />
                      <VisibleToggle visible={b.visible} onClick={() => set("breakdowns", prefs.breakdowns.map((x) => (x.id === b.id ? { ...x, visible: !x.visible } : x)))} />
                    </Row>
                  ))}
                </ul>
              </Field>
            </>
          )}

          {tab === "Defaults" && (
            <>
              <Field label="Default date range" hint="Used every time you open the overview.">
                <select className="input" value={prefs.defaultRange} onChange={(e) => set("defaultRange", e.target.value as RangePreset)}>
                  {Object.entries(RANGE_PRESETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Default currency">
                <select className="input" value={prefs.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value)}>
                  <option value="">Store currency</option>
                  {Object.entries(currencies).map(([c, name]) => <option key={c} value={c}>{c} - {name}</option>)}
                </select>
              </Field>
            </>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border px-5 py-3">
          <button className="btn text-sm" onClick={() => onChange(DEFAULT_PREFS)}>
            <RotateCcw className="size-4" /> Reset to default
          </button>
          <button className="btn btn-primary text-sm" onClick={onClose}>
            <Check className="size-4" /> Done
          </button>
        </footer>
      </aside>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-medium">{label}</h3>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      {!hint && <div className="mb-2" />}
      {children}
    </section>
  );
}

function Swatch({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} aria-pressed={active} className={clsx("grid size-8 place-items-center rounded-full border-2 p-0.5", active ? "border-foreground" : "border-transparent")}>
      {children}
    </button>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={clsx("rounded-md px-3 py-1 text-sm", value === v ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Row({ label, dim, children }: { label: string; dim?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5">
      <span className={clsx("flex-1 truncate text-sm", dim && "text-muted")}>{label}</span>
      {children}
    </li>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground">
      {children}
    </button>
  );
}

function Reorder({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return (
    <>
      <IconButton label="Move up" onClick={onUp}><ArrowUp className="size-4" /></IconButton>
      <IconButton label="Move down" onClick={onDown}><ArrowDown className="size-4" /></IconButton>
    </>
  );
}

function VisibleToggle({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <IconButton label={visible ? "Hide" : "Show"} onClick={onClick}>
      {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
    </IconButton>
  );
}
