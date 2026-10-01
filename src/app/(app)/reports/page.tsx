import Link from "next/link";
import { eq } from "drizzle-orm";
import { LayoutDashboard } from "lucide-react";
import { db, schema } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { DeleteDashboardButton } from "@/components/DeleteDashboardButton";
import { HomeToggle } from "@/components/HomeToggle";
import { NewDashboardForm } from "@/components/NewDashboardForm";
import { visibleDashboards } from "@/lib/team";
import { DASHBOARD_TEMPLATES } from "@/widgets/types";

/** Every saved dashboard in the workspace, plus a form to build a new one. */
export default async function ReportsPage() {
  const session = await requirePageSession();
  const [dashboards, stores] = await Promise.all([
    visibleDashboards(session),
    db
      .select({ id: schema.stores.id, shopDomain: schema.stores.shopDomain, name: schema.stores.name })
      .from(schema.stores)
      .where(eq(schema.stores.workspaceId, session.workspaceId)),
  ]);
  const canEdit = session.role !== "viewer";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-muted">Your saved dashboards. Open one to change its charts, or start a new one from a template.</p>
      </div>

      {dashboards.length === 0 ? (
        <div className="card p-5 text-sm text-muted">No saved dashboards yet.</div>
      ) : (
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
                {canEdit && <DeleteDashboardButton id={d.id} name={d.name} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {stores.length > 0 && canEdit && (
        <NewDashboardForm
          stores={stores.map((s) => ({ id: s.id, label: s.name ?? s.shopDomain }))}
          templates={Object.entries(DASHBOARD_TEMPLATES).map(([id, t]) => ({ id, label: t.label }))}
        />
      )}
    </div>
  );
}
