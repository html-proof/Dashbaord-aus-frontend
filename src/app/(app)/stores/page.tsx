import { isPlatformAdmin, requirePageSession } from "@/lib/session";
import { blockLimited } from "@/lib/team";
import { StoresClient } from "@/components/StoresClient";
import { optionalSetting } from "@/lib/settings";

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await requirePageSession();
  blockLimited(session);
  // The install (OAuth) flow needs the app's own credentials from app_settings.
  const oauthAvailable = Boolean(
    (await optionalSetting("SHOPIFY_CLIENT_ID")) && (await optionalSetting("SHOPIFY_CLIENT_SECRET")),
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stores</h1>
        <p className="text-sm text-muted">
          Connect Shopify stores. Your dashboards adapt to what each store has enabled.
        </p>
      </div>
      {error && (
        <p role="alert" className="card border-negative p-3 text-sm text-negative">
          {error}
        </p>
      )}
      <StoresClient
        canEdit={session.role !== "viewer"} oauthAvailable={oauthAvailable}
        showStatus={isPlatformAdmin(session)}
      />
    </div>
  );
}
