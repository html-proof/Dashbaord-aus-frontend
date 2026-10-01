"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { BarChart3, CheckCircle2, ExternalLink, Loader2, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { BRAND_ICONS } from "@/components/BrandIcons";
import { api } from "@/lib/format";
import { AD_PLATFORMS, PLATFORMS, type AdPlatform } from "@/lib/ads/platforms";

type Account = {
  id: string;
  platform: AdPlatform;
  accountId: string;
  status: "active" | "syncing" | "error";
  lastError: string | null;
  lastSyncedAt: string | null;
};

/**
 * Settings → connect Meta, Google Ads, TikTok and GA4 per store. Keys are tested
 * with a live call before saving; the overview's Marketing section fills in on its own.
 */
export function IntegrationsSettings({ stores, canEdit }: { stores: { id: string; label: string }[]; canEdit: boolean }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [learn, setLearn] = useState(false);
  const accounts = useQuery({
    queryKey: ["integrations", storeId],
    enabled: !!storeId,
    queryFn: () => api<{ accounts: Account[] }>(`/api/integrations?storeId=${storeId}`),
    // Poll while an import is running so the status flips to "Connected" by itself.
    refetchInterval: (q) => (q.state.data?.accounts.some((a) => a.status === "syncing") ? 3000 : false),
  });

  return (
    <section id="integrations" className="card scroll-mt-20 space-y-4 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet-400/15 text-violet-400">
          <BarChart3 className="size-6" />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="font-semibold">Ad &amp; analytics integrations</h2>
          <p className="text-sm text-muted">
            Connect your ad accounts and analytics to get a complete view of your business. Once the keys check out,
            ad spend, ROAS and sessions appear on the overview automatically. Your account IDs and keys are stored
            securely and encrypted.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => setLearn(!learn)} aria-expanded={learn}>
            {learn ? "Hide details" : "Learn more"}
          </button>
          {stores.length > 1 && (
            <select className="input w-auto" value={storeId} onChange={(e) => setStoreId(e.target.value)} aria-label="Store">
              {stores.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
        </div>
      </div>
      {learn && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-2/40 p-4 text-sm">
          <p>
            Each platform needs an account ID and read-only API keys. We test them with a live call before saving, then
            import your recent history and refresh it on a schedule. Keys are encrypted and never shown again. Remove a
            platform at any time to stop syncing and delete its keys.
          </p>
          <ul className="space-y-2">
            {AD_PLATFORMS.map((p) => (
              <li key={p}>
                <span className="font-medium">{PLATFORMS[p].label}:</span> <span className="text-muted">{PLATFORMS[p].help}</span>{" "}
                <a href={PLATFORMS[p].helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Open <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {AD_PLATFORMS.map((p) => (
        <PlatformCard
          key={`${storeId}-${p}`}
          storeId={storeId}
          platform={p}
          account={accounts.data?.accounts.find((a) => a.platform === p)}
          canEdit={canEdit}
        />
      ))}
    </section>
  );
}

function PlatformCard({ storeId, platform, account, canEdit }: { storeId: string; platform: AdPlatform; account?: Account; canEdit: boolean }) {
  const info = PLATFORMS[platform];
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["integrations", storeId] });
    qc.invalidateQueries({ queryKey: ["capabilities", storeId] });
  };
  const save = useMutation({
    mutationFn: () => api("/api/integrations", { method: "POST", body: JSON.stringify({ storeId, platform, fields: values }) }),
    onSuccess: () => {
      setEditing(false);
      setValues({});
      refresh();
    },
  });
  const sync = useMutation({ mutationFn: () => api(`/api/integrations/${account!.id}`, { method: "POST" }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => api(`/api/integrations/${account!.id}`, { method: "DELETE" }), onSuccess: refresh });
  const open = editing && canEdit;
  const Logo = BRAND_ICONS[platform];

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center">
          <Logo />
        </span>
        <div className="mr-auto min-w-0">
          <p className="font-medium">{info.label}</p>
          <p className="text-xs text-muted">{info.gives}</p>
        </div>
        {account ? (
          <Status account={account} />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="size-2 rounded-full bg-warning" /> Not connected
          </span>
        )}
        {canEdit && account && (
          <>
            <button className="btn size-8 p-0" title="Sync now" onClick={() => sync.mutate()} disabled={sync.isPending || account.status === "syncing"}>
              <RefreshCw className={clsx("size-4", account.status === "syncing" && "animate-spin")} />
            </button>
            <button className="btn" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Update keys"}</button>
            <button
              className="btn size-8 p-0 text-negative"
              title="Disconnect"
              disabled={remove.isPending}
              onClick={() => confirm(`Disconnect ${info.label}? Its imported data will be removed from the overview.`) && remove.mutate()}
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
        {canEdit && !account && !open && <button className="btn btn-primary" onClick={() => setEditing(true)}>Connect</button>}
      </div>

      {open && (
        <form
          autoComplete="off"
          className="mt-3 space-y-3 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <p className="text-xs text-muted">
            {info.help}{" "}
            <a href={info.helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">
              Where to find these <ExternalLink className="size-3" />
            </a>
          </p>
          {info.fields.map((f) => (
            <label key={f.key} className="block">
              {/* Keys, not logins: stop browsers and password managers from autofilling. */}
              <span className="text-sm">{f.label}{f.optional && <span className="text-muted"> (optional)</span>}</span>
              {f.multiline ? (
                <textarea
                  className="input mt-1 h-28 font-mono text-xs"
                  placeholder={f.placeholder ?? "Paste the whole JSON file"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  required={!f.optional}
                  name={`${platform}-${f.key}-nofill`}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  spellCheck={false}
                />
              ) : (
                <input
                  className="input mt-1"
                  type={f.secret ? "password" : "text"}
                  placeholder={f.placeholder ?? (account && f.key === info.accountField ? account.accountId : undefined)}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  required={!f.optional}
                  name={`${platform}-${f.key}-nofill`}
                  autoComplete={f.secret ? "new-password" : "off"}
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  pattern={f.pattern}
                  title={f.hint}
                  spellCheck={false}
                />
              )}
              {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
            </label>
          ))}
          {save.error && <p className="text-sm text-negative">{(save.error as Error).message}</p>}
          <div className="flex items-center gap-2">
            <button className="btn btn-primary" disabled={save.isPending}>
              {save.isPending ? <><Loader2 className="size-4 animate-spin" /> Checking keys…</> : "Save & connect"}
            </button>
            <button type="button" className="btn" onClick={() => { setEditing(false); setValues({}); save.reset(); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Status({ account }: { account: Account }) {
  if (account.status === "syncing")
    return <span className="flex items-center gap-1 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" /> Importing {account.accountId}…</span>;
  if (account.status === "error")
    return (
      <span className="flex max-w-xs items-center gap-1 text-xs text-negative" title={account.lastError ?? undefined}>
        <TriangleAlert className="size-3.5 shrink-0" /> <span className="truncate">{account.lastError ?? "Sync failed"}</span>
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-positive">
      <CheckCircle2 className="size-3.5" /> Connected · {account.accountId}
      {account.lastSyncedAt && <span className="text-muted"> · synced {new Date(account.lastSyncedAt).toLocaleString("en-AU")}</span>}
    </span>
  );
}
