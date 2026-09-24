"use client";

import { AdminChromeProviders } from "@/components/admin/admin-chrome-providers";
import type { StaffArea } from "@/lib/staff-access";

export function AdminShell({
  children,
  showPartner = false,
  partnerNavLabel = "Partner Program",
  partnerNavHref = "/partner",
  staffAreas,
  userRole,
}: {
  children: React.ReactNode;
  showPartner?: boolean;
  partnerNavLabel?: string;
  partnerNavHref?: string;
  staffAreas?: StaffArea[];
  userRole?: "admin" | "staff";
}) {
  return (
    <AdminChromeProviders
      showPartner={showPartner}
      partnerNavLabel={partnerNavLabel}
      partnerNavHref={partnerNavHref}
      staffAreas={staffAreas}
      userRole={userRole}
    >
      {children}
    </AdminChromeProviders>
  );
}
