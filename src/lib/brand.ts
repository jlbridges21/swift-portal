export const LOGO_URL =
  "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a347eb5671890ccaad77c04.png";

export const BRAND = {
  name: "Swift Aerial Media",
  portalName: "Swift Portal",
  logoUrl: LOGO_URL,
  faviconUrl: "/icons/icon-192.png",
} as const;

// File size limits in bytes
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
