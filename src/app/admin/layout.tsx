import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCapabilitiesProvider } from "@/components/admin/admin-capabilities-context";
import { SubscriptionBanner } from "@/components/admin/subscription-banner";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { FinishSetupBanner } from "@/components/admin/finish-setup-banner";
import { requireAdminPage } from "@/lib/admin-access";
import { getCapabilities, showPartnerNavItem } from "@/lib/capabilities";
import { getTenantContext } from "@/lib/tenant";
import { metadataFromBusiness } from "@/lib/site-metadata";
import { showFinishSetupBanner } from "@/lib/onboarding";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantContext();
  if (!tenant) return {};
  const settings = await getAppSettings(tenant.businessId);
  return metadataFromBusiness(settings.business);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, tenant } = await requireAdminPage();
  const settings = await getAppSettings(tenant.businessId);
  const brand = getPortalBrandFromSettings(settings);
  const caps = await getCapabilities();
  const showPartner = showPartnerNavItem(caps);
  const finishBanner = showFinishSetupBanner({
    onboardingCompletedAt: tenant.business.onboarding_completed_at,
    onboardingState: tenant.business.onboarding_state,
    role: profile.role,
    impersonating: tenant.impersonating,
  });

  return (
    <BrandProvider brand={brand}>
      <AdminCapabilitiesProvider showPartner={showPartner}>
        {tenant.impersonating && (
          <ImpersonationBanner
            businessName={tenant.business.name}
            businessId={tenant.businessId}
            allowWrites={tenant.allowWrites}
            subscriptionStatus={tenant.business.subscription_status}
            trialEndsAt={tenant.business.trial_ends_at}
            compedUntil={tenant.business.comped_until}
            compedReason={tenant.business.comped_reason}
          />
        )}
        <SubscriptionBanner
          subscriptionStatus={tenant.business.subscription_status}
          trialEndsAt={tenant.business.trial_ends_at}
          compedUntil={tenant.business.comped_until}
          subscriptionCurrentPeriodEnd={tenant.business.subscription_current_period_end}
          subscriptionCancelAtPeriodEnd={tenant.business.subscription_cancel_at_period_end}
        />
        {finishBanner ? <FinishSetupBanner /> : null}
        <AdminShell showPartner={showPartner}>{children}</AdminShell>
      </AdminCapabilitiesProvider>
    </BrandProvider>
  );
}
