"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Eye, Loader2, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/format";
import { SECTION_IDS, SECTION_LABELS, type SectionId } from "@/lib/overview-prefs";
import type { Access } from "@/lib/access";

type Role = "owner" | "editor" | "viewer";
type Member = { id: string; email: string | null; name: string | null; avatarUrl: string | null; role: Role; access: Access | null };
type Invite = { id: string; email: string; role: "editor" | "viewer"; access: Access | null; createdAt: string };
type Incoming = { id: string; role: "editor" | "viewer"; workspace: string };
type Dash = { id: string; name: string };
type Action = { url: string; method: "POST" | "PATCH" | "DELETE"; body?: unknown; accept?: boolean };

/** Short summary of a viewer's limits, e.g. "Sales, Trends + 1 report". */
function describe(access: Access | null) {
  if (!access) return "Everything";
  const parts = access.sections.map((s) => SECTION_LABELS[s as SectionId]);
  if (access.dashboards.length) parts.push(`${access.dashboards.length} report${access.dashboards.length > 1 ? "s" : ""}`);
  return parts.length ? parts.join(", ") : "Nothing yet";
}

/** Tick boxes for the overview sections and saved dashboards a viewer can see. null = everything. */
function AccessPicker({ value, onChange, dashboards }: { value: Access | null; onChange: (a: Access | null) => void; dashboards: Dash[] }) {
  const limited = value !== null;
  const cur = value ?? { sections: [...SECTION_IDS], dashboards: dashboards.map((d) => d.id) };
  const toggle = <K extends keyof Access>(key: K, id: string) => {
    const list = cur[key] as string[];
    onChange({ ...cur, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };
  return (
    <div className="w-full space-y-3 rounded-lg border border-border bg-surface-2/40 p-3 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!limited} onChange={(e) => onChange(e.target.checked ? null : cur)} />
        Everything, including reports added later
      </label>
      {limited && (
        <>
          <fieldset>
            <legend className="mb-1 text-xs text-muted">Overview sections</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {SECTION_IDS.map((id) => (
                <label key={id} className="flex items-center gap-2">
                  <input type="checkbox" checked={cur.sections.includes(id)} onChange={() => toggle("sections", id)} />
                  {SECTION_LABELS[id]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-xs text-muted">Saved reports</legend>
            {dashboards.length === 0 && <p className="text-xs text-muted">No saved dashboards yet.</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {dashboards.map((d) => (
                <label key={d.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={cur.dashboards.includes(d.id)} onChange={() => toggle("dashboards", d.id)} />
                  {d.name}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}

/** Members, pending invites and the invite form for the Team page. */
export function TeamClient({
  me,
  isOwner,
  members,
  invites,
  incoming,
  dashboards,
}: {
  me: string;
  isOwner: boolean;
  members: Member[];
  invites: Invite[];
  incoming: Incoming[];
  dashboards: Dash[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [access, setAccess] = useState<Access | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: () => api("/api/team/invites", { method: "POST", body: JSON.stringify({ email, role, access: role === "viewer" ? access : null }) }),
    onSuccess: () => {
      setEmail("");
      setAccess(null);
      router.refresh();
    },
  });
  const act = useMutation({
    mutationFn: ({ url, method, body }: Action) => api(url, { method, body: body ? JSON.stringify(body) : undefined }),
    // Accepting moves you to another workspace: a full reload drops every cached query from the old one.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    onSuccess: (_d, v) => (v.accept ? window.location.assign("/dashboards") : router.refresh()),
  });

  return (
    <div className="space-y-5">
      {incoming.map((i) => (
        <div key={i.id} className="card flex flex-wrap items-center gap-3 border-accent/40 bg-accent/[0.06] p-4">
          <Mail className="size-5 text-accent" />
          <p className="mr-auto text-sm">
            You&apos;re invited to <b>{i.workspace}</b> as {i.role === "editor" ? "an editor" : "a viewer"}. Joining replaces your current workspace.
          </p>
          <button
            className="btn btn-primary"
            disabled={act.isPending}
            onClick={() => confirm(`Join ${i.workspace}? You'll leave your current workspace.`) && act.mutate({ url: `/api/team/invites/${i.id}`, method: "POST", accept: true })}
          >
            Accept
          </button>
        </div>
      ))}

      {isOwner && (
        <form
          className="card flex flex-wrap items-end gap-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate();
          }}
        >
          <div className="min-w-0 flex-1 basis-64">
            <label className="mb-1 block text-sm font-medium" htmlFor="invite-email">Invite by email</label>
            <input id="invite-email" type="email" required className="input" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <select className="input w-auto" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")}>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button className="btn btn-primary" disabled={invite.isPending}>
            {invite.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Invite
          </button>
          {role === "viewer" && (
            <div className="w-full">
              <p className="mb-1 text-sm font-medium">What can they see?</p>
              <AccessPicker value={access} onChange={setAccess} dashboards={dashboards} />
            </div>
          )}
          <p className="w-full text-xs text-muted">
            They join this workspace the next time they sign in with that email. No email is sent yet, so let them know.
          </p>
          {invite.error && <p className="w-full text-sm text-negative">{(invite.error as Error).message}</p>}
        </form>
      )}

      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Users className="size-4 text-accent" /> Members ({members.length})</h2>
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const label = m.name ?? m.email ?? "Unknown";
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" className="size-9 rounded-full" />
                ) : (
                  <span className="grid size-9 place-items-center rounded-full bg-accent/20 text-sm font-medium text-accent">{label.charAt(0).toUpperCase()}</span>
                )}
                <span className="mr-auto min-w-0">
                  <span className="block truncate text-sm font-medium">{label}{m.id === me && " (you)"}</span>
                  {m.name && m.email && <span className="block truncate text-xs text-muted">{m.email}</span>}
                  {m.role === "viewer" && <span className="block truncate text-xs text-muted">Sees: {describe(m.access)}</span>}
                </span>
                {isOwner && m.role !== "owner" ? (
                  <>
                    {m.role === "viewer" && (
                      <button className="btn py-1 text-sm" onClick={() => setEditing(editing === m.id ? null : m.id)} aria-expanded={editing === m.id}>
                        <Eye className="size-4" /> What they see
                      </button>
                    )}
                    <select
                      className="input w-auto py-1 text-sm"
                      aria-label={`Role for ${label}`}
                      value={m.role}
                      onChange={(e) => act.mutate({ url: `/api/team/members/${m.id}`, method: "PATCH", body: { role: e.target.value } })}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      className="btn size-8 p-0 text-negative"
                      title="Remove from workspace"
                      onClick={() => confirm(`Remove ${label} from this workspace?`) && act.mutate({ url: `/api/team/members/${m.id}`, method: "DELETE" })}
                    >
                      <Trash2 className="size-4" />
                    </button>
                    {editing === m.id && (
                      <AccessPicker
                        value={m.access}
                        dashboards={dashboards}
                        onChange={(a) => act.mutate({ url: `/api/team/members/${m.id}`, method: "PATCH", body: { access: a } })}
                      />
                    )}
                  </>
                ) : (
                  <span className="rounded-md border border-border px-2 py-0.5 text-xs capitalize text-muted">{m.role}</span>
                )}
              </li>
            );
          })}
        </ul>
        {act.error && <p className="mt-2 text-sm text-negative">{(act.error as Error).message}</p>}
      </section>

      {isOwner && invites.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Pending invites</h2>
          <ul className="divide-y divide-border">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3 text-sm">
                <Mail className="size-4 text-muted" />
                <span className="mr-auto min-w-0">
                  <span className="block truncate">{i.email}</span>
                  {i.role === "viewer" && <span className="block truncate text-xs text-muted">Will see: {describe(i.access)}</span>}
                </span>
                <span className="text-xs capitalize text-muted">{i.role}</span>
                <button className="btn size-8 p-0" title="Cancel invite" onClick={() => act.mutate({ url: `/api/team/invites/${i.id}`, method: "DELETE" })}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
