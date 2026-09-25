"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminMobilePwaNav } from "@/components/admin/admin-mobile-pwa-nav";
import { AdminCommandPalette } from "@/components/admin/admin-command-palette";
import { AdminSearchContext } from "@/components/admin/admin-search-context";
import { UploadManagerProvider } from "@/components/admin/upload-manager";

/**
 * Shell chrome that Header (and related controls) depend on.
 * Used by AdminShell and PartnerShell — one source, not copy-pasted.
 * Partner, staff areas, and create flags are read from AdminCapabilitiesContext
 * (filled by the layout). They are accepted here so callers can keep passing them.
 */
export function AdminChromeProviders({
  children,
}: {
  children: React.ReactNode;
  showPartner?: boolean;
  partnerNavLabel?: string;
  partnerNavHref?: string;
  /** Accepted so AdminShell can keep passing layout data; the bar reads context. */
  staffAreas?: import("@/lib/staff-access").StaffArea[];
  /** Accepted for API parity with AdminShell; role lives in AdminCapabilitiesContext. */
  userRole?: "admin" | "staff";
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const value = useMemo(() => ({ openSearch }), [openSearch]);

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
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      if (query.matches) document.body.setAttribute("data-admin-pwa-nav", "");
      else document.body.removeAttribute("data-admin-pwa-nav");
    };
    apply();
    query.addEventListener("change", apply);
    return () => {
      query.removeEventListener("change", apply);
      document.body.removeAttribute("data-admin-pwa-nav");
    };
  }, []);

  return (
    <AdminSearchContext.Provider value={value}>
      <UploadManagerProvider>
        <div className="admin-pwa-content-pad">{children}</div>
        <AdminMobilePwaNav />
        <AdminCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      </UploadManagerProvider>
    </AdminSearchContext.Provider>
  );
}
