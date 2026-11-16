"use client";

import { useSyncExternalStore } from "react";
import type { SettingsSectionId } from "@/lib/settings-nav";

/**
 * Bridge between the Settings page and the app shell's settings sidebar. The page owns which
 * section is open (it follows #settings-* hashes); the shell sidebar only shows it and asks the
 * page to switch. Kept outside React context so publishing never re-renders the whole shell.
 */
export type SettingsNavState = {
  sections: { id: SettingsSectionId; label: string }[];
  active: SettingsSectionId;
  /** Sections with an essential setup step still open (accent dot). */
  attention: SettingsSectionId[];
  select: (id: SettingsSectionId) => void;
};

let current: SettingsNavState | null = null;
const listeners = new Set<() => void>();

export function publishSettingsNav(next: SettingsNavState | null) {
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettingsNav(): SettingsNavState | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
}
