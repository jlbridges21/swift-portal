import { BrandProvider } from "@/components/brand/brand-provider";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { PlatformNav } from "@/components/platform/platform-nav";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminPage();
  const tenant = await getTenantContext();
  const brand = getPortalBrandFromSettings(DEFAULT_APP_SETTINGS);

  return (
    <BrandProvider brand={brand}>
      {tenant?.impersonating && (
        <ImpersonationBanner
          businessName={tenant.business.name}
          businessId={tenant.businessId}
          allowWrites={tenant.allowWrites}
        />
      )}
      <PlatformNav />
      {children}
    </BrandProvider>
  );
}
