/**
 * Appointment details for the business calendar modal and the client shoot page:
 * schedule, people, money summary, and the route (previous → this → next stop).
 */
import { createServiceClient } from "@/lib/supabase/server";
import { getProjectHeroPosterUrlMap } from "@/lib/cover";
import { computeRoute, metersToMiles, routesConfigured, staticMapUrl, type MapMarker } from "@/lib/booking/routes";
import { evaluateFor, rowToAppointment, type Appointment, type BookingContext, type BookingProjectFacts } from "@/lib/booking/server";
import { zonedParts } from "@/lib/booking/time";
import { isRoutesTravelLine } from "@/lib/booking/travel-pricing";
import { isTravelLineDescription } from "@/lib/travel-fee";
import { VIOLATION_COPY } from "@/lib/booking/engine";

export type Stop = {
  proposalId: string | null;
  projectId: string | null;
  label: string;
  address: string | null;
  start: string | null;
  end: string | null;
};

export type Leg = { minutes: number | null; miles: number | null; polyline: string | null };

export type EstimateSummary = {
  kind: "preliminary" | "official";
  status: string;
  totalCents: number;
  lines: { description: string; amountCents: number; travel: boolean }[];
} | null;

export async function loadEstimateSummary(ctx: BookingContext, projectId: string): Promise<EstimateSummary> {
  const { data } = await ctx.db
    .from("project_quotes")
    .select("quote_kind, status, total_cents, line_items, created_at")
    .eq("project_id", projectId)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(5);
  const rows = data ?? [];
  const pick = rows.find((r) => r.quote_kind === "official") ?? rows.find((r) => r.quote_kind === "preliminary");
  if (!pick) return null;
  const lines = Array.isArray(pick.line_items) ? (pick.line_items as { description?: string; amount_cents?: number }[]) : [];
  return {
    kind: pick.quote_kind === "official" ? "official" : "preliminary",
    status: String(pick.status),
    totalCents: Number(pick.total_cents ?? 0),
    lines: lines.map((l) => {
      const description = String(l.description ?? "");
      return {
        description,
        amountCents: Number(l.amount_cents ?? 0),
        travel: isRoutesTravelLine(description) || isTravelLineDescription(description),
      };
    }),
  };
}

async function sameDayStops(ctx: BookingContext, appt: Appointment) {
  const dayKey = zonedParts(appt.start, ctx.timeZone).dayKey;
  const from = new Date(appt.start - 24 * 3600_000).toISOString();
  const to = new Date(appt.start + 24 * 3600_000).toISOString();
  let query = ctx.db
    .from("shoot_proposals")
    .select("id, project_id, proposed_at, end_at, status, assigned_user_id, buffer_before_minutes, buffer_after_minutes, appointment_key, projects(project_name, property_address)")
    .eq("status", "confirmed")
    .gte("proposed_at", from)
    .lte("proposed_at", to)
    .order("proposed_at", { ascending: true });
  if (appt.assignedUserId && appt.assignedUserId !== ctx.ownerId) query = query.eq("assigned_user_id", appt.assignedUserId);
  const { data } = await query;
  const rows = (data ?? []).filter((row) => {
    const a = rowToAppointment(row as Record<string, unknown>, ctx.ownerId);
    return a.assignedUserId === appt.assignedUserId && zonedParts(a.start, ctx.timeZone).dayKey === dayKey;
  });
  const list = rows.map((row) => {
    const a = rowToAppointment(row as Record<string, unknown>, ctx.ownerId);
    const project = (row as { projects?: { project_name?: string; property_address?: string } | null }).projects;
    return { appt: a, address: project?.property_address?.trim() || null, name: project?.project_name ?? "Shoot" };
  });
  const idx = list.findIndex((s) => s.appt.id === appt.id);
  return { previous: idx > 0 ? list[idx - 1] : null, next: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null, count: list.length };
}

function toStop(s: { appt: Appointment; address: string | null; name: string } | null, label: string): Stop | null {
  if (!s) return null;
  return {
    proposalId: s.appt.id,
    projectId: s.appt.projectId,
    label: s.name || label,
    address: s.address,
    start: new Date(s.appt.start).toISOString(),
    end: new Date(s.appt.end).toISOString(),
  };
}

export type RouteContext = {
  previous: Stop | null;
  current: Stop;
  next: Stop | null;
  /** First stop of the day starts from the base; last returns to it. */
  startsFromBase: boolean;
  endsAtBase: boolean;
  base: string | null;
  legIn: Leg;
  legOut: Leg;
  shootsThatDay: number;
};

export async function loadRouteContext(ctx: BookingContext, facts: BookingProjectFacts, appt: Appointment): Promise<RouteContext> {
  const stops = await sameDayStops(ctx, appt);
  const member = ctx.team.find((m) => m.userId === appt.assignedUserId);
  const base = member?.profile.baseAddress?.trim() || ctx.businessAddress;
  const current: Stop = {
    proposalId: appt.id,
    projectId: facts.projectId,
    label: facts.projectName,
    address: facts.propertyAddress,
    start: new Date(appt.start).toISOString(),
    end: new Date(appt.end).toISOString(),
  };
  const fromAddr = stops.previous?.address ?? base;
  const toAddr = stops.next?.address ?? base;
  const [legIn, legOut] = await Promise.all([
    fromAddr && facts.propertyAddress ? computeRoute(fromAddr, facts.propertyAddress) : Promise.resolve(null),
    toAddr && facts.propertyAddress ? computeRoute(facts.propertyAddress, toAddr) : Promise.resolve(null),
  ]);
  const leg = (r: Awaited<ReturnType<typeof computeRoute>>): Leg => ({
    minutes: r ? Math.ceil(r.durationSeconds / 60) : null,
    miles: r ? metersToMiles(r.distanceMeters) : null,
    polyline: r?.polyline ?? null,
  });
  return {
    previous: toStop(stops.previous, "Previous stop"),
    current,
    next: toStop(stops.next, "Next stop"),
    startsFromBase: !stops.previous,
    endsAtBase: !stops.next,
    base,
    legIn: leg(legIn),
    legOut: leg(legOut),
    shootsThatDay: stops.count,
  };
}

export function routeMapUrl(route: RouteContext): string | null {
  if (!routesConfigured() || !route.current.address) return null;
  const markers: MapMarker[] = [];
  const startAddr = route.previous?.address ?? route.base;
  const endAddr = route.next?.address ?? route.base;
  if (startAddr) markers.push({ address: startAddr, label: route.previous ? "A" : "H", color: "0x16a34a" });
  markers.push({ address: route.current.address, label: "B", color: "0x2563eb" });
  if (endAddr && endAddr !== startAddr) markers.push({ address: endAddr, label: route.next ? "C" : "H", color: "0x7c3aed" });
  const polylines = [route.legIn.polyline, route.legOut.polyline].filter((p): p is string => Boolean(p));
  return staticMapUrl({ markers, polylines, width: 640, height: 400 });
}

export function propertyMapUrl(address: string | null): string | null {
  if (!address) return null;
  return staticMapUrl({ markers: [{ address, label: "", color: "0x2563eb" }], polylines: [], width: 640, height: 300, zoom: 15 });
}

export type TeamOption = {
  userId: string;
  name: string;
  title: string;
  avatarUrl: string | null;
  ok: boolean;
  issues: string[];
  current: boolean;
};

export async function teamOptionsFor(ctx: BookingContext, facts: BookingProjectFacts, appt: Appointment): Promise<TeamOption[]> {
  const candidates = ctx.team.filter((m) => m.profile.bookable || m.role === "owner" || m.userId === appt.assignedUserId);
  return Promise.all(
    candidates.map(async (m) => {
      const current = m.userId === appt.assignedUserId;
      const ev = current ? null : await evaluateFor(ctx, facts, m.userId, appt.start, appt.id);
      const issues = (ev?.violations ?? []).filter((v) => v !== "too_soon" && v !== "too_far_ahead");
      return {
        userId: m.userId,
        name: m.name,
        title: m.profile.displayTitle || (m.role === "staff" ? "Photographer" : "Owner"),
        avatarUrl: m.avatarUrl,
        ok: current || issues.length === 0,
        issues: issues.map((v) => VIOLATION_COPY[v] ?? v),
        current,
      };
    })
  );
}

export async function coverUrlFor(ctx: BookingContext, projectId: string): Promise<string | null> {
  try {
    const { data } = await ctx.db.from("projects").select("id, cover_image_id, cover_image_url").eq("id", projectId).maybeSingle();
    if (!data) return null;
    const map = await getProjectHeroPosterUrlMap(
      [{ id: data.id as string, cover_image_id: data.cover_image_id as string | null, cover_image_url: data.cover_image_url as string | null }],
      ctx.businessId
    );
    return map[projectId] ?? null;
  } catch {
    return null;
  }
}

export async function avatarFor(userId: string | null): Promise<{ name: string; avatarUrl: string | null } | null> {
  if (!userId) return null;
  const raw = await createServiceClient();
  const { data } = await raw.from("profiles").select("full_name, email, avatar_url").eq("id", userId).maybeSingle();
  if (!data) return null;
  return { name: (data.full_name as string) || (data.email as string) || "Photographer", avatarUrl: (data.avatar_url as string | null) ?? null };
}
