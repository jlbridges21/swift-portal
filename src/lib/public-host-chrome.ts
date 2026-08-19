import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings, PLATFORM_BUSINESS_DEFAULTS, type PortalBrand } from "@/lib/portal-brand";
import { metadataFromBusiness, SITE } from "@/lib/site-metadata";
import { getPublicHostContext, type PublicHostContext } from "@/lib/host-resolution";
import type { Metadata } from "next";

export function platformPortalBrand(): PortalBrand {
  const b = PLATFORM_BUSINESS_DEFAULTS;
  return {
    name: b.businessName,
    portalName: b.portalName,
    logoUrl: b.logoUrl,
    primaryColor: b.brandPrimaryColor,
    accentColor: b.brandAccentColor,
    websiteUrl: b.websiteUrl,
    contactEmail: b.primaryContactEmail,
    phoneNumber: b.phoneNumber,
    adminDisplayName: b.adminDisplayName,
    supportEmail: b.supportEmail,
    addressLine1: b.addressLine1,
    addressLine2: b.addressLine2,
    city: b.city,
    state: b.state,
    postalCode: b.postalCode,
    country: b.country,
    legalName: b.legalName,
    tagline: b.tagline,
    faviconUrl: b.faviconUrl,
    emailLogoUrl: b.emailLogoUrl,
    termsUrl: b.termsUrl,
    privacyUrl: b.privacyUrl,
    preliminaryDisclaimer: "",
  };
}

export async function publicHostBrand(): Promise<{
  host: PublicHostContext;
  brand: PortalBrand;
  metadata: Metadata;
}> {
  const host = await getPublicHostContext();
  if (host.kind === "tenant" && host.businessId) {
    const settings = await getAppSettings(host.businessId);
    return {
      host,
      brand: getPortalBrandFromSettings(settings),
      metadata: metadataFromBusiness(settings.business),
    };
  }
  return {
    host,
    brand: platformPortalBrand(),
    metadata: {
      title: SITE.title,
      description: SITE.description,
    },
  };
}
