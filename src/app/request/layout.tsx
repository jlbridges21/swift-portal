import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";
import { LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** TODO(tenant): host-based public chrome — prompt 18. */
export default async function RequestLayout({ children }: { children: React.ReactNode }) {
  const settings = await getAppSettings(LEGACY_DEFAULT_BUSINESS_ID);
  return (
    <BrandProvider brand={getPortalBrandFromSettings(settings)}>{children}</BrandProvider>
  );
}
