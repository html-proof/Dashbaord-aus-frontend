"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Search, X } from "lucide-react";
import { api, formatValue } from "@/lib/format";
import { METRICS, type MetricQuery } from "@/metrics/registry";
import type { DrillRow } from "@/lib/query";
import type { DrillPoint } from "@/widgets/WidgetView";

export type DrillRequest = { query: MetricQuery; point: DrillPoint; title: string; currency: string | null };

const KIND_LABEL = { orders: "orders", customers: "customers", variants: "products" } as const;

function pointLabel(p: DrillPoint, dimension: string) {
  if (p.key === null) return "whole period";
  if (dimension === "date") {
    const d = new Date(`${p.key}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  return p.label;
}

/** Side panel listing the orders / customers / products behind a clicked chart point. */
export function DrillDialog({ req, onClose }: { req: DrillRequest | null; onClose: () => void }) {
  const [search, setSearch] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSearch(""), [req]);
  useEffect(() => {
    if (!req) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [req, onClose]);

  const q = useQuery({
    queryKey: ["drill", req?.query, req?.point.key],
    enabled: !!req,
    queryFn: () =>
      api<{ kind: keyof typeof KIND_LABEL; rows: DrillRow[]; truncated: boolean; currency: string | null }>("/api/drilldown", {
        method: "POST",
        body: JSON.stringify({ query: { ...req!.query, compare: false }, key: req!.point.key }),
      }),
  });
  if (!req) return null;

  const metric = METRICS[req.query.metric];
  // Record values are in the store's own currency (not the overview's display currency).
  const currency = q.data?.currency ?? req.currency;
  const money = (v: number) => formatValue(v, "currency", currency);
  const rows = (q.data?.rows ?? []).filter((r) => `${r.title} ${r.subtitle}`.toLowerCase().includes(search.toLowerCase()));
  const kind = q.data ? KIND_LABEL[q.data.kind] : "records";

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Name", "Details", "Date", "Value"], ...rows.map((r) => [r.title, r.subtitle, r.date ?? "", r.value ?? ""])];
    const blob = new Blob([lines.map((l) => l.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${req.title} - ${pointLabel(req.point, req.query.dimension)}.csv`.replace(/[\\/:*?"<>|]/g, "-");
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={`${req.title} details`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{req.title}</p>
            <h2 className="truncate text-lg font-semibold">{pointLabel(req.point, req.query.dimension)}</h2>
            <p className="mt-0.5 text-sm">
              {metric.label}: <span className="font-mono font-medium">{formatValue(req.point.value, metric.format, req.currency)}</span>
            </p>
          </div>
          <button className="text-muted hover:text-foreground" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input className="input py-1.5 pl-8 text-sm" placeholder={`Search ${kind}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn py-1.5" onClick={exportCsv} disabled={!rows.length} title="Download as CSV">
            <Download className="size-4" /> CSV
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {q.isLoading && <div className="m-4 h-40 animate-pulse rounded-lg bg-surface-2" />}
          {q.isError && <p className="p-4 text-sm text-negative">{(q.error as Error).message}</p>}
          {q.data && (
            <p className="px-4 pt-3 text-xs text-muted">
              {q.data.rows.length}
              {q.data.truncated ? "+" : ""} {kind}
              {search && ` · ${rows.length} matching`}
              {q.data.truncated && " (showing the latest 200)"}
            </p>
          )}
          {q.data && rows.length === 0 && <p className="p-4 text-sm text-muted">No {kind} found.</p>}
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <a
                  href={r.href ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="truncate text-xs text-muted">
                      {r.date && `${new Date(r.date).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · `}
                      {r.subtitle}
                    </p>
                  </div>
                  {r.value !== null && (
                    <span className="shrink-0 font-mono text-sm tabular-nums">
                      {q.data?.kind === "variants" ? r.value : money(r.value)}
                    </span>
                  )}
                  {r.href && <ExternalLink className="size-3.5 shrink-0 text-muted" />}
                </a>
              </li>
            ))}
          </ul>
        </div>
        {q.data?.kind === "customers" && (
          <p className="border-t border-border p-3 text-[11px] text-muted">Value = customer&apos;s total spend to date. Opens in Shopify admin.</p>
        )}
      </aside>
    </div>
  );
}
