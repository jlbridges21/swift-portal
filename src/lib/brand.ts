/**
 * Platform fallback identity only. Never render these values to a user when
 * `BrandProvider` / `getAppSettings(businessId)` is available — they exist so
 * imports of `BRAND` / `LOGO_URL` do not crash in code paths without a tenant.
 */
export const LOGO_URL = "/icons/icon-192.png";

export const BRAND = {
  name: "Client Portal",
  portalName: "Client Portal",
  logoUrl: LOGO_URL,
  faviconUrl: "/icons/icon-192.png",
} as const;

// File size limits in bytes — not brand data.
export const FILE_SIZE_LIMITS = {
  photo: 100 * 1024 * 1024, // 100MB
  video: 2 * 1024 * 1024 * 1024, // 2GB
  document: 500 * 1024 * 1024, // 500MB
} as const;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
