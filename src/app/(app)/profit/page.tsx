import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canSeeSection } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { ProfitReport } from "@/components/ProfitReport";

/** Profit report: revenue, costs and profit line by line, per day or month. */
export default async function ProfitPage() {
  const session = await requirePageSession();
  if (!canSeeSection(session.access, "profit")) notFound();
  const stores = await db
    .select({
      id: schema.stores.id,
      shopDomain: schema.stores.shopDomain,
      name: schema.stores.name,
      currency: schema.stores.currency,
      timezone: schema.stores.timezone,
    })
    .from(schema.stores)
    .where(eq(schema.stores.workspaceId, session.workspaceId));

  if (stores.length === 0) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="font-medium">Connect a Shopify store first</p>
          <p className="text-sm text-muted">The profit report needs a store to pull data from.</p>
        </div>
        <Link href="/stores" className="btn btn-primary">Connect a store</Link>
      </div>
    );
  }
  return (
    <ProfitReport
      stores={stores.map((s) => ({
        id: s.id,
        label: s.name ?? s.shopDomain,
        shopDomain: s.shopDomain,
        currency: s.currency,
        timezone: s.timezone,
      }))}
    />
  );
}
