"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/format";
import { appearanceVars, mergePrefs, type OverviewPrefs } from "@/lib/overview-prefs";

const MANAGED = ["--background", "--surface", "--surface-2", "--border", "--foreground", "--muted", "--app-font", "--app-weight", "--app-style", "font-size"];

/** Applies the user's background and text style (Customise > Theme) to the whole app. */
export function AppearanceApplier() {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ overviewPrefs: OverviewPrefs }>("/api/settings"),
  });
  const prefs = settings.data?.overviewPrefs;
  useEffect(() => {
    const root = document.documentElement.style;
    const vars = appearanceVars(mergePrefs(prefs));
    for (const k of MANAGED) {
      if (vars[k]) root.setProperty(k, vars[k]);
      else root.removeProperty(k);
    }
  }, [prefs]);
  return null;
}
