"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/format";

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card border-negative/40 bg-negative/[0.05] p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-negative/15 text-negative">
          <Trash2 className="size-6" />
        </span>
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="font-semibold text-negative">Delete account</h2>
          <p className="mt-1 text-sm text-muted">
            Permanently deletes your account, sign-in, all connected stores, synced orders, products, customers and
            dashboards. Shopify access and webhooks are removed. This action can&apos;t be undone.
          </p>
        </div>
        {!open && (
          <button className="btn border-negative/50 text-negative hover:bg-negative/10" onClick={() => setOpen(true)}>
            Delete my account
          </button>
        )}
      </div>
      {open && (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api("/api/account", { method: "DELETE" });
              router.replace("/login");
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
              setBusy(false);
            }
          }}
        >
          <label className="block text-sm">
            Type <strong>DELETE</strong> to confirm
            <input
              className="input mt-1"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </label>
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn text-negative" disabled={busy || confirmText !== "DELETE"}>
              {busy ? "Deleting…" : "Permanently delete everything"}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => { setOpen(false); setConfirmText(""); }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
