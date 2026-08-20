import { lookupBusinessById } from "@/lib/host-resolution";

/** Active, not soft-deleted. Suspended and deleted businesses skip cron, email, and push. */
export async function isLiveBusiness(businessId: string): Promise<boolean> {
  const row = await lookupBusinessById(businessId);
  return Boolean(row && row.status === "active" && !row.deleted_at);
}
