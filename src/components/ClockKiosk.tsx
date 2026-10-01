"use client";
import { useEffect, useState } from "react";
import { Clock, Delete } from "lucide-react";
import { clsx } from "clsx";

/** PIN pad: staff clock in, and clock out on their next entry. */
export function ClockKiosk({ token, shop }: { token: string; shop: string }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, pin }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: body.error ?? "Something went wrong" });
      else
        setMsg({
          ok: true,
          text: body.action === "in" ? `Welcome, ${body.name}. You're clocked in.` : `Bye, ${body.name}. Clocked out after ${body.hours} h.`,
        });
    } finally {
      setPin("");
      setBusy(false);
    }
  };
  const press = (k: string) => setPin((p) => (p.length < 8 ? p + k : p));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="flex items-center justify-center gap-2 text-sm text-muted">
          <Clock className="size-4" /> {shop}
        </p>
        <p className="mt-2 text-4xl font-semibold tabular-nums" suppressHydrationWarning>
          {now?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? " "}
        </p>
        <p className="mt-1 text-sm text-muted">Enter your PIN to clock in or out</p>
      </div>
      <div className="flex h-12 items-center gap-3" aria-live="polite">
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span key={i} className={clsx("size-3.5 rounded-full", i < pin.length ? "bg-accent" : "bg-border")} />
        ))}
      </div>
      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <button key={k} className="btn h-16 justify-center text-2xl" onClick={() => press(k)} disabled={busy}>{k}</button>
        ))}
        <button className="btn h-16 justify-center" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete digit" disabled={busy}>
          <Delete className="size-5" />
        </button>
        <button className="btn h-16 justify-center text-2xl" onClick={() => press("0")} disabled={busy}>0</button>
        <button className="btn btn-primary h-16 justify-center" onClick={submit} disabled={busy || pin.length < 4}>
          {busy ? "…" : "Enter"}
        </button>
      </div>
      {msg && <p className={clsx("text-center font-medium", msg.ok ? "text-positive" : "text-negative")}>{msg.text}</p>}
    </main>
  );
}
