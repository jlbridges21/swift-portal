/**
 * LIVE check of Instant Booking against the real database, Google Routes and Google Calendar.
 * WRITES LIVE DATA. Run it deliberately, never in CI or in a loop.
 *
 * Uses Swift Aerial Media (the owner's own business, which has Google Calendar connected), two
 * "[TEST]" projects with no client, in-memory setting overrides only (nothing saved to settings),
 * and deletes everything it creates: projects, appointments, holds, activity, notifications and
 * Google events. Creates and deletes a few events on the connected Google calendar ~9 days out.
 *
 * Mute email/push while running:
 *   RESEND_API_KEY= ONESIGNAL_REST_API_KEY= WEB_PUSH_VAPID_PRIVATE_KEY= \
 *     npx tsx --env-file=.env.local scripts/live-check-instant-booking.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  checkStart,
  computeAvailability,
  createHold,
  loadBookingContext,
  loadProjectBookingFacts,
  travelSnapshotForRequest,
  type BookingContext,
} from "../src/lib/booking/server";
import { cancelAppointment, confirmAppointment, reassignAppointment } from "../src/lib/booking/actions";
import { computeRoute, driveBetween, staticMapUrl } from "../src/lib/booking/routes";
import { bookableMembers } from "../src/lib/booking/team";
import { getGoogleCalendarAccess } from "../src/lib/google-calendar";
import { addDaysToKey, weekdayOfKey, zonedParts } from "../src/lib/booking/time";

const B = "00000000-0000-0000-0000-000000000001";
const OWNER = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const ADMIN = "7ca53cbd-986d-49fd-96d9-5188b630676d";
const BASE = "675 Ponce De Leon Ave NE, Atlanta, GA 30308";
const PROP_A = "1 AMB Dr NW, Atlanta, GA 30313";
const PROP_B = "1 Olympic Pl, Atlanta, GA 30313";
const MIN = 60_000;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const results: { name: string; ok: boolean; detail: string }[] = [];
function record(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const created = { projects: [] as string[], googleEvents: [] as { cal: string; id: string }[] };
let token = "";
let calId = "";

async function gcal(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, json };
}

async function eventFor(proposalId: string) {
  const { data } = await sb
    .from("shoot_proposals")
    .select("google_event_id, google_calendar_id, google_sync_status, google_sync_error")
    .eq("id", proposalId)
    .single();
  return data as { google_event_id: string | null; google_calendar_id: string | null; google_sync_status: string | null; google_sync_error: string | null };
}

async function makeProject(label: string, address: string) {
  const { data, error } = await sb
    .from("projects")
    .insert({
      business_id: B,
      project_name: `[TEST] Instant Booking live check ${label} (safe to delete)`,
      property_address: address,
      client_id: null,
      service_type: "Photography",
    })
    .select("id")
    .single();
  if (error) throw new Error(`project insert: ${error.message}`);
  created.projects.push(data.id);
  return data.id as string;
}

function overrideCtx(ctx: BookingContext) {
  // In memory only: base address + Google busy calendar. Nothing is written to settings.
  ctx.settings = {
    ...ctx.settings,
    business: { ...ctx.settings.business, addressLine1: "675 Ponce De Leon Ave NE", city: "Atlanta", state: "GA", postalCode: "30308" },
    booking: { ...ctx.settings.booking, blockCalendarIds: [calId] },
  };
  ctx.booking = ctx.settings.booking;
  ctx.businessAddress = BASE;
  ctx.bookable = bookableMembers(ctx.team, ctx.settings);
}

async function main() {
  const access = await getGoogleCalendarAccess(B);
  if (!access.ok) throw new Error(`Google access: ${access.error}`);
  token = access.token;
  calId = access.defaultCalendarId;
  record("Google Calendar token refresh", true, `calendar ${calId === "primary" ? "primary" : "custom"}`);

  // ── Routes ───────────────────────────────────────────────────────────
  const leg = await computeRoute(BASE, PROP_A);
  record("Routes computeRoute", Boolean(leg && leg.distanceMeters > 0 && leg.polyline), leg ? `${(leg.distanceMeters / 1609.34).toFixed(1)} mi, ${Math.round(leg.durationSeconds / 60)} min, polyline ${leg.polyline?.length ?? 0} chars` : "null");

  const dbClient = (await loadBookingContext(B)).db;
  const d1 = await driveBetween(dbClient, PROP_A, PROP_B);
  const { count: cacheRows } = await sb.from("route_cache").select("*", { count: "exact", head: true }).eq("business_id", B);
  const t0 = Date.now();
  const d2 = await driveBetween(dbClient, PROP_A, PROP_B);
  const cachedMs = Date.now() - t0;
  record("Routes matrix + route_cache", Boolean(d1 && d2 && d1.miles === d2.miles && (cacheRows ?? 0) > 0), d1 ? `${d1.miles.toFixed(1)} mi / ${d1.minutes} min; cache rows ${cacheRows}; cached lookup ${cachedMs} ms` : "null");

  const base = await loadBookingContext(B);
  overrideCtx(base);
  const pricing = {
    ...base.settings,
    booking: { ...base.settings.booking, travel: { ...base.settings.booking.travel, model: "per_mile" as const, freeMiles: 0, perMileCents: 100 } },
  };
  const snap = await travelSnapshotForRequest({ businessId: B, settings: pricing, propertyAddress: "100 Peachtree Industrial Blvd, Sugar Hill, GA 30518", servicesRequireQuote: false, hidePricing: false });
  record("Travel fee from Routes distance (per-mile)", Boolean(snap.lineItem && snap.miles && snap.lineItem.amount_cents > 0), snap.lineItem ? `${snap.lineItem.description} = $${(snap.lineItem.amount_cents / 100).toFixed(2)}` : snap.note ?? "no line");

  const mapUrl = staticMapUrl({ markers: [{ address: BASE, label: "A", color: "blue" }, { address: PROP_A, label: "B", color: "red" }], polylines: leg?.polyline ? [leg.polyline] : [], width: 600, height: 300 });
  const mapRes = mapUrl ? await fetch(mapUrl) : null;
  record("Maps Static API image", Boolean(mapRes?.ok && mapRes.headers.get("content-type")?.startsWith("image/")), mapRes ? `${mapRes.status} ${mapRes.headers.get("content-type")} ${(Number(mapRes.headers.get("content-length")) / 1024).toFixed(0)} KB` : "no url");

  // ── test projects + a weekday ~9 days out ─────────────────────────────
  const A = await makeProject("A", PROP_A);
  const Bp = await makeProject("B", PROP_B);
  let day = addDaysToKey(zonedParts(Date.now(), base.timeZone).dayKey, 9);
  while ([0, 6].includes(weekdayOfKey(day))) day = addDaysToKey(day, 1);
  console.log(`test day ${day} (${base.timeZone}); projects A=${A.slice(0, 8)} B=${Bp.slice(0, 8)}`);

  let ctx = await loadBookingContext(B);
  overrideCtx(ctx);
  let fa = (await loadProjectBookingFacts(ctx, A))!;
  const avail = await computeAvailability(ctx, { facts: fa, fromDay: day, toDay: day, onlyUserIds: [OWNER] });
  record("Availability for owner on test day", avail.slots.length > 0, `${avail.slots.length} slots, travelKnown=${avail.travelKnown}, blocked=${avail.blockedReason ?? "none"}`);

  // ── Google busy time blocks a slot ────────────────────────────────────
  const free = avail.slots.map((x) => Date.parse(x.start)).sort((a, b) => a - b);
  const pick = (after: number) => free.find((t) => t >= after)!;
  const busyStart = free[0];
  console.log("free slots used:", [busyStart, pick(busyStart + 180 * MIN), pick(busyStart + 360 * MIN)].map((t) => new Date(t).toISOString()).join(", "));
  const busy = await gcal("POST", "/events", {
    summary: "[TEST] ShootPortal busy-block check (auto-deleted)",
    start: { dateTime: new Date(busyStart).toISOString() },
    end: { dateTime: new Date(busyStart + 60 * MIN).toISOString() },
    transparency: "opaque",
  });
  if (busy.json?.id) created.googleEvents.push({ cal: calId, id: busy.json.id });
  const blocked = await checkStart(ctx, fa, busyStart, { userId: OWNER });
  const viol = blocked.ranked[0]?.violations ?? [];
  record("Google busy event blocks that time", !blocked.chosen && viol.length > 0, `violations: ${viol.join(", ") || "none"}`);
  await gcal("DELETE", `/events/${busy.json?.id}`);
  created.googleEvents = created.googleEvents.filter((e) => e.id !== busy.json?.id);
  const freed = await checkStart(ctx, fa, busyStart, { userId: OWNER });
  record("Same time opens after the Google event is removed", Boolean(freed.chosen), freed.chosen ? "ok" : (freed.ranked[0]?.violations ?? []).join(", "));

  // ── Hold blocks another client's instant confirm ──────────────────────
  const S2 = pick(busyStart + 180 * MIN);
  const hold = await createHold(ctx, fa, OWNER, S2);
  record("Hold created", Boolean(hold), hold ? `expires ${hold.expiresAt}` : "null");
  let fb = (await loadProjectBookingFacts(ctx, Bp))!;
  const stolen = await confirmAppointment(ctx, fb, { startMs: S2, userId: OWNER, source: "instant", actor: { kind: "client", userId: null } });
  record("Another client can't book a held time", !stolen.ok, stolen.ok ? "BOOKED (bad)" : `${stolen.code}: ${stolen.message}`);
  await sb.from("booking_holds").delete().eq("project_id", A);

  // ── Race: two confirms for the same person and time ───────────────────
  ctx = await loadBookingContext(B);
  overrideCtx(ctx);
  fa = (await loadProjectBookingFacts(ctx, A))!;
  fb = (await loadProjectBookingFacts(ctx, Bp))!;
  const actor = { kind: "business" as const, userId: OWNER };
  const [r1, r2] = await Promise.all([
    confirmAppointment(ctx, fa, { startMs: S2, userId: OWNER, source: "manual", actor }),
    confirmAppointment(ctx, fb, { startMs: S2, userId: OWNER, source: "manual", actor }),
  ]);
  const winners = [r1, r2].filter((r) => r.ok);
  const loser = [r1, r2].find((r) => !r.ok);
  record("Concurrent confirms: exactly one wins", winners.length === 1, `A=${r1.ok ? "booked" : r1.code} B=${r2.ok ? "booked" : r2.code}${loser && !loser.ok ? ` (“${loser.message}”)` : ""}`);
  const winnerProject = r1.ok ? A : Bp;
  const otherProject = r1.ok ? Bp : A;
  const win = (r1.ok ? r1 : r2) as Extract<typeof r1, { ok: true }>;

  const { data: row } = await sb.from("shoot_proposals").select("status,end_at,assigned_user_id,booking_source,buffer_before_minutes,buffer_after_minutes").eq("id", win.proposalId).single();
  const { data: proj } = await sb.from("projects").select("scheduling_status,shoot_date").eq("id", winnerProject).single();
  record("Confirmed row + project scheduling status", row?.status === "confirmed" && Boolean(row?.end_at) && row?.assigned_user_id === OWNER && proj?.scheduling_status === "scheduled", `source=${row?.booking_source} end=${row?.end_at} buffers=${row?.buffer_before_minutes}/${row?.buffer_after_minutes} project=${proj?.scheduling_status} ${proj?.shoot_date}`);

  // ── Exclusion constraint as last line of defence ──────────────────────
  const direct = await sb.from("shoot_proposals").insert({
    business_id: B,
    project_id: otherProject,
    proposed_at: new Date(S2 + 30 * MIN).toISOString(),
    end_at: new Date(S2 + 90 * MIN).toISOString(),
    status: "confirmed",
    assigned_user_id: OWNER,
    booking_source: "manual",
    proposed_by: "admin",
  });
  record("DB exclusion constraint rejects a raw overlapping insert", direct.error?.code === "23P01", direct.error ? `${direct.error.code} ${direct.error.message.slice(0, 80)}` : "INSERTED (bad)");

  // ── Google event created ──────────────────────────────────────────────
  let ev = await eventFor(win.proposalId);
  let g = ev.google_event_id ? await gcal("GET", `/events/${ev.google_event_id}`) : null;
  const gStartOk = g?.json?.start?.dateTime && Date.parse(g.json.start.dateTime) === S2;
  const gEndOk = g?.json?.end?.dateTime && Date.parse(g.json.end.dateTime) === Date.parse(win.end);
  record("Google event created on confirm", g?.status === 200 && Boolean(gStartOk && gEndOk), `sync=${ev.google_sync_status}${ev.google_sync_error ? ` err=${ev.google_sync_error}` : ""}; "${g?.json?.summary}"; location="${g?.json?.location ?? ""}"; attendees=${(g?.json?.attendees ?? []).length}; start/end match=${Boolean(gStartOk && gEndOk)}`);
  const firstEventId = ev.google_event_id;

  // ── Reschedule moves the same event ───────────────────────────────────
  const S3 = pick(busyStart + 360 * MIN);
  let fw = (await loadProjectBookingFacts(ctx, winnerProject))!;
  const moved = await confirmAppointment(ctx, fw, { startMs: S3, userId: OWNER, source: "manual", actor });
  const { data: oldRow } = await sb.from("shoot_proposals").select("status").eq("id", win.proposalId).single();
  if (!moved.ok) {
    record("Reschedule", false, `${moved.code}: ${moved.message}`);
  } else {
    ev = await eventFor(moved.proposalId);
    g = ev.google_event_id ? await gcal("GET", `/events/${ev.google_event_id}`) : null;
    record(
      "Reschedule: old row superseded, same Google event moved",
      oldRow?.status === "superseded" && ev.google_event_id === firstEventId && g?.status === 200 && Date.parse(g?.json?.start?.dateTime) === S3,
      `old=${oldRow?.status}; same event id=${ev.google_event_id === firstEventId}; google start=${g?.json?.start?.dateTime}`
    );
  }

  // ── Reassign to another team member ───────────────────────────────────
  fw = (await loadProjectBookingFacts(ctx, winnerProject))!;
  let re = await reassignAppointment(ctx, fw, { userId: ADMIN, actor });
  if (!re.ok && re.status === 409) re = await reassignAppointment(ctx, fw, { userId: ADMIN, actor, override: { reason: "[TEST] live check" } });
  const { data: reRow } = await sb.from("shoot_proposals").select("assigned_user_id,conflict_override").eq("id", fw.appointment!.id).single();
  ev = await eventFor(fw.appointment!.id);
  g = ev.google_event_id ? await gcal("GET", `/events/${ev.google_event_id}`) : null;
  record("Reassign updates row and keeps the Google event", re.ok && reRow?.assigned_user_id === ADMIN && g?.status === 200 && g?.json?.status !== "cancelled", `${re.ok ? "ok" : re.message}; override=${reRow?.conflict_override}; google=${g?.status} ${g?.json?.status}; sync=${ev.google_sync_status}`);

  // ── Cancel removes the Google event ───────────────────────────────────
  fw = (await loadProjectBookingFacts(ctx, winnerProject))!;
  const eventBeforeCancel = ev.google_event_id;
  const cancelled = await cancelAppointment(ctx, fw, { actor, reason: "[TEST] live check" });
  const { data: cRow } = await sb.from("shoot_proposals").select("status").eq("id", fw.appointment!.id).single();
  const { data: cProj } = await sb.from("projects").select("scheduling_status").eq("id", winnerProject).single();
  g = eventBeforeCancel ? await gcal("GET", `/events/${eventBeforeCancel}`) : null;
  const gone = !g || g.status === 404 || g.status === 410 || g.json?.status === "cancelled";
  record("Cancel: row cancelled, project cancelled, Google event removed", cancelled.ok && cRow?.status === "cancelled" && cProj?.scheduling_status === "cancelled" && gone, `row=${cRow?.status} project=${cProj?.scheduling_status} google=${g?.status} ${g?.json?.status ?? ""}`);

  // ── Override books through a conflict, audited ────────────────────────
  ctx = await loadBookingContext(B);
  overrideCtx(ctx);
  fb = (await loadProjectBookingFacts(ctx, otherProject))!;
  const pre = await confirmAppointment(ctx, fb, { startMs: S3, userId: OWNER, source: "manual", actor });
  fa = (await loadProjectBookingFacts(ctx, winnerProject))!;
  const refused = await confirmAppointment(ctx, fa, { startMs: S3 + 30 * MIN, userId: OWNER, source: "manual", actor });
  const forced = await confirmAppointment(ctx, fa, { startMs: S3 + 30 * MIN, userId: OWNER, source: "manual", actor, override: { reason: "[TEST] override check" } });
  const { data: oRow } = forced.ok ? await sb.from("shoot_proposals").select("conflict_override,override_reason,override_by").eq("id", forced.proposalId).single() : { data: null };
  record("Overlap refused without override", pre.ok && !refused.ok, refused.ok ? "BOOKED (bad)" : `${refused.code}: ${(refused.violations ?? []).join("; ")}`);
  record("Admin override books and is audited", forced.ok && oRow?.conflict_override === true && oRow?.override_by === OWNER, forced.ok ? `override=${oRow?.conflict_override} reason="${oRow?.override_reason}"` : forced.message);

  for (const pid of [otherProject, winnerProject]) {
    const f = (await loadProjectBookingFacts(ctx, pid))!;
    if (f.appointment?.status === "confirmed") {
      const evId = (await eventFor(f.appointment.id)).google_event_id;
      await cancelAppointment(ctx, f, { actor, reason: "[TEST] cleanup" });
      if (evId) {
        const chk = await gcal("GET", `/events/${evId}`);
        if (!(chk.status === 404 || chk.status === 410 || chk.json?.status === "cancelled")) created.googleEvents.push({ cal: calId, id: evId });
      }
    }
  }
}

async function cleanup() {
  for (const e of created.googleEvents) await gcal("DELETE", `/events/${e.id}`).catch(() => null);
  const ids = created.projects;
  if (!ids.length) return;
  // Any Google event still attached to these projects' rows.
  const { data: rows } = await sb.from("shoot_proposals").select("id,google_event_id,status").in("project_id", ids);
  for (const r of rows ?? []) {
    if (r.google_event_id) {
      const chk = await gcal("GET", `/events/${r.google_event_id}`);
      if (chk.status === 200 && chk.json?.status !== "cancelled") await gcal("DELETE", `/events/${r.google_event_id}`);
    }
  }
  const counts: Record<string, number | string> = {};
  for (const table of ["booking_holds", "shoot_proposals", "project_staff", "activity_logs"]) {
    const { error, count } = await sb.from(table).delete({ count: "exact" }).in("project_id", ids);
    counts[table] = error ? `err ${error.message}` : count ?? 0;
  }
  let notif = 0;
  for (const id of ids) {
    const { count } = await sb.from("notifications").delete({ count: "exact" }).like("link", `%${id}%`);
    notif += count ?? 0;
  }
  for (const r of rows ?? []) {
    const { count } = await sb.from("notifications").delete({ count: "exact" }).like("link", `%${r.id}%`);
    notif += count ?? 0;
  }
  counts.notifications = notif;
  const { error: pErr, count: pCount } = await sb.from("projects").delete({ count: "exact" }).in("id", ids);
  counts.projects = pErr ? `err ${pErr.message}` : pCount ?? 0;
  const { count: leftover } = await sb.from("shoot_proposals").select("id", { count: "exact", head: true }).in("project_id", ids);
  console.log("cleanup:", JSON.stringify(counts), "leftover proposals:", leftover);
}

main()
  .catch((err) => record("script error", false, err instanceof Error ? err.message : String(err)))
  .finally(async () => {
    await cleanup().catch((e) => console.error("cleanup error", e));
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  });
