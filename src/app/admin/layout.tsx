import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { getTenantContext, LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantContext();
  const settings = await getAppSettings(
    tenant?.businessId ?? LEGACY_DEFAULT_BUSINESS_ID // TODO(tenant): require tenant on admin layouts
  );
  const brand = getPortalBrandFromSettings(settings);

  return (
    <BrandProvider brand={brand}>
      <AdminShell>{children}</AdminShell>
    </BrandProvider>
  );
}
