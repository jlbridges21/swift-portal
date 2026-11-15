"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { brandThemeCss, sanitizeCssColor, surfaceTone, type SurfaceMode } from "@/lib/brand-color";
import { PLATFORM_BUSINESS_DEFAULTS, type PortalBrand } from "@/lib/portal-brand";
import { DEFAULT_PRELIMINARY_DISCLAIMER } from "@/lib/preliminary-disclaimer";
import { PORTAL_LOGO_SIZE } from "@/lib/brand-logo-size";

const DEFAULT_BRAND: PortalBrand = {
  name: PLATFORM_BUSINESS_DEFAULTS.businessName,
  portalName: PLATFORM_BUSINESS_DEFAULTS.portalName,
  logoUrl: PLATFORM_BUSINESS_DEFAULTS.logoUrl,
  logoSizePx: PORTAL_LOGO_SIZE.default,
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

/** Unsaved branding shown across the app while the owner edits Settings (null = saved look). */
export type BrandPreview = { brand: PortalBrand; surfaceMode: SurfaceMode } | null;

const BrandPreviewContext = createContext<((preview: BrandPreview) => void) | null>(null);

/**
 * Settings → Business Identity / Branding: show name, logo, colors and portal background
 * everywhere (sidebar, buttons, page) as they're edited, before saving. Pass null to go back to
 * the saved look. A no-op outside a BrandProvider.
 */
export function useSetBrandPreview(): (preview: BrandPreview) => void {
  return useContext(BrandPreviewContext) ?? noop;
}

function noop() {}

export function BrandProvider({
  brand,
  children,
  surfaceMode = "light",
}: {
  brand: PortalBrand;
  children: React.ReactNode;
  /** Client portal and share links pass the business setting. Every other surface stays light. */
  surfaceMode?: SurfaceMode;
}) {
  const [preview, setPreview] = useState<BrandPreview>(null);
  const shown = preview?.brand ?? brand;
  const mode = preview?.surfaceMode ?? surfaceMode;
  const primary = sanitizeCssColor(shown.primaryColor, PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor);
  const accent = sanitizeCssColor(shown.accentColor, PLATFORM_BUSINESS_DEFAULTS.brandAccentColor);
  const value = useMemo(() => ({ ...shown, primaryColor: primary, accentColor: accent }), [shown, primary, accent]);
  const css = useMemo(() => brandThemeCss(primary, accent, mode), [primary, accent, mode]);

  return (
    <BrandPreviewContext.Provider value={setPreview}>
      <BrandContext.Provider value={value}>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        {/* data-surface is the tone (dark-only CSS keys off it); the chosen option rides alongside. */}
        <div data-surface={surfaceTone(mode, primary)} data-surface-mode={mode} className="contents">
          {children}
        </div>
      </BrandContext.Provider>
    </BrandPreviewContext.Provider>
  );
}
