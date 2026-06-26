import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const settings = await getAppSettings();
  const brand = getPortalBrandFromSettings(settings);

  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}
