import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { parseUiState } from "@/lib/ui-state";

/** After sign-in: reopen the page the user last had open, on whichever device that was. */
export default async function ResumePage() {
  const session = await requirePageSession();
  const s = await db.query.userSettings.findFirst({ where: eq(schema.userSettings.userId, session.user.id) });
  redirect(parseUiState(s?.uiState).lastPath ?? "/dashboards");
}
