import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";
import { flushVideoReviewNotificationBatches } from "@/lib/video-review-notifications";

/**
 * Flushes debounced video review email/push batches.
 * GET /api/cron/video-review-notifications
 * GET /api/cron/video-review-notifications?dryRun=1
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const dryRun = cronDryRunRequested(request);
  const raw = await createServiceClient();
  const { data: businesses } = await raw.from("businesses").select("id").eq("status", "active");
  const businessIds = (businesses ?? []).map((b) => b.id as string);

  const result = await flushVideoReviewNotificationBatches({ businessIds, dryRun });

  return NextResponse.json({
    ok: true,
    dryRun,
    businesses: businessIds.length,
    ...result,
  });
}
