"use client";

import { createContext, useContext } from "react";

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
