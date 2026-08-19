import type { Metadata } from "next";

/** Brand guide: Portal Indigo — PWA theme / status bar. */
export const SITE_THEME_COLOR = "#4F46E5" as const;
/** Brand guide: Cloud — app/page background. */
export const SITE_BACKGROUND_COLOR = "#F8FAFC" as const;

export const DEFAULT_PLATFORM_ROOT_DOMAIN = "shootportal.app";
export const DEFAULT_PLATFORM_EMAIL_DOMAIN = "shootportal.app";
export const DEFAULT_PLATFORM_FROM_ADDRESS = "noreply@shootportal.app";

/**
 * Platform chrome icons (ShootPortal monogram).
 * `/icons/icon-*.png` are the legacy Swift Aerial Media files still referenced by
 * stored `business_settings` favicon/logo URLs — do not overwrite those paths.
 */
export const SITE_ICONS = {
  favicon: "/icon.png",
  apple: "/apple-icon.png",
  icon48: "/icons/sp-icon-48.png",
  icon192: "/icons/sp-icon-192.png",
  icon512: "/icons/sp-icon-512.png",
  icon512Maskable: "/icons/sp-icon-512-maskable.png",
  ogBrand: "/icons/og-brand.png",
  logoPrimary: "/icons/sp-logo-primary.png",
  logoWhite: "/icons/sp-logo-white.png",
  appIcon: "/icons/sp-app-icon.png",
} as const;

export function getPlatformRootDomain(): string {
  return process.env.PLATFORM_ROOT_DOMAIN?.trim() || DEFAULT_PLATFORM_ROOT_DOMAIN;
}

/**
 * Canonical site origin. `NEXT_PUBLIC_APP_URL` is unchanged (prompt 18 owns tenant hosts).
 * Fallback is the purchased platform domain, not a tenant custom domain.
 */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `https://${DEFAULT_PLATFORM_ROOT_DOMAIN}`;
}

/** Root-layout metadata. Platform-generic — no tenant context at `/`. */
export const SITE = {
  name: "ShootPortal",
  company: "ShootPortal",
  title: "ShootPortal | Client & Project Management for Media Professionals",
  description:
    "Manage estimates, scheduling, client communication, media review, payments, and delivery from one professional portal built for photographers, videographers, drone operators, and media teams.",
  tagline: "From request to delivery. One portal.",
  themeColor: SITE_THEME_COLOR,
  backgroundColor: SITE_BACKGROUND_COLOR,
} as const;

export function metadataFromBusiness(business: {
  portalName: string;
  businessName: string;
  tagline?: string;
  faviconUrl?: string;
}): Metadata {
  const title = `${business.portalName} | ${business.businessName}`;
  const description = business.tagline?.trim() || SITE.description;
  const favicon = business.faviconUrl?.trim() || SITE_ICONS.favicon;
  return {
    title: {
      default: title,
      template: `%s | ${business.portalName}`,
    },
    description,
    applicationName: business.portalName,
    icons: {
      icon: [{ url: favicon }],
      apple: [{ url: favicon }],
    },
    openGraph: {
      siteName: business.portalName,
      title,
      description,
    },
    twitter: {
      title,
      description,
    },
  };
}
