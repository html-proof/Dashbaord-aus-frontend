import { requirePageSession } from "@/lib/session";
import { blockLimited, invitesFor, listInvites, listMembers } from "@/lib/team";
import { listDashboards } from "@/lib/dashboards";
import { TeamClient } from "@/components/TeamClient";

export default async function TeamPage() {
  const session = await requirePageSession();
  blockLimited(session);
  const isOwner = session.role === "owner";
  const [members, invites, incoming, dashboards] = await Promise.all([
    listMembers(session.workspaceId),
    isOwner ? listInvites(session.workspaceId) : Promise.resolve([]),
    invitesFor(session.user.email, session.workspaceId),
    listDashboards(session.workspaceId),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-muted">Share your stores and dashboards. Editors can change dashboards and integrations; viewers can only look.</p>
      </div>
      <TeamClient me={session.user.id} isOwner={isOwner} members={members} invites={invites} incoming={incoming} dashboards={dashboards.map((d) => ({ id: d.id, name: d.name }))} />
    </div>
  );
}
