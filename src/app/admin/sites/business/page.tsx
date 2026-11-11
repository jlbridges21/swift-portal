import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin-access";
import { getAppSettings } from "@/lib/app-settings";
import { hasEntitlement } from "@/lib/entitlements";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { listBusinessServices } from "@/lib/business-services";
import { siteServicesFromRows } from "@/lib/website/server";
import { loadBusinessDomainState, toPublicDomainState, WebsiteDomainSetupRequiredError } from "@/lib/custom-domain";
import { HashScrollHandler } from "@/components/ui/hash-scroll-handler";
import { BusinessWebsiteWorkspace } from "@/components/admin/sites/business-website-workspace";

export const metadata: Metadata = { title: "Business Website · Sites" };
export const dynamic = "force-dynamic";

/**
 * Sites → Business Website. The same Business Website builder, data and save path that
 * Settings → Business Website used (Settings now sends the New interface here), so there is
 * exactly one editor and one copy of the website settings.
 */
export default async function AdminSitesBusinessPage() {
  const { tenant } = await requireAdminPage({ adminOnly: true });
  const [settings, canCustomizeLanding, portalPreviewUrl, serviceRows] = await Promise.all([
    getAppSettings(tenant.businessId),
    hasEntitlement(tenant.businessId, "custom_branding"),
    getBusinessPortalOriginById(tenant.businessId),
    listBusinessServices(tenant.businessId, { activeOnly: true }),
  ]);

  let setupRequired = false;
  let domain: string | null = null;
  let connected = false;
  try {
    const row = await loadBusinessDomainState(tenant.businessId, "website");
    if (row) {
      const state = toPublicDomainState(row);
      domain = state.domain;
      connected = Boolean(state.domain) && state.status === "connected";
    }
  } catch (e) {
    if (e instanceof WebsiteDomainSetupRequiredError) setupRequired = true;
    else throw e;
  }

  return (
    <>
    <HashScrollHandler />
    <BusinessWebsiteWorkspace
      initialSettings={settings}
      services={siteServicesFromRows(serviceRows)}
      siteUrl={connected ? `https://${domain}` : portalPreviewUrl}
      websiteDomain={{ domain, connected, setupRequired }}
      canCustomizeLanding={canCustomizeLanding}
      serviceNames={serviceRows.filter((s) => s.is_active).map((s) => s.name)}
      portalPreviewUrl={portalPreviewUrl}
    />
    </>
  );
}
