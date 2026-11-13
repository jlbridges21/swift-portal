"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * false while server-rendering and during the hydration pass, true afterwards (and on every
 * client-side render that is not hydrating). Lets locale/time-zone formatting render the same
 * text on the server (UTC) and on the hydration pass, then switch to the viewer's own time
 * zone right after — avoiding React hydration mismatches (#418) that force a full client
 * re-render of the page.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/** Locale/time-zone arguments for Date#toLocale*: deterministic until hydrated. */
export function viewerDateArgs(hydrated: boolean): { locale: string | undefined; timeZone: string | undefined } {
  return hydrated ? { locale: undefined, timeZone: undefined } : { locale: "en-US", timeZone: "UTC" };
}
