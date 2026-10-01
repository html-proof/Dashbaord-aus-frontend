"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/format";
import { useLiveStore } from "@/builder/useLiveStore";
import type { HealthCheck, HealthStatus } from "@/app/api/health/route";

// Each check probes six endpoints plus Shopify; every 15s competed with the dashboard itself.
const INTERVAL = 60_000;

type EndpointCheck = { label: string; method: string; path: string; body?: unknown };

function endpoints(storeId: string): EndpointCheck[] {
  return [
    { label: "Your stores", method: "GET", path: "/api/stores" },
    { label: "Saved dashboards", method: "GET", path: "/api/dashboards" },
    { label: "Account settings", method: "GET", path: "/api/settings" },
    { label: "Available metrics", method: "GET", path: `/api/capabilities?storeId=${storeId}` },
    { label: "Filter options", method: "GET", path: `/api/stores/${storeId}/filters` },
    { label: "Reports & charts", method: "POST", path: "/api/query", body: { storeId, metric: "orders", range: "7d" } },
  ];
}

/** Calls each app endpoint and records status + latency. */
async function probeEndpoints(storeId: string): Promise<HealthCheck[]> {
  return Promise.all(
    endpoints(storeId).map(async (e) => {
      const t = performance.now();
      try {
        const res = await fetch(e.path, {
          method: e.method,
          headers: { "Content-Type": "application/json" },
          body: e.body ? JSON.stringify(e.body) : undefined,
          cache: "no-store",
        });
        const ms = Math.round(performance.now() - t);
        const status: HealthStatus = !res.ok ? "error" : ms > 2000 ? "warn" : "ok";
        const detail = !res.ok
          ? (((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Not responding right now")
          : status === "warn" ? "Working, but slow" : "Working";
        return { id: e.label, label: e.label, status, detail, ms };
      } catch {
        return { id: e.label, label: e.label, status: "error" as const, detail: "Can't reach the server" };
      }
    }),
  );
}

const DOT: Record<HealthStatus, string> = { ok: "bg-positive", warn: "bg-warning", error: "bg-negative" };
const worst = (cs: HealthCheck[]): HealthStatus =>
  cs.some((c) => c.status === "error") ? "error" : cs.some((c) => c.status === "warn") ? "warn" : "ok";

/** Live status of the backend, Shopify connection and every API endpoint, re-checked every minute. */
export function SystemStatus({ storeId }: { storeId: string | null }) {
  const live = useLiveStore(storeId);
  const backend = useQuery({
    queryKey: ["health", storeId],
    queryFn: () => api<{ checkedAt: string; checks: HealthCheck[] }>(`/api/health${storeId ? `?storeId=${storeId}` : ""}`),
    refetchInterval: INTERVAL,
    refetchIntervalInBackground: false,
  });
  const eps = useQuery({
    queryKey: ["health-endpoints", storeId],
    enabled: !!storeId,
    queryFn: () => probeEndpoints(storeId!),
    refetchInterval: INTERVAL,
    refetchIntervalInBackground: false,
  });

  const stream: HealthCheck[] = storeId
    ? [{ id: "stream", label: "Live updates", status: live.connected ? "ok" : "warn", detail: live.connected ? "Connected" : "Reconnecting…" }]
    : [];
  const backendChecks: HealthCheck[] = backend.error
    ? [{ id: "health", label: "Server", status: "error", detail: (backend.error as Error).message }]
    : (backend.data?.checks ?? []);
  const all = [...backendChecks, ...stream, ...(eps.data ?? [])];
  const webhooks = backendChecks.find((c) => c.id === "webhooks");
  const [registering, setRegistering] = useState(false);
  const [regResult, setRegResult] = useState<string | null>(null);
  const register = async () => {
    if (!storeId) return;
    setRegistering(true);
    setRegResult(null);
    try {
      const r = await api<{ callbackUrl: string; registered: string[]; failed: { topic: string; error: string }[] }>(
        `/api/stores/${storeId}/webhooks`,
        { method: "POST" },
      );
      setRegResult(
        r.failed.length
          ? `Registered ${r.registered.length}; failed: ${r.failed.map((f) => `${f.topic} (${f.error})`).join(", ")}`
          : `Registered ${r.registered.length} topics → ${r.callbackUrl}`,
      );
    } catch (e) {
      setRegResult((e as Error).message);
    } finally {
      setRegistering(false);
      backend.refetch();
    }
  };
  const overall = worst(all);
  const checkedAt = backend.data ? new Date(backend.data.checkedAt).toLocaleTimeString() : null;

  return (
    <section className="card p-4" aria-label="System status">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Activity className="size-4 text-muted" />
        <h2 className="font-medium">System status</h2>
        <span className={clsx("size-2 rounded-full", all.length ? DOT[overall] : "bg-muted")} aria-hidden />
        <span className="text-sm text-muted">
          {!all.length ? "Checking…" : overall === "ok" ? "All systems working" : overall === "warn" ? "Working with warnings" : "Problems detected"}
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted">
          {checkedAt && `Checked ${checkedAt} · every minute`}
          <button
            className="btn px-2 py-1"
            aria-label="Check now"
            title="Check now"
            onClick={() => {
              backend.refetch();
              eps.refetch();
            }}
          >
            <RefreshCw className={clsx("size-3.5", (backend.isFetching || eps.isFetching) && "animate-spin")} />
          </button>
        </span>
      </div>

      {webhooks && webhooks.status !== "ok" && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 p-2.5 text-sm">
          <span className="flex-1">
            Webhooks: {webhooks.detail}
            {regResult && <span className="block text-xs text-muted">{regResult}</span>}
          </span>
          <button className="btn py-1.5" onClick={register} disabled={registering}>
            {registering ? "Registering…" : "Register webhooks"}
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Group title="Server & Shopify" checks={[...backendChecks, ...stream]} />
        <Group title="Dashboard features" checks={eps.data ?? []} />
      </div>
    </section>
  );
}

function Group({ title, checks }: { title: string; checks: HealthCheck[] }) {
  return (
    <div>
      <p className="label">{title}</p>
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {checks.length === 0 && <li className="p-2.5 text-muted">Checking…</li>}
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 p-2.5">
            <span className={clsx("mt-1.5 size-2 shrink-0 rounded-full", DOT[c.status])} aria-label={c.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.label}</p>
              <p className="text-xs break-words text-muted">{c.detail}</p>
            </div>
            {c.ms !== undefined && <span className="shrink-0 text-xs tabular-nums text-muted">{c.ms} ms</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
