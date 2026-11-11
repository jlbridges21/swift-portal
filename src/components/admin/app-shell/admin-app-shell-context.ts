"use client";

import { createContext, useContext, useEffect } from "react";

/**
 * True inside the business app shell (left sidebar + top bar). The legacy page-level
 * `<Header variant="dashboard">` reads this and renders nothing for admin/staff chrome,
 * so pages keep their markup while the shell owns global navigation.
 */
export const AdminAppShellContext = createContext(false);

export function useInAdminAppShell(): boolean {
  return useContext(AdminAppShellContext);
}

/** Signed-in identity shown in the sidebar footer and the top-bar profile badge. */
export type AdminShellUser = {
  name: string | null;
  avatarUrl: string | null;
  businessName: string | null;
};

// ---------------------------------------------------------------------------
// Contextual page title (New interface top bar)
// ---------------------------------------------------------------------------

export type ShellCrumb = { label: string; href: string };

/** What the top bar shows on the left: the page title, and a subtitle or breadcrumb trail. */
export type ShellPageTitle = {
  title: string;
  description?: string | null;
  /** Parent pages, shown in place of the subtitle (e.g. Projects › on a project page). */
  crumbs?: ShellCrumb[];
};

type Registration = ShellPageTitle & { id: number; path: string };

export type AdminPageTitleStore = {
  registered: Registration | null;
  set: (reg: Registration) => void;
  clear: (id: number) => void;
};

export const AdminPageTitleContext = createContext<AdminPageTitleStore | null>(null);

let nextRegistrationId = 1;
function allocateId(): number {
  return nextRegistrationId++;
}

/**
 * Publish this page's title to the New interface top bar. No-op outside the shell (Classic
 * keeps its in-page headings). Cleared on unmount, keyed by path so a stale title never sticks.
 */
export function useShellPageTitle(title: ShellPageTitle | null, path: string) {
  const store = useContext(AdminPageTitleContext);
  const t = title?.title ?? null;
  const d = title?.description ?? null;
  const c = title?.crumbs ? JSON.stringify(title.crumbs) : null;
  useEffect(() => {
    if (!store || !t) return;
    const id = allocateId();
    store.set({ id, path, title: t, description: d, crumbs: c ? (JSON.parse(c) as ShellCrumb[]) : undefined });
    return () => store.clear(id);
    // store.set / clear are stable; `store` identity changes when the registration changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.set, store?.clear, path, t, d, c]);
}
