"use client";

import { createContext, useContext } from "react";

type AdminCapabilitiesContextValue = {
  showPartner: boolean;
  /** True when this identity is an active (non-suspended) partner. */
  partnerActive: boolean;
  /** True when partner row exists but is suspended. */
  partnerSuspended: boolean;
  partnerNavLabel: string;
  partnerNavHref: string;
};

const AdminCapabilitiesContext = createContext<AdminCapabilitiesContextValue>({
  showPartner: false,
  partnerActive: false,
  partnerSuspended: false,
  partnerNavLabel: "Partner Program",
  partnerNavHref: "/partner",
});

export function AdminCapabilitiesProvider({
  showPartner,
  partnerActive = false,
  partnerSuspended = false,
  partnerNavLabel,
  partnerNavHref,
  children,
}: {
  showPartner: boolean;
  partnerActive?: boolean;
  partnerSuspended?: boolean;
  partnerNavLabel: string;
  partnerNavHref: string;
  children: React.ReactNode;
}) {
  return (
    <AdminCapabilitiesContext.Provider
      value={{
        showPartner,
        partnerActive,
        partnerSuspended,
        partnerNavLabel,
        partnerNavHref,
      }}
    >
      {children}
    </AdminCapabilitiesContext.Provider>
  );
}

export function useAdminCapabilities(): AdminCapabilitiesContextValue {
  return useContext(AdminCapabilitiesContext);
}
