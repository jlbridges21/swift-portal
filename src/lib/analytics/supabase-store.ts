import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import type { AnalyticsStore, EventRow, SessionRow } from "@/lib/analytics/ingest";

/**
 * Service-role store for the write-only collector. Only touches analytics_* tables
 * (RLS on, no policies). Never reads tenant data.
 */

const saltCache = new Map<string, string>();

export function createSupabaseAnalyticsStore(): AnalyticsStore {
  return {
    async getDailySalt(day) {
      const cached = saltCache.get(day);
      if (cached) return cached;
      const db = await createServiceClient();
      await db
        .from("analytics_daily_salts")
        .upsert({ day, salt: randomBytes(32).toString("base64url") }, { onConflict: "day", ignoreDuplicates: true });
      const { data, error } = await db.from("analytics_daily_salts").select("salt").eq("day", day).single();
      if (error || !data) throw new Error(`analytics salt unavailable: ${error?.message ?? "missing"}`);
      saltCache.clear();
      saltCache.set(day, data.salt as string);
      return data.salt as string;
    },
    async findRecentSessionId(visitorKey, sinceIso) {
      const db = await createServiceClient();
      const { data } = await db
        .from("analytics_events")
        .select("session_id")
        .eq("visitor_key", visitorKey)
        .gte("occurred_at", sinceIso)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.session_id as string | undefined) ?? null;
    },
    async ensureSession(row: SessionRow) {
      const db = await createServiceClient();
      const { error } = await db.from("analytics_sessions").upsert(row, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(`analytics session insert failed: ${error.message}`);
    },
    async insertEvent(row: EventRow) {
      const db = await createServiceClient();
      const { error } = await db
        .from("analytics_events")
        .upsert(row, { onConflict: "client_event_id", ignoreDuplicates: true });
      if (error) throw new Error(`analytics event insert failed: ${error.message}`);
    },
  };
}
