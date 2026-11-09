"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  PLATFORM_PARTNERS_SECTIONS,
  platformPartnersSectionForHash,
  type PlatformPartnersSectionId,
} from "@/lib/platform-partners-nav";

function SettingsPanel({
  id,
  active,
  children,
}: {
  id: PlatformPartnersSectionId;
  active: PlatformPartnersSectionId;
  children: ReactNode;
}) {
  const selected = id === active;
  return (
    <div
      role="tabpanel"
      id={`partners-panel-${id}`}
      hidden={!selected}
      tabIndex={selected ? 0 : -1}
      className={selected ? "outline-none" : "hidden"}
    >
      {children}
    </div>
  );
}

export function PlatformPartnersProgramShell({
  overview,
  performance,
  applications,
  payouts,
  referralDiscount,
  programSettings,
}: {
  overview: ReactNode;
  performance: ReactNode;
  applications: ReactNode;
  payouts: ReactNode;
  referralDiscount: ReactNode;
  programSettings: ReactNode;
}) {
  const [section, setSection] = useState<PlatformPartnersSectionId>("overview");
  useEffect(() => {
    function syncFromHash() {
      const id = platformPartnersSectionForHash(window.location.hash);
      if (id) setSection(id);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const meta = PLATFORM_PARTNERS_SECTIONS.find((s) => s.id === section);

  return (
    // Section tabs live in the Platform Console top bar; they set location.hash.
    <div>
      <div className="min-w-0 space-y-4">
        {meta ? (
          <div>
            <h2 className="text-lg font-semibold text-heading">{meta.label}</h2>
            <p className="mt-1 text-sm text-muted">{meta.description}</p>
          </div>
        ) : null}

        <SettingsPanel id="overview" active={section}>
          <div id="partners-overview" tabIndex={-1} className="scroll-mt-24">
            {overview}
          </div>
        </SettingsPanel>
        <SettingsPanel id="performance" active={section}>
          <div id="partners-performance" tabIndex={-1} className="scroll-mt-24">
            {performance}
          </div>
        </SettingsPanel>
        <SettingsPanel id="applications" active={section}>
          <div id="partners-applications" tabIndex={-1} className="scroll-mt-24">
            {applications}
          </div>
        </SettingsPanel>
        <SettingsPanel id="payouts" active={section}>
          <div id="partners-payouts" tabIndex={-1} className="scroll-mt-24">
            {payouts}
          </div>
        </SettingsPanel>
        <SettingsPanel id="referral_discount" active={section}>
          <div id="partners-referral-discount" tabIndex={-1} className="scroll-mt-24">
            {referralDiscount}
          </div>
        </SettingsPanel>
        <SettingsPanel id="program_settings" active={section}>
          <div id="partners-program-settings" tabIndex={-1} className="scroll-mt-24">
            {programSettings}
          </div>
        </SettingsPanel>
      </div>
    </div>
  );
}
