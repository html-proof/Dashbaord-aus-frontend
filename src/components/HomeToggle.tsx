"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Home } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/format";

/** Makes a personal dashboard the user's home page (shown instead of the store overview), or clears it. */
export function HomeToggle({ id, compact }: { id: string; compact?: boolean }) {
  const qc = useQueryClient();
  const router = useRouter();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ homeDashboardId: string | null }>("/api/settings"),
  });
  const isHome = settings.data?.homeDashboardId === id;
  const save = useMutation({
    mutationFn: (homeDashboardId: string | null) =>
      api("/api/settings", { method: "PATCH", body: JSON.stringify({ homeDashboardId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      router.refresh();
    },
  });
  const label = isHome ? "Home dashboard (click to use store overview instead)" : "Set as home dashboard";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={isHome}
      disabled={settings.isLoading || save.isPending}
      onClick={(e) => {
        e.preventDefault();
        save.mutate(isHome ? null : id);
      }}
      className={clsx(
        compact ? "rounded-md p-1.5" : "btn",
        isHome ? "text-accent" : "text-muted hover:text-foreground",
      )}
    >
      <Home className="size-4" fill={isHome ? "currentColor" : "none"} />
      {!compact && (isHome ? "Home" : "Set as home")}
    </button>
  );
}
