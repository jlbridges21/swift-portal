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
  /** Owner/admin on a US business. Staff never receive this, even with every permission. */
  showTax: boolean;
  /** Team pay is on and the business has a team: the owner (or staff who approve pay) see it. */
  showTeamPay: boolean;
  /** Team pay is on and this person is on a pay plan. */
  showMyPay: boolean;
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
  showTax: false,
  showTeamPay: false,
  showMyPay: false,
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
  showTax = false,
  showTeamPay = false,
  showMyPay = false,
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
  showTax?: boolean;
  showTeamPay?: boolean;
  showMyPay?: boolean;
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
        showTax,
        showTeamPay,
        showMyPay,
      }}
    >
      {children}
    </AdminCapabilitiesContext.Provider>
  );
}

export function useAdminCapabilities(): AdminCapabilitiesContextValue {
  return useContext(AdminCapabilitiesContext);
}
