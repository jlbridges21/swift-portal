/**
 * Request-time booking facts: driving distance, service area, estimated duration and the
 * project's initial scheduling status. Called once per new request; never throws.
 */
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import type { AppSettings } from "@/lib/app-settings";
import { combinedDuration } from "@/lib/booking/settings";
import { bookingSchemaReady, loadServiceBookingRules, travelSnapshotForRequest } from "@/lib/booking/server";

export type RequestBookingFacts = {
  travel: Awaited<ReturnType<typeof travelSnapshotForRequest>> | null;
  durationMinutes: number;
  /** The client will be offered a scheduling step. */
  bookingOffered: boolean;
};

export async function recordRequestBookingFacts(input: {
  businessId: string;
  projectId: string;
  settings: AppSettings;
  propertyAddress: string | null;
  serviceIds: string[];
  hidePricing: boolean;
}): Promise<RequestBookingFacts> {
  const booking = input.settings.booking;
  try {
    const db = await createTenantServiceClient(input.businessId);
    const [rules, schemaReady] = await Promise.all([loadServiceBookingRules(db), bookingSchemaReady(db)]);
    const chosen = input.serviceIds.map((id) => rules.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
    const servicesRequireQuote = chosen.some((r) => r.outsideRadiusRequiresQuote);
    const instantAllowed = chosen.every((r) => r.instantBookingAllowed);
    const duration = combinedDuration(
      chosen.map((r) => ({ durationMinutes: r.durationMinutes, bufferMinutes: r.bufferMinutes })),
      booking
    );
    const travel = await travelSnapshotForRequest({
      businessId: input.businessId,
      settings: input.settings,
      propertyAddress: input.propertyAddress,
      servicesRequireQuote,
      hidePricing: input.hidePricing,
    });
    const outside = !travel.serviceArea.inside;
    const blockedByArea = !travel.serviceArea.inside && travel.serviceArea.behavior !== "allow";
    const bookingOffered = schemaReady && booking.mode !== "off" && instantAllowed && !blockedByArea;

    if (schemaReady) {
      await db
        .from("projects")
        .update({
          scheduling_status: bookingOffered ? "awaiting_booking" : "unscheduled",
          travel_distance_miles: travel.miles,
          travel_duration_minutes: travel.minutes,
          outside_service_area: outside,
          estimated_duration_minutes: duration.durationMinutes,
        })
        .eq("id", input.projectId);
    }
    return { travel, durationMinutes: duration.durationMinutes, bookingOffered };
  } catch (err) {
    console.error("[booking] request facts failed", err instanceof Error ? err.message : err);
    return { travel: null, durationMinutes: 60, bookingOffered: false };
  }
}
