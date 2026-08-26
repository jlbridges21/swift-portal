"use client";

import { createContext, useContext } from "react";

type AdminSearchContextValue = {
  openSearch: () => void;
};

export const AdminSearchContext = createContext<AdminSearchContextValue | null>(null);

export function useAdminSearch() {
  const ctx = useContext(AdminSearchContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        "useAdminSearch must be used within AdminChromeProviders (AdminSearchContext.Provider). " +
          "The search control rendered without its shell chrome."
      );
    }
    console.error(
      "[useAdminSearch] AdminSearchContext missing — search is a no-op. Mount AdminChromeProviders."
    );
    return { openSearch: () => undefined };
  }
  return ctx;
}
