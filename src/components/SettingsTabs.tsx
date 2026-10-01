"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Plug, Settings, Store, User } from "lucide-react";

type Tab = "general" | "integrations" | "account";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "account", label: "Account", icon: User },
];

/**
 * Settings tabs. General shows everything; the others narrow it down.
 * The tab follows the URL hash (#integrations, #account), so links can open one directly.
 */
export function SettingsTabs({
  top,
  general,
  integrations,
  side,
  account,
}: {
  /** Full-width row above the columns on the General tab. */
  top: React.ReactNode;
  general: React.ReactNode;
  integrations: React.ReactNode;
  side: React.ReactNode;
  account: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("general");
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (h === "integrations" || h === "account") setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const pick = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "general" ? window.location.pathname : `#${t}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 sm:w-fit" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => pick(id)}
            className={clsx(
              "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm transition",
              tab === id ? "bg-accent/15 font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
        <Link href="/stores" className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground">
          <Store className="size-4" /> Stores
        </Link>
      </div>

      {tab === "general" && top}
      {tab === "account" ? (
        account
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">{tab === "general" ? general : integrations}</div>
          <aside className="space-y-5">{side}</aside>
        </div>
      )}
      {tab === "general" && account}
    </div>
  );
}
