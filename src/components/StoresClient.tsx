"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, History, Lock, RefreshCw, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/format";
import { CAPABILITIES } from "@/metrics/capabilities";
import { useLiveStore } from "@/builder/useLiveStore";
import { SystemStatus } from "@/components/SystemStatus";

type Store = {
  id: string;
  shopDomain: string;
  name: string | null;
  status: string;
  authMode: string;
  lastSyncedAt: string | null;
};

export function StoresClient({
  canEdit,
  oauthAvailable,
  showStatus,
}: {
  canEdit: boolean;
  oauthAvailable: boolean;
  showStatus: boolean;
}) {
  const qc = useQueryClient();
  const stores = useQuery({
    queryKey: ["stores"],
    queryFn: () => api<{ stores: Store[] }>("/api/stores"),
    // Live sync.status events update each card; this only catches the final state.
    refetchInterval: (q) => (q.state.data?.stores.some((s) => s.status === "syncing") ? 10_000 : false),
  });

  return (
    <div className="space-y-6">
      {canEdit && <ConnectForm oauthAvailable={oauthAvailable} onConnected={() => qc.invalidateQueries({ queryKey: ["stores"] })} />}
      <div className="space-y-4">
        {stores.data?.stores.map((s) => <StoreCard key={s.id} store={s} canEdit={canEdit} oauthAvailable={oauthAvailable} />)}
        {stores.data?.stores.length === 0 && <p className="text-sm text-muted">No stores connected yet.</p>}
      </div>
      {showStatus && stores.data && <SystemStatus storeId={stores.data.stores[0]?.id ?? null} />}
    </div>
  );
}

function ConnectForm({ onConnected, oauthAvailable }: { onConnected: () => void; oauthAvailable: boolean }) {
  const [shop, setShop] = useState("");
  const [mode, setMode] = useState<"oauth" | "direct">(oauthAvailable ? "oauth" : "direct");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (mode === "oauth") {
          // Full navigation: this route redirects off-site to Shopify's OAuth screen.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop)}`;
          return;
        }
        setBusy(true);
        try {
          await api("/api/shopify/connect-direct", {
            method: "POST",
            body: JSON.stringify({ shop, clientId, clientSecret }),
          });
          setShop("");
          setClientId("");
          setClientSecret("");
          onConnected();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="font-medium">Connect a Shopify store</p>
      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-sm flex-1"
          placeholder="your-store.myshopify.com"
          aria-label="Shop domain"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          required
        />
        <button className="btn btn-primary" disabled={busy}>{busy ? "Connecting…" : "Connect"}</button>
      </div>
      {oauthAvailable && (
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={mode === "oauth"}
            onChange={() => setMode("oauth")}
          />
          <span>Install app (any store, merchant approves)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "direct"} onChange={() => setMode("direct")} />
          Direct: client ID + secret (store in your own Shopify organization)
        </label>
      </fieldset>
      )}
      {mode === "direct" && (
        <div className="flex flex-wrap gap-2">
          <input
            className="input max-w-sm flex-1"
            placeholder="Client ID"
            aria-label="Client ID"
            autoComplete="off"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required={!oauthAvailable}
          />
          <input
            className="input max-w-sm flex-1"
            type="password"
            placeholder="Client secret"
            aria-label="Client secret"
            autoComplete="new-password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            required={!oauthAvailable}
          />
        </div>
      )}
      {error && <p className="text-sm text-negative">{error}</p>}
    </form>
  );
}

function StoreCard({ store, canEdit, oauthAvailable }: { store: Store; canEdit: boolean; oauthAvailable: boolean }) {
  const qc = useQueryClient();
  const live = useLiveStore(store.id);
  const status = live.syncStatus ?? store.status;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{store.name ?? store.shopDomain}</p>
          <p className="text-xs text-muted">
            {store.shopDomain} · {store.authMode === "oauth" ? "Installed app" : "Client credentials"} ·{" "}
            {store.lastSyncedAt ? `synced ${new Date(store.lastSyncedAt).toLocaleString()}` : "never synced"}
          </p>
        </div>
        <span
          className={clsx(
            "rounded-full px-2 py-0.5 text-xs",
            status === "active" && "bg-positive/15 text-positive",
            status === "syncing" && "bg-warning/15 text-warning",
            (status === "error" || status === "uninstalled") && "bg-negative/15 text-negative",
          )}
        >
          {status}
        </span>
        {canEdit && (
          <>
            <button
              className="btn px-2"
              title="Sync now"
              aria-label="Sync now"
              onClick={async () => {
                await api(`/api/stores/${store.id}`, { method: "POST" });
                qc.invalidateQueries({ queryKey: ["stores"] });
              }}
            >
              <RefreshCw className={clsx("size-4", status === "syncing" && "animate-spin")} />
            </button>
            <button
              className="btn px-2"
              title="Full re-sync (re-download all history)"
              aria-label="Full re-sync"
              disabled={status === "syncing"}
              onClick={async () => {
                if (!confirm("Re-download all orders, products and customers from Shopify? This can take a few minutes.")) return;
                await api(`/api/stores/${store.id}?full=1`, { method: "POST" });
                qc.invalidateQueries({ queryKey: ["stores"] });
              }}
            >
              <History className="size-4" />
            </button>
            <button
              className="btn px-2 text-negative"
              title="Disconnect"
              aria-label="Disconnect store"
              onClick={async () => {
                if (!confirm(`Disconnect ${store.shopDomain} and delete its synced data?`)) return;
                await api(`/api/stores/${store.id}`, { method: "DELETE" });
                qc.invalidateQueries({ queryKey: ["stores"] });
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
      </div>

      <div className="mt-4">
        <p className="label">What this store powers (updates live)</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {live.capabilities
            .filter((c) => !c.key.startsWith("scope:") || !c.enabled)
            .map((c) => {
              const info = CAPABILITIES[c.key];
              const coverage = c.key === "data:product_cost" && typeof c.meta.coverage === "number" ? c.meta.coverage : null;
              return (
                <li key={c.key} className="flex gap-2 rounded-lg border border-border p-2.5 text-sm">
                  {c.enabled ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" />
                  ) : (
                    <Lock className="mt-0.5 size-4 shrink-0 text-muted" />
                  )}
                  <div className="min-w-0">
                    <p className={clsx(!c.enabled && "text-muted")}>
                      {info.label}
                      {coverage !== null && c.enabled && (
                        <span className="text-xs text-muted"> · {(coverage * 100).toFixed(0)}% of variants costed</span>
                      )}
                    </p>
                    {!c.enabled && (
                      <p className="text-xs text-muted">
                        {info.howToEnable}{" "}
                        {info.requestScope && oauthAvailable ? (
                          <a className="text-accent" href={`/api/shopify/install?shop=${store.shopDomain}&extra=${info.requestScope}`}>
                            Grant access
                          </a>
                        ) : info.adminPath ? (
                          <a className="text-accent" target="_blank" rel="noreferrer" href={`https://${store.shopDomain}${info.adminPath}`}>
                            Open Shopify
                          </a>
                        ) : null}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}
