"use client";

import { useIsStandalonePwaMobile } from "@/lib/use-is-standalone-pwa-mobile";
import { AdminMobilePwaNav } from "@/components/admin/admin-mobile-pwa-nav";
import { cn } from "@/lib/utils";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const showPwaNav = useIsStandalonePwaMobile();

  return (
    <>
      <div className={cn(showPwaNav && "admin-pwa-content-pad")}>{children}</div>
      {showPwaNav && <AdminMobilePwaNav />}
    </>
  );
}
