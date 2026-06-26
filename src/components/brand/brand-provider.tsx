"use client";

import { createContext, useContext } from "react";
import { BRAND } from "@/lib/brand";
import { SWIFT_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import type { PortalBrand } from "@/lib/portal-brand";

const DEFAULT_BRAND: PortalBrand = {
  name: BRAND.name,
  portalName: BRAND.portalName,
  logoUrl: BRAND.logoUrl,
  primaryColor: SWIFT_BUSINESS_DEFAULTS.brandPrimaryColor,
  accentColor: SWIFT_BUSINESS_DEFAULTS.brandAccentColor,
  websiteUrl: SWIFT_BUSINESS_DEFAULTS.websiteUrl,
  contactEmail: SWIFT_BUSINESS_DEFAULTS.primaryContactEmail,
  phoneNumber: SWIFT_BUSINESS_DEFAULTS.phoneNumber,
  adminDisplayName: SWIFT_BUSINESS_DEFAULTS.adminDisplayName,
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
  return (
    <BrandContext.Provider value={brand}>
      <style
        dangerouslySetInnerHTML={{
          __html: `:root { --color-primary: ${brand.primaryColor}; --color-accent: ${brand.accentColor}; }`,
        }}
      />
      {children}
    </BrandContext.Provider>
  );
}
