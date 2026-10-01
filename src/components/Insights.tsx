"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight, ExternalLink, X, Zap } from "lucide-react";
import { clsx } from "clsx";
import { api, formatValue } from "@/lib/format";
import type { Insight } from "@/lib/insights";
import type { DetailColumn, DetailRow, InsightDetail } from "@/lib/insight-details";
import type { RangePreset } from "@/metrics/registry";

const DOT: Record<Insight["severity"], string> = {
  high: "bg-negative",
  medium: "bg-warning",
  info: "bg-accent",
};
const SEVERITY_LABEL: Record<Insight["severity"], string> = { high: "High priority", medium: "Medium priority", info: "For your information" };

/** "Worth your attention" list for the overview; refreshed with the live data poll. */
const dateParams = (from?: string, to?: string) => `${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;

export function Insights({ storeId, range, from, to }: { storeId: string; range: RangePreset; from?: string; to?: string }) {
  const q = useQuery({
    queryKey: ["metric", storeId, "insights", range, from, to],
    queryFn: () => api<{ insights: Insight[] }>(`/api/insights?storeId=${storeId}&range=${range}${dateParams(from, to)}`),
    refetchInterval: 60_000,
  });
  const items = q.data?.insights ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((it) => it.id === openId) ?? null;

  return (
    <section id="attention" className="card scroll-mt-20 overflow-hidden border-accent/30 bg-gradient-to-b from-accent/[0.06] to-transparent" aria-label="Worth your attention">
      <div className="flex items-center gap-2 px-4 py-3">
        <Zap className="size-4 text-accent" />
        <h2 className="font-semibold">Worth your attention</h2>
        {q.data && <span className="ml-auto rounded-md border border-border px-2 py-0.5 text-xs text-muted">{items.length}</span>}
      </div>
      {q.isLoading && <div className="mx-4 mb-4 h-16 animate-pulse rounded-lg bg-surface-2" />}
      {q.isError && <p className="px-4 pb-4 text-sm text-negative">{(q.error as Error).message}</p>}
      {q.data && items.length === 0 && (
        <p className="px-4 pb-4 text-sm text-muted">Nothing needs your attention right now. Sales, orders, stock and payments look normal.</p>
      )}
      {items.length > 0 && (
        <ol className="space-y-2 px-3 pb-3">
          {items.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => setOpenId(it.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface/60 px-2.5 py-2 text-left transition hover:border-accent/50 hover:bg-surface-2"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-xs tabular-nums text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={clsx("size-2 shrink-0 rounded-full", DOT[it.severity])} aria-label={`${it.severity} priority`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{it.title}</span>
                  <span className="block truncate text-xs text-muted sm:whitespace-normal md:truncate" title={it.detail}>{it.detail}</span>
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-xs font-medium text-accent sm:flex">
                  See details <ArrowRight className="size-3" />
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {open && <InsightPanel insight={open} storeId={storeId} range={range} from={from} to={to} onClose={() => setOpenId(null)} />}
    </section>
  );
}

/** Slide-over that explains one insight and lists the records behind it, inside the dashboard. */
function InsightPanel({ insight, storeId, range, from, to, onClose }: { insight: Insight; storeId: string; range: RangePreset; from?: string; to?: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["metric", storeId, "insight-detail", insight.id, range, from, to],
    queryFn: () =>
      api<{ detail: InsightDetail; currency: string | null }>(`/api/insights/${insight.id}?storeId=${storeId}&range=${range}${dateParams(from, to)}`),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const d = q.data?.detail;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={insight.title}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-border bg-surface shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span className={clsx("mt-2 size-2 shrink-0 rounded-full", DOT[insight.severity])} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{SEVERITY_LABEL[insight.severity]}</p>
            <h2 className="text-lg font-semibold">{insight.title}</h2>
            <p className="mt-1 text-sm text-muted">{insight.detail}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground" aria-label="Close">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {q.isLoading && <div className="h-40 animate-pulse rounded-lg bg-surface-2" />}
          {q.isError && <p className="text-sm text-negative">{(q.error as Error).message}</p>}
          {d && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Why this matters</h3>
                  <p className="mt-1 text-sm">{d.why}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Why it was flagged</h3>
                  <p className="mt-1 text-sm">{d.rule}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">What to do</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {d.next.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">{d.tableTitle}</h3>
                <DetailTable columns={d.columns} rows={d.rows} currency={q.data?.currency ?? null} />
              </div>
            </>
          )}
        </div>

        {d?.shopifyHref && (
          <footer className="border-t border-border px-5 py-3 text-right">
            <a href={d.shopifyHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent">
              Open in Shopify <ExternalLink className="size-3" />
            </a>
          </footer>
        )}
      </aside>
    </>
  );
}

function cell(v: DetailRow[string], col: DetailColumn, currency: string | null) {
  if (v === null || v === undefined || v === "") return "–";
  switch (col.format) {
    case "currency":
      return formatValue(Number(v), "currency", currency);
    case "percent": {
      const n = Number(v);
      return `${n > 0 ? "+" : ""}${n.toFixed(0)}%`;
    }
    case "number":
      return formatValue(Number(v), "number", currency);
    case "date":
      return new Date(String(v)).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    default:
      return String(v).replace(/_/g, " ");
  }
}

function DetailTable({ columns, rows, currency }: { columns: DetailColumn[]; rows: DetailRow[]; currency: string | null }) {
  if (!rows.length) return <p className="text-sm text-muted">No records found.</p>;
  const numeric = (c: DetailColumn) => c.format && c.format !== "date";
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={clsx("px-3 py-2 font-medium", numeric(c) ? "text-right" : "text-left")}>
                {c.label}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {columns.map((c, j) => (
                <td
                  key={c.key}
                  className={clsx(
                    "px-3 py-2",
                    numeric(c) ? "text-right tabular-nums" : "text-left",
                    j === 0 && "font-medium",
                    c.format === "percent" && Number(r[c.key]) < 0 && "text-negative",
                    c.key === "qty" && Number(r[c.key]) <= 0 && "text-negative",
                  )}
                >
                  {cell(r[c.key], c, currency)}
                </td>
              ))}
              <td className="px-2 text-right">
                {r._href && (
                  <a href={String(r._href)} target="_blank" rel="noreferrer" className="text-muted hover:text-accent" title="Open in Shopify">
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
