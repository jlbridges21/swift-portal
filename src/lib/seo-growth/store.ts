import { createServiceClient } from "@/lib/supabase/server";
import { writePlatformAudit } from "@/lib/platform-audit";

/**
 * Persistence for the SEO Growth Engine, reusing platform_audit_log (append-only, super-admin
 * read via RLS, service-role writes). No new tables or migrations.
 *
 *  - seo.opportunity.{reviewed|dismissed|reopened}: latest entry per opportunity id wins.
 *  - seo.index_snapshot: compact Google index counts recorded whenever URL Inspection
 *    actually runs (at most once per cache period), so indexing changes can be compared.
 *
 * Callers MUST have passed requireSuperAdminPage()/requireSuperAdminApi() first.
 */

export const REVIEW_STATUSES = ["reviewed", "dismissed", "reopened"] as const;
export type ReviewAction = (typeof REVIEW_STATUSES)[number];
export type ReviewState = { status: "open" | "reviewed" | "dismissed"; note: string | null; at: string; by: string | null };

export async function loadReviewStates(): Promise<{ states: Map<string, ReviewState>; error: string | null }> {
  const db = await createServiceClient();
  const { data, error } = await db
    .from("platform_audit_log")
    .select("action, target_id, metadata, actor_email, created_at")
    .in(
      "action",
      REVIEW_STATUSES.map((s) => `seo.opportunity.${s}`)
    )
    .order("created_at", { ascending: false })
    .limit(2000);
  const states = new Map<string, ReviewState>();
  if (error) return { states, error: error.message };
  for (const row of data ?? []) {
    const id = row.target_id as string | null;
    if (!id || states.has(id)) continue;
    const action = (row.action as string).replace("seo.opportunity.", "") as ReviewAction;
    const note = (row.metadata as { note?: unknown } | null)?.note;
    states.set(id, {
      status: action === "reopened" ? "open" : action,
      note: typeof note === "string" && note ? note : null,
      at: row.created_at as string,
      by: (row.actor_email as string | null) ?? null,
    });
  }
  return { states, error: null };
}

export async function recordReview(entry: { actorUserId: string; actorEmail: string | null; opportunityId: string; action: ReviewAction; note: string | null }) {
  await writePlatformAudit({
    actorUserId: entry.actorUserId,
    actorEmail: entry.actorEmail,
    action: `seo.opportunity.${entry.action}`,
    targetType: "seo_opportunity",
    targetId: entry.opportunityId,
    metadata: entry.note ? { note: entry.note } : null,
  });
}

export type IndexSnapshot = {
  at: string;
  inspected: number;
  indexed: number;
  waiting: number;
  unknown: number;
  other: number;
  /** Paths indexed at snapshot time (short list; the monitored set is ~60 pages). */
  indexedPaths: string[];
};

/** Called from inside the cached inspection run, so there is no request context (ip null). */
export async function recordIndexSnapshot(s: Omit<IndexSnapshot, "at">) {
  await writePlatformAudit({
    actorUserId: null,
    actorEmail: "system:seo-growth",
    action: "seo.index_snapshot",
    targetType: "seo_index",
    targetId: null,
    metadata: s,
    ipAddress: null,
  });
}

export async function loadIndexHistory(limit = 30): Promise<IndexSnapshot[]> {
  const db = await createServiceClient();
  const { data, error } = await db
    .from("platform_audit_log")
    .select("metadata, created_at")
    .eq("action", "seo.index_snapshot")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? [])
    .map((r) => ({ ...(r.metadata as Omit<IndexSnapshot, "at">), at: r.created_at as string }))
    .filter((s) => typeof s.inspected === "number")
    .reverse();
}
