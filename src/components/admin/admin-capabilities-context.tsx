"use client";

import { createContext, useContext } from "react";

type AdminCapabilitiesContextValue = {
  showPartner: boolean;
  partnerNavLabel: string;
  partnerNavHref: string;
};

const AdminCapabilitiesContext = createContext<AdminCapabilitiesContextValue>({
  showPartner: false,
  partnerNavLabel: "Partner Program",
  partnerNavHref: "/partner",
});

export function AdminCapabilitiesProvider({
  showPartner,
  partnerNavLabel,
  partnerNavHref,
  children,
}: {
  showPartner: boolean;
  partnerNavLabel: string;
  partnerNavHref: string;
  children: React.ReactNode;
}) {
  return (
    <AdminCapabilitiesContext.Provider value={{ showPartner, partnerNavLabel, partnerNavHref }}>
      {children}
    </AdminCapabilitiesContext.Provider>
  );
}

export function useAdminCapabilities(): AdminCapabilitiesContextValue {
  return useContext(AdminCapabilitiesContext);
}
