"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SettingsTabNav } from "@/components/admin/settings-tab-nav";
import {
  PLATFORM_PARTNERS_SECTIONS,
  platformPartnersSectionForHash,
  type PlatformPartnersSectionId,
} from "@/lib/platform-partners-nav";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { sanitizeCssColor } from "@/lib/brand-color";

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
      aria-labelledby={`partners-tab-${id}`}
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
  const accent = sanitizeCssColor(
    PLATFORM_BUSINESS_DEFAULTS.brandAccentColor,
    "#0F766E"
  );

  useEffect(() => {
    function syncFromHash() {
      const id = platformPartnersSectionForHash(window.location.hash);
      if (id) setSection(id);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectSection(id: PlatformPartnersSectionId) {
    setSection(id);
    const hash = PLATFORM_PARTNERS_SECTIONS.find((s) => s.id === id)?.hashes[0];
    if (hash) window.history.replaceState(null, "", `#${hash}`);
  }

  const meta = PLATFORM_PARTNERS_SECTIONS.find((s) => s.id === section);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <aside className="w-full shrink-0 md:sticky md:top-20 md:w-56">
        <SettingsTabNav
          sections={PLATFORM_PARTNERS_SECTIONS}
          active={section}
          onChange={selectSection}
          accentColor={accent}
          ariaLabel="Partner program sections"
          selectId="partners-section-select"
          idPrefix="partners"
        />
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
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
