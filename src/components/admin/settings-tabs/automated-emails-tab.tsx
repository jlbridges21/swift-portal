"use client";

import { EmailTemplatesSettingsCard } from "@/components/admin/email-templates-settings-card";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";

export function AutomatedEmailsTab() {
  const { settings, patchWorkflow } = useSettingsTab();
  const business = settings.business;
  return (
    <div id="settings-automated-emails" tabIndex={-1} className="scroll-mt-24">
      <SectionHeading id="automated_emails">Automated Emails</SectionHeading>
      <p className="mt-1 text-sm text-muted">The emails clients get at each step. Pick one to edit it.</p>
      <div className="mt-5">
        <EmailTemplatesSettingsCard
          workflow={settings.workflow}
          onChange={patchWorkflow}
          portalName={business.portalName}
          businessName={business.businessName}
          logoUrl={business.emailLogoUrl || business.logoUrl}
          primaryColor={business.brandPrimaryColor}
          accentColor={business.brandAccentColor}
          footerText={settings.email.footerText}
        />
      </div>
    </div>
  );
}
