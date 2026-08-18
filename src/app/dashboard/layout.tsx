import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { requireTenantContext } from "@/lib/tenant";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenantContext();
  const settings = await getAppSettings(tenant.businessId);
  const brand = getPortalBrandFromSettings(settings);

  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}
