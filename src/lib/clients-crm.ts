import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import type { Client, Communication, Payment, Project, Property } from "@/lib/types";
import { normalizeStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import {
  getClientPortalAccountStatus,
  type ClientPortalAccountStatus,
} from "@/lib/client-portal-recovery";

export interface ClientFinancialStats {
  lifetime_revenue: number;
  outstanding_balance: number;
  active_project_count: number;
  delivered_project_count: number;
  total_project_count: number;
  average_project_value: number;
  last_payment_at: string | null;
}

export interface ClientListRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  referral_source: string | null;
  created_at: string;
  last_activity_at: string | null;
  last_login_at: string | null;
  lifetime_revenue: number;
  outstanding_balance: number;
  active_projects: number;
  delivered_projects: number;
  total_projects: number;
  is_repeat: boolean;
  has_outstanding: boolean;
  is_new: boolean;
  stale_activity: boolean;
}

export interface ClientNote {
  id: string;
  client_id: string;
  user_id: string | null;
  note: string;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
}

export interface PropertySummary extends Property {
  project_count: number;
  last_project_at: string | null;
  revenue_cents: number;
}

export interface ClientCrmProfile {
  client: Client;
  stats: ClientFinancialStats;
  properties: PropertySummary[];
  projects: Project[];
  payments: Payment[];
  notes: ClientNote[];
  communications: Communication[];
  recentActivities: {
    id: string;
    activity_type: string;
    description: string;
    project_id: string | null;
    created_at: string;
    visibility?: string;
  }[];
  lastLogin: string | null;
  portalStatus: ClientPortalAccountStatus | null;
}

const EMPTY_FINANCIAL: ClientFinancialStats = {
  lifetime_revenue: 0,
  outstanding_balance: 0,
  active_project_count: 0,
  delivered_project_count: 0,
  total_project_count: 0,
  average_project_value: 0,
  last_payment_at: null,
};

const STALE_DAYS = 30;
const NEW_CLIENT_DAYS = 14;

export async function touchClientLogin(
  clientId: string,
  businessId: string,
  existingLastLogin: string | null
) {
  try {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    if (existingLastLogin && new Date(existingLastLogin).getTime() > hourAgo) return;

    const db = await createTenantServiceClient(businessId);
    await db
      .from("clients")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", clientId);
  } catch {
    // non-blocking
  }
}

export async function getClientListRows(
  businessId: string,
  options?: {
    includeDeleted?: boolean;
    /** Staff scope: "all" or explicit client ids. Empty array → no rows. */
    clientIds?: "all" | string[];
  }
): Promise<ClientListRow[]> {
  // Cookie RLS client (not service role). Explicit business_id is defense in depth.
  const supabase = await createClient();
  const db = await createTenantServiceClient(businessId);

  if (options?.clientIds && options.clientIds !== "all" && options.clientIds.length === 0) {
    return [];
  }

  let clientsQuery = supabase
    .from("clients")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (options?.includeDeleted) {
    clientsQuery = clientsQuery.not("deleted_at", "is", null);
  } else {
    clientsQuery = clientsQuery.is("deleted_at", null);
  }
  if (options?.clientIds && options.clientIds !== "all") {
    clientsQuery = clientsQuery.in("id", options.clientIds);
  }

  // Payments don't depend on the client rows, so they load alongside them.
  const paymentsLoad = supabase.from("payments").select("client_id, amount, status").eq("business_id", businessId);
  const { data: clients } = await clientsQuery;
  const clientIds = (clients ?? []).map((c) => c.id);

  const [{ data: statsRows }, { data: payments }] = await Promise.all([
    clientIds.length
      ? supabase.from("client_stats").select("*").in("client_id", clientIds)
      : Promise.resolve({ data: [] as { client_id: string }[] }),
    paymentsLoad,
  ]);

  const statsMap = new Map((statsRows ?? []).map((s) => [s.client_id as string, s]));
  const loginMap = new Map<string, string>();

  // Auth is only a fallback: clients.last_login_at (kept current by touchClientLogin) wins
  // whenever it is set, so only look up portal users that have no stored login yet.
  const userIds = (clients ?? [])
    .filter((c) => c.user_id && !c.last_login_at)
    .map((c) => c.user_id) as string[];
  if (userIds.length) {
    // Per-user lookups instead of auth.admin.listUsers({ perPage: 1000 }), which
    // enumerated the entire Auth directory (cross-tenant) and truncated at 1000.
    const authUsers = await Promise.all(
      userIds.map((id) => db.raw.auth.admin.getUserById(id))
    );
    for (const { data } of authUsers) {
      if (data?.user?.last_sign_in_at) loginMap.set(data.user.id, data.user.last_sign_in_at);
    }
  }

  const now = Date.now();
  const staleCutoff = now - STALE_DAYS * 24 * 60 * 60 * 1000;
  const newCutoff = now - NEW_CLIENT_DAYS * 24 * 60 * 60 * 1000;

  return (clients ?? []).map((client) => {
    const stats = statsMap.get(client.id);
    const clientPayments = (payments ?? []).filter((p) => p.client_id === client.id);

    const lifetime_revenue = stats
      ? Number(stats.lifetime_revenue ?? 0)
      : clientPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);

    const outstanding_balance = stats
      ? Number(stats.outstanding_balance ?? 0)
      : clientPayments
          .filter((p) => ["pending", "sent", "draft"].includes(p.status))
          .reduce((s, p) => s + p.amount, 0);

    const active_projects = Number(stats?.active_project_count ?? 0);
    const delivered_projects = Number(stats?.delivered_project_count ?? 0);
    const total_projects = Number(stats?.total_project_count ?? active_projects + delivered_projects);

    const lastActivity = client.last_activity_at as string | null;
    const lastLogin =
      (client.last_login_at as string | null) ??
      (client.user_id ? loginMap.get(client.user_id) ?? null : null);

    const createdAt = new Date(client.created_at).getTime();

    return {
      id: client.id,
      name: client.full_name || client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
      referral_source: (client.referral_source as string | null) ?? null,
      created_at: client.created_at,
      last_activity_at: lastActivity,
      last_login_at: lastLogin,
      lifetime_revenue,
      outstanding_balance,
      active_projects,
      delivered_projects,
      total_projects,
      is_repeat: delivered_projects > 0 && total_projects > 1,
      has_outstanding: outstanding_balance > 0,
      is_new: createdAt > newCutoff,
      stale_activity: !lastActivity || new Date(lastActivity).getTime() < staleCutoff,
    };
  });
}

export async function getClientCrmProfile(
  clientId: string,
  businessId: string,
  options?: {
    includeDeleted?: boolean;
    /** Staff scope: limit projects/payments/activity to these project ids. */
    projectIds?: "all" | string[];
  }
): Promise<ClientCrmProfile | null> {
  // Cookie RLS client (not service role). Explicit business_id is defense in depth.
  const supabase = await createClient();
  const db = await createTenantServiceClient(businessId);
  const projectScope = options?.projectIds ?? "all";
  const emptyScope =
    projectScope !== "all" && projectScope.length === 0
      ? (["00000000-0000-0000-0000-000000000000"] as string[])
      : null;

  let projectsByClientQuery = supabase
    .from("projects")
    .select("*")
    .eq("client_id", clientId)
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false });
  let junctionQuery = supabase
    .from("project_clients")
    .select("project_id, projects(*)")
    .eq("client_id", clientId)
    .eq("business_id", businessId);
  let paymentsQuery = supabase
    .from("payments")
    .select("*, projects(project_name)")
    .eq("client_id", clientId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  let activitiesQuery = supabase
    .from("activity_logs")
    .select("id, activity_type, description, project_id, created_at, visibility")
    .eq("client_id", clientId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(25);
  let allProjectsForPropsQuery = supabase
    .from("projects")
    .select("id, property_id, client_id, updated_at, status")
    .eq("client_id", clientId)
    .eq("business_id", businessId);

  if (projectScope !== "all") {
    const ids = emptyScope ?? projectScope;
    projectsByClientQuery = projectsByClientQuery.in("id", ids);
    junctionQuery = junctionQuery.in("project_id", ids);
    paymentsQuery = paymentsQuery.in("project_id", ids);
    activitiesQuery = activitiesQuery.in("project_id", ids);
    allProjectsForPropsQuery = allProjectsForPropsQuery.in("id", ids);
  }

  const [
    { data: client },
    { data: statsRow, error: statsError },
    { data: properties },
    { data: projectsByClient },
    { data: junction },
    { data: payments },
    { data: notes },
    { data: communications },
    { data: activities },
    { data: allProjectsForProps },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).eq("business_id", businessId).single(),
    supabase.from("client_stats").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("properties").select("*").eq("client_id", clientId).eq("business_id", businessId).order("created_at", { ascending: false }),
    projectsByClientQuery,
    junctionQuery,
    paymentsQuery,
    supabase.from("client_notes").select("*").eq("client_id", clientId).eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase
      .from("communications")
      .select("*")
      .eq("client_id", clientId)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(40),
    activitiesQuery,
    allProjectsForPropsQuery,
  ]);

  if (!client) return null;
  if (client.deleted_at && !options?.includeDeleted) return null;

  const projectMap = new Map<string, Project>();
  (projectsByClient ?? []).forEach((p) => projectMap.set(p.id, p as Project));
  junction?.forEach((row) => {
    const project = row.projects as unknown as Project | null;
    if (project?.id) projectMap.set(project.id, project);
  });

  const projects = Array.from(projectMap.values())
    .filter((p) => options?.includeDeleted || !p.deleted_at)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Scoped staff must not see business-wide client_stats totals.
  const stats: ClientFinancialStats =
    projectScope === "all" && statsRow && !statsError
      ? {
          lifetime_revenue: Number(statsRow.lifetime_revenue ?? 0),
          outstanding_balance: Number(statsRow.outstanding_balance ?? 0),
          active_project_count: Number(statsRow.active_project_count ?? 0),
          delivered_project_count: Number(statsRow.delivered_project_count ?? 0),
          total_project_count: Number(statsRow.total_project_count ?? 0),
          average_project_value: Number(statsRow.average_project_value ?? 0),
          last_payment_at: (statsRow.last_payment_at as string | null) ?? null,
        }
      : computeFinancialFallback(projects, payments ?? []);

  const propertySummaries: PropertySummary[] = (properties ?? [])
    .map((property) => {
      const propProjects = (allProjectsForProps ?? []).filter((p) => p.property_id === property.id);
      const propPayments = (payments ?? []).filter(
        (pay) => pay.status === "paid" && propProjects.some((pp) => pp.id === pay.project_id)
      );
      return {
        ...(property as Property),
        project_count: propProjects.length,
        last_project_at: propProjects.length
          ? propProjects.sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )[0].updated_at
          : null,
        revenue_cents: propPayments.reduce((sum, p) => sum + p.amount, 0),
      };
    })
    .filter((p) => projectScope === "all" || p.project_count > 0);

  let lastLogin: string | null = (client.last_login_at as string | null) ?? null;
  if (!lastLogin && client.user_id) {
    const { data: authData } = await db.raw.auth.admin.getUserById(client.user_id);
    lastLogin = authData?.user?.last_sign_in_at ?? null;
  }

  const portalStatus = await getClientPortalAccountStatus(clientId, businessId);

  const noteAuthorIds = [...new Set((notes ?? []).map((n) => n.user_id).filter(Boolean))] as string[];
  const authorMap = new Map<string, string>();
  if (noteAuthorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", noteAuthorIds);
    profiles?.forEach((p) => authorMap.set(p.id, p.full_name || p.email));
  }

  return {
    client: client as Client,
    stats,
    properties: propertySummaries,
    projects,
    payments: (payments ?? []) as Payment[],
    notes: (notes ?? []).map((n) => ({
      ...n,
      author_name: n.user_id ? authorMap.get(n.user_id) ?? null : null,
    })) as ClientNote[],
    communications: (communications ?? []) as Communication[],
    recentActivities: (activities ?? []).map((a) => ({
      id: a.id,
      activity_type: a.activity_type,
      description: a.description,
      project_id: a.project_id,
      created_at: a.created_at,
      visibility: a.visibility,
    })),
    lastLogin,
    portalStatus,
  };
}

function computeFinancialFallback(projects: Project[], payments: Payment[]): ClientFinancialStats {
  const paid = payments.filter((p) => p.status === "paid");
  const lifetime_revenue = paid.reduce((sum, p) => sum + p.amount, 0);
  const outstanding_balance = payments
    .filter((p) => ["pending", "sent", "draft"].includes(p.status))
    .reduce((sum, p) => sum + p.amount, 0);
  const active_project_count = projects.filter((p) => normalizeStatus(p.status) !== "delivered").length;
  const delivered_project_count = projects.filter((p) => normalizeStatus(p.status) === "delivered").length;
  const paidProjectIds = new Set(paid.map((p) => p.project_id));
  const average_project_value =
    paidProjectIds.size > 0 ? Math.round(lifetime_revenue / paidProjectIds.size) : 0;
  const last_payment_at = paid.length
    ? paid.sort((a, b) => new Date(b.paid_at ?? b.created_at).getTime() - new Date(a.paid_at ?? a.created_at).getTime())[0]
        .paid_at ?? paid[0].created_at
    : null;

  return {
    lifetime_revenue,
    outstanding_balance,
    active_project_count,
    delivered_project_count,
    total_project_count: projects.length,
    average_project_value,
    last_payment_at,
  };
}

export function formatClientRevenue(cents: number): string {
  return formatCurrency(cents);
}

export async function touchClientActivity(clientId: string, businessId: string) {
  try {
    const db = await createTenantServiceClient(businessId);
    await db
      .from("clients")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", clientId);
  } catch {
    // non-blocking
  }
}

// ── New interface Clients page ────────────────────────────────────────────────

type AuthFact = {
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  foreign: boolean;
};

const PORTAL_INVITE_ACTIVITY = "portal_invite_sent";
const PORTAL_ACTIVATED_ACTIVITY_TYPE = "portal_activated";
const AUTH_LOOKUP_CONCURRENCY = 8;

/**
 * Login facts for every linked client: one RPC (migration v129), or — until that migration
 * is applied — per-user Auth lookups a few at a time plus one profiles query.
 */
async function loadClientAuthFacts(
  businessId: string,
  linked: { clientId: string; userId: string }[]
): Promise<Map<string, AuthFact>> {
  const facts = new Map<string, AuthFact>();
  if (!linked.length) return facts;
  const db = await createTenantServiceClient(businessId);
  const { profileBelongsToBusiness } = await import("@/lib/client-portal-link");

  const { data: rpcRows, error: rpcError } = await db.raw.rpc("client_portal_auth_facts", {
    p_business_id: businessId,
  });
  if (!rpcError && Array.isArray(rpcRows)) {
    for (const r of rpcRows as {
      client_id: string;
      email_confirmed_at: string | null;
      last_sign_in_at: string | null;
      profile_role: string | null;
      profile_business_id: string | null;
    }[]) {
      const foreign =
        r.profile_role !== null &&
        !profileBelongsToBusiness({ role: r.profile_role, business_id: r.profile_business_id }, businessId);
      facts.set(r.client_id, {
        emailConfirmedAt: r.email_confirmed_at,
        lastSignInAt: r.last_sign_in_at,
        foreign,
      });
    }
    return facts;
  }

  // Fallback (migration not applied yet): same checks as loadLoginFacts in portal-activation-server.
  const userIds = [...new Set(linked.map((l) => l.userId))];
  const { data: profiles } = await db.raw
    .from("profiles")
    .select("id, role, business_id")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const authByUser = new Map<string, { email_confirmed_at?: string | null; last_sign_in_at?: string | null } | null>();
  let next = 0;
  async function lane() {
    while (next < userIds.length) {
      const id = userIds[next++];
      const profile = profileMap.get(id);
      if (profile && !profileBelongsToBusiness(profile, businessId)) continue;
      try {
        const { data } = await db.raw.auth.admin.getUserById(id);
        authByUser.set(id, data?.user ?? null);
      } catch {
        authByUser.set(id, null);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(AUTH_LOOKUP_CONCURRENCY, userIds.length) }, lane));

  for (const { clientId, userId } of linked) {
    const profile = profileMap.get(userId);
    const foreign = Boolean(profile && !profileBelongsToBusiness(profile, businessId));
    const user = authByUser.get(userId);
    facts.set(clientId, {
      emailConfirmedAt: foreign ? null : user?.email_confirmed_at ?? null,
      lastSignInAt: foreign ? null : user?.last_sign_in_at ?? null,
      foreign,
    });
  }
  return facts;
}

/** Invite / activation log rows, newest first (paged — PostgREST caps a response at 1000 rows). */
async function loadPortalActivityLogs(
  db: Awaited<ReturnType<typeof createTenantServiceClient>>
): Promise<{ data: { client_id: string; activity_type: string; created_at: string }[] }> {
  const PAGE = 1000;
  const out: { client_id: string; activity_type: string; created_at: string }[] = [];
  for (let page = 0; page < 10; page++) {
    // Tenant client scopes business_id. Only invite/activation rows — a few per client at most.
    const { data, error } = await db
      .from("activity_logs")
      .select("client_id, activity_type, created_at")
      .in("activity_type", [PORTAL_INVITE_ACTIVITY, PORTAL_ACTIVATED_ACTIVITY_TYPE])
      .not("client_id", "is", null)
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error || !data) break;
    out.push(...(data as typeof out));
    if (data.length < PAGE) break;
  }
  return { data: out };
}

const newest = (...values: (string | null | undefined)[]): string | null => {
  let best: string | null = null;
  let bestT = -Infinity;
  for (const v of values) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (!Number.isNaN(t) && t > bestT) {
      best = v;
      bestT = t;
    }
  }
  return best;
};

/**
 * Rows for the new interface Clients page: CRM stats plus real portal status
 * (linked login confirmed? invite on record and still valid?) for every client.
 */
export async function getClientWorkspaceRows(
  businessId: string,
  options: {
    includeDeleted?: boolean;
    clientIds?: "all" | string[];
    canViewMoney: boolean;
  }
): Promise<import("@/lib/clients-workspace").ClientWorkspaceRow[]> {
  const { deriveClientPortalStatus } = await import("@/lib/clients-workspace");
  const supabase = await createClient();
  const db = await createTenantServiceClient(businessId);

  if (options.clientIds && options.clientIds !== "all" && options.clientIds.length === 0) return [];

  let clientsQuery = supabase
    .from("clients")
    .select("id, name, full_name, email, phone, company, referral_source, created_at, last_activity_at, last_login_at, user_id, deleted_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  clientsQuery = options.includeDeleted
    ? clientsQuery.not("deleted_at", "is", null)
    : clientsQuery.is("deleted_at", null);
  if (options.clientIds && options.clientIds !== "all") clientsQuery = clientsQuery.in("id", options.clientIds);

  const [{ data: clients }, { data: portalLogs }] = await Promise.all([
    clientsQuery,
    loadPortalActivityLogs(db),
  ]);
  const list = clients ?? [];
  const ids = list.map((c) => c.id as string);

  const [{ data: statsRows }, authFacts] = await Promise.all([
    ids.length
      ? supabase.from("client_stats").select("*").in("client_id", ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    loadClientAuthFacts(
      businessId,
      list.filter((c) => c.user_id).map((c) => ({ clientId: c.id as string, userId: c.user_id as string }))
    ),
  ]);

  const statsMap = new Map((statsRows ?? []).map((s) => [s.client_id as string, s]));
  const lastInvite = new Map<string, string>();
  const activated = new Map<string, string>();
  for (const log of portalLogs ?? []) {
    const cid = log.client_id as string;
    const map = log.activity_type === PORTAL_INVITE_ACTIVITY ? lastInvite : activated;
    if (!map.has(cid)) map.set(cid, log.created_at as string); // newest first
  }

  const now = Date.now();
  return list.map((c) => {
    const s = statsMap.get(c.id as string) as Record<string, unknown> | undefined;
    const auth = authFacts.get(c.id as string);
    const email = ((c.email as string | null) ?? "").trim();
    const inviteAt = lastInvite.get(c.id as string) ?? null;
    const portal_status = deriveClientPortalStatus({
      hasEmail: Boolean(email),
      foreign: auth?.foreign ?? false,
      emailConfirmedAt: auth?.emailConfirmedAt ?? null,
      lastInviteSentAt: inviteAt,
      now,
    });
    const active = Number(s?.active_project_count ?? 0);
    const delivered = Number(s?.delivered_project_count ?? 0);
    return {
      id: c.id as string,
      name: ((c.full_name as string | null) || (c.name as string | null) || email || "Unnamed client").trim(),
      email,
      phone: (c.phone as string | null) ?? null,
      company: (c.company as string | null) ?? null,
      referral_source: (c.referral_source as string | null) ?? null,
      created_at: c.created_at as string,
      last_seen_at: newest(
        c.last_activity_at as string | null,
        c.last_login_at as string | null,
        auth?.lastSignInAt ?? null
      ),
      total_projects: Number(s?.total_project_count ?? active + delivered),
      active_projects: active,
      lifetime_revenue: options.canViewMoney ? Number(s?.lifetime_revenue ?? 0) : 0,
      outstanding_balance: options.canViewMoney ? Number(s?.outstanding_balance ?? 0) : 0,
      portal_status,
      invite_sent_at: inviteAt,
      activated_at:
        portal_status === "active"
          ? activated.get(c.id as string) ?? auth?.emailConfirmedAt ?? null
          : null,
      deleted_at: (c.deleted_at as string | null) ?? null,
    };
  });
}

/** Hidden / active client counts for the "View Hidden Clients" toggle. */
export async function countClients(
  businessId: string,
  options: { deleted: boolean; clientIds?: "all" | string[] }
): Promise<number> {
  if (options.clientIds && options.clientIds !== "all" && options.clientIds.length === 0) return 0;
  const supabase = await createClient();
  let q = supabase.from("clients").select("id", { count: "exact", head: true }).eq("business_id", businessId);
  q = options.deleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  if (options.clientIds && options.clientIds !== "all") q = q.in("id", options.clientIds);
  const { count } = await q;
  return count ?? 0;
}
