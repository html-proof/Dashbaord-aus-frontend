import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/lib/db";

/** Public "Our team" page: staff the merchant chose to show (name, role, bio only). */
export default async function OurTeamPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!z.string().uuid().safeParse(storeId).success) notFound();
  const store = await db.query.stores.findFirst({ where: eq(schema.stores.id, storeId) });
  if (!store) notFound();
  const people = await db
    .select({ id: schema.staff.id, name: schema.staff.name, role: schema.staff.role, bio: schema.staff.bio })
    .from(schema.staff)
    .where(and(eq(schema.staff.storeId, storeId), eq(schema.staff.active, true), eq(schema.staff.showOnWebsite, true)))
    .orderBy(asc(schema.staff.name));
  const shop = store.name ?? store.shopDomain;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{shop}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Meet our team.</h1>
      <p className="mt-2 text-muted">The people behind every order.</p>
      {people.length === 0 ? (
        <p className="mt-10 text-muted">Team profiles are coming soon.</p>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <div key={p.id} className="card p-6">
              <span className="grid size-12 place-items-center rounded-full bg-accent/15 text-lg font-semibold text-accent">
                {p.name.charAt(0).toUpperCase()}
              </span>
              <p className="mt-4 text-lg font-semibold">{p.name}</p>
              {p.role && <p className="text-sm text-accent">{p.role}</p>}
              {p.bio && <p className="mt-3 text-sm text-muted">{p.bio}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export const metadata = { title: "Our team" };
