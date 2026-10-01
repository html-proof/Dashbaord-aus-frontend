import Link from "next/link";
import { eq } from "drizzle-orm";
import { Home } from "lucide-react";
import { LayoutDashboard } from "lucide-react";
import { db, schema } from "@/lib/db";
import { getDashboard } from "@/lib/dashboards";
import { visibleDashboards } from "@/lib/team";
import { requirePageSession } from "@/lib/session";
import { DeleteDashboardButton } from "@/components/DeleteDashboardButton";
import { StoreOverview } from "@/components/StoreOverview";
import { HomeToggle } from "@/components/HomeToggle";
import { Builder } from "@/builder/Builder";

export default async function DashboardsPage({ searchParams }: PageProps<"/dashboards">) {
  const session = await requirePageSession();
  const showOverview = (await searchParams).view === "overview";
  const [dashboards, stores, settings] = await Promise.all([
    visibleDashboards(session),
    db
      .select({ id: schema.stores.id, shopDomain: schema.stores.shopDomain, name: schema.stores.name })
      .from(schema.stores)
      .where(eq(schema.stores.workspaceId, session.workspaceId)),
    db.query.userSettings.findFirst({ where: eq(schema.userSettings.userId, session.user.id) }),
  ]);
  const storeOptions = stores.map((s) => ({ id: s.id, label: s.name ?? s.shopDomain }));
  const home = dashboards.find((d) => d.id === settings?.homeDashboardId) ?? null;

  // The user picked one of their own dashboards as the home page.
  if (home && !showOverview) {
    const dashboard = await getDashboard(home.id, session.workspaceId);
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2 text-sm">
          <Home className="size-4 text-accent" />
          <span>This is your home dashboard.</span>
          <Link href="/dashboards?view=overview" className="text-accent hover:underline">Show store overview</Link>
          <span className="text-muted">·</span>
          <Link href="/settings" className="text-muted hover:underline">Change in Settings</Link>
        </div>
        <Builder
          dashboard={{ id: dashboard.id, name: dashboard.name, storeId: dashboard.storeId, widgets: dashboard.widgets }}
          stores={storeOptions}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {stores.length === 0 ? (
        <>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted">Each dashboard is fully yours: pick charts, drag, resize, and save.</p>
          </div>
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-medium">Connect a Shopify store first</p>
              <p className="text-sm text-muted">Dashboards need a store to pull data from.</p>
            </div>
            <Link href="/stores" className="btn btn-primary">Connect store</Link>
          </div>
        </>
      ) : (
        <StoreOverview stores={storeOptions} homeDashboard={home && { id: home.id, name: home.name }} sections={session.access?.sections ?? null} />
      )}

      {dashboards.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Your dashboards</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dashboards.map((d) => (
              <div key={d.id} className="relative">
                <Link href={`/dashboards/${d.id}`} className="card flex items-center gap-3 p-4 pr-20 transition hover:border-accent">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                    <LayoutDashboard className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {d.shopDomain ?? "No store"} · updated {d.updatedAt.toLocaleDateString("en-AU")}
                    </span>
                  </span>
                </Link>
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  <HomeToggle id={d.id} compact />
                  {session.role !== "viewer" && <DeleteDashboardButton id={d.id} name={d.name} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
