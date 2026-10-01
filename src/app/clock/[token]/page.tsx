import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { ClockKiosk } from "@/components/ClockKiosk";

/** Public clock-in kiosk for a store; the link token is the secret, each person's PIN identifies them. */
export default async function ClockPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = await db.query.staffSettings.findFirst({ where: eq(schema.staffSettings.clockToken, token) });
  const store = settings && (await db.query.stores.findFirst({ where: eq(schema.stores.id, settings.storeId) }));
  if (!store) notFound();
  return <ClockKiosk token={token} shop={store.name ?? store.shopDomain} />;
}

export const metadata = { title: "Clock in", robots: { index: false } };
