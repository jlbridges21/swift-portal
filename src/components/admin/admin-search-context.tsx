"use client";

import { createContext, useContext } from "react";

type AdminSearchContextValue = {
  openSearch: () => void;
};

export const AdminSearchContext = createContext<AdminSearchContextValue | null>(null);

export function useAdminSearch() {
  const ctx = useContext(AdminSearchContext);
  if (!ctx) {
    return { openSearch: () => undefined };
  }
  return ctx;
}
