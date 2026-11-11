"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminMobilePwaNav } from "@/components/admin/admin-mobile-pwa-nav";
import { AdminCommandPalette } from "@/components/admin/admin-command-palette";
import { AdminSearchContext } from "@/components/admin/admin-search-context";
import { UploadManagerProvider } from "@/components/admin/upload-manager";
import { AdminAppShell } from "@/components/admin/app-shell/admin-app-shell";
import type { AdminShellUser } from "@/components/admin/app-shell/admin-app-shell-context";
import { UiRolloutProvider } from "@/components/admin/ui-rollout/ui-rollout";
import type { UiExperience } from "@/lib/ui-rollout";

const CLASSIC_EXPERIENCE: UiExperience = { mode: "classic", phase: "classic_only", canSwitch: false, banner: null };

/**
 * Shell chrome that Header (and related controls) depend on.
 * Used by AdminShell and PartnerShell — one source, not copy-pasted.
 * Partner, staff areas, and create flags are read from AdminCapabilitiesContext
 * (filled by the layout). They are accepted here so callers can keep passing them.
 */
export function AdminChromeProviders({
  children,
  shellUser,
  banner,
  experience = CLASSIC_EXPERIENCE,
}: {
  children: React.ReactNode;
  /**
   * Classic or New interface for this user (resolved on the server, src/lib/ui-rollout.ts).
   * Classic: pages render their own top Header, exactly as before the redesign.
   * New: the sidebar + top bar shell, and page Headers step aside.
   */
  experience?: UiExperience;
  /** Name / avatar / business shown in the sidebar footer and top-bar profile badge. */
  shellUser?: AdminShellUser | null;
  /** Account banners (trial, impersonation, setup) rendered at the top of the main column. */
  banner?: React.ReactNode;
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
        <UiRolloutProvider value={experience}>
          {experience.mode === "new" ? (
            <div className="admin-pwa-content-pad">
              <AdminAppShell user={shellUser} banner={banner}>
                {children}
              </AdminAppShell>
            </div>
          ) : (
            <>
              {banner}
              <div className="admin-pwa-content-pad">{children}</div>
            </>
          )}
        </UiRolloutProvider>
        <AdminMobilePwaNav />
        <AdminCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      </UploadManagerProvider>
    </AdminSearchContext.Provider>
  );
}
