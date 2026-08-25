"use client";

import { createContext, useContext } from "react";

type AdminCapabilitiesContextValue = {
  showPartner: boolean;
};

const AdminCapabilitiesContext = createContext<AdminCapabilitiesContextValue>({
  showPartner: false,
});

export function AdminCapabilitiesProvider({
  showPartner,
  children,
}: {
  showPartner: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdminCapabilitiesContext.Provider value={{ showPartner }}>
      {children}
    </AdminCapabilitiesContext.Provider>
  );
}

export function useAdminCapabilities(): AdminCapabilitiesContextValue {
  return useContext(AdminCapabilitiesContext);
}
