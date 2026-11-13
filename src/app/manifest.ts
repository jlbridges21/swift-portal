import type { MetadataRoute } from "next";
import { getAppSettings } from "@/lib/app-settings";
import { parseSurfaceMode } from "@/lib/brand-color";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { appChromeThemeColor, pwaIconUrl, pwaIconVersion } from "@/lib/pwa/metadata";
import { SITE, SITE_BACKGROUND_COLOR, SITE_ICONS, SITE_THEME_COLOR } from "@/lib/site-metadata";

function platformManifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: SITE_BACKGROUND_COLOR,
    theme_color: SITE_THEME_COLOR,
    icons: [
      { src: SITE_ICONS.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: SITE_ICONS.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: SITE_ICONS.icon512Maskable, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

/** Home Screen label: whole words that fit (iOS/Android truncate around 12 characters). */
function shortName(name: string): string {
  const clean = name.trim();
  if (clean.length <= 12) return clean;
  let out = "";
  for (const word of clean.split(/\s+/)) {
    if ((out ? `${out} ${word}` : word).length > 12) break;
    out = out ? `${out} ${word}` : word;
  }
  return out || clean.slice(0, 12);
}

/**
 * Per-host web app manifest.
 *
 * Business portal hosts ({slug}.shootportal.app, portal custom domains) install as that
 * business's app: its name, its logo icon, its surface colors, and start_url "/app" — the app
 * entry that opens the signed-in home or a branded sign-in screen, never the public website.
 * `id` stays "/" (the implicit id of earlier installs, whose start_url was "/") so Android
 * updates existing installs in place instead of treating them as a different app.
 *
 * Business Website domains (www.yourstudio.com) are the public website, not the portal, so they
 * keep a plain website manifest. The ShootPortal platform keeps its own manifest.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return platformManifest();
  const { business } = await getAppSettings(host.businessId);
  const name = (business.businessName || business.portalName || SITE.name).trim();
  const dark = parseSurfaceMode(business.surfaceMode) === "dark";
  const surface = dark ? "#14181F" : "#F8FAFC";
  const version = pwaIconVersion(business.logoUrl, business.brandPrimaryColor);
  const onWebsiteDomain = host.source === "website_domain";
  return {
    id: "/",
    name,
    short_name: shortName(name),
    description: business.tagline?.trim() || `${name} client portal`,
    start_url: onWebsiteDomain ? "/" : "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: surface,
    // Portal installs: the status bar takes the app header's surface (same value as the pages'
    // theme-color meta, see appChromeThemeColor), so status bar + header read as one solid bar.
    theme_color: onWebsiteDomain ? surface : appChromeThemeColor(business).themeColor,
    icons: [
      { src: pwaIconUrl(192, { version }), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: pwaIconUrl(512, { version }), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: pwaIconUrl(512, { version, maskable: true }), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
