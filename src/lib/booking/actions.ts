/**
 * Booking writes: confirm (instant + manual), reschedule, cancel, reassign, admin override.
 * Booking confirmation is independent of proposals and payments: nothing here reads or
 * changes quotes, invoices or payment state.
 */

import { logProjectActivity } from "@/lib/activity";
import { notifyAdmins, notifyProjectClients, notifyTeamMember } from "@/lib/notifications";
import { setProjectStatus } from "@/lib/status-automation";
import { syncShootToGoogleSafe } from "@/lib/google-calendar";
import { syncShootToOutlookSafe } from "@/lib/outlook-calendar";
import { formatZoned } from "@/lib/booking/time";
import { zonedParts } from "@/lib/booking/time";
import { VIOLATION_COPY, type SlotViolation } from "@/lib/booking/engine";
import {
  checkStart,
  evaluateFor,
  type BookingContext,
  type BookingProjectFacts,
} from "@/lib/booking/server";

const MINUTE = 60_000;

export type BookingActor = { kind: "client" | "business"; userId: string | null };

export type ConfirmResult =
  | { ok: true; proposalId: string; userId: string; start: string; end: string }
  | { ok: false; code: "not_ready" | "conflict" | "unavailable" | "error"; message: string; violations?: string[] };

function whenLabel(ctx: BookingContext, ms: number): string {
  return formatZoned(ms, ctx.timeZone, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function isConflictError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23P01" || /booking_conflict|no_double_booking|exclusion/i.test(error.message ?? "");
}

async function setSchedulingStatus(ctx: BookingContext, projectId: string, status: string, shootDateMs?: number) {
  const patch: Record<string, unknown> = { scheduling_status: status };
  if (shootDateMs != null) patch.shoot_date = zonedParts(shootDateMs, ctx.timeZone).dayKey;
  const { error } = await ctx.db.from("projects").update(patch).eq("id", projectId);
  if (error && shootDateMs != null) {
    await ctx.db.from("projects").update({ shoot_date: patch.shoot_date }).eq("id", projectId);
  }
}

/** Adds a staff assignee to the project. True when they were newly added. */
async function ensureProjectStaff(ctx: BookingContext, projectId: string, userId: string, actorId: string | null): Promise<boolean> {
  const member = ctx.team.find((m) => m.userId === userId);
  if (!member || member.role !== "staff") return false;
  const { data } = await ctx.db
    .from("project_staff")
    .upsert({ project_id: projectId, user_id: userId, added_by: actorId }, { onConflict: "project_id,user_id", ignoreDuplicates: true })
    .select("user_id");
  return Boolean(data?.length);
}

/** Personal alert to the person a shoot was just given to (their "Added to a project" choice). */
async function notifyAssignee(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  userId: string,
  actorId: string | null,
  startMs: number
) {
  const member = ctx.team.find((m) => m.userId === userId);
  if (!member || member.role !== "staff" || userId === actorId) return;
  await notifyTeamMember({
    businessId: ctx.businessId,
    userId,
    projectId: facts.projectId,
    type: "project_assigned",
    title: "A shoot was assigned to you",
    body: `${facts.propertyAddress ?? facts.projectName} · ${whenLabel(ctx, startMs)} · ${facts.clientName}`,
    link: `/admin/projects/${facts.projectId}`,
  });
}

function memberName(ctx: BookingContext, userId: string): string {
  return ctx.team.find((m) => m.userId === userId)?.name ?? "your photographer";
}

/**
 * Book (or rebook) the project's primary appointment.
 * - instant: client self-booking. Strict: every rule must pass, notice and window included.
 * - manual:  business scheduling through the same engine. Notice/window are not enforced,
 *            everything else is; violations come back unless `override` is given.
 */
export async function confirmAppointment(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  input: {
    startMs: number;
    userId: string | null;
    source: "instant" | "manual";
    actor: BookingActor;
    holdId?: string | null;
    override?: { reason: string } | null;
    /** Manual bookings from the Shoot Calendar may set their own length (resize / custom end). */
    durationMinutes?: number | null;
  }
): Promise<ConfirmResult> {
  if (!ctx.schemaReady) {
    return { ok: false, code: "not_ready", message: "Instant Booking needs database migration v132." };
  }
  const previous = facts.appointment?.status === "confirmed" ? facts.appointment : null;
  const check = await checkStart(ctx, facts, input.startMs, {
    userId: input.userId,
    excludeAppointmentId: previous?.id ?? null,
    includeAllTeam: input.source === "manual",
    ignoreNotice: input.source === "manual",
  });

  let userId = check.chosen?.userId ?? null;
  const override = input.source === "manual" && input.override?.reason?.trim() ? input.override : null;
  if (!userId) {
    const first = check.ranked[0];
    // An owner/admin override from the calendar works even when nobody is "available"
    // (no bookable team member ranked): it goes to the chosen photographer, or the booker.
    if (override && !first && input.actor.kind === "business") {
      userId = input.userId ?? input.actor.userId ?? null;
    }
  }
  if (!userId) {
    const first = check.ranked[0];
    if (!override || !first) {
      const violations = (first?.violations ?? []) as SlotViolation[];
      return {
        ok: false,
        code: "unavailable",
        message: violations.length
          ? violations.map((v) => VIOLATION_COPY[v] ?? v).join(" ")
          : "That time is no longer available. Please choose another time.",
        violations: violations.map((v) => VIOLATION_COPY[v] ?? v),
      };
    }
    userId = input.userId ?? first.userId;
  }

  const customMinutes =
    input.source === "manual" && input.durationMinutes && input.durationMinutes >= 5 && input.durationMinutes <= 24 * 60
      ? Math.round(input.durationMinutes)
      : null;
  const durationMinutes = customMinutes ?? facts.durationMinutes;
  const endMs = input.startMs + durationMinutes * MINUTE;
  let proposalId: string | null = null;

  // Override path: a conflict was overridden, or a calendar booking set its own length (the
  // rule check ran on the service length, so the database constraint could refuse the custom end).
  if (override && (!check.chosen || customMinutes !== null)) {
    // Admin override: explicit, audited, excluded from the double-booking constraint.
    await ctx.db
      .from("shoot_proposals")
      .update({ status: "superseded" })
      .eq("project_id", facts.projectId)
      .eq("appointment_key", "primary")
      .in("status", ["confirmed", "pending"]);
    const { data, error } = await ctx.db
      .from("shoot_proposals")
      .insert({
        project_id: facts.projectId,
        proposed_by: "admin",
        proposed_at: new Date(input.startMs).toISOString(),
        end_at: new Date(endMs).toISOString(),
        duration_minutes: durationMinutes,
        buffer_before_minutes: facts.bufferBefore,
        buffer_after_minutes: facts.bufferAfter,
        assigned_user_id: userId,
        booking_source: "manual",
        appointment_key: "primary",
        status: "confirmed",
        created_by: input.actor.userId,
        conflict_override: true,
        override_reason: override.reason.trim().slice(0, 500),
        override_by: input.actor.userId,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, code: "error", message: error?.message ?? "Could not save the shoot." };
    proposalId = data.id as string;
    const overridden = check.chosen ? [] : (check.ranked.find((r) => r.userId === userId)?.violations ?? []);
    if (!check.chosen) {
      await logProjectActivity("shoot_override", `Admin override: shoot booked despite conflicts (${whenLabel(ctx, input.startMs)})`, {
        businessId: ctx.businessId,
        projectId: facts.projectId,
        userId: input.actor.userId,
        visibility: "admin",
        metadata: { reason: override.reason, violations: overridden },
      });
    }
  } else {
    const { data, error } = await ctx.db.raw.rpc("confirm_instant_booking", {
      p_business_id: ctx.businessId,
      p_project_id: facts.projectId,
      p_assigned_user_id: userId,
      p_start: new Date(input.startMs).toISOString(),
      p_end: new Date(endMs).toISOString(),
      p_buffer_before: facts.bufferBefore,
      p_buffer_after: facts.bufferAfter,
      p_source: input.source,
      p_created_by: input.actor.userId,
      p_hold_id: input.holdId ?? null,
      p_appointment_key: "primary",
      p_message: null,
    });
    if (error) {
      if (isConflictError(error)) {
        return { ok: false, code: "conflict", message: "Someone just booked that time. Please choose another time." };
      }
      console.error("[booking] confirm failed", { businessId: ctx.businessId, error: error.message });
      return { ok: false, code: "error", message: "We couldn't confirm the booking. Please try again." };
    }
    proposalId = data as string;
  }

  // Keep one Google event per appointment: the new row takes over the previous event id.
  if (previous?.googleEventId && proposalId) {
    // Which account holds the event (v133); absent before the migration.
    const owner = await ctx.db.from("shoot_proposals").select("google_owner_user_id").eq("id", previous.id).maybeSingle();
    const ownerUserId = owner.error ? undefined : ((owner.data?.google_owner_user_id as string | null) ?? null);
    await ctx.db
      .from("shoot_proposals")
      .update({ google_event_id: null, google_sync_status: null, google_sync_error: null })
      .eq("id", previous.id);
    await ctx.db
      .from("shoot_proposals")
      .update({
        google_event_id: previous.googleEventId,
        google_calendar_id: previous.googleCalendarId,
        ...(ownerUserId !== undefined ? { google_owner_user_id: ownerUserId } : {}),
      })
      .eq("id", proposalId);
  }

  await afterBooked(ctx, facts, {
    proposalId: proposalId!,
    userId: userId!,
    startMs: input.startMs,
    endMs,
    actor: input.actor,
    rescheduled: Boolean(previous),
    source: input.source,
  });

  return {
    ok: true,
    proposalId: proposalId!,
    userId: userId!,
    start: new Date(input.startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

async function afterBooked(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  args: {
    proposalId: string;
    userId: string;
    startMs: number;
    endMs: number;
    actor: BookingActor;
    rescheduled: boolean;
    source: "instant" | "manual";
  }
) {
  try {
    await setSchedulingStatus(ctx, facts.projectId, "scheduled", args.startMs);
    const newlyAdded = await ensureProjectStaff(ctx, facts.projectId, args.userId, args.actor.userId);
    await syncShootToGoogleSafe(ctx.businessId, args.proposalId, "upsert");
    await syncShootToOutlookSafe(ctx.businessId, args.proposalId, "upsert");
    // Someone just put on the project hears it once, as an assignment, not also as a schedule change.
    if (newlyAdded) await notifyAssignee(ctx, facts, args.userId, args.actor.userId, args.startMs);

    const when = whenLabel(ctx, args.startMs);
    const who = memberName(ctx, args.userId);
    const byClient = args.actor.kind === "client";
    const verb = args.rescheduled ? "rescheduled" : "booked";
    await logProjectActivity(
      args.rescheduled ? "shoot_rescheduled" : "shoot_confirmed",
      `Shoot ${verb} for ${when}${ctx.bookable.length > 1 ? ` with ${who}` : ""}${byClient ? " by the client" : ""}`,
      {
        businessId: ctx.businessId,
        projectId: facts.projectId,
        userId: args.actor.userId,
        visibility: "both",
        metadata: { proposal_id: args.proposalId, assigned_user_id: args.userId, source: args.source },
      }
    );

    // The pipeline only advances from "Awaiting Scheduling". Proposal and payment states are untouched.
    if (facts.projectStatus === "proposal_approved") {
      await setProjectStatus({
        projectId: facts.projectId,
        status: "scheduled",
        userId: args.actor.userId,
        activityType: "shoot_confirmed",
        activityDescription: `Shoot scheduled for ${when}`,
        skipIfSame: true,
      });
    }

    await notifyAdmins({
      businessId: ctx.businessId,
      projectId: facts.projectId,
      type: "shoot_proposed",
      eventKey: args.rescheduled ? "shoot_rescheduled" : "shoot_time_confirmed",
      title: byClient ? (args.rescheduled ? "Client rescheduled a shoot" : "New shoot booked") : args.rescheduled ? "Shoot rescheduled" : "Shoot scheduled",
      body: `${facts.clientName} · ${facts.propertyAddress ?? facts.projectName} · ${when}${ctx.bookable.length > 1 ? ` · ${who}` : ""}`,
      link: `/admin/calendar?shoot=${args.proposalId}`,
      idempotencyKey: `booking:${args.proposalId}:admin`,
      excludeUserIds: newlyAdded ? [args.userId] : undefined,
    });
    await notifyProjectClients({
      businessId: ctx.businessId,
      projectId: facts.projectId,
      type: "shoot_proposed",
      eventKey: args.rescheduled ? "shoot_rescheduled" : "shoot_scheduled",
      title: args.rescheduled ? "Your shoot was rescheduled" : "Your shoot is scheduled",
      body: `Your shoot at ${facts.propertyAddress ?? facts.projectName} is confirmed for ${when}${
        ctx.bookable.length > 1 ? ` with ${who}` : ""
      }.`,
      link: `/dashboard/projects/${facts.projectId}/shoot`,
      idempotencyKey: `booking:${args.proposalId}:client`,
    });
  } catch (err) {
    console.error("[booking] post-confirm side effects failed", {
      proposalId: args.proposalId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── cancel ─────────────────────────────────────────────────────────────────

export async function cancelAppointment(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  input: { actor: BookingActor; reason?: string | null }
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const appt = facts.appointment;
  if (!appt || appt.status !== "confirmed") return { ok: false, status: 404, message: "There is no scheduled shoot to cancel." };
  const { error } = await ctx.db
    .from("shoot_proposals")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: input.actor.kind,
      cancel_reason: input.reason?.trim().slice(0, 500) || null,
    })
    .eq("id", appt.id);
  if (error) return { ok: false, status: 500, message: "Couldn't cancel the shoot. Please try again." };

  try {
    await setSchedulingStatus(ctx, facts.projectId, "cancelled");
    await syncShootToGoogleSafe(ctx.businessId, appt.id, "delete");
    await syncShootToOutlookSafe(ctx.businessId, appt.id, "delete");
    const when = whenLabel(ctx, appt.start);
    const byClient = input.actor.kind === "client";
    await logProjectActivity("shoot_cancelled", `Shoot on ${when} cancelled${byClient ? " by the client" : ""}`, {
      businessId: ctx.businessId,
      projectId: facts.projectId,
      userId: input.actor.userId,
      visibility: "both",
      metadata: { proposal_id: appt.id, reason: input.reason ?? null },
    });
    await notifyAdmins({
      businessId: ctx.businessId,
      projectId: facts.projectId,
      type: "schedule_change_requested",
      eventKey: "shoot_time_declined",
      title: byClient ? "Client cancelled a shoot" : "Shoot cancelled",
      body: `${facts.clientName} · ${facts.propertyAddress ?? facts.projectName} · ${when}${input.reason ? ` — “${input.reason}”` : ""}`,
      link: `/admin/projects/${facts.projectId}`,
    });
    await notifyProjectClients({
      businessId: ctx.businessId,
      projectId: facts.projectId,
      type: "schedule_change_requested",
      eventKey: "shoot_time_declined",
      title: "Your shoot was cancelled",
      body: `The shoot at ${facts.propertyAddress ?? facts.projectName} on ${when} was cancelled. You can book a new time anytime from your project.`,
      link: `/dashboard/projects/${facts.projectId}/shoot`,
    });
  } catch (err) {
    console.error("[booking] post-cancel side effects failed", err instanceof Error ? err.message : err);
  }
  return { ok: true };
}

// ── reassign ───────────────────────────────────────────────────────────────

export async function reassignAppointment(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  input: { userId: string; actor: BookingActor; override?: { reason: string } | null }
): Promise<{ ok: true } | { ok: false; message: string; status: number; violations?: string[] }> {
  const appt = facts.appointment;
  if (!appt || appt.status !== "confirmed") return { ok: false, status: 404, message: "There is no scheduled shoot to reassign." };
  if (appt.assignedUserId === input.userId) return { ok: true };
  if (!ctx.team.some((m) => m.userId === input.userId)) return { ok: false, status: 400, message: "Unknown team member." };

  const evaluation = await evaluateFor(ctx, facts, input.userId, appt.start, appt.id);
  const blocking = (evaluation?.violations ?? []).filter((v) => v !== "too_soon" && v !== "too_far_ahead");
  const override = input.override?.reason?.trim() ? input.override : null;
  if (blocking.length && !override) {
    return {
      ok: false,
      status: 409,
      message: "This team member isn't free for this shoot.",
      violations: blocking.map((v) => VIOLATION_COPY[v] ?? v),
    };
  }
  const { error } = await ctx.db
    .from("shoot_proposals")
    .update({
      assigned_user_id: input.userId,
      ...(override ? { conflict_override: true, override_reason: override.reason.slice(0, 500), override_by: input.actor.userId } : {}),
    })
    .eq("id", appt.id);
  if (error) {
    if (isConflictError(error)) return { ok: false, status: 409, message: "That team member was just booked at this time." };
    return { ok: false, status: 500, message: "Couldn't reassign the shoot." };
  }
  try {
    await ensureProjectStaff(ctx, facts.projectId, input.userId, input.actor.userId);
    await syncShootToGoogleSafe(ctx.businessId, appt.id, "upsert");
    await syncShootToOutlookSafe(ctx.businessId, appt.id, "upsert");
    await notifyAssignee(ctx, facts, input.userId, input.actor.userId, appt.start);
    await logProjectActivity(
      "shoot_reassigned",
      `Shoot reassigned from ${appt.assignedUserId ? memberName(ctx, appt.assignedUserId) : "unassigned"} to ${memberName(ctx, input.userId)}${override ? " (admin override)" : ""}`,
      {
        businessId: ctx.businessId,
        projectId: facts.projectId,
        userId: input.actor.userId,
        visibility: "admin",
        metadata: { proposal_id: appt.id, from: appt.assignedUserId, to: input.userId, override: override?.reason ?? null },
      }
    );
  } catch (err) {
    console.error("[booking] post-reassign side effects failed", err instanceof Error ? err.message : err);
  }
  return { ok: true };
}

// ── client self-service rules ──────────────────────────────────────────────

export function clientChangeAllowed(
  ctx: BookingContext,
  facts: BookingProjectFacts,
  kind: "reschedule" | "cancel",
  nowMs = Date.now()
): { allowed: boolean; reason: string | null; deadline: string | null } {
  const appt = facts.appointment;
  if (!appt || appt.status !== "confirmed") return { allowed: false, reason: "No scheduled shoot.", deadline: null };
  const enabled = kind === "reschedule" ? ctx.booking.allowClientReschedule : ctx.booking.allowClientCancel;
  const hours = kind === "reschedule" ? ctx.booking.rescheduleNoticeHours : ctx.booking.cancelNoticeHours;
  if (!enabled) return { allowed: false, reason: `Contact us to ${kind} this shoot.`, deadline: null };
  const deadlineMs = appt.start - hours * 60 * MINUTE;
  const deadline = new Date(deadlineMs).toISOString();
  if (nowMs > deadlineMs) {
    return {
      allowed: false,
      reason: `Online ${kind === "reschedule" ? "rescheduling" : "cancellation"} closes ${hours} hours before the shoot. Please message us.`,
      deadline,
    };
  }
  return { allowed: true, reason: null, deadline };
}
