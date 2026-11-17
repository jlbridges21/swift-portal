/**
 * Everything the client-facing booking pages render, loaded server-side in one place:
 * the request summary (property, services, duration, estimate with travel), the booking
 * mode, the appointment with its photographer, and the self-service policy.
 */
import { clientChangeAllowed } from "@/lib/booking/actions";
import { avatarFor, coverUrlFor, loadEstimateSummary, type EstimateSummary } from "@/lib/booking/details";
import {
  effectiveSchedulingStatus,
  instantBookingActive,
  loadBookingContext,
  loadProjectBookingFacts,
  type BookingContext,
  type BookingProjectFacts,
} from "@/lib/booking/server";
import { isTeamBusiness, type ResolvedTeamMember } from "@/lib/booking/team";
import { decideServiceArea } from "@/lib/booking/travel-pricing";
import { timeZoneLabel } from "@/lib/booking/time";
import type { BookingMode } from "@/lib/booking/settings";

export type ClientBookingView = {
  businessName: string;
  projectId: string;
  projectName: string;
  address: string | null;
  coverUrl: string | null;
  services: string[];
  durationMinutes: number;
  estimate: EstimateSummary;
  mode: BookingMode;
  /** Instant booking can be offered for this project right now. */
  bookable: boolean;
  /** Why it can't (shown as a calm explanation). */
  notBookableReason: string | null;
  schedulingStatus: string;
  timeZone: string;
  timeZoneLabel: string;
  team: boolean;
  clientChoosesStaff: boolean;
  staffPreview: { userId: string; name: string; title: string; avatarUrl: string | null }[];
  appointment: {
    id: string;
    start: string;
    end: string;
    status: string;
    photographer: { name: string; avatarUrl: string | null; title: string } | null;
    onGoogleCalendar: boolean;
  } | null;
  canReschedule: { allowed: boolean; reason: string | null };
  canCancel: { allowed: boolean; reason: string | null };
};

function staffPreview(ctx: BookingContext): ClientBookingView["staffPreview"] {
  return ctx.bookable.slice(0, 6).map((m: ResolvedTeamMember) => ({
    userId: m.userId,
    name: m.name,
    title: m.title,
    avatarUrl: m.avatarUrl,
  }));
}

export async function loadClientBookingView(
  businessId: string,
  projectId: string
): Promise<{ view: ClientBookingView; ctx: BookingContext; facts: BookingProjectFacts } | null> {
  const ctx = await loadBookingContext(businessId);
  const facts = await loadProjectBookingFacts(ctx, projectId);
  if (!facts) return null;
  const [estimate, coverUrl] = await Promise.all([loadEstimateSummary(ctx, projectId), coverUrlFor(ctx, projectId)]);

  const area = decideServiceArea({ oneWayMiles: facts.travelMiles, settings: ctx.booking, servicesRequireQuote: facts.servicesRequireQuote });
  let notBookableReason: string | null = null;
  if (!instantBookingActive(ctx)) notBookableReason = null;
  else if (!facts.propertyAddress) notBookableReason = "We need the property address before you can choose a time.";
  else if (!facts.instantAllowedForServices) notBookableReason = "These services are scheduled personally — we'll reach out with times that work.";
  else if (!area.inside && area.behavior !== "allow")
    notBookableReason = `This property is outside our ${ctx.booking.serviceRadiusMiles}-mile service area, so we'll follow up with a custom quote and times.`;
  const bookable = instantBookingActive(ctx) && !notBookableReason;

  const appt = facts.appointment;
  let appointment: ClientBookingView["appointment"] = null;
  if (appt && (appt.status === "confirmed" || appt.status === "cancelled")) {
    const person = isTeamBusiness(ctx.team) || ctx.team.length ? await avatarFor(appt.assignedUserId) : null;
    const member = ctx.team.find((m) => m.userId === appt.assignedUserId);
    appointment = {
      id: appt.id,
      start: new Date(appt.start).toISOString(),
      end: new Date(appt.end).toISOString(),
      status: appt.status,
      photographer: person ? { ...person, title: member?.profile.displayTitle || "Photographer" } : null,
      onGoogleCalendar: Boolean(appt.googleEventId) && appt.googleSyncStatus === "synced",
    };
  }
  const resched = clientChangeAllowed(ctx, facts, "reschedule");
  const cancel = clientChangeAllowed(ctx, facts, "cancel");

  return {
    ctx,
    facts,
    view: {
      businessName: ctx.settings.business.businessName,
      projectId,
      projectName: facts.projectName,
      address: facts.propertyAddress,
      coverUrl,
      services: facts.serviceNames,
      durationMinutes: facts.durationMinutes,
      estimate,
      mode: ctx.booking.mode,
      bookable,
      notBookableReason,
      schedulingStatus: effectiveSchedulingStatus(facts),
      timeZone: ctx.timeZone,
      timeZoneLabel: timeZoneLabel(ctx.timeZone),
      team: isTeamBusiness(ctx.team),
      clientChoosesStaff: ctx.booking.clientChoosesStaff,
      staffPreview: isTeamBusiness(ctx.team) ? staffPreview(ctx) : [],
      appointment,
      canReschedule: { allowed: resched.allowed && bookable, reason: resched.allowed && !bookable ? "Contact us to reschedule." : resched.reason },
      canCancel: { allowed: cancel.allowed, reason: cancel.reason },
    },
  };
}
