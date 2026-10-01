"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronDown, Filter, X } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/format";
import { activeFilterCount, isoDaysAgo } from "@/metrics/filters";
import { FILTER_FIELDS, FILTER_FIELD_IDS, RANGE_PRESETS, type FilterField, type Filters, type RangePreset } from "@/metrics/registry";

type Option = { key: string; label: string };
type Options = Record<FilterField, Option[]>;

export function useFilterOptions(storeId: string | null) {
  return useQuery({
    queryKey: ["filter-options", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60_000,
    queryFn: () => api<Options>(`/api/stores/${storeId}/filters`),
  });
}

/** Dashboard-wide filter bar: date preset/custom range plus multi-select filters. */
export function FilterBar({ storeId, value, onChange }: { storeId: string; value: Filters; onChange: (f: Filters) => void }) {
  const options = useFilterOptions(storeId).data;

  return (
    <div className="card flex flex-wrap items-center gap-2 p-2">
      <span className="flex items-center gap-1.5 px-1 text-sm text-muted">
        <Filter className="size-4" /> Filters
      </span>
      <DateRangeControl
        preset={value.range}
        from={value.from}
        to={value.to}
        allowDefault
        onChange={(d) => onChange({ ...value, ...d })}
      />
      {FILTER_FIELD_IDS.map((k) => (
        <MultiSelect
          key={k}
          label={FILTER_FIELDS[k]}
          options={options?.[k] ?? []}
          value={value[k] ?? []}
          onChange={(v) => onChange({ ...value, [k]: v.length ? v : undefined })}
        />
      ))}
      {activeFilterCount(value) > 0 && (
        <button className="ml-auto flex items-center gap-1 px-2 text-sm text-muted hover:text-foreground" onClick={() => onChange({})}>
          <X className="size-3.5" /> Clear all
        </button>
      )}
    </div>
  );
}

/** Per-widget overrides shown in the widget settings drawer. */
export function WidgetFilterFields({
  storeId,
  fields,
  value,
  onChange,
}: {
  storeId: string;
  fields: FilterField[];
  value: Filters;
  onChange: (f: Filters | undefined) => void;
}) {
  const options = useFilterOptions(storeId).data;
  const set = (patch: Filters) => {
    const next = { ...value, ...patch };
    onChange(activeFilterCount(next) ? next : undefined);
  };
  return (
    <div className="space-y-2">
      {fields.map((k) => (
        <div key={k}>
          <span className="label">{FILTER_FIELDS[k]}</span>
          <MultiSelect
            label="Use dashboard filter"
            options={options?.[k] ?? []}
            value={value[k] ?? []}
            onChange={(v) => set({ [k]: v.length ? v : undefined })}
            block
          />
        </div>
      ))}
    </div>
  );
}

export function DateRangeControl({
  preset,
  from,
  to,
  allowDefault,
  onChange,
}: {
  preset: RangePreset | undefined;
  from?: string;
  to?: string;
  /** Offer "Each widget's range" (dashboard bar) instead of requiring a preset. */
  allowDefault?: boolean;
  onChange: (d: { range?: RangePreset; from?: string; to?: string }) => void;
}) {
  const custom = !!(from || to);
  const today = isoDaysAgo(0);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="relative flex items-center">
        <Calendar className="pointer-events-none absolute left-2.5 size-4 text-muted" />
        <select
          aria-label="Date range"
          className="input w-auto py-1.5 pl-8 text-sm"
          value={custom ? "custom" : (preset ?? "")}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "custom") onChange({ range: undefined, from: isoDaysAgo(29), to: today });
            else onChange({ range: (v || undefined) as RangePreset | undefined, from: undefined, to: undefined });
          }}
        >
          {allowDefault && <option value="">Each widget&apos;s range</option>}
          {Object.entries(RANGE_PRESETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="custom">Custom range…</option>
        </select>
      </label>
      {custom && (
        <>
          <input
            type="date"
            aria-label="From date"
            className="input w-auto py-1.5 text-sm"
            value={from ?? ""}
            max={to ?? today}
            onChange={(e) => onChange({ range: undefined, from: e.target.value || undefined, to })}
          />
          <span className="text-sm text-muted">to</span>
          <input
            type="date"
            aria-label="To date"
            className="input w-auto py-1.5 text-sm"
            value={to ?? ""}
            min={from}
            max={today}
            onChange={(e) => onChange({ range: undefined, from, to: e.target.value || undefined })}
          />
        </>
      )}
    </div>
  );
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
  block,
}: {
  label: string;
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const selected = new Set(value);
  const labelOf = (k: string) => options.find((o) => o.key === k)?.label ?? k;
  const shown = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  const toggle = (k: string) => onChange(selected.has(k) ? value.filter((v) => v !== k) : [...value, k]);
  const summary =
    value.length === 0 ? label : value.length === 1 ? labelOf(value[0]) : `${block ? "" : `${label}: `}${value.length} selected`;

  return (
    <div ref={ref} className={clsx("relative", block && "w-full")}>
      <button
        type="button"
        className={clsx("btn py-1.5", block && "w-full justify-between", value.length > 0 && "border-accent text-accent")}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="max-w-48 truncate">{summary}</span>
        <ChevronDown className="size-3.5 text-muted" />
      </button>
      {open && (
        <div className="card absolute left-0 z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] p-2 shadow-lg">
          <input
            autoFocus
            className="input mb-2 py-1.5 text-sm"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-64 overflow-y-auto">
            {shown.length === 0 && <p className="p-2 text-sm text-muted">{options.length ? "No matches" : "No values yet"}</p>}
            {shown.map((o) => (
              <label key={o.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2">
                <input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
          {value.length > 0 && (
            <button type="button" className="mt-2 w-full text-left text-xs text-muted hover:text-foreground" onClick={() => onChange([])}>
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
