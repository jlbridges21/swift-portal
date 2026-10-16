import { getAppSettings } from "@/lib/app-settings";
import { parseSurfaceMode } from "@/lib/brand-color";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BrandProvider } from "@/components/brand/brand-provider";

export async function PhotoShareBrand({
  businessId,
  children,
}: {
  businessId: string;
  children: React.ReactNode;
}) {
  const settings = await getAppSettings(businessId);
  return (
    <BrandProvider
      brand={getPortalBrandFromSettings(settings)}
      surfaceMode={parseSurfaceMode(settings.business.surfaceMode)}
    >
      {children}
    </BrandProvider>
  );
}
