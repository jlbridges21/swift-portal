"use client";

import { createContext, useContext } from "react";
import type { StaffArea } from "@/lib/staff-access";

export type AdminNavCreate = {
  project: boolean;
  client: boolean;
  media: boolean;
};

const FULL_NAV_CREATE: AdminNavCreate = { project: true, client: true, media: true };

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
  /** Create actions for the mobile + sheet. Layout computes these with staffCan. */
  navCreate: AdminNavCreate;
};

const AdminCapabilitiesContext = createContext<AdminCapabilitiesContextValue>({
  showPartner: false,
  partnerActive: false,
  partnerSuspended: false,
  partnerNavLabel: "Partner Program",
  partnerNavHref: "/partner",
  staffAreas: null,
  userRole: null,
  navCreate: FULL_NAV_CREATE,
});

export function AdminCapabilitiesProvider({
  showPartner,
  partnerActive = false,
  partnerSuspended = false,
  partnerNavLabel,
  partnerNavHref,
  staffAreas = null,
  userRole = null,
  navCreate = FULL_NAV_CREATE,
  children,
}: {
  showPartner: boolean;
  partnerActive?: boolean;
  partnerSuspended?: boolean;
  partnerNavLabel: string;
  partnerNavHref: string;
  staffAreas?: StaffArea[] | null;
  userRole?: "admin" | "staff" | "client" | null;
  navCreate?: AdminNavCreate;
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
        navCreate,
      }}
    >
      {children}
    </AdminCapabilitiesContext.Provider>
  );
}

export function useAdminCapabilities(): AdminCapabilitiesContextValue {
  return useContext(AdminCapabilitiesContext);
}
