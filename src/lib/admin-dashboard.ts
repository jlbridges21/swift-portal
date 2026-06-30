import { createClient } from "@/lib/supabase/server";
import { isPreliminaryQuote } from "@/lib/quote-display";
import type { Payment, Project, ProjectQuote, ShootProposal } from "@/lib/types";

export interface AdminDashboardProjectRow {
  id: string;
  project_name: string;
  property_address: string;
  status: string;
  shoot_date: string | null;
  created_at: string;
  updated_at: string;
  clients: { name: string; company: string | null } | null;
}

export interface AdminQuoteAttentionRow {
  id: string;
  title: string;
  status: string;
  project_id: string;
  updated_at: string;
  projects: { id: string; project_name: string; clients: { name: string } | null } | null;
}

export interface AdminPaymentRow extends Omit<Payment, "projects"> {
  projects: { id: string; project_name: string; clients: { name: string } | null } | null;
}

export interface AdminDashboardData {
  newRequests: AdminDashboardProjectRow[];
  quoteAttention: AdminQuoteAttentionRow[];
  upcomingShoots: (AdminDashboardProjectRow & { shootAt: string })[];
  editingQueue: AdminDashboardProjectRow[];
  readyForDelivery: AdminDashboardProjectRow[];
  outstandingPayments: AdminPaymentRow[];
  recentlyPaid: AdminPaymentRow[];
  expiredPayments: AdminPaymentRow[];
  counts: {
    newRequests: number;
    quoteAttention: number;
    upcomingShoots: number;
    editingQueue: number;
    readyForDelivery: number;
    outstandingPayments: number;
    recentlyPaid: number;
    expiredPayments: number;
    inReview: number;
    awaitingPayment: number;
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function activeProjectRows<T extends { deleted_at?: string | null }>(rows: T[] | null): T[] {
  return (rows ?? []).filter((row) => !row.deleted_at);
}

function activePaymentRows(rows: AdminPaymentRow[] | null): AdminPaymentRow[] {
  return (rows ?? []).filter((row) => {
    const project = row.projects as { deleted_at?: string | null } | null;
    return !project?.deleted_at;
  });
}

function activeQuoteRows(rows: AdminQuoteAttentionRow[] | null): AdminQuoteAttentionRow[] {
  return (rows ?? []).filter((row) => {
    const project = row.projects as { deleted_at?: string | null } | null;
    return !project?.deleted_at;
  });
}

export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = await createClient();
  const today = startOfToday();
  const twoWeeksOut = addDays(today, 14);
  const sevenDaysAgo = addDays(today, -7);

  const [
    { data: newRequests },
    { data: quoteRows },
    { data: scheduledProjects },
    { data: shootProposals },
    { data: editingQueue },
    { data: readyForReview },
    { data: awaitingPaymentProjects },
    { data: outstandingPayments },
    { data: recentlyPaid },
    { data: expiredPayments },
    { count: inReviewCount },
    { count: awaitingPaymentCount },
    { count: newRequestCount },
    { count: editingCount },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, clients(name, company)")
      .is("deleted_at", null)
      .eq("status", "new_request")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("project_quotes")
      .select("*, projects(id, project_name, deleted_at, clients(name))")
      .in("status", ["draft", "sent", "changes_requested"])
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("projects")
      .select("*, clients(name, company)")
      .is("deleted_at", null)
      .eq("status", "scheduled")
      .order("shoot_date", { ascending: true })
      .limit(20),
    supabase
      .from("shoot_proposals")
      .select("*, projects(id, project_name, property_address, status, shoot_date, created_at, updated_at, deleted_at, clients(name, company))")
      .eq("status", "confirmed")
      .gte("proposed_at", today.toISOString())
      .lte("proposed_at", twoWeeksOut.toISOString())
      .order("proposed_at", { ascending: true })
      .limit(12),
    supabase
      .from("projects")
      .select("*, clients(name, company)")
      .is("deleted_at", null)
      .eq("status", "shoot_complete_editing")
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("projects")
      .select("*, clients(name, company)")
      .is("deleted_at", null)
      .eq("status", "ready_for_review")
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("projects")
      .select("*, clients(name, company)")
      .is("deleted_at", null)
      .eq("status", "awaiting_payment")
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("payments")
      .select("*, projects(id, project_name, deleted_at, clients(name))")
      .in("status", ["pending", "sent"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("payments")
      .select("*, projects(id, project_name, deleted_at, clients(name))")
      .eq("status", "paid")
      .gte("updated_at", sevenDaysAgo.toISOString())
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("payments")
      .select("*, projects(id, project_name, deleted_at, clients(name))")
      .eq("status", "expired")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase.from("projects").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", "ready_for_review"),
    supabase.from("projects").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", "awaiting_payment"),
    supabase.from("projects").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", "new_request"),
    supabase.from("projects").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("status", "shoot_complete_editing"),
  ]);

  const officialQuoteAttention = activeQuoteRows(
    (quoteRows ?? []).filter((q) => !isPreliminaryQuote(q as ProjectQuote)) as AdminQuoteAttentionRow[]
  );

  const upcomingFromProjects = activeProjectRows(scheduledProjects ?? [])
    .filter((p) => {
      if (!p.shoot_date) return false;
      const shootDay = new Date(`${p.shoot_date}T12:00:00`);
      return shootDay >= today && shootDay <= twoWeeksOut;
    })
    .map((p) => ({
      ...(p as AdminDashboardProjectRow),
      shootAt: p.shoot_date ? `${p.shoot_date}T09:00:00.000Z` : p.created_at,
    }));

  const upcomingFromProposals = (shootProposals ?? [])
    .filter((sp) => sp.projects && sp.proposed_at && !(sp.projects as { deleted_at?: string | null }).deleted_at)
    .map((sp) => {
      const project = sp.projects as Project & { clients: { name: string; company: string | null } | null };
      return {
        id: project.id,
        project_name: project.project_name,
        property_address: project.property_address,
        status: project.status,
        shoot_date: project.shoot_date,
        created_at: project.created_at,
        updated_at: project.updated_at,
        clients: project.clients,
        shootAt: sp.proposed_at as string,
      };
    });

  const upcomingMap = new Map<string, AdminDashboardProjectRow & { shootAt: string }>();
  for (const row of [...upcomingFromProjects, ...upcomingFromProposals]) {
    const existing = upcomingMap.get(row.id);
    if (!existing || new Date(row.shootAt) < new Date(existing.shootAt)) {
      upcomingMap.set(row.id, row);
    }
  }
  const upcomingShoots = Array.from(upcomingMap.values())
    .sort((a, b) => new Date(a.shootAt).getTime() - new Date(b.shootAt).getTime())
    .slice(0, 8);

  const readyForDelivery = [
    ...activeProjectRows(readyForReview ?? []),
    ...activeProjectRows(awaitingPaymentProjects ?? []),
  ].slice(0, 8) as AdminDashboardProjectRow[];

  return {
    newRequests: activeProjectRows(newRequests ?? []) as AdminDashboardProjectRow[],
    quoteAttention: officialQuoteAttention,
    upcomingShoots,
    editingQueue: activeProjectRows(editingQueue ?? []) as AdminDashboardProjectRow[],
    readyForDelivery,
    outstandingPayments: activePaymentRows(outstandingPayments as AdminPaymentRow[] | null),
    recentlyPaid: activePaymentRows(recentlyPaid as AdminPaymentRow[] | null),
    expiredPayments: activePaymentRows(expiredPayments as AdminPaymentRow[] | null),
    counts: {
      newRequests: newRequestCount ?? newRequests?.length ?? 0,
      quoteAttention: officialQuoteAttention.length,
      upcomingShoots: upcomingShoots.length,
      editingQueue: editingCount ?? editingQueue?.length ?? 0,
      readyForDelivery: (readyForReview?.length ?? 0) + (awaitingPaymentProjects?.length ?? 0),
      outstandingPayments: activePaymentRows(outstandingPayments as AdminPaymentRow[] | null).length,
      recentlyPaid: activePaymentRows(recentlyPaid as AdminPaymentRow[] | null).length,
      expiredPayments: activePaymentRows(expiredPayments as AdminPaymentRow[] | null).length,
      inReview: inReviewCount ?? 0,
      awaitingPayment: awaitingPaymentCount ?? 0,
    },
  };
}

export function getQuoteAttentionLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft — finish & send";
    case "sent":
      return "Waiting for approval";
    case "changes_requested":
      return "Changes requested";
    default:
      return status.replace(/_/g, " ");
  }
}
