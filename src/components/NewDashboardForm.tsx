"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Plus } from "lucide-react";
import { api } from "@/lib/format";

type Option = { id: string; label: string };

export function NewDashboardForm({ stores, templates }: { stores: Option[]; templates: Option[] }) {
  const router = useRouter();
  const [name, setName] = useState("My dashboard");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [template, setTemplate] = useState("sales");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="card grid gap-4 p-5 sm:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const { id } = await api<{ id: string }>("/api/dashboards", {
            method: "POST",
            body: JSON.stringify({ name, storeId, template }),
          });
          router.push(`/dashboards/${id}`);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="flex items-center gap-3 sm:col-span-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-400">
          <LayoutGrid className="size-6" />
        </span>
        <div>
          <h2 className="font-semibold">Create a new dashboard</h2>
          <p className="text-sm text-muted">Create a custom dashboard for your store.</p>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="nd-name">Dashboard name</label>
        <input id="nd-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="nd-store">Store</label>
        <select id="nd-store" className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="nd-template">Start from</label>
        <select id="nd-template" className="input" value={template} onChange={(e) => setTemplate(e.target.value)}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <button className="btn btn-primary sm:col-span-3 sm:justify-self-end" disabled={busy}>
        <Plus className="size-4" /> {busy ? "Creating…" : "Create dashboard"}
      </button>
      {error && <p className="text-sm text-negative sm:col-span-3">{error}</p>}
    </form>
  );
}
