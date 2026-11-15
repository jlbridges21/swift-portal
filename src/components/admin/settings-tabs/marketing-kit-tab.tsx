"use client";

import { MarketingKitSettingsCard } from "@/components/admin/marketing-kit-settings-card";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";

export function MarketingKitTab() {
  const { settings, setSettings } = useSettingsTab();
  return (
    <div id="settings-marketing-kit" tabIndex={-1} className="scroll-mt-24 space-y-4">
      <SectionHeading id="marketing_kit">Marketing Kit</SectionHeading>
      <p className="mt-1 text-sm text-muted">
        Property websites and social kits, built automatically from each project. Change any project from its Marketing Kit card.
      </p>
      <MarketingKitSettingsCard
        value={settings.marketingKit}
        onChange={(marketingKit) => setSettings((prev) => ({ ...prev, marketingKit }))}
      />
    </div>
  );
}
