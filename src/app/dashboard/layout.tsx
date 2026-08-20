import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { ClientSubscriptionNotice } from "@/components/dashboard/client-subscription-notice";
import { requireTenantContext, getTenantContext } from "@/lib/tenant";
import { metadataFromBusiness } from "@/lib/site-metadata";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantContext();
  if (!tenant) return {};
  const settings = await getAppSettings(tenant.businessId);
  return metadataFromBusiness(settings.business);
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenantContext();
  const settings = await getAppSettings(tenant.businessId);
  const brand = getPortalBrandFromSettings(settings);

  return (
    <BrandProvider brand={brand}>
      {tenant.role === "client" && (
        <ClientSubscriptionNotice
          businessName={tenant.business.name}
          subscriptionStatus={tenant.business.subscription_status}
          trialEndsAt={tenant.business.trial_ends_at}
        />
      )}
      {children}
    </BrandProvider>
  );
}
