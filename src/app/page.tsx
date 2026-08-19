import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { metadataFromBusiness } from "@/lib/site-metadata";
import { LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";

// TODO(tenant): host-based public landing — prompt 18. Until then the marketing
// site at `/` loads the legacy production business so Swift stays pixel-identical.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings(LEGACY_DEFAULT_BUSINESS_ID);
  return metadataFromBusiness(settings.business);
}

export default async function HomePage() {
  const settings = await getAppSettings(LEGACY_DEFAULT_BUSINESS_ID);
  const brand = getPortalBrandFromSettings(settings);
  return <LandingPage brand={brand} landing={settings.landing} />;
}
