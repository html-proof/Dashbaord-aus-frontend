"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChartLine,
  Home,
  MessageCircle,
  Bell,
  CalendarRange,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  Settings,
  Receipt,
  ShoppingBag,
  Store,
  Users,
  UserCog,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/format";
import { logout } from "@/lib/firebase-client";
import { useUiState } from "@/lib/use-ui-state";
import { STORE_KEY, STORE_SWITCH_EVENT, TOPBAR_SLOT_ID } from "@/components/StoreOverview";
import type { Insight } from "@/lib/insights";
import type { SectionId } from "@/lib/overview-prefs";

/** Pages a limited viewer (shared only some sections/reports) may open. */
const LIMITED_PAGES = ["/dashboards", "/reports"];

const LINKS = [
  { href: "/dashboards", label: "Dashboards", icon: LayoutGrid },
  { href: "/profit", label: "Profit report", icon: Receipt },
  { href: "/plan", label: "Annual plan", icon: CalendarRange },
  { href: "/staff", label: "Staff & hours", icon: UserCog },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

type User = { email: string | null; name: string | null; avatarUrl: string | null };

/** Jump links to each section of the store overview (ids set in StoreOverview / Insights), with the section they belong to. */
const OVERVIEW: { id: string; label: string; section: SectionId }[] = [
  { id: "attention", label: "Worth your attention", section: "insights" },
  { id: "sales", label: "Sales", section: "sales" },
  { id: "profit-inventory", label: "Profit & Inventory", section: "profit" },
  { id: "marketing", label: "Marketing", section: "marketing" },
  { id: "trends", label: "Trends", section: "trends" },
  { id: "breakdowns", label: "Breakdowns", section: "breakdowns" },
  { id: "customers", label: "Customers", section: "breakdowns" },
];

const COLLAPSE_KEY = "sidebar-collapsed";

/** Sidebar + top bar around every signed-in page. */
export function AppShell({ user, sections, children }: { user: User; sections: SectionId[] | null; children: React.ReactNode }) {
  // Limited viewers only get the pages and overview sections shared with them.
  const links = sections ? LINKS.filter((l) => LIMITED_PAGES.includes(l.href)) : LINKS;
  const shared = sections ? OVERVIEW.filter((o) => sections.includes(o.section)) : OVERVIEW;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const path = usePathname();
  const router = useRouter();

  // Only list sections this user's store actually shows (some need extra Shopify permissions).
  const [present, setPresent] = useState<string[] | null>(null);
  useEffect(() => {
    const scan = () => {
      const found = shared.filter((o) => document.getElementById(o.id)).map((o) => o.id);
      setPresent((prev) => (found.length === 0 ? null : prev?.join() === found.join() ? prev : found));
    };
    scan();
    const obs = new MutationObserver(scan);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, sections]);
  const overviewItems = present ? shared.filter((o) => present.includes(o.id)) : shared;

  const onDashboards = path.startsWith("/dashboards");

  // Quick store switching from the sidebar when more than one store is connected.
  const storeList =
    useQuery({
      queryKey: ["stores"],
      queryFn: () => api<{ stores: { id: string; name: string | null; shopDomain: string }[] }>("/api/stores"),
    }).data?.stores ?? [];
  const [activeStore, setActiveStore] = useState<string | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveStore(localStorage.getItem(STORE_KEY));
    } catch {}
    const onSwitch = (e: Event) => setActiveStore((e as CustomEvent<string>).detail);
    window.addEventListener(STORE_SWITCH_EVENT, onSwitch);
    return () => window.removeEventListener(STORE_SWITCH_EVENT, onSwitch);
  }, []);
  const currentStore = storeList.some((st) => st.id === activeStore) ? activeStore : storeList[0]?.id;
  const switchStore = (id: string) => {
    try {
      localStorage.setItem(STORE_KEY, id);
    } catch {}
    setMobileOpen(false);
    window.dispatchEvent(new CustomEvent(STORE_SWITCH_EVENT, { detail: id }));
    if (!onDashboards) router.push("/dashboards?view=overview");
  };

  const jump = (id: string) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else router.push(`/dashboards?view=overview#${id}`);
  };

  useEffect(() => {
    try {
      // Read after mount so server and client HTML match; the saved account value below then wins.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);
  const { ui, loaded, save: saveUi } = useUiState();
  const savedCollapsed = ui?.sidebarCollapsed;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedCollapsed !== undefined) setCollapsed(savedCollapsed);
  }, [savedCollapsed]);
  // Remember the page for "resume where you left off" on any device.
  useEffect(() => {
    if (!loaded || !/^\/(dashboards|reports)/.test(path)) return;
    const t = setTimeout(() => saveUi({ lastPath: path + window.location.search }), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, loaded]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMobileOpen(false), [path]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveUi({ sidebarCollapsed: next });
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {}
  };

  return (
    <div className="flex min-h-full flex-1">
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-[width,transform] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-60",
          mobileOpen ? "w-60 translate-x-0" : "w-60 -translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg">
            <ShoppingBag className="size-4" />
          </span>
          {!collapsed && (
            <Link href="/dashboards" className="text-lg font-semibold">
              Store<span className="text-accent">board</span>
            </Link>
          )}
          <button className="ml-auto text-muted lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          <Link
            href="/dashboards?view=overview"
            title={collapsed ? "Overview" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              onDashboards ? "bg-accent/15 font-medium text-foreground ring-1 ring-accent/30" : "text-muted hover:bg-surface-2 hover:text-foreground",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <Home className={clsx("size-4 shrink-0", onDashboards && "text-accent")} />
            <span className={clsx(collapsed && "lg:hidden")}>Overview</span>
          </Link>
          <button
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground",
              collapsed && "lg:justify-center lg:px-0",
            )}
            onClick={() => {
              if (!onDashboards) {
                setOverviewOpen(true);
                router.push("/dashboards?view=overview");
              } else if (collapsed && overviewItems[0]) jump(overviewItems[0].id);
              else setOverviewOpen((o) => !o);
            }}
            title={collapsed ? "Analytics" : undefined}
            aria-expanded={overviewOpen}
          >
            <ChartLine className="size-4 shrink-0" />
            <span className={clsx("flex-1 text-left", collapsed && "lg:hidden")}>Analytics</span>
            <ChevronDown className={clsx("size-4 transition", !overviewOpen && "-rotate-90", collapsed && "lg:hidden")} />
          </button>
          {overviewOpen && (
            <div className={clsx("ml-5 flex flex-col gap-0.5 border-l border-border pl-3", collapsed && "lg:hidden")}>
              {overviewItems.map((o) => (
                <button
                  key={o.id}
                  className="rounded-md px-2 py-1.5 text-left text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
                  onClick={() => jump(o.id)}
                >
                  {o.label}
                </button>
              ))}
              {storeList.length > 1 && (
                <>
                  <p className="mt-2 px-2 text-[11px] uppercase tracking-wide text-muted">Switch store</p>
                  {storeList.map((st) => (
                    <button
                      key={st.id}
                      className={clsx(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-surface-2",
                        currentStore === st.id ? "text-foreground" : "text-muted hover:text-foreground",
                      )}
                      onClick={() => switchStore(st.id)}
                    >
                      <span className={clsx("size-1.5 shrink-0 rounded-full", currentStore === st.id ? "bg-accent" : "bg-border")} />
                      <span className="truncate">{st.name ?? st.shopDomain}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          {links.filter((l) => l.href !== "/dashboards").map(({ href, label, icon: Icon }) => {
            const active = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  active ? "bg-accent/15 font-medium text-foreground ring-1 ring-accent/30" : "text-muted hover:bg-surface-2 hover:text-foreground",
                  collapsed && "lg:justify-center lg:px-0",
                )}
              >
                <Icon className={clsx("size-4 shrink-0", active && "text-accent")} />
                <span className={clsx(collapsed && "lg:hidden")}>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={clsx("mx-3 mb-2 rounded-xl border border-border bg-surface-2/50 p-4", (collapsed || sections) && "lg:hidden", sections && "hidden")}>
          <span className="grid size-9 place-items-center rounded-full bg-accent/15 text-accent">
            <MessageCircle className="size-4" />
          </span>
          <p className="mt-3 font-medium">Need help?</p>
          <p className="mt-1 text-xs text-muted">Connect a store and your ad accounts in a few minutes.</p>
          <Link href="/settings#integrations" className="btn mt-3 w-full justify-center text-accent">
            Setup guide <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="hidden p-3 lg:block">
          <button className="btn size-9 p-0" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
            <button className="btn size-9 p-0 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="size-4" />
            </button>
            <CommandSearch links={links} />
            <div id={TOPBAR_SLOT_ID} className="hidden min-w-0 items-center gap-2 xl:flex" />
            <div className="ml-auto flex items-center gap-3">
              {(!sections || sections.includes("insights")) && <Notifications storeId={currentStore ?? null} onOpen={() => jump("attention")} />}
              <UserMenu user={user} settings={!sections} />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

/** Bell menu listing the current store's "Worth your attention" items (last 7 days). */
function Notifications({ storeId, onOpen }: { storeId: string | null; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: ["metric", storeId, "insights", "7d", undefined, undefined],
    enabled: !!storeId,
    queryFn: () => api<{ insights: Insight[] }>(`/api/insights?storeId=${storeId}&range=7d`),
    refetchInterval: 60_000,
  });
  const items = q.data?.insights ?? [];
  const urgent = items.filter((i) => i.severity !== "info").length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
        aria-label={urgent ? `Notifications (${urgent} need attention)` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell className="size-4" />
        {urgent > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-negative" />}
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] p-1 shadow-lg">
          <p className="px-3 py-2 text-xs text-muted">Worth your attention · last 7 days</p>
          {!storeId && <p className="px-3 pb-3 text-sm text-muted">Connect a store to get alerts.</p>}
          {q.isLoading && <div className="mx-3 mb-3 h-12 animate-pulse rounded-md bg-surface-2" />}
          {q.data && items.length === 0 && <p className="px-3 pb-3 text-sm text-muted">All clear. Nothing needs your attention.</p>}
          <div className="max-h-80 overflow-y-auto">
            {items.map((it) => (
              <button
                key={it.id}
                className="flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-left hover:bg-surface-2"
                onClick={() => {
                  setOpen(false);
                  onOpen();
                }}
              >
                <span
                  className={clsx(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    it.severity === "high" ? "bg-negative" : it.severity === "medium" ? "bg-warning" : "bg-accent",
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{it.title}</span>
                  <span className="line-clamp-2 block text-xs text-muted">{it.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "Search anything" box: jumps to pages and dashboards. Ctrl/⌘+K focuses it. */
function CommandSearch({ links }: { links: typeof LINKS }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const dashboards = useQuery({
    queryKey: ["dashboards"],
    enabled: open,
    queryFn: () => api<{ dashboards: { id: string; name: string; shopDomain: string | null }[] }>("/api/dashboards"),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = [
    ...links.map((l) => ({ id: l.href, label: l.label, hint: "Page", href: l.href })),
    ...(dashboards.data?.dashboards ?? []).map((d) => ({
      id: d.id,
      label: d.name,
      hint: d.shopDomain ?? "Dashboard",
      href: `/dashboards/${d.id}`,
    })),
  ].filter((i) => i.label.toLowerCase().includes(q.toLowerCase()) || i.hint.toLowerCase().includes(q.toLowerCase()));

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    input.current?.blur();
    router.push(href);
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        ref={input}
        className="input bg-surface pl-9 pr-14"
        placeholder="Search anything…"
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, items.length - 1));
          if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          if (e.key === "Enter" && items[active]) go(items[active].href);
          if (e.key === "Escape") input.current?.blur();
        }}
        aria-label="Search"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-[10px] text-muted sm:block">
        Ctrl K
      </kbd>
      {open && (
        <div className="card absolute inset-x-0 top-full z-50 mt-1 max-h-80 overflow-y-auto p-1 shadow-lg">
          {items.length === 0 && <p className="p-3 text-sm text-muted">No matches</p>}
          {items.map((i, n) => (
            <button
              key={i.id}
              className={clsx("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm", n === active ? "bg-surface-2" : "hover:bg-surface-2")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(i.href)}
            >
              <span className="truncate">{i.label}</span>
              <span className="ml-3 shrink-0 text-xs text-muted">{i.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu({ user, settings }: { user: User; settings: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = user.email ?? user.name ?? "Account";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-surface-2" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="hidden text-sm sm:inline">{label}</span>
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="size-8 rounded-full" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-accent/20 text-sm font-medium text-accent">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-50 mt-1 w-56 p-1 shadow-lg">
          <p className="truncate px-3 py-2 text-xs text-muted">{label}</p>
          {settings && (
            <Link href="/settings" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>
              <Settings className="size-4" /> Settings
            </Link>
          )}
          <button
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-negative hover:bg-surface-2"
            onClick={async () => {
              await logout();
              router.replace("/login");
              router.refresh();
            }}
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
