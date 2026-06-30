import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Client, Communication, Payment, Project, Property } from "@/lib/types";
import { normalizeStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

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

export async function touchClientLogin(clientId: string, existingLastLogin: string | null) {
  try {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    if (existingLastLogin && new Date(existingLastLogin).getTime() > hourAgo) return;

    const supabase = await createServiceClient();
    await supabase
      .from("clients")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", clientId);
  } catch {
    // non-blocking
  }
}

export async function getClientListRows(options?: { includeDeleted?: boolean }): Promise<ClientListRow[]> {
  const supabase = await createClient();
  const service = await createServiceClient();

  let clientsQuery = supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (options?.includeDeleted) {
    clientsQuery = clientsQuery.not("deleted_at", "is", null);
  } else {
    clientsQuery = clientsQuery.is("deleted_at", null);
  }

  const [{ data: clients }, { data: statsRows }, { data: payments }] = await Promise.all([
    clientsQuery,
    supabase.from("client_stats").select("*"),
    supabase.from("payments").select("client_id, amount, status"),
  ]);

  const statsMap = new Map((statsRows ?? []).map((s) => [s.client_id as string, s]));
  const loginMap = new Map<string, string>();

  const userIds = (clients ?? []).map((c) => c.user_id).filter(Boolean) as string[];
  if (userIds.length) {
    const { data: authData } = await service.auth.admin.listUsers({ perPage: 1000 });
    authData?.users?.forEach((u) => {
      if (u.last_sign_in_at) loginMap.set(u.id, u.last_sign_in_at);
    });
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
  options?: { includeDeleted?: boolean }
): Promise<ClientCrmProfile | null> {
  const supabase = await createClient();
  const service = await createServiceClient();

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
    supabase.from("clients").select("*").eq("id", clientId).single(),
    supabase.from("client_stats").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("properties").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("projects").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }),
    supabase.from("project_clients").select("project_id, projects(*)").eq("client_id", clientId),
    supabase.from("payments").select("*, projects(project_name)").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("client_notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase
      .from("communications")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("activity_logs")
      .select("id, activity_type, description, project_id, created_at, visibility")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("projects").select("id, property_id, client_id, updated_at, status").eq("client_id", clientId),
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

  const stats: ClientFinancialStats = statsRow && !statsError
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

  const propertySummaries: PropertySummary[] = (properties ?? []).map((property) => {
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
  });

  let lastLogin: string | null = (client.last_login_at as string | null) ?? null;
  if (!lastLogin && client.user_id) {
    const { data: authData } = await service.auth.admin.getUserById(client.user_id);
    lastLogin = authData?.user?.last_sign_in_at ?? null;
  }

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

export async function touchClientActivity(clientId: string) {
  try {
    const supabase = await createServiceClient();
    await supabase
      .from("clients")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", clientId);
  } catch {
    // non-blocking
  }
}
