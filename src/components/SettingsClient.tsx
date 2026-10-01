"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Home, Lightbulb, Sparkles } from "lucide-react";
import { api } from "@/lib/format";

type Settings = { autoAddWidgets: boolean; homeDashboardId: string | null };

function useSettings() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/api/settings"),
  });
  const save = useMutation({
    mutationFn: (patch: Partial<Settings>) => api("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
  // The settings may already be cached from the overview; stay "loading" until mount so
  // server and client HTML match.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const busy = !mounted || settings.isLoading || save.isPending;
  return { data: mounted ? settings.data : undefined, save, busy };
}

/** Icon tile used at the top-left of each settings card. */
export function CardIcon({ icon: Icon, tone }: { icon: React.ElementType; tone: string }) {
  return (
    <span className={clsx("grid size-12 shrink-0 place-items-center rounded-xl", tone)}>
      <Icon className="size-6" />
    </span>
  );
}

export function HomePageCard({ dashboards }: { dashboards: { id: string; name: string }[] }) {
  const { data, save, busy } = useSettings();
  return (
    <div className="card flex gap-4 p-5">
      <CardIcon icon={Home} tone="bg-sky-400/15 text-sky-400" />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Home page</h2>
        <p className="mb-3 text-sm text-muted">Choose what you see when you open the dashboard.</p>
        <select
          className="input"
          aria-label="Home page"
          disabled={busy}
          value={data?.homeDashboardId ?? ""}
          onChange={(e) => save.mutate({ homeDashboardId: e.target.value || null })}
        >
          <option value="">Store overview (default)</option>
          {dashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <p className="mt-2 text-xs text-muted">
          {dashboards.length === 0
            ? "Create a dashboard below to use it as your home page."
            : "You can still open the store overview from the sidebar."}
        </p>
      </div>
    </div>
  );
}

export function SmartWidgetsCard() {
  const { data, save, busy } = useSettings();
  const on = data?.autoAddWidgets ?? false;
  return (
    <div className="card flex gap-4 p-5">
      <CardIcon icon={Sparkles} tone="bg-violet-400/15 text-violet-400" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 font-semibold">
              Smart widgets
              <span className="rounded-full bg-positive/15 px-2 py-0.5 text-[11px] font-medium text-positive">Recommended</span>
            </h2>
            <p className="text-sm text-muted">
              Automatically add new widgets when your store unlocks new data (e.g. product costs, ad accounts or analytics).
            </p>
          </div>
          <button
            role="switch"
            aria-checked={on}
            aria-label="Smart widgets"
            disabled={busy}
            onClick={() => save.mutate({ autoAddWidgets: !on })}
            className={clsx(
              "relative mt-1 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60",
              on ? "bg-accent" : "bg-surface-2 ring-1 ring-border",
            )}
          >
            <span className={clsx("absolute top-1 size-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
          </button>
        </div>
        <p className="flex gap-2 rounded-lg bg-accent/[0.07] p-3 text-xs text-muted">
          <Lightbulb className="size-4 shrink-0 text-accent" />
          When this is off you get a one-click suggestion instead. You can always hide or rearrange widgets later.
        </p>
      </div>
    </div>
  );
}
