import { getAppSettings } from "@/lib/app-settings";

/**
 * Incidental photo, tour, and model notifications share one client email
 * per project per day. Concurrent uploads still race on one claim.
 */

/** Length of one notification day. Alignment is the offset below, not this. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Moves the day boundary off UTC midnight.
 *
 * Dividing by 24 hours alone is epoch-aligned, so the bucket rolls at
 * 00:00 UTC. That is 6pm or 7pm Central. A business uploading through the
 * evening would cross it mid-session and the client would get a second
 * email. Subtracting nine hours puts the boundary at 09:00 UTC, which is
 * between 1am and 5am from Pacific to Eastern.
 *
 * There is no business timezone setting. This is a deliberate approximation
 * for the continental United States, not a per-business local midnight.
 */
export const DAY_BOUNDARY_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * One key per project per offset day. Concurrent uploads compute the same
 * key and race on the unique claim.
 */
export function incidentalMediaNotificationKey(projectId: string, now = Date.now()): string {
  const bucket = Math.floor((now - DAY_BOUNDARY_OFFSET_MS) / DAY_MS);
  return `incidental-media:${projectId}:${bucket}`;
}

/** workflow.deliverables.notifyClientWhenReady. Unreadable settings fail open. */
export async function deliverablesClientNotifyEnabled(businessId: string): Promise<boolean> {
  try {
    const settings = await getAppSettings(businessId);
    return settings.workflow.deliverables.notifyClientWhenReady !== false;
  } catch (error) {
    console.error("[notifications] could not read deliverables notify setting", error);
    return true;
  }
}
