"use client";

import { createContext, useContext } from "react";
import type { StaffArea } from "@/lib/staff-access";

type AdminCapabilitiesContextValue = {
  showPartner: boolean;
  /** True when this identity is an active (non-suspended) partner. */
  partnerActive: boolean;
  /** True when partner row exists but is suspended. */
  partnerSuspended: boolean;
  partnerNavLabel: string;
  partnerNavHref: string;
  /** When set (staff), Header filters admin links to these areas. */
  staffAreas: StaffArea[] | null;
  userRole: "admin" | "staff" | "client" | null;
};

const AdminCapabilitiesContext = createContext<AdminCapabilitiesContextValue>({
  showPartner: false,
  partnerActive: false,
  partnerSuspended: false,
  partnerNavLabel: "Partner Program",
  partnerNavHref: "/partner",
  staffAreas: null,
  userRole: null,
});

export function AdminCapabilitiesProvider({
  showPartner,
  partnerActive = false,
  partnerSuspended = false,
  partnerNavLabel,
  partnerNavHref,
  staffAreas = null,
  userRole = null,
  children,
}: {
  showPartner: boolean;
  partnerActive?: boolean;
  partnerSuspended?: boolean;
  partnerNavLabel: string;
  partnerNavHref: string;
  staffAreas?: StaffArea[] | null;
  userRole?: "admin" | "staff" | "client" | null;
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
        staffAreas,
        userRole,
      }}
    >
      {children}
    </AdminCapabilitiesContext.Provider>
  );
}

export function useAdminCapabilities(): AdminCapabilitiesContextValue {
  return useContext(AdminCapabilitiesContext);
}
