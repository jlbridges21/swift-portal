import type { AppSettings } from "@/lib/app-settings";
import { BRAND } from "@/lib/brand";
import { sanitizeCssColor } from "@/lib/brand-color";
import { DEFAULT_PRELIMINARY_DISCLAIMER } from "@/lib/preliminary-disclaimer";

export interface PortalBrand {
  name: string;
  portalName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  websiteUrl: string;
  contactEmail: string;
  phoneNumber: string;
  adminDisplayName: string;
  supportEmail: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  legalName: string;
  tagline: string;
  faviconUrl: string;
  emailLogoUrl: string;
  termsUrl: string;
  privacyUrl: string;
  preliminaryDisclaimer: string;
}

/** Platform fallback only — never the source of a tenant's rendered identity. */
export const PLATFORM_BUSINESS_DEFAULTS: AppSettings["business"] = {
  businessName: "ShootPortal",
  portalName: "ShootPortal",
  adminDisplayName: "Admin",
  primaryContactEmail: "",
  phoneNumber: "",
  websiteUrl: "",
  logoUrl: BRAND.logoUrl,
  brandPrimaryColor: "#0F172A",
  brandAccentColor: "#4F46E5",
  supportEmail: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  legalName: "ShootPortal",
  tagline: "From request to delivery. One portal.",
  faviconUrl: BRAND.faviconUrl,
  emailLogoUrl: BRAND.logoUrl,
  termsUrl: "",
  privacyUrl: "",
};

export function getPortalBrandFromSettings(settings: AppSettings): PortalBrand {
  const b = settings.business;
  return {
    name: b.businessName || BRAND.name,
    portalName: b.portalName || BRAND.portalName,
    logoUrl: b.logoUrl || BRAND.logoUrl,
    primaryColor: sanitizeCssColor(b.brandPrimaryColor, PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor),
    accentColor: sanitizeCssColor(b.brandAccentColor, PLATFORM_BUSINESS_DEFAULTS.brandAccentColor),
    websiteUrl: b.websiteUrl || "",
    contactEmail: b.primaryContactEmail || "",
    phoneNumber: b.phoneNumber || "",
    adminDisplayName: b.adminDisplayName || b.businessName || BRAND.name,
    supportEmail: b.supportEmail || b.primaryContactEmail || "",
    addressLine1: b.addressLine1 || "",
    addressLine2: b.addressLine2 || "",
    city: b.city || "",
    state: b.state || "",
    postalCode: b.postalCode || "",
    country: b.country || "",
    legalName: b.legalName || b.businessName || BRAND.name,
    tagline: b.tagline || "",
    faviconUrl: b.faviconUrl || BRAND.faviconUrl,
    emailLogoUrl: b.emailLogoUrl || b.logoUrl || BRAND.logoUrl,
    termsUrl: b.termsUrl || "",
    privacyUrl: b.privacyUrl || "",
    preliminaryDisclaimer: settings.proposals.preliminaryDisclaimer || DEFAULT_PRELIMINARY_DISCLAIMER,
  };
}
