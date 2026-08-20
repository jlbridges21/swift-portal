import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";
import { requireAdminPage } from "@/lib/admin-access";
import { getTenantContext } from "@/lib/tenant";
import { metadataFromBusiness } from "@/lib/site-metadata";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantContext();
  if (!tenant) return {};
  const settings = await getAppSettings(tenant.businessId);
  return metadataFromBusiness(settings.business);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = await requireAdminPage();
  const settings = await getAppSettings(tenant.businessId);
  const brand = getPortalBrandFromSettings(settings);

  return (
    <BrandProvider brand={brand}>
      {tenant.impersonating && (
        <ImpersonationBanner
          businessName={tenant.business.name}
          businessId={tenant.businessId}
          allowWrites={tenant.allowWrites}
        />
      )}
      <AdminShell>{children}</AdminShell>
    </BrandProvider>
  );
}
