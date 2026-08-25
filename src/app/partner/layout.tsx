import { BrandProvider } from "@/components/brand/brand-provider";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

/**
 * Partner surface outer layout — branding only.
 * Entry (/partner) and guarded dashboard routes share ShootPortal chrome.
 * Partner DATA guards live in (dashboard)/layout.tsx, not here.
 */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const brand = getPortalBrandFromSettings(DEFAULT_APP_SETTINGS);
  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}
