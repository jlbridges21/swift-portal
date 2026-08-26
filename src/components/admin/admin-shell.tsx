"use client";

import { AdminChromeProviders } from "@/components/admin/admin-chrome-providers";

export function AdminShell({
  children,
  showPartner = false,
  partnerNavLabel = "Partner Program",
  partnerNavHref = "/partner",
}: {
  children: React.ReactNode;
  showPartner?: boolean;
  partnerNavLabel?: string;
  partnerNavHref?: string;
}) {
  return (
    <AdminChromeProviders
      showPartner={showPartner}
      partnerNavLabel={partnerNavLabel}
      partnerNavHref={partnerNavHref}
    >
      {children}
    </AdminChromeProviders>
  );
}
