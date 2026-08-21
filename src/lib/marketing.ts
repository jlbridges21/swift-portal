import type { Metadata } from "next";
import { getCanonicalSiteUrl, SITE, SITE_ICONS } from "@/lib/site-metadata";

export const MARKETING_SUPPORT_EMAIL = "support@shootportal.app";
export const MARKETING_HELLO_EMAIL = "hello@shootportal.app";

/** Brand tokens from ShootPortal_Brand_Source_of_Truth.docx */
export const MARKETING_BRAND = {
  indigo: "#4F46E5",
  indigoHover: "#4338CA",
  midnight: "#0F172A",
  cloud: "#F8FAFC",
  slate600: "#475569",
  slate200: "#E2E8F0",
  white: "#FFFFFF",
  tagline: "From request to delivery. One portal.",
  hero: "Run every shoot from one place.",
  heroSupport:
    "Manage requests, estimates, scheduling, client communication, media review, payments, and delivery without stitching together five different tools.",
} as const;

export function marketingPageMetadata(options: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const base = getCanonicalSiteUrl();
  const url = `${base}${options.path === "/" ? "" : options.path}`;
  const title =
    options.path === "/"
      ? options.title
      : `${options.title} | ${SITE.name}`;

  return {
    title: options.path === "/" ? { absolute: options.title } : options.title,
    description: options.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: SITE.name,
      title,
      description: options.description,
      images: [
        {
          url: SITE_ICONS.ogBrand,
          width: 1200,
          height: 630,
          alt: `${SITE.name} — ${SITE.tagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: options.description,
      images: [SITE_ICONS.ogBrand],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
