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
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://portal.swiftaerialmedia.com"
  );
}

export const SITE = {
  name: "Swift Portal",
  company: "Swift Aerial Media",
  title: "Swift Portal | Swift Aerial Media",
  description:
    "Swift Aerial Media client portal for project requests, quotes, scheduling, payments, and media delivery.",
  themeColor: SITE_THEME_COLOR,
  backgroundColor: SITE_BACKGROUND_COLOR,
} as const;
