/**
 * Offered times: the business offers the client 1–3 times, each checked by the booking engine;
 * the client picks one. Picking (or the business accepting a time the client suggested) books
 * through the same engine and confirm function as Instant Booking, so it can never double-book.
 *
 * Offers are pending shoot_proposals rows (booking_source "offer"). They don't hold the time:
 * if someone else takes it first, the client is told to pick another and the business is notified.
 */
import { logProjectActivity } from "@/lib/activity";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { getAppSettings } from "@/lib/app-settings";
import { syncShootToGoogleSafe } from "@/lib/google-calendar";
import { VIOLATION_COPY } from "@/lib/booking/engine";
import { formatZoned } from "@/lib/booking/time";
import { checkStart, type BookingContext, type BookingProjectFacts } from "@/lib/booking/server";
import { confirmAppointment, type BookingActor, type ConfirmResult } from "@/lib/booking/actions";

const MINUTE = 60_000;
export const MAX_OFFERED_TIMES = 3;

function label(ctx: BookingContext, ms: number) {
  return formatZoned(ms, ctx.timeZone, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export type OfferResult =
  | { ok: true; offered: { id: string; start: string; end: string; userId: string }[] }
  | { ok: false; status: number; message: string; problems?: { start: string; violations: string[] }[] };

export async function offerTimes(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  input: { starts: number[]; userId: string | null; message?: string | null; actor: BookingActor }
): Promise<OfferResult> {
  if (!ctx.schemaReady) return { ok: false, status: 409, message: "Offering times needs database migration v132." };
  const starts = [...new Set(input.starts.filter((s) => Number.isFinite(s)))].sort((a, b) => a - b);
  if (!starts.length) return { ok: false, status: 400, message: "Pick at least one time to offer." };
  if (starts.length > MAX_OFFERED_TIMES) return { ok: false, status: 400, message: `Offer up to ${MAX_OFFERED_TIMES} times.` };
  if (starts.some((s) => s < Date.now())) return { ok: false, status: 400, message: "Offered times must be in the future." };
  if (facts.appointment?.status === "confirmed") {
    return { ok: false, status: 409, message: "This shoot is already booked. Reschedule it instead." };
  }

  // Every time must pass the same rules as a booking (notice and window aside: the business chose it).
  const chosen: { start: number; userId: string }[] = [];
  const problems: { start: string; violations: string[] }[] = [];
  for (const start of starts) {
    const check = await checkStart(ctx, facts, start, { userId: input.userId, includeAllTeam: true, ignoreNotice: true });
    if (check.chosen) chosen.push({ start, userId: check.chosen.userId });
    else
      problems.push({
        start: new Date(start).toISOString(),
        violations: (check.ranked[0]?.violations ?? []).map((v) => VIOLATION_COPY[v as keyof typeof VIOLATION_COPY] ?? v),
      });
  }
  if (problems.length) {
    return { ok: false, status: 409, message: "Some of these times break your scheduling rules.", problems };
  }

  // A new offer replaces any open one (and any pending legacy proposal from the business).
  const { data: replaced } = await ctx.db
    .from("shoot_proposals")
    .select("id, google_event_id")
    .eq("project_id", facts.projectId)
    .eq("status", "pending")
    .eq("proposed_by", "admin");
  if (replaced?.length) {
    await ctx.db
      .from("shoot_proposals")
      .update({ status: "superseded" })
      .in(
        "id",
        replaced.map((r) => r.id as string)
      );
    for (const r of replaced) if (r.google_event_id) await syncShootToGoogleSafe(ctx.businessId, r.id as string, "delete");
  }

  const message = input.message?.trim().slice(0, 1000) || null;
  const rows = chosen.map((c) => ({
    project_id: facts.projectId,
    proposed_by: "admin",
    proposed_at: new Date(c.start).toISOString(),
    end_at: new Date(c.start + facts.durationMinutes * MINUTE).toISOString(),
    duration_minutes: facts.durationMinutes,
    buffer_before_minutes: facts.bufferBefore,
    buffer_after_minutes: facts.bufferAfter,
    assigned_user_id: c.userId,
    booking_source: "offer",
    appointment_key: "primary",
    status: "pending",
    message,
    created_by: input.actor.userId,
  }));
  let insert = await ctx.db.from("shoot_proposals").insert(rows).select("id, proposed_at, end_at, assigned_user_id");
  if (insert.error && /booking_source/.test(insert.error.message)) {
    // Before migration v133 "offer" isn't an allowed source; the legacy value works the same.
    insert = await ctx.db
      .from("shoot_proposals")
      .insert(rows.map((r) => ({ ...r, booking_source: "proposal" })))
      .select("id, proposed_at, end_at, assigned_user_id");
  }
  if (insert.error || !insert.data) return { ok: false, status: 500, message: "Couldn't save the offered times." };

  await ctx.db.from("projects").update({ scheduling_status: "awaiting_booking" }).eq("id", facts.projectId);

  const labels = chosen.map((c) => label(ctx, c.start));
  try {
    await logProjectActivity("shoot_times_offered", `Offered ${labels.length === 1 ? "a shoot time" : `${labels.length} shoot times`}: ${labels.join(" · ")}`, {
      businessId: ctx.businessId,
      projectId: facts.projectId,
      userId: input.actor.userId,
      visibility: "both",
      metadata: { starts: chosen.map((c) => new Date(c.start).toISOString()) },
    });
    const settings = await getAppSettings(ctx.businessId);
    if (settings.workflow.scheduling.notifyClientOnPropose) {
      const where = facts.propertyAddress ?? facts.projectName;
      await notifyProjectClients({
        businessId: ctx.businessId,
        projectId: facts.projectId,
        type: "shoot_proposed",
        eventKey: "shoot_times_offered",
        title: labels.length === 1 ? "Confirm your shoot time" : "Pick a time for your shoot",
        body:
          labels.length === 1
            ? `${settings.business.businessName} offered ${labels[0]} for your shoot at ${where}. Confirm it in your portal.`
            : `${settings.business.businessName} offered ${labels.length} times for your shoot at ${where}: ${labels.join(" · ")}. Pick the one that works for you.`,
        link: `/dashboard/projects/${facts.projectId}?scheduling=pending#scheduling`,
        emailCtaLabel: labels.length === 1 ? "Confirm time" : "Pick a time",
        idempotencyKey: `offer:${insert.data[0].id}`,
      });
    }
  } catch (err) {
    console.error("[booking] offer side effects failed", err instanceof Error ? err.message : err);
  }

  return {
    ok: true,
    offered: insert.data.map((r) => ({
      id: r.id as string,
      start: r.proposed_at as string,
      end: r.end_at as string,
      userId: r.assigned_user_id as string,
    })),
  };
}

/**
 * Book a pending proposal (an offered time the client picked, or a time the client suggested
 * that the business accepts) through the booking engine. Pending siblings are superseded by the
 * confirm function; their Google "PENDING" events are removed.
 */
export async function acceptProposal(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  input: { proposalId: string; actor: BookingActor }
): Promise<ConfirmResult> {
  const { data: row } = await ctx.db
    .from("shoot_proposals")
    .select("id, project_id, proposed_at, status, assigned_user_id, proposed_by")
    .eq("id", input.proposalId)
    .maybeSingle();
  if (!row || row.project_id !== facts.projectId) return { ok: false, code: "error", message: "That time is no longer available." };
  if (row.status !== "pending") return { ok: false, code: "unavailable", message: "That time is no longer open. Please choose another time." };

  const { data: pendingWithEvents } = await ctx.db
    .from("shoot_proposals")
    .select("id, google_event_id")
    .eq("project_id", facts.projectId)
    .eq("status", "pending")
    .not("google_event_id", "is", null);

  const result = await confirmAppointment(ctx, facts, {
    startMs: Date.parse(row.proposed_at as string),
    userId: (row.assigned_user_id as string | null) ?? null,
    // The business chose or accepted this time: rules apply, notice and booking window don't.
    source: "manual",
    actor: input.actor,
  });

  if (!result.ok) {
    if (input.actor.kind === "client") {
      await notifyAdmins({
        businessId: ctx.businessId,
        projectId: facts.projectId,
        type: "schedule_change_requested",
        eventKey: "shoot_time_declined",
        title: "Offered time no longer available",
        body: `${facts.clientName} picked ${label(ctx, Date.parse(row.proposed_at as string))}, but it was taken. Offer new times or let them book online.`,
        link: `/admin/projects/${facts.projectId}`,
      }).catch(() => null);
    }
    return result;
  }

  for (const p of pendingWithEvents ?? []) await syncShootToGoogleSafe(ctx.businessId, p.id as string, "delete");
  return result;
}
