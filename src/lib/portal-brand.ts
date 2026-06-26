import type { AppSettings } from "@/lib/app-settings";
import { BRAND } from "@/lib/brand";

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
}

export const SWIFT_BUSINESS_DEFAULTS: AppSettings["business"] = {
  businessName: "Swift Aerial Media",
  portalName: "Swift Portal",
  adminDisplayName: "Jackson Bridges",
  primaryContactEmail: "jackson@swiftaerialmedia.com",
  phoneNumber: "6626871259",
  websiteUrl: "https://swiftaerialmedia.com",
  logoUrl: BRAND.logoUrl,
  brandPrimaryColor: "#0F172A",
  brandAccentColor: "#3B82F6",
};

export function getPortalBrandFromSettings(settings: AppSettings): PortalBrand {
  return {
    name: settings.business.businessName || BRAND.name,
    portalName: settings.business.portalName || BRAND.portalName,
    logoUrl: settings.business.logoUrl || BRAND.logoUrl,
    primaryColor: settings.business.brandPrimaryColor || "#0F172A",
    accentColor: settings.business.brandAccentColor || "#3B82F6",
    websiteUrl: settings.business.websiteUrl || SWIFT_BUSINESS_DEFAULTS.websiteUrl,
    contactEmail: settings.business.primaryContactEmail || SWIFT_BUSINESS_DEFAULTS.primaryContactEmail,
    phoneNumber: settings.business.phoneNumber || "",
    adminDisplayName: settings.business.adminDisplayName || "Swift Aerial Media",
  };
}
