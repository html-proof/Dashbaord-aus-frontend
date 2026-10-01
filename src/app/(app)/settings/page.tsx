import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowRight, CheckCircle2, Lightbulb, Lock, ShieldCheck } from "lucide-react";
import { db, schema } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { listDashboards } from "@/lib/dashboards";
import { blockLimited } from "@/lib/team";
import { HomePageCard, SmartWidgetsCard } from "@/components/SettingsClient";
import { SettingsTabs } from "@/components/SettingsTabs";
import { NewDashboardForm } from "@/components/NewDashboardForm";
import { DeleteAccount } from "@/components/DeleteAccount";
import { IntegrationsSettings } from "@/components/IntegrationsSettings";
import { DASHBOARD_TEMPLATES } from "@/widgets/types";

export default async function SettingsPage() {
  const session = await requirePageSession();
  blockLimited(session);
  const dashboards = await listDashboards(session.workspaceId);
  const stores = await db
    .select({ id: schema.stores.id, shopDomain: schema.stores.shopDomain, name: schema.stores.name })
    .from(schema.stores)
    .where(eq(schema.stores.workspaceId, session.workspaceId));
  const storeOptions = stores.map((s) => ({ id: s.id, label: s.name ?? s.shopDomain }));
  const canEdit = session.role !== "viewer";

  const integrations = storeOptions.length > 0 && <IntegrationsSettings stores={storeOptions} canEdit={canEdit} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-muted">Customise your dashboard, integrations and account settings.</p>
        </div>
        <Illustration />
      </div>

      <SettingsTabs
        top={
          <div className="grid gap-5 md:grid-cols-2">
            <HomePageCard dashboards={dashboards.map((d) => ({ id: d.id, name: d.name }))} />
            <SmartWidgetsCard />
          </div>
        }
        general={
          <>
            {storeOptions.length > 0 && canEdit && (
              <NewDashboardForm
                stores={storeOptions}
                templates={Object.entries(DASHBOARD_TEMPLATES).map(([id, t]) => ({ id, label: t.label }))}
              />
            )}
            {integrations}
          </>
        }
        integrations={
          integrations || (
            <div className="card p-5 text-sm text-muted">
              <Link href="/stores" className="text-accent hover:underline">Connect a Shopify store</Link> first; ad and
              analytics accounts are linked to a store.
            </div>
          )
        }
        side={<SideCards />}
        account={<DeleteAccount />}
      />
    </div>
  );
}

function SideCards() {
  return (
    <>
      <div className="card space-y-4 bg-gradient-to-b from-accent/[0.08] to-transparent p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-accent/15 text-accent">
            <Lock className="size-6" />
          </span>
          <h2 className="text-lg font-semibold text-accent">Your data is secure</h2>
        </div>
        <ul className="space-y-3 text-sm">
          {["API keys are encrypted", "Never shown again after saving", "Read-only access to your ad accounts", "You can disconnect anytime"].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <CheckCircle2 className="size-4 shrink-0 text-positive" /> {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="card space-y-3 border-warning/30 bg-warning/[0.06] p-5">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-warning">Permissions</h2>
            <p className="text-xs text-muted">This app only reads the data you explicitly allow in Shopify.</p>
          </div>
        </div>
        <Link href="/stores" className="btn border-warning/40 text-warning">
          Manage permissions <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="card space-y-3 border-positive/30 bg-positive/[0.06] p-5">
        <div className="flex gap-3">
          <Lightbulb className="mt-0.5 size-6 shrink-0 text-positive" />
          <div>
            <h2 className="font-semibold text-positive">Pro tip</h2>
            <p className="text-sm text-muted">
              Enable more permissions in Shopify to unlock additional widgets and reports automatically.
            </p>
          </div>
        </div>
        <Link href="/stores" className="btn border-positive/40 text-positive">
          Go to store settings <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}

/** Decorative header art: a settings cog next to a mini chart card. */
function Illustration() {
  return (
    <svg viewBox="0 0 300 150" className="hidden h-32 w-64 shrink-0 md:block" aria-hidden>
      <defs>
        <linearGradient id="st-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <rect x="40" y="18" width="130" height="118" rx="26" fill="url(#st-bg)" transform="rotate(-8 105 77)" />
      <circle cx="30" cy="40" r="4" fill="var(--accent)" opacity="0.4" />
      <circle cx="280" cy="120" r="5" fill="var(--accent)" opacity="0.3" />
      <rect x="150" y="22" width="130" height="100" rx="14" fill="var(--surface)" stroke="var(--border)" />
      <rect x="166" y="40" width="44" height="6" rx="3" fill="var(--accent)" opacity="0.6" />
      <rect x="166" y="54" width="30" height="6" rx="3" fill="var(--accent)" opacity="0.35" />
      {[
        [220, 92, 14],
        [238, 80, 26],
        [256, 66, 40],
      ].map(([x, y, h]) => (
        <rect key={x} x={x} y={y} width="9" height={h} rx="4.5" fill="var(--accent)" />
      ))}
      <circle cx="205" cy="99" r="5" fill="var(--accent)" />
      <rect x="92" y="96" width="46" height="26" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <rect x="100" y="104" width="18" height="10" rx="5" fill="var(--positive)" />
      <circle cx="124" cy="109" r="4" fill="var(--positive)" />
      <g transform="translate(96 56)" fill="var(--accent)">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="-5" y="-30" width="10" height="14" rx="3" transform={`rotate(${i * 45})`} />
        ))}
        <circle r="22" />
        <circle r="9" fill="var(--surface)" />
      </g>
    </svg>
  );
}
