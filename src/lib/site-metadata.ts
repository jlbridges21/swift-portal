import type { Metadata } from "next";

export const SITE_THEME_COLOR = "#0F172A" as const;
export const SITE_BACKGROUND_COLOR = "#0F172A" as const;

export const SITE_ICONS = {
  favicon: "/icon.png",
  apple: "/apple-icon.png",
  icon48: "/icons/icon-48.png",
  icon192: "/icons/icon-192.png",
  icon512: "/icons/icon-512.png",
  icon512Maskable: "/icons/icon-512-maskable.png",
} as const;

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

/** Root-layout metadata. Platform-generic — no tenant context at `/`. */
export const SITE = {
  name: "Client Portal",
  company: "Client Portal",
  title: "Client Portal",
  description:
    "Client portal for project requests, quotes, scheduling, payments, and media delivery.",
  themeColor: SITE_THEME_COLOR,
  backgroundColor: SITE_BACKGROUND_COLOR,
} as const;

export function metadataFromBusiness(business: {
  portalName: string;
  businessName: string;
  tagline?: string;
}): Metadata {
  const title = `${business.portalName} | ${business.businessName}`;
  const description = business.tagline?.trim() || SITE.description;
  return {
    title: {
      default: title,
      template: `%s | ${business.portalName}`,
    },
    description,
    applicationName: business.portalName,
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
