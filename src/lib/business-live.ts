import { lookupBusinessById } from "@/lib/host-resolution";
import { getSubscriptionState } from "@/lib/subscription";

/**
 * Active, not soft-deleted, and not subscription-paywalled.
 * Suspended, deleted, and paywalled businesses skip cron, email, and push.
 */
export async function isLiveBusiness(businessId: string): Promise<boolean> {
  const row = await lookupBusinessById(businessId);
  if (!row || row.status !== "active" || row.deleted_at) return false;
  return !getSubscriptionState(row).requiresPayment;
}
