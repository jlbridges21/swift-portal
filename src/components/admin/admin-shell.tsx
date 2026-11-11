"use client";

import { AdminChromeProviders } from "@/components/admin/admin-chrome-providers";
import type { StaffArea } from "@/lib/staff-access";
import type { AdminShellUser } from "@/components/admin/app-shell/admin-app-shell-context";
import type { UiExperience } from "@/lib/ui-rollout";

export function AdminShell({
  children,
  showPartner = false,
  partnerNavLabel = "Partner Program",
  partnerNavHref = "/partner",
  staffAreas,
  userRole,
  shellUser,
  banner,
  experience,
}: {
  children: React.ReactNode;
  showPartner?: boolean;
  partnerNavLabel?: string;
  partnerNavHref?: string;
  staffAreas?: StaffArea[];
  userRole?: "admin" | "staff";
  shellUser?: AdminShellUser | null;
  banner?: React.ReactNode;
  experience?: UiExperience;
}) {
  return (
    <AdminChromeProviders
      showPartner={showPartner}
      partnerNavLabel={partnerNavLabel}
      partnerNavHref={partnerNavHref}
      staffAreas={staffAreas}
      userRole={userRole}
      shellUser={shellUser}
      banner={banner}
      experience={experience}
    >
      {children}
    </AdminChromeProviders>
  );
}
