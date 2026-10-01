import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getDashboard } from "@/lib/dashboards";
import { HttpError, requirePageSession } from "@/lib/session";
import { Builder } from "@/builder/Builder";

export default async function DashboardPage({ params }: PageProps<"/dashboards/[id]">) {
  const { id } = await params;
  const session = await requirePageSession();
  if (session.access && !session.access.dashboards.includes(id)) notFound();
  const dashboard = await getDashboard(id, session.workspaceId).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const stores = await db
    .select({ id: schema.stores.id, shopDomain: schema.stores.shopDomain, name: schema.stores.name })
    .from(schema.stores)
    .where(eq(schema.stores.workspaceId, session.workspaceId));

  return (
    <Builder
      dashboard={{ id: dashboard.id, name: dashboard.name, storeId: dashboard.storeId, widgets: dashboard.widgets }}
      stores={stores.map((s) => ({ id: s.id, label: s.name ?? s.shopDomain }))}
    />
  );
}
