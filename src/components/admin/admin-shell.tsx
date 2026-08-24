"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useIsStandalonePwaMobile } from "@/lib/use-is-standalone-pwa-mobile";
import { AdminMobilePwaNav } from "@/components/admin/admin-mobile-pwa-nav";
import { AdminCommandPalette } from "@/components/admin/admin-command-palette";
import { AdminSearchContext } from "@/components/admin/admin-search-context";
import { UploadManagerProvider } from "@/components/admin/upload-manager";
import { cn } from "@/lib/utils";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const showPwaNav = useIsStandalonePwaMobile();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const value = useMemo(() => ({ openSearch }), [openSearch]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!showPwaNav) {
      document.body.removeAttribute("data-admin-pwa-nav");
      return;
    }
    document.body.setAttribute("data-admin-pwa-nav", "");
    return () => document.body.removeAttribute("data-admin-pwa-nav");
  }, [showPwaNav]);

  return (
    <AdminSearchContext.Provider value={value}>
      <UploadManagerProvider>
        <div className={cn(showPwaNav && "admin-pwa-content-pad")}>{children}</div>
        {mounted && showPwaNav && createPortal(<AdminMobilePwaNav />, document.body)}
        <AdminCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      </UploadManagerProvider>
    </AdminSearchContext.Provider>
  );
}
