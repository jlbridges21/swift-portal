"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useIsStandalonePwaMobile } from "@/lib/use-is-standalone-pwa-mobile";
import { AdminMobilePwaNav } from "@/components/admin/admin-mobile-pwa-nav";
import { cn } from "@/lib/utils";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const showPwaNav = useIsStandalonePwaMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className={cn(showPwaNav && "admin-pwa-content-pad")}>{children}</div>
      {mounted && showPwaNav && createPortal(<AdminMobilePwaNav />, document.body)}
    </>
  );
}
