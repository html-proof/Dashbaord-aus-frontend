import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canSeeSection } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { StaffClient } from "@/components/StaffClient";

/** Staff & hours: staff records, shifts and how labour enters the profit report. */
export default async function StaffPage() {
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
          <p className="text-sm text-muted">Staff and shifts are kept per store.</p>
        </div>
        <Link href="/stores" className="btn btn-primary">Connect a store</Link>
      </div>
    );
  }
  return (
    <StaffClient
      canEdit={session.role !== "viewer"}
      stores={stores.map((s) => ({ id: s.id, label: s.name ?? s.shopDomain, currency: s.currency, timezone: s.timezone }))}
    />
  );
}
