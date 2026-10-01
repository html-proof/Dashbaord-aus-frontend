"use client";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Copy, ExternalLink, Info, Pencil, Plus, RefreshCw, ShoppingBag, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { api, formatValue } from "@/lib/format";
import { STORE_KEY, STORE_SWITCH_EVENT } from "@/components/StoreOverview";
import type { LabourMode, Shift, StaffMember } from "@/lib/staff";

type StoreOption = { id: string; label: string; currency: string | null; timezone: string };
type Data = { staff: StaffMember[]; shifts: Shift[]; settings: { labourMode: LabourMode; clockToken: string | null } };

const PRESETS = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  thisMonth: "This month",
  lastMonth: "Last month",
  custom: "Custom",
} as const;
type Preset = keyof typeof PRESETS;

function todayIn(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function shift(d: string, days: number) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
}
function presetRange(p: Exclude<Preset, "custom">, today: string) {
  const month = today.slice(0, 7);
  switch (p) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: shift(today, -1), to: shift(today, -1) };
    case "last7":
      return { from: shift(today, -6), to: today };
    case "last30":
      return { from: shift(today, -29), to: today };
    case "thisMonth":
      return { from: `${month}-01`, to: today };
    case "lastMonth": {
      const end = shift(`${month}-01`, -1);
      return { from: `${end.slice(0, 7)}-01`, to: end };
    }
  }
}
const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const MODES: Record<LabourMode, { label: string; help: string }> = {
  none: {
    label: "Review only (labour not added to profit)",
    help: "Shifts recorded here are for review and do not add an expense to the profit report.",
  },
  shifts: {
    label: "Recorded shifts (wages + on-costs + extra costs)",
    help: "Each shift's wages, on-costs and extra costs are added to the profit report as labour on the day it was worked.",
  },
};

export function StaffClient({ stores, canEdit }: { stores: StoreOption[]; canEdit: boolean }) {
  const [storeId, setStoreId] = useState(stores[0].id);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && stores.some((s) => s.id === saved)) setStoreId(saved);
    } catch {}
  }, [stores]);
  const pickStore = (id: string) => {
    setStoreId(id);
    try {
      localStorage.setItem(STORE_KEY, id);
    } catch {}
    window.dispatchEvent(new CustomEvent(STORE_SWITCH_EVENT, { detail: id }));
  };
  const store = stores.find((s) => s.id === storeId) ?? stores[0];
  const today = todayIn(store.timezone);

  const [preset, setPreset] = useState<Preset>("yesterday");
  const [custom, setCustom] = useState(() => presetRange("last7", today));
  const [includeToday, setIncludeToday] = useState(true);
  const range = useMemo(() => {
    const r = preset === "custom" ? custom : presetRange(preset, today);
    if (!includeToday && r.to >= today) {
      const to = shift(today, -1);
      return { from: r.from > to ? to : r.from, to };
    }
    return r;
  }, [preset, custom, today, includeToday]);

  const qc = useQueryClient();
  const key = ["staff", store.id, range.from, range.to];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api<Data>(`/api/staff?${new URLSearchParams({ storeId: store.id, ...range })}`),
    placeholderData: (prev) => prev,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["staff", store.id] });
    qc.invalidateQueries({ queryKey: ["profit", store.id] });
  };
  const data = q.data;
  const money = (v: number) => formatValue(v, "currency", store.currency);

  const shifts = data?.shifts ?? [];
  const totalHours = shifts.reduce((a, s) => a + s.hours, 0);
  const wages = shifts.reduce((a, s) => a + s.hours * s.hourlyRate, 0);
  const totalCost = shifts.reduce((a, s) => a + s.cost, 0);
  const people = new Set(shifts.map((s) => s.staffId)).size;
  const reportedDays = new Set(shifts.map((s) => s.day)).size;
  const mode = data?.settings.labourMode ?? "none";

  const [tab, setTab] = useState<"timesheets" | "staff" | "clock">("timesheets");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Your people, your costs</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Staff, hours and expenses.</h1>
        <p className="mt-1 text-muted">Manage staff details and bring labour into your daily profit.</p>
        <p className="mt-6 flex items-center gap-1.5 text-sm text-muted">
          <Info className="size-4 shrink-0" /> Staff and shifts are the records you enter here. Shopify does not provide wages or timesheets.
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-2">
          {stores.length > 1 && (
            <label className="flex items-center gap-2">
              <ShoppingBag className="size-4 text-muted" />
              <select className="input w-auto" value={store.id} onChange={(e) => pickStore(e.target.value)} aria-label="Store">
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          )}
          <CalendarDays className="size-4 text-muted" />
          <input
            type="date"
            className="input w-auto"
            aria-label="From"
            value={range.from}
            onChange={(e) => {
              if (!e.target.value) return;
              setPreset("custom");
              setCustom({ from: e.target.value, to: range.to < e.target.value ? e.target.value : range.to });
            }}
          />
          <span className="text-sm text-muted">to</span>
          <input
            type="date"
            className="input w-auto"
            aria-label="To"
            value={range.to}
            onChange={(e) => {
              if (!e.target.value) return;
              setPreset("custom");
              setCustom({ from: range.from > e.target.value ? e.target.value : range.from, to: e.target.value });
            }}
          />
          <select
            className="input w-auto"
            value={preset}
            aria-label="Date range"
            onChange={(e) => {
              const p = e.target.value as Preset;
              if (p === "custom") setCustom(range);
              setPreset(p);
            }}
          >
            {Object.entries(PRESETS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <label className="ml-auto flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="accent-[var(--accent)]" checked={includeToday} onChange={(e) => setIncludeToday(e.target.checked)} />
            Include incomplete days
          </label>
        </div>
        <div className="flex justify-between text-xs text-muted">
          <span>{store.currency ?? "—"} · {store.timezone}</span>
          <span>{reportedDays} reported days</span>
        </div>
      </div>

      {q.error && <p className="text-sm text-negative">{(q.error as Error).message}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Stat title="Staff" value={String(people)} sub={`${people} ${people === 1 ? "person" : "people"} with shifts in this period`} />
        <Stat
          title="Paid hours · average rate"
          value={`${+totalHours.toFixed(2)} h`}
          sub={`${totalHours ? money(wages / totalHours) : "—"} / hour before on-costs`}
        />
        <Stat
          title="Recorded labour expense"
          value={money(totalCost)}
          sub={mode === "shifts" ? "Wages + on-costs + extra costs; added to profit" : "Wages + on-costs + extra costs; not added to profit (review only)"}
        />
      </div>

      <CostingMethod key={`${store.id}:${mode}`} storeId={store.id} mode={mode} canEdit={canEdit} onSaved={refresh} />

      <div className="inline-flex rounded-lg border border-border bg-surface p-1">
        {(
          [
            ["timesheets", "Timesheets"],
            ["staff", "Staff records"],
            ["clock", "Clocking integration"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={clsx("rounded-md px-3 py-1.5 text-sm transition", tab === id ? "bg-surface-2 font-medium" : "text-muted hover:text-foreground")}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "timesheets" && (
        <Timesheets storeId={store.id} today={today} range={range} data={data} money={money} canEdit={canEdit} onChanged={refresh} goStaff={() => setTab("staff")} />
      )}
      {tab === "staff" && <StaffRecords storeId={store.id} staff={data?.staff ?? []} money={money} canEdit={canEdit} onChanged={refresh} />}
      {tab === "clock" && (
        <Clocking storeId={store.id} token={data?.settings.clockToken ?? null} staff={data?.staff ?? []} canEdit={canEdit} onChanged={refresh} />
      )}
    </div>
  );
}

function Stat({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-muted">{sub}</p>
    </div>
  );
}

function CostingMethod({ storeId, mode, canEdit, onSaved }: { storeId: string; mode: LabourMode; canEdit: boolean; onSaved: () => void }) {
  const [value, setValue] = useState<LabourMode>(mode);
  const save = useMutation({
    mutationFn: () => api("/api/staff/settings", { method: "PATCH", body: JSON.stringify({ storeId, labourMode: value }) }),
    onSuccess: onSaved,
  });
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold">How staff costs enter your profit report</h2>
      <p className="mt-1 text-sm text-muted">Choose one method so payroll is never counted twice.</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <select className="input w-auto max-w-full" value={value} disabled={!canEdit} onChange={(e) => setValue(e.target.value as LabourMode)} aria-label="Costing method">
          {(Object.keys(MODES) as LabourMode[]).map((m) => (
            <option key={m} value={m}>{MODES[m].label}</option>
          ))}
        </select>
        {canEdit && (
          <button className="btn" disabled={value === mode || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save costing method"}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        {mode === value ? `${MODES[mode].label.split(" (")[0]} is active. ` : ""}
        {MODES[value].help} Changing the method recalculates every report period.
      </p>
      {save.error && <p className="mt-2 text-sm text-negative">{(save.error as Error).message}</p>}
    </div>
  );
}

function Timesheets({
  storeId, today, range, data, money, canEdit, onChanged, goStaff,
}: {
  storeId: string; today: string; range: { from: string; to: string }; data: Data | undefined;
  money: (v: number) => string; canEdit: boolean; onChanged: () => void; goStaff: () => void;
}) {
  // null = closed; otherwise the staff member and day to prefill (from a timesheet cell).
  const [adding, setAdding] = useState<{ staffId?: string; day?: string } | null>(null);
  const staff = data?.staff ?? [];
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const del = useMutation({
    mutationFn: (id: string) => api(`/api/staff/shifts/${id}`, { method: "DELETE" }),
    onSuccess: onChanged,
  });
  const shifts = data?.shifts ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Hours &amp; expenses</h2>
        {canEdit && staff.some((s) => s.active) && (
          <button className="btn btn-primary" onClick={() => setAdding({})}>
            <Plus className="size-4" /> Add shift
          </button>
        )}
      </div>
      {adding && (
        <ShiftForm
          key={`${adding.staffId}:${adding.day}`}
          storeId={storeId}
          staff={staff.filter((s) => s.active)}
          defaultStaff={adding.staffId}
          defaultDay={adding.day ?? (range.to > today ? today : range.to)}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            onChanged();
          }}
        />
      )}
      {staff.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Add a staff member in{" "}
          <button className="text-accent underline-offset-2 hover:underline" onClick={goStaff}>Staff records</button>, then record their shifts for this period.
        </div>
      ) : (
        <TimesheetGrid
          staff={staff}
          shifts={shifts}
          range={range}
          today={today}
          money={money}
          onCell={canEdit ? (staffId, day) => setAdding({ staffId, day }) : undefined}
        />
      )}
      {shifts.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Day</th>
                <th className="px-4 py-3 font-medium">Staff</th>
                <th className="px-4 py-3 text-right font-medium">Hours</th>
                <th className="px-4 py-3 text-right font-medium">Rate</th>
                <th className="px-4 py-3 text-right font-medium">On-cost</th>
                <th className="px-4 py-3 text-right font-medium">Extra</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-3">{dayLabel(s.day)}</td>
                  <td className="px-4 py-3">{names.get(s.staffId) ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.source === "clock" && !s.clockOut ? <span className="text-accent">Clocked in</span> : s.hours.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(s.hourlyRate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.onCostPct}%</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(s.extraCost)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{money(s.cost)}</td>
                  <td className="max-w-48 truncate px-4 py-3 text-muted">{s.source === "clock" ? "Clock-in" : s.note}</td>
                  <td className="px-2 py-3">
                    {canEdit && (
                      <button
                        className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-negative"
                        aria-label="Delete shift"
                        onClick={() => confirm("Delete this shift?") && del.mutate(s.id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Timesheet: hours per staff member per day of the period, with totals. Clicking a day adds a shift. */
function TimesheetGrid({
  staff, shifts, range, today, money, onCell,
}: {
  staff: StaffMember[]; shifts: Shift[]; range: { from: string; to: string }; today: string;
  money: (v: number) => string; onCell?: (staffId: string, day: string) => void;
}) {
  const days: string[] = [];
  for (let d = range.from; d <= range.to && days.length < 62; d = shift(d, 1)) days.push(d);
  // Active staff, plus anyone inactive who still has shifts in the period.
  const people = staff.filter((p) => p.active || shifts.some((s) => s.staffId === p.id));
  const cells = new Map<string, { hours: number; cost: number; open: boolean }>();
  for (const s of shifts) {
    const k = `${s.staffId}:${s.day}`;
    const c = cells.get(k) ?? { hours: 0, cost: 0, open: false };
    cells.set(k, { hours: c.hours + s.hours, cost: c.cost + s.cost, open: c.open || (s.source === "clock" && !s.clockOut) });
  }
  const hrs = (h: number) => String(+h.toFixed(2));
  const sum = (id: string, k: "hours" | "cost") => days.reduce((a, d) => a + (cells.get(`${id}:${d}`)?.[k] ?? 0), 0);
  const dayTotal = (d: string) => people.reduce((a, p) => a + (cells.get(`${p.id}:${d}`)?.hours ?? 0), 0);
  const totalHours = people.reduce((a, p) => a + sum(p.id, "hours"), 0);
  const totalCost = people.reduce((a, p) => a + sum(p.id, "cost"), 0);

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-border">
            <th className="sticky left-0 bg-surface px-4 py-3 text-left font-medium">Timesheet</th>
            {days.map((d) => (
              <th key={d} className={clsx("px-2 py-3 text-center font-medium", d === today && "text-accent")}>{dayLabel(d)}</th>
            ))}
            <th className="bg-surface-2 px-4 py-3 text-right font-medium">Hours</th>
            <th className="bg-surface-2 px-4 py-3 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className="border-b border-border/60">
              <td className="sticky left-0 bg-surface px-4 py-2">
                <span className="font-medium">{p.name}</span>
                {p.role && <span className="block text-xs text-muted">{p.role}</span>}
              </td>
              {days.map((d) => {
                const c = cells.get(`${p.id}:${d}`);
                const label = c ? (c.open ? "In" : hrs(c.hours)) : "";
                return (
                  <td key={d} className="px-1 py-1.5 text-center">
                    {onCell && p.active && d <= today ? (
                      <button
                        className={clsx(
                          "h-9 w-14 rounded-md tabular-nums transition",
                          c ? "bg-accent/15 font-medium hover:bg-accent/25" : "text-muted hover:bg-surface-2 hover:text-foreground",
                        )}
                        title={c ? `${label} h · ${money(c.cost)} (click to add another shift)` : "Add shift"}
                        aria-label={`${p.name}, ${dayLabel(d)}: ${c ? `${label} hours` : "add shift"}`}
                        onClick={() => onCell(p.id, d)}
                      >
                        {label || "+"}
                      </button>
                    ) : (
                      <span className={clsx("inline-block w-14 tabular-nums", c ? "font-medium" : "text-muted")}>{label || "–"}</span>
                    )}
                  </td>
                );
              })}
              <td className="bg-surface-2 px-4 py-2 text-right font-medium tabular-nums">{hrs(sum(p.id, "hours"))}</td>
              <td className="bg-surface-2 px-4 py-2 text-right tabular-nums">{money(sum(p.id, "cost"))}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="sticky left-0 bg-surface px-4 py-3">Total</td>
            {days.map((d) => (
              <td key={d} className="px-2 py-3 text-center tabular-nums">{dayTotal(d) ? hrs(dayTotal(d)) : "–"}</td>
            ))}
            <td className="bg-surface-2 px-4 py-3 text-right tabular-nums">{hrs(totalHours)}</td>
            <td className="bg-surface-2 px-4 py-3 text-right tabular-nums">{money(totalCost)}</td>
          </tr>
        </tbody>
      </table>
      {shifts.length === 0 && (
        <p className="border-t border-border px-4 py-3 text-center text-sm text-muted">
          No shifts recorded in this period yet{onCell ? ". Click a day to add one." : "."}
        </p>
      )}
    </div>
  );
}

function ShiftForm({
  storeId, staff, defaultStaff, defaultDay, onClose, onSaved,
}: { storeId: string; staff: StaffMember[]; defaultStaff?: string; defaultDay: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ staffId: defaultStaff ?? staff[0]?.id ?? "", day: defaultDay, hours: "", extraCost: "", note: "" });
  const save = useMutation({
    mutationFn: () =>
      api("/api/staff/shifts", {
        method: "POST",
        body: JSON.stringify({ storeId, staffId: f.staffId, day: f.day, hours: +f.hours, extraCost: +(f.extraCost || 0), note: f.note }),
      }),
    onSuccess: onSaved,
  });
  return (
    <form
      className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label="Staff member" className="lg:col-span-2">
        <select className="input" value={f.staffId} onChange={(e) => setF({ ...f, staffId: e.target.value })} required>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Day">
        <input type="date" className="input" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} required />
      </Field>
      <Field label="Hours">
        <input type="number" className="input" min={0} max={24} step={0.25} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} required />
      </Field>
      <Field label="Extra cost">
        <input type="number" className="input" min={0} step={0.01} placeholder="0" value={f.extraCost} onChange={(e) => setF({ ...f, extraCost: e.target.value })} />
      </Field>
      <Field label="Note">
        <input className="input" maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </Field>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
        <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save shift"}</button>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        {save.error && <p className="text-sm text-negative">{(save.error as Error).message}</p>}
      </div>
    </form>
  );
}

function StaffRecords({
  storeId, staff, money, canEdit, onChanged,
}: { storeId: string; staff: StaffMember[]; money: (v: number) => string; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => api(`/api/staff/${id}`, { method: "DELETE" }),
    onSuccess: onChanged,
  });
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Staff records</h2>
        <div className="flex gap-2">
          <a className="btn" href={`/our-team/${storeId}`} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> Public team page
          </a>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add staff
            </button>
          )}
        </div>
      </div>
      {editing && (
        <StaffForm
          key={editing === "new" ? "new" : editing.id}
          storeId={storeId}
          person={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
      {staff.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No staff yet. Add your first team member to start recording hours.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 text-right font-medium">Hourly rate</th>
                <th className="px-4 py-3 text-right font-medium">On-cost</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Website</th>
                <th className="px-4 py-3 font-medium">Clock PIN</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.name}</p>
                    {s.email && <p className="text-xs text-muted">{s.email}</p>}
                  </td>
                  <td className="px-4 py-3">{s.role ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(s.hourlyRate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.onCostPct}%</td>
                  <td className="px-4 py-3">{s.active ? "Active" : <span className="text-muted">Inactive</span>}</td>
                  <td className="px-4 py-3">{s.showOnWebsite ? "Shown" : <span className="text-muted">Hidden</span>}</td>
                  <td className="px-4 py-3">{s.hasPin ? "Set" : <span className="text-muted">None</span>}</td>
                  <td className="whitespace-nowrap px-2 py-3">
                    {canEdit && (
                      <>
                        <button className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground" style={{ display: "inline-grid" }} aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}>
                          <Pencil className="size-4" />
                        </button>
                        <button
                          className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-negative"
                          style={{ display: "inline-grid" }}
                          aria-label={`Delete ${s.name}`}
                          onClick={() => confirm(`Delete ${s.name} and all their shifts?`) && del.mutate(s.id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StaffForm({ storeId, person, onClose, onSaved }: { storeId: string; person: StaffMember | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: person?.name ?? "",
    role: person?.role ?? "",
    email: person?.email ?? "",
    hourlyRate: person ? String(person.hourlyRate) : "",
    onCostPct: person ? String(person.onCostPct) : "12",
    active: person?.active ?? true,
    showOnWebsite: person?.showOnWebsite ?? false,
    bio: person?.bio ?? "",
    pin: "",
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name,
        role: f.role,
        email: f.email,
        hourlyRate: +f.hourlyRate,
        onCostPct: +(f.onCostPct || 0),
        active: f.active,
        showOnWebsite: f.showOnWebsite,
        bio: f.bio,
        ...(f.pin && { pin: f.pin }),
      };
      return person
        ? api(`/api/staff/${person.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : api("/api/staff", { method: "POST", body: JSON.stringify({ storeId, ...body }) });
    },
    onSuccess: onSaved,
  });
  return (
    <form
      className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex items-center justify-between sm:col-span-2 lg:col-span-4">
        <p className="font-medium">{person ? `Edit ${person.name}` : "New staff member"}</p>
        <button type="button" className="text-muted hover:text-foreground" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <Field label="Name">
        <input className="input" required maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Role">
        <input className="input" maxLength={120} placeholder="e.g. Warehouse" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
      </Field>
      <Field label="Email (optional)">
        <input type="email" className="input" maxLength={200} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <Field label="Hourly rate">
        <input type="number" className="input" required min={0} step={0.01} value={f.hourlyRate} onChange={(e) => setF({ ...f, hourlyRate: e.target.value })} />
      </Field>
      <Field label="On-costs % (super, payroll tax…)">
        <input type="number" className="input" min={0} max={500} step={0.01} value={f.onCostPct} onChange={(e) => setF({ ...f, onCostPct: e.target.value })} />
      </Field>
      <Field label={person?.hasPin ? "New clock-in PIN (blank = keep)" : "Clock-in PIN (4–8 digits)"}>
        <input className="input" inputMode="numeric" pattern="\d{4,8}" autoComplete="off" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} />
      </Field>
      <Field label="Bio for the public team page" className="sm:col-span-2">
        <input className="input" maxLength={1000} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-[var(--accent)]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-[var(--accent)]" checked={f.showOnWebsite} onChange={(e) => setF({ ...f, showOnWebsite: e.target.checked })} /> Show on public team page
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
        <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : person ? "Save changes" : "Add staff member"}</button>
        {person?.hasPin && (
          <button type="button" className="btn" onClick={() => api(`/api/staff/${person.id}`, { method: "PATCH", body: JSON.stringify({ pin: "" }) }).then(onSaved)}>
            Remove PIN
          </button>
        )}
        {person && <p className="text-xs text-muted">Rate changes apply to new shifts; recorded shifts keep their rate.</p>}
        {save.error && <p className="text-sm text-negative">{(save.error as Error).message}</p>}
      </div>
    </form>
  );
}

function Clocking({
  storeId, token, staff, canEdit, onChanged,
}: { storeId: string; token: string | null; staff: StaffMember[]; canEdit: boolean; onChanged: () => void }) {
  const set = useMutation({
    mutationFn: (clock: "on" | "off" | "rotate") => api("/api/staff/settings", { method: "PATCH", body: JSON.stringify({ storeId, clock }) }),
    onSuccess: onChanged,
  });
  const [copied, setCopied] = useState(false);
  const link = token && typeof window !== "undefined" ? `${window.location.origin}/clock/${token}` : null;
  const withPin = staff.filter((s) => s.active && s.hasPin).length;
  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Clock-in kiosk</h2>
        <p className="mt-1 text-sm text-muted">
          Open this link on a shared tablet or phone at work. Staff enter their PIN to clock in, and again to clock out; the hours land in Timesheets automatically.
        </p>
      </div>
      {link ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input min-w-0 flex-1 font-mono text-xs" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Kiosk link" />
            <button
              className="btn"
              onClick={() => {
                navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy className="size-4" /> {copied ? "Copied" : "Copy"}
            </button>
            <a className="btn" href={link} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> Open
            </a>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button className="btn" disabled={set.isPending} onClick={() => confirm("Make a new link? The old one stops working.") && set.mutate("rotate")}>
                <RefreshCw className="size-4" /> New link
              </button>
              <button className="btn text-negative" disabled={set.isPending} onClick={() => set.mutate("off")}>
                Turn off kiosk
              </button>
            </div>
          )}
        </>
      ) : canEdit ? (
        <button className="btn btn-primary" disabled={set.isPending} onClick={() => set.mutate("on")}>
          Turn on clock-in kiosk
        </button>
      ) : (
        <p className="text-sm text-muted">The kiosk is off.</p>
      )}
      <p className="text-xs text-muted">
        {withPin} active staff {withPin === 1 ? "member has" : "members have"} a PIN. Set PINs in Staff records.
      </p>
      {set.error && <p className="text-sm text-negative">{(set.error as Error).message}</p>}
    </section>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx("block space-y-1", className)}>
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
