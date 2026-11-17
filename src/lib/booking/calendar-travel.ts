/**
 * Drive time around each confirmed shoot, per photographer and day, for the calendar:
 * - into the shoot: from the same photographer's previous shoot that day, or from their base
 *   address for the first shoot of the day;
 * - out of the last shoot of the day: back to their base.
 * Cached Google Routes lookups (route_cache), recent and upcoming shoots only.
 */
import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import { TravelTable } from "@/lib/booking/routes";
import { zonedParts } from "@/lib/booking/time";

type Row = {
  id: string;
  proposed_at: string;
  status: string;
  end_at?: string | null;
  assigned_user_id?: string | null;
  projects: unknown;
};

export type CalendarLeg = {
  minutes: number;
  miles: number;
  /** Where the drive in starts. */
  from: "previous" | "base";
  /** Drive home after the day's last shoot. */
  out?: { minutes: number; miles: number };
};

export async function computeCalendarTravelLegs(
  db: TenantServiceClient,
  rows: Row[],
  timeZone: string,
  ownerId: string | null,
  baseOf: (userId: string | null) => string | null = () => null
): Promise<Record<string, CalendarLeg>> {
  const now = Date.now();
  // Recent and upcoming only: keeps Routes lookups bounded.
  const relevant = rows.filter((r) => r.status === "confirmed" && Math.abs(Date.parse(r.proposed_at) - now) < 45 * 24 * 3600_000);
  const groups = new Map<string, { userId: string | null; list: { id: string; start: number; address: string | null }[] }>();
  for (const r of relevant) {
    const address = ((r.projects as { property_address?: string | null } | null)?.property_address ?? "").trim() || null;
    const start = Date.parse(r.proposed_at);
    const userId = r.assigned_user_id ?? ownerId ?? null;
    const key = `${userId ?? "?"}|${zonedParts(start, timeZone).dayKey}`;
    const group = groups.get(key) ?? { userId, list: [] };
    group.list.push({ id: r.id, start, address });
    groups.set(key, group);
  }

  type Pair = { id: string; from: string; to: string; kind: "previous" | "base" | "home" };
  const pairs: Pair[] = [];
  for (const { userId, list } of groups.values()) {
    list.sort((a, b) => a.start - b.start);
    const base = baseOf(userId);
    for (let i = 0; i < list.length; i++) {
      const to = list[i].address;
      if (!to) continue;
      const from = i === 0 ? base : list[i - 1].address;
      if (from) pairs.push({ id: list[i].id, from, to, kind: i === 0 ? "base" : "previous" });
    }
    const last = list[list.length - 1];
    if (base && last?.address) pairs.push({ id: last.id, from: last.address, to: base, kind: "home" });
  }
  if (!pairs.length) return {};

  const table = new TravelTable(db);
  await table.prefetch(pairs.map((p) => [p.from, p.to]));
  const out: Record<string, CalendarLeg> = {};
  for (const p of pairs) {
    const minutes = table.minutes(p.from, p.to);
    const miles = table.miles(p.from, p.to);
    if (minutes == null || miles == null) continue;
    if (p.kind === "home") {
      out[p.id] = { ...(out[p.id] ?? { minutes: 0, miles: 0, from: "base" as const }), out: { minutes, miles } };
    } else {
      out[p.id] = { ...out[p.id], minutes, miles, from: p.kind };
    }
  }
  return out;
}
