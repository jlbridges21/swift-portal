import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireTenantContext } from "@/lib/tenant";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenantContext();
  const settings = await getAppSettings(tenant.businessId);
  const brand = getPortalBrandFromSettings(settings);

  return (
    <BrandProvider brand={brand}>
      <AdminShell>{children}</AdminShell>
    </BrandProvider>
  );
}
