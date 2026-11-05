import { createClient } from "@/lib/supabase/server";
import { listBusinessServices } from "@/lib/business-services";
import {
  aggregateDashboardAnalytics,
  rangeBoundsUtc,
  safeTimeZone,
  type AnalyticsLeadRow,
  type AnalyticsPaymentRow,
  type AnalyticsProjectRow,
  type AnalyticsRange,
  type AnalyticsServiceDef,
  type DashboardAnalytics,
} from "@/lib/dashboard-analytics";

/**
 * Loads Command Center analytics for one business and one date range.
 *
 * Every query is filtered by business_id (and runs under the signed-in admin's RLS);
 * the aggregator drops any row whose business_id differs as a second guard. Only
 * narrow columns inside the selected range are read, paged 1,000 rows at a time.
 *
 * Refunds: client payment refunds are not stored (payments has no refunded amount
 * or refund date, and the Connect webhook does not handle charge.refunded), so
 * refundsTracked is false and the UI says so.
 */

const PAGE = 1000;
const MAX_ROWS = 50_000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function fetchAllPages<T>(label: string, page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`[dashboard-analytics] ${label}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
  console.warn(`[dashboard-analytics] ${label} hit the ${MAX_ROWS}-row cap; totals may be incomplete.`);
  return out;
}

type PaymentQueryRow = {
  id: string;
  business_id: string;
  project_id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  projects: { deleted_at: string | null } | { deleted_at: string | null }[] | null;
};

function projectDeleted(p: PaymentQueryRow["projects"]): boolean {
  const row = Array.isArray(p) ? p[0] : p;
  return Boolean(row?.deleted_at);
}

const PAYMENT_COLUMNS = "id, business_id, project_id, amount, status, paid_at, created_at, updated_at, projects(deleted_at)";

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export async function loadDashboardAnalytics(
  businessId: string,
  range: AnalyticsRange,
  timeZoneRaw: string
): Promise<DashboardAnalytics> {
  const timeZone = safeTimeZone(timeZoneRaw);
  const { start, end } = rangeBoundsUtc(range, timeZone);
  const supabase = await createClient();

  const [paidRows, issuedRows, projectRows, leadRows, serviceRows] = await Promise.all([
    fetchAllPages<PaymentQueryRow>("payments received", (a, b) =>
      supabase
        .from("payments")
        .select(PAYMENT_COLUMNS)
        .eq("business_id", businessId)
        .eq("status", "paid")
        .or(
          `and(paid_at.gte."${start}",paid_at.lt."${end}"),and(paid_at.is.null,updated_at.gte."${start}",updated_at.lt."${end}")`
        )
        .order("id", { ascending: true })
        .range(a, b) as unknown as PageResult<PaymentQueryRow>
    ),
    fetchAllPages<PaymentQueryRow>("invoices issued", (a, b) =>
      supabase
        .from("payments")
        .select(PAYMENT_COLUMNS)
        .eq("business_id", businessId)
        .not("status", "in", "(draft,cancelled,expired)")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("id", { ascending: true })
        .range(a, b) as unknown as PageResult<PaymentQueryRow>
    ),
    fetchAllPages<{ id: string; business_id: string; created_at: string; service_id: string | null; service_type: string | null }>(
      "projects",
      (a, b) =>
        supabase
          .from("projects")
          .select("id, business_id, created_at, service_id, service_type")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .gte("created_at", start)
          .lt("created_at", end)
          .order("id", { ascending: true })
          .range(a, b)
    ),
    fetchAllPages<{ id: string; business_id: string; created_at: string }>("leads", (a, b) =>
      supabase
        .from("leads")
        .select("id, business_id, created_at")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("id", { ascending: true })
        .range(a, b)
    ),
    listBusinessServices(businessId),
  ]);

  // Configured services (active and archived, so older projects keep their label).
  const services: AnalyticsServiceDef[] = serviceRows.map((s) => ({ key: s.id, label: s.name, order: s.display_order }));
  const byId = new Set(serviceRows.map((s) => s.id));
  const byName = new Map<string, string>();
  for (const s of serviceRows) {
    for (const name of [s.name, ...s.aliases]) {
      const n = normalizeName(name);
      if (n && !byName.has(n)) byName.set(n, s.id);
    }
  }

  // Today a project links one service (projects.service_id). Projects saved before
  // service_id existed fall back to an exact name/alias match on service_type, then
  // to the stored service name itself.
  const extraDefs = new Map<string, string>();
  const projects: AnalyticsProjectRow[] = projectRows.map((p) => {
    let key: string | null = null;
    if (p.service_id && byId.has(p.service_id)) key = p.service_id;
    else {
      const n = normalizeName(p.service_type);
      if (n && byName.has(n)) key = byName.get(n)!;
      else if (n) {
        key = `type:${n}`;
        if (!extraDefs.has(key)) extraDefs.set(key, (p.service_type ?? "").trim());
      }
    }
    return { id: p.id, business_id: p.business_id, created_at: p.created_at, service_keys: key ? [key] : [] };
  });
  for (const [key, label] of extraDefs) services.push({ key, label });

  const paymentMap = new Map<string, AnalyticsPaymentRow>();
  for (const r of [...paidRows, ...issuedRows]) {
    if (paymentMap.has(r.id)) continue;
    paymentMap.set(r.id, {
      id: r.id,
      business_id: r.business_id,
      project_id: r.project_id,
      amount: Number(r.amount) || 0,
      status: r.status,
      paid_at: r.paid_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      project_deleted: projectDeleted(r.projects),
    });
  }

  const leads: AnalyticsLeadRow[] = leadRows.map((l) => ({ id: l.id, business_id: l.business_id, created_at: l.created_at }));

  const result = aggregateDashboardAnalytics({
    businessId,
    range,
    timeZone,
    payments: [...paymentMap.values()],
    refunds: [],
    refundsTracked: false,
    projects,
    leads,
    services,
  });

  if (result.foreignRowsDropped > 0) {
    console.error("[dashboard-analytics] dropped rows from another business", {
      businessId,
      dropped: result.foreignRowsDropped,
    });
  }
  return result;
}
