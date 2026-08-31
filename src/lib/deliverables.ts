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
