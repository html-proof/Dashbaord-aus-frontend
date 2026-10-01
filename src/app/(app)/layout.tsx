import { requirePageSession } from "@/lib/session";
import { AppShell } from "@/components/Nav";
import { AppearanceApplier } from "@/components/AppearanceApplier";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, access } = await requirePageSession();
  return (
    <AppShell user={{ email: user.email ?? null, name: user.name ?? null, avatarUrl: user.avatarUrl ?? null }} sections={access?.sections ?? null}>
      <AppearanceApplier />
      {children}
    </AppShell>
  );
}
