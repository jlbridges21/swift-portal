"use client";

import { createContext, useContext } from "react";
import { brandThemeCss, sanitizeCssColor } from "@/lib/brand-color";
import { PLATFORM_BUSINESS_DEFAULTS, type PortalBrand } from "@/lib/portal-brand";
import { DEFAULT_PRELIMINARY_DISCLAIMER } from "@/lib/preliminary-disclaimer";

const DEFAULT_BRAND: PortalBrand = {
  name: PLATFORM_BUSINESS_DEFAULTS.businessName,
  portalName: PLATFORM_BUSINESS_DEFAULTS.portalName,
  logoUrl: PLATFORM_BUSINESS_DEFAULTS.logoUrl,
  primaryColor: PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor,
  accentColor: PLATFORM_BUSINESS_DEFAULTS.brandAccentColor,
  websiteUrl: PLATFORM_BUSINESS_DEFAULTS.websiteUrl,
  contactEmail: PLATFORM_BUSINESS_DEFAULTS.primaryContactEmail,
  phoneNumber: PLATFORM_BUSINESS_DEFAULTS.phoneNumber,
  adminDisplayName: PLATFORM_BUSINESS_DEFAULTS.adminDisplayName,
  supportEmail: PLATFORM_BUSINESS_DEFAULTS.supportEmail,
  addressLine1: PLATFORM_BUSINESS_DEFAULTS.addressLine1,
  addressLine2: PLATFORM_BUSINESS_DEFAULTS.addressLine2,
  city: PLATFORM_BUSINESS_DEFAULTS.city,
  state: PLATFORM_BUSINESS_DEFAULTS.state,
  postalCode: PLATFORM_BUSINESS_DEFAULTS.postalCode,
  country: PLATFORM_BUSINESS_DEFAULTS.country,
  legalName: PLATFORM_BUSINESS_DEFAULTS.legalName,
  tagline: PLATFORM_BUSINESS_DEFAULTS.tagline,
  faviconUrl: PLATFORM_BUSINESS_DEFAULTS.faviconUrl,
  emailLogoUrl: PLATFORM_BUSINESS_DEFAULTS.emailLogoUrl,
  termsUrl: PLATFORM_BUSINESS_DEFAULTS.termsUrl,
  privacyUrl: PLATFORM_BUSINESS_DEFAULTS.privacyUrl,
  preliminaryDisclaimer: DEFAULT_PRELIMINARY_DISCLAIMER,
};

const BrandContext = createContext<PortalBrand>(DEFAULT_BRAND);

export function usePortalBrand(): PortalBrand {
  return useContext(BrandContext);
}

export function BrandProvider({
  brand,
  children,
}: {
  brand: PortalBrand;
  children: React.ReactNode;
}) {
  const primary = sanitizeCssColor(brand.primaryColor, PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor);
  const accent = sanitizeCssColor(brand.accentColor, PLATFORM_BUSINESS_DEFAULTS.brandAccentColor);

  return (
    <BrandContext.Provider value={{ ...brand, primaryColor: primary, accentColor: accent }}>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(primary, accent) }} />
      {children}
    </BrandContext.Provider>
  );
}
