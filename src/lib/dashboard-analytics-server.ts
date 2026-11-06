import { createClient } from "@/lib/supabase/server";
import { listBusinessServices } from "@/lib/business-services";
import {
  aggregateDashboardAnalytics,
  drilldownAttributions,
  rangeBoundsUtc,
  safeTimeZone,
  type AnalyticsLeadRow,
  type AnalyticsPaymentRow,
  type AnalyticsProjectRow,
  type AnalyticsRange,
  type AnalyticsServiceDef,
  type DashboardAnalytics,
  type DashboardAnalyticsInput,
  type DrilldownResponse,
  type DrilldownRow,
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
/** Drill-down tables list at most this many projects (largest activity first). */
const DRILLDOWN_MAX_ROWS = 1000;
const ID_CHUNK = 200;

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

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
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

function one<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

const PAYMENT_COLUMNS = "id, business_id, project_id, amount, status, paid_at, created_at, updated_at, projects(deleted_at)";

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Maps a project to its service key: projects.service_id when it is a configured
 * service, else an exact name/alias match on service_type, else the stored service
 * name itself. Today a project links one service; the aggregator accepts several.
 */
type ServiceResolver = {
  defs: AnalyticsServiceDef[];
  keyFor: (p: { service_id: string | null; service_type: string | null }) => string | null;
  labelFor: (key: string) => string;
};

async function loadServiceResolver(businessId: string): Promise<ServiceResolver> {
  // Active and archived services, so older projects keep their label.
  const rows = await listBusinessServices(businessId);
  const defs: AnalyticsServiceDef[] = rows.map((s) => ({ key: s.id, label: s.name, order: s.display_order }));
  const byId = new Set(rows.map((s) => s.id));
  const byName = new Map<string, string>();
  for (const s of rows) {
    for (const name of [s.name, ...s.aliases]) {
      const n = normalizeName(name);
      if (n && !byName.has(n)) byName.set(n, s.id);
    }
  }
  const labels = new Map(defs.map((d) => [d.key, d.label]));
  return {
    defs,
    keyFor(p) {
      if (p.service_id && byId.has(p.service_id)) return p.service_id;
      const n = normalizeName(p.service_type);
      if (!n) return null;
      if (byName.has(n)) return byName.get(n)!;
      const key = `type:${n}`;
      if (!labels.has(key)) {
        const label = (p.service_type ?? "").trim();
        labels.set(key, label);
        defs.push({ key, label });
      }
      return key;
    },
    labelFor: (key) => labels.get(key) ?? key,
  };
}

/** Raw, business-scoped rows for one range — the input to every analytics calculation. */
async function loadAnalyticsInput(
  businessId: string,
  range: AnalyticsRange,
  timeZoneRaw: string
): Promise<{ input: DashboardAnalyticsInput; services: ServiceResolver }> {
  const timeZone = safeTimeZone(timeZoneRaw);
  const { start, end } = rangeBoundsUtc(range, timeZone);
  const supabase = await createClient();

  const [paidRows, issuedRows, projectRows, leadRows, services] = await Promise.all([
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
    loadServiceResolver(businessId),
  ]);

  const projects: AnalyticsProjectRow[] = projectRows.map((p) => {
    const key = services.keyFor(p);
    return { id: p.id, business_id: p.business_id, created_at: p.created_at, service_keys: key ? [key] : [] };
  });

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
      project_deleted: Boolean(one(r.projects)?.deleted_at),
    });
  }

  const leads: AnalyticsLeadRow[] = leadRows.map((l) => ({ id: l.id, business_id: l.business_id, created_at: l.created_at }));

  return {
    input: {
      businessId,
      range,
      timeZone,
      payments: [...paymentMap.values()],
      refunds: [],
      refundsTracked: false,
      projects,
      leads,
      services: services.defs,
    },
    services,
  };
}

export async function loadDashboardAnalytics(
  businessId: string,
  range: AnalyticsRange,
  timeZoneRaw: string
): Promise<DashboardAnalytics> {
  const { input } = await loadAnalyticsInput(businessId, range, timeZoneRaw);
  const result = aggregateDashboardAnalytics(input);
  if (result.foreignRowsDropped > 0) {
    console.error("[dashboard-analytics] dropped rows from another business", {
      businessId,
      dropped: result.foreignRowsDropped,
    });
  }
  return result;
}

type ProjectDetailRow = {
  id: string;
  business_id: string;
  project_name: string;
  property_address: string | null;
  status: string;
  created_at: string;
  shoot_date: string | null;
  service_id: string | null;
  service_type: string | null;
  clients:
    | { id: string; name: string | null; company: string | null; email: string | null; deleted_at: string | null }
    | { id: string; name: string | null; company: string | null; email: string | null; deleted_at: string | null }[]
    | null;
};

/**
 * Projects behind one chart point or one service slice.
 *   service omitted → every project with activity in the range (new, paid, refunded, or invoiced).
 *   service keys    → projects created in the range with any of those services.
 * Rows carry both revenue views so the table can show either.
 */
export async function loadDashboardDrilldown(
  businessId: string,
  range: AnalyticsRange,
  timeZoneRaw: string,
  serviceKeys: string[] | null
): Promise<DrilldownResponse> {
  const { input, services } = await loadAnalyticsInput(businessId, range, timeZoneRaw);
  const attributions = drilldownAttributions(input, serviceKeys ? { kind: "service", serviceKeys } : { kind: "period" });
  const truncated = attributions.length > DRILLDOWN_MAX_ROWS;
  const picked = attributions.slice(0, DRILLDOWN_MAX_ROWS);
  const ids = picked.map((a) => a.projectId);

  const supabase = await createClient();
  const details = new Map<string, ProjectDetailRow>();
  const lifetime = new Map<string, number>();
  await Promise.all(
    chunks(ids, ID_CHUNK).map(async (part) => {
      const [{ data: projectRows, error: projectError }, { data: paidRows, error: paidError }] = await Promise.all([
        supabase
          .from("projects")
          .select("id, business_id, project_name, property_address, status, created_at, shoot_date, service_id, service_type, clients(id, name, company, email, deleted_at)")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .in("id", part),
        supabase
          .from("payments")
          .select("project_id, amount")
          .eq("business_id", businessId)
          .eq("status", "paid")
          .in("project_id", part),
      ]);
      if (projectError) throw new Error(`[dashboard-analytics] drilldown projects: ${projectError.message}`);
      if (paidError) throw new Error(`[dashboard-analytics] drilldown payments: ${paidError.message}`);
      for (const p of (projectRows ?? []) as ProjectDetailRow[]) {
        if (p.business_id === businessId) details.set(p.id, p);
      }
      for (const r of (paidRows ?? []) as { project_id: string; amount: number }[]) {
        lifetime.set(r.project_id, (lifetime.get(r.project_id) ?? 0) + (Number(r.amount) || 0));
      }
    })
  );

  const rows: DrilldownRow[] = [];
  for (const a of picked) {
    const p = details.get(a.projectId);
    if (!p) continue;
    const client = one(p.clients);
    const keys = a.serviceKeys.length ? a.serviceKeys : [services.keyFor(p)].filter((k): k is string => Boolean(k));
    rows.push({
      id: p.id,
      name: p.project_name,
      address: p.property_address ?? "",
      status: p.status,
      createdAt: p.created_at,
      shootDate: p.shoot_date,
      clientId: client && !client.deleted_at ? client.id : null,
      clientName: client?.name ?? null,
      clientCompany: client?.company ?? null,
      clientEmail: client?.email ?? null,
      services: keys.map(services.labelFor),
      isNew: a.isNew,
      paidCents: a.paidCents,
      refundedCents: a.refundedCents,
      paymentCount: a.paymentCount,
      invoicedCents: a.invoicedCents,
      invoiceCount: a.invoiceCount,
      lifetimePaidCents: lifetime.get(p.id) ?? 0,
    });
  }

  return { range: input.range, timeZone: input.timeZone, rows, truncated, refundsTracked: input.refundsTracked };
}
