"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/format";

export function DeleteDashboardButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      className="btn px-2 text-negative"
      disabled={busy}
      aria-label="Delete dashboard"
      title="Delete dashboard"
      onClick={async () => {
        if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
        setBusy(true);
        try {
          await api(`/api/dashboards/${id}`, { method: "DELETE" });
          router.replace("/dashboards");
          router.refresh();
        } catch (err) {
          alert((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <Trash2 className="size-4" />
    </button>
  );
}
