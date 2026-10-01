"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/format";
import type { CapabilityKey, CapabilityState } from "@/metrics/capabilities";

export type LiveNotice = { id: number; added: CapabilityKey[]; removed: CapabilityKey[] };

type LiveEvent =
  | { type: "ready" | "error" }
  | { type: "capabilities.changed"; added: CapabilityKey[]; removed: CapabilityKey[] }
  | { type: "data.updated" }
  | { type: "sync.status"; status: string };
type Listener = (e: LiveEvent) => void;
type Channel = { listeners: Set<Listener>; close: () => void; connected: boolean; syncStatus: string | null };

const POLL_MS = 15_000;

/**
 * One EventSource and one poll loop per store per tab, shared by every component
 * that asks for that store. Each open SSE connection holds one of the browser's
 * ~6 connections per host; one per component starved every other request.
 */
const channels = new Map<string, Channel>();

function subscribe(storeId: string, listener: Listener) {
  let ch = channels.get(storeId);
  if (!ch) {
    const channel: Channel = { listeners: new Set(), connected: false, syncStatus: null, close: () => {} };
    const emit = (e: LiveEvent) => {
      if (e.type === "ready") channel.connected = true;
      if (e.type === "error") channel.connected = false;
      if (e.type === "sync.status") channel.syncStatus = e.status;
      for (const l of channel.listeners) l(e);
    };

    const es = new EventSource(`/api/stream?storeId=${storeId}`);
    es.addEventListener("ready", () => emit({ type: "ready" }));
    es.addEventListener("error", () => emit({ type: "error" }));
    for (const type of ["capabilities.changed", "data.updated", "sync.status"] as const) {
      es.addEventListener(type, (m) => emit({ ...JSON.parse((m as MessageEvent).data), type }));
    }

    // Pull fresh Shopify changes while the page is visible. The server dedupes
    // across tabs and users, and resumes a first import that was cut off.
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      api<{ changed: number }>(`/api/stores/${storeId}/poll`, { method: "POST" })
        .then((r) => {
          if (r.changed > 0) emit({ type: "data.updated" });
        })
        .catch(() => {});
    };
    tick();
    const timer = setInterval(tick, POLL_MS);

    channel.close = () => {
      clearInterval(timer);
      es.close();
    };
    channels.set(storeId, (ch = channel));
  }
  const channel = ch;
  channel.listeners.add(listener);
  return {
    channel,
    unsubscribe: () => {
      channel.listeners.delete(listener);
      if (channel.listeners.size === 0) {
        channel.close();
        channels.delete(storeId);
      }
    },
  };
}

/**
 * Capabilities + live updates for one store. Subscribes to /api/stream so the
 * dashboard reacts within seconds when the merchant changes something in Shopify.
 */
export function useLiveStore(storeId: string | null, onCapabilitiesChanged?: (n: LiveNotice) => void) {
  const qc = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const onChanged = useRef(onCapabilitiesChanged);
  useEffect(() => {
    onChanged.current = onCapabilitiesChanged;
  });

  const caps = useQuery({
    queryKey: ["capabilities", storeId],
    enabled: !!storeId,
    queryFn: () =>
      api<{ shopDomain: string; capabilities: CapabilityState[] }>(`/api/capabilities?storeId=${storeId}`),
  });

  useEffect(() => {
    if (!storeId) return;
    const { channel, unsubscribe } = subscribe(storeId, (e) => {
      switch (e.type) {
        case "ready":
        case "error":
          setConnected(e.type === "ready");
          break;
        case "capabilities.changed":
          qc.invalidateQueries({ queryKey: ["capabilities", storeId] });
          qc.invalidateQueries({ queryKey: ["metric", storeId] });
          onChanged.current?.({ id: Date.now(), added: e.added, removed: e.removed });
          break;
        case "data.updated":
          qc.invalidateQueries({ queryKey: ["metric", storeId] });
          break;
        case "sync.status":
          setSyncStatus(e.status);
          break;
      }
    });
    // A component joining an open channel starts from its current state.
    setConnected(channel.connected);
    setSyncStatus(channel.syncStatus);
    return unsubscribe;
  }, [storeId, qc]);

  const enabled = useMemo(
    () => new Set<string>((caps.data?.capabilities ?? []).filter((c) => c.enabled).map((c) => c.key)),
    [caps.data],
  );

  return {
    capabilities: caps.data?.capabilities ?? [],
    enabled,
    shopDomain: caps.data?.shopDomain ?? null,
    loading: caps.isLoading,
    syncStatus,
    connected,
  };
}
