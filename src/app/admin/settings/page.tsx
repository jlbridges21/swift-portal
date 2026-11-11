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
  emptyPublicDomainState,
  ListingDomainSetupRequiredError,
} from "@/lib/custom-domain";
import { suggestListingDomain } from "@/lib/marketing/listing-url";
import { StaffPermissionsSettings } from "@/components/admin/staff-permissions-settings";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { w9CountryDecision } from "@/lib/w9-country";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { siteServicesFromRows } from "@/lib/website/server";
import { WebsiteDomainSetupRequiredError } from "@/lib/custom-domain";

/** Only same-site project editor paths may be used as the "back to your website" link. */
function safeReturnTo(raw: string | undefined): string | null {
  if (!raw || !raw.startsWith("/admin/projects/") || raw.includes("//") || raw.includes("\\")) return null;
  return /^\/admin\/projects\/[0-9a-f-]{36}\/marketing(\?[a-z=&]*)?$/i.test(raw) ? raw : null;
}

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ return?: string }> }) {
  const { tenant } = await requireAdminPage({ adminOnly: true });
  const { return: returnRaw } = await searchParams;
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
    : emptyPublicDomainState(`${tenant.business.slug}.${getPlatformRootDomain()}`);
  let listingSetupRequired = false;
  let listingDomainState = emptyPublicDomainState(`${tenant.business.slug}.${getPlatformRootDomain()}`);
  try {
    const listingRow = await loadBusinessDomainState(tenant.businessId, "listing");
    if (listingRow) listingDomainState = toPublicDomainState(listingRow);
  } catch (e) {
    if (e instanceof ListingDomainSetupRequiredError) listingSetupRequired = true;
    else throw e;
  }
  let websiteSetupRequired = false;
  let websiteDomainState = emptyPublicDomainState(`${tenant.business.slug}.${getPlatformRootDomain()}`);
  try {
    const websiteRow = await loadBusinessDomainState(tenant.businessId, "website");
    if (websiteRow) websiteDomainState = toPublicDomainState(websiteRow);
  } catch (e) {
    if (e instanceof WebsiteDomainSetupRequiredError) websiteSetupRequired = true;
    else throw e;
  }
  const websiteConnected = Boolean(websiteDomainState.domain) && websiteDomainState.status === "connected";
  const websiteSiteUrl = websiteConnected ? `https://${websiteDomainState.domain}` : portalPreviewUrl;
  const suggestedListing = suggestListingDomain(customDomainState.domain);
  const suggestedListingRoot = suggestedListing ? suggestedListing.replace(/^listings\./, "") : null;
  const country = await w9CountryDecision(tenant.businessId);
  let w9Clients: { id: string; name: string; email: string }[] = [];
  if (country.us) {
    const db = await createTenantServiceClient(tenant.businessId);
    const { data: clientRows } = await db
      .from("clients")
      .select("id, name, email")
      .is("deleted_at", null)
      .order("name")
      .limit(200);
    w9Clients = (clientRows ?? []).map((client) => ({
      id: client.id as string,
      name: (client.name as string) || "Client",
      email: (client.email as string) || "",
    }));
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="app-page mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 pb-12">
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
          listingDomain={{
            state: listingDomainState,
            setupRequired: listingSetupRequired,
            suggestedRootDomain: suggestedListingRoot,
            returnTo: safeReturnTo(returnRaw),
          }}
          portalPreviewUrl={portalPreviewUrl}
          serviceNames={serviceNames}
          website={{
            services: siteServicesFromRows(serviceRows),
            siteUrl: websiteSiteUrl,
            domain: { domain: websiteDomainState.domain, connected: websiteConnected, setupRequired: websiteSetupRequired },
            domainState: websiteDomainState,
          }}
          staff={<StaffPermissionsSettings />}
          payments={
            <Suspense fallback={null}>
              <StripeConnectCard />
            </Suspense>
          }
          services={<ServicesSettingsCard />}
          showTax={country.us}
          w9Clients={w9Clients}
        />
      </main>
    </div>
  );
}
