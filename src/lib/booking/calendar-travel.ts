/**
 * Drive time into each confirmed shoot from the same photographer's previous shoot that day.
 * Used for the calendar's travel indicators and day route summary. Cached Routes lookups.
 */
import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import { TravelTable } from "@/lib/booking/routes";
import { zonedParts } from "@/lib/booking/time";

type Row = {
  id: string;
  proposed_at: string;
  status: string;
  assigned_user_id?: string | null;
  projects: unknown;
};

export async function computeCalendarTravelLegs(
  db: TenantServiceClient,
  rows: Row[],
  timeZone: string,
  ownerId: string | null
): Promise<Record<string, { minutes: number; miles: number }>> {
  const now = Date.now();
  // Recent and upcoming only: keeps Routes lookups bounded.
  const relevant = rows.filter(
    (r) => r.status === "confirmed" && Math.abs(Date.parse(r.proposed_at) - now) < 45 * 24 * 3600_000
  );
  const groups = new Map<string, { id: string; start: number; address: string | null }[]>();
  for (const r of relevant) {
    const address = ((r.projects as { property_address?: string | null } | null)?.property_address ?? "").trim() || null;
    const start = Date.parse(r.proposed_at);
    const key = `${r.assigned_user_id ?? ownerId ?? "?"}|${zonedParts(start, timeZone).dayKey}`;
    const list = groups.get(key) ?? [];
    list.push({ id: r.id, start, address });
    groups.set(key, list);
  }
  const pairs: { id: string; from: string; to: string }[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      const from = list[i - 1].address;
      const to = list[i].address;
      if (from && to) pairs.push({ id: list[i].id, from, to });
    }
  }
  if (!pairs.length) return {};
  const table = new TravelTable(db);
  await table.prefetch(pairs.map((p) => [p.from, p.to]));
  const out: Record<string, { minutes: number; miles: number }> = {};
  for (const p of pairs) {
    const minutes = table.minutes(p.from, p.to);
    const miles = table.miles(p.from, p.to);
    if (minutes != null && miles != null) out[p.id] = { minutes, miles };
  }
  return out;
}
