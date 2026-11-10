import type { Metadata } from "next";
import { deriveBrandTheme, parseSurfaceMode } from "@/lib/brand-color";

/** Business-branded Home Screen icon (see src/app/pwa/icon/route.ts). Host-aware: each portal gets its own. */
export const PWA_ICON_PATH = "/pwa/icon";

/** Short stable version so a new logo/color gets a new icon URL (caches and Android updates). */
export function pwaIconVersion(logoUrl: string, color: string): string {
  let h = 5381;
  for (const ch of `${logoUrl}|${color}`) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

export function pwaIconUrl(size: number, opts: { maskable?: boolean; version?: string } = {}): string {
  return `${PWA_ICON_PATH}?size=${size}${opts.maskable ? "&maskable=1" : ""}${opts.version ? `&v=${opts.version}` : ""}`;
}

/**
 * iOS Home Screen metadata for a business surface: the business's name under the icon and an
 * opaque status bar (see the root layout for why it isn't "black-translucent").
 */
export function pwaAppleMetadata(name: string): Pick<Metadata, "appleWebApp"> {
  return {
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: (name.trim() || "Portal").slice(0, 40),
    },
  };
}

export function pwaAppleIcon(version?: string) {
  return [{ url: pwaIconUrl(180, { version }), sizes: "180x180", type: "image/png" }];
}

/**
 * The installed app's status-bar color: exactly the app header's surface (`--color-card` for this
 * business's theme), so the status bar and header read as one solid surface — never the gray page
 * background behind it.
 */
export function appChromeThemeColor(business: { brandPrimaryColor: string; brandAccentColor: string; surfaceMode?: string }): {
  themeColor: string;
  colorScheme: "light" | "dark";
} {
  const mode = parseSurfaceMode(business.surfaceMode);
  const card = deriveBrandTheme(business.brandPrimaryColor, business.brandAccentColor, mode).card;
  return { themeColor: card, colorScheme: mode === "dark" ? "dark" : "light" };
}
