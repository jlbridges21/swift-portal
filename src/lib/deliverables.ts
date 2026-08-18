import { normalizeStatus } from "@/lib/constants";

/**
 * Full-resolution downloads unlocked only after payment (delivered).
 * Callers must load the project through a business-scoped query first
 * (`media/download`, `project-zip-download`). This helper only inspects status.
 */
export function canDownloadDeliverables(status: string): boolean {
  return normalizeStatus(status) === "delivered";
}

/** Clients can always preview uploaded media; downloads are gated separately. */
export function showDeliverablesToClient(_status?: string): boolean {
  return true;
}
