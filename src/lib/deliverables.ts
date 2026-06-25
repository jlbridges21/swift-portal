import { normalizeStatus } from "@/lib/constants";

/** Full-resolution downloads unlocked only after payment (delivered). */
export function canDownloadDeliverables(status: string): boolean {
  return normalizeStatus(status) === "delivered";
}

/** Watermarked / preview access during review and payment stages. */
export function canPreviewDeliverables(status: string): boolean {
  const s = normalizeStatus(status);
  return ["ready_for_review", "awaiting_payment", "delivered"].includes(s);
}

/** Hide deliverable media from client until sent for review. */
export function showDeliverablesToClient(status: string): boolean {
  return canPreviewDeliverables(status);
}
