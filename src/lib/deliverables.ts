import { normalizeStatus } from "@/lib/constants";

/**
 * Full-resolution downloads unlocked only after payment (delivered) when the
 * business requires Delivered. Callers must load project + settings through
 * tenant-scoped queries first.
 */
export function canDownloadDeliverables(status: string): boolean {
  return normalizeStatus(status) === "delivered";
}

/** Clients can always preview uploaded media; downloads are gated separately. */
export function showDeliverablesToClient(_status?: string): boolean {
  return true;
}

export type ProjectDownloadGateInput = {
  projectStatus: string;
  isAdmin: boolean;
  requireDeliveredForDownloads: boolean;
};

/**
 * Single resolver for individual media, project ZIP, and folder ZIP downloads.
 * Admins always download; clients follow the business download-gate setting.
 */
export function resolveProjectDownloadAllowed({
  projectStatus,
  isAdmin,
  requireDeliveredForDownloads,
}: ProjectDownloadGateInput): boolean {
  if (isAdmin) return true;
  if (!requireDeliveredForDownloads) return true;
  return canDownloadDeliverables(projectStatus);
}

/** Client-facing lock copy when downloads are blocked. Null when downloads are open. */
export function clientDownloadLockMessage(
  projectStatus: string,
  requireDeliveredForDownloads: boolean
): string | null {
  if (!requireDeliveredForDownloads) return null;
  if (canDownloadDeliverables(projectStatus)) return null;
  return "Downloads unlock when your project reaches Delivered.";
}

/** API 403 message — kept aligned with existing client copy. */
export const DOWNLOAD_GATE_API_MESSAGE =
  "Downloads unlock after your final payment is complete.";

/**
 * Per-project client download override (migration v124, projects.client_download_access).
 *   "default"  (NULL)   — follow the business setting (Admin Settings › Payments › Download Access)
 *   "allow"             — clients may download as soon as media is available (no Delivered/payment wait)
 *   "restrict"          — clients must wait for Delivered, even if the business allows early downloads
 * Only changes download timing. Project access, file visibility and section visibility still apply.
 */
export type ProjectDownloadAccess = "default" | "allow" | "restrict";

export function parseProjectDownloadAccess(value: unknown): ProjectDownloadAccess {
  return value === "allow" || value === "restrict" ? value : "default";
}

/** The Delivered requirement that actually applies to this project after its override. */
export function effectiveRequireDeliveredForDownloads(
  businessRequiresDelivered: boolean,
  projectAccess: unknown
): boolean {
  const access = parseProjectDownloadAccess(projectAccess);
  if (access === "allow") return false;
  if (access === "restrict") return true;
  return businessRequiresDelivered;
}
