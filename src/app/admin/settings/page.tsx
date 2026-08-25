import { Suspense } from "react";
import { Header, PageHeader } from "@/components/layout/header";
import { requireAdminPage } from "@/lib/admin-access";
import { getAppSettings, NOTIFICATION_EVENT_DEFINITIONS } from "@/lib/app-settings";
import { AdminSettingsClient } from "@/components/admin/admin-settings-client";
import { StripeConnectCard } from "@/components/admin/stripe-connect-card";
import { SetupChecklistCard } from "@/components/admin/setup-checklist-card";
import { ServicesSettingsCard } from "@/components/admin/services-settings-card";
import { HashScrollHandler } from "@/components/ui/hash-scroll-handler";
import { hasEntitlement } from "@/lib/entitlements";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { listBusinessServices } from "@/lib/business-services";
import { loadSetupChecklistSnapshot } from "@/lib/setup-checklist";
import {
  loadBusinessDomainState,
  toPublicDomainState,
} from "@/lib/custom-domain";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { isVercelDomainApiConfigured } from "@/lib/vercel-domains";

export default async function AdminSettingsPage() {
  const { tenant } = await requireAdminPage();
  const settings = await getAppSettings(tenant.businessId);
  const [
    canCustomizeLanding,
    canUseCustomDomain,
    portalPreviewUrl,
    serviceRows,
    checklist,
    domainRow,
  ] = await Promise.all([
    hasEntitlement(tenant.businessId, "custom_branding"),
    hasEntitlement(tenant.businessId, "custom_domain"),
    getBusinessPortalOriginById(tenant.businessId),
    listBusinessServices(tenant.businessId, { activeOnly: true }),
    loadSetupChecklistSnapshot(tenant.businessId, settings),
    loadBusinessDomainState(tenant.businessId),
  ]);
  const serviceNames = serviceRows.filter((s) => s.is_active).map((s) => s.name);
  const customDomainState = domainRow
    ? toPublicDomainState(domainRow)
    : {
        domain: null,
        status: null,
        vercelVerified: false,
        misconfigured: null,
        lastCheckedAt: null,
        error: null,
        dnsRecords: [],
        verification: [],
        portalUrl: null,
        vercelApiConfigured: isVercelDomainApiConfigured(),
        isApex: false,
        fallbackSubdomain: `${tenant.business.slug}.${getPlatformRootDomain()}`,
      };

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 pb-12">
        <PageHeader
          title="Admin Settings"
          description={`Manage global notification, email, business, and proposal settings for ${settings.business.portalName}.`}
        />
        <HashScrollHandler />
        {checklist.incomplete ? (
          <SetupChecklistCard items={checklist.items} incomplete={checklist.incomplete} />
        ) : null}
        <AdminSettingsClient
          initialSettings={settings}
          notificationEvents={NOTIFICATION_EVENT_DEFINITIONS}
          canCustomizeLanding={canCustomizeLanding}
          canUseCustomDomain={canUseCustomDomain}
          customDomainState={customDomainState}
          portalPreviewUrl={portalPreviewUrl}
          serviceNames={serviceNames}
          payments={
            <Suspense fallback={null}>
              <StripeConnectCard />
            </Suspense>
          }
          services={<ServicesSettingsCard />}
        />
      </main>
    </div>
  );
}
