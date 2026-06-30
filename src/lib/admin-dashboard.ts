import { createClient } from "@/lib/supabase/server";
import { isPreliminaryQuote } from "@/lib/quote-display";
import {
  buildPipelineContext,
  filterProjectsForStage,
  type PipelineStageParam,
} from "@/lib/admin-project-pipeline";
import type { Payment, ProjectQuote } from "@/lib/types";

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
  projects: { id: string; project_name: string; clients: { name: string } | null; deleted_at?: string | null } | null;
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
    activeProjects: number;
    hiddenProjects: number;
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

function toDashboardRow(
  p: {
    id: string;
    project_name: string;
    property_address: string;
    status: string;
    shoot_date: string | null;
    created_at: string;
    updated_at: string;
    clients: { name: string; company: string | null } | null;
  }
): AdminDashboardProjectRow {
  return {
    id: p.id,
    project_name: p.project_name,
    property_address: p.property_address,
    status: p.status,
    shoot_date: p.shoot_date,
    created_at: p.created_at,
    updated_at: p.updated_at,
    clients: p.clients,
  };
}

function activePaymentRows(rows: AdminPaymentRow[] | null): AdminPaymentRow[] {
  return (rows ?? []).filter((row) => {
    const project = row.projects;
    return !project?.deleted_at;
  });
}

export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = await createClient();
  const ctx = await buildPipelineContext();
  const today = startOfToday();
  const twoWeeksOut = addDays(today, 14);
  const sevenDaysAgo = addDays(today, -7);

  const [{ data: quoteRows }, { data: outstandingPayments }, { data: recentlyPaid }, { data: expiredPayments }] =
    await Promise.all([
      supabase
        .from("project_quotes")
        .select("*, projects(id, project_name, deleted_at, clients(name, deleted_at))")
        .in("status", ["draft", "sent", "changes_requested"])
        .order("updated_at", { ascending: false })
        .limit(12),
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
    ]);

  const officialQuoteAttention = (quoteRows ?? []).filter((q) => {
    if (isPreliminaryQuote(q as ProjectQuote)) return false;
    const project = q.projects as { deleted_at?: string | null; clients?: { deleted_at?: string | null } | null };
    return !project?.deleted_at && !project?.clients?.deleted_at;
  }) as AdminQuoteAttentionRow[];

  const newRequests = filterProjectsForStage(
    ctx.activeProjects,
    "new_request",
    ctx.quoteProjectIds,
    ctx.upcomingProjectIds
  ).map(toDashboardRow);

  const editingQueue = filterProjectsForStage(
    ctx.activeProjects,
    "editing",
    ctx.quoteProjectIds,
    ctx.upcomingProjectIds
  ).map(toDashboardRow);

  const readyForReview = filterProjectsForStage(
    ctx.activeProjects,
    "in_review",
    ctx.quoteProjectIds,
    ctx.upcomingProjectIds
  ).map(toDashboardRow);

  const awaitingPaymentProjects = filterProjectsForStage(
    ctx.activeProjects,
    "awaiting_payment",
    ctx.quoteProjectIds,
    ctx.upcomingProjectIds
  ).map(toDashboardRow);

  const upcomingShoots = filterProjectsForStage(
    ctx.activeProjects,
    "upcoming_shoot",
    ctx.quoteProjectIds,
    ctx.upcomingProjectIds
  )
    .map((p) => ({
      ...toDashboardRow(p),
      shootAt:
        p.confirmedShootAt ??
        (p.shoot_date ? `${p.shoot_date}T09:00:00.000Z` : p.created_at),
    }))
    .sort((a, b) => new Date(a.shootAt).getTime() - new Date(b.shootAt).getTime())
    .slice(0, 8);

  const readyForDelivery = [...readyForReview, ...awaitingPaymentProjects].slice(0, 8);

  const outstanding = activePaymentRows(outstandingPayments as AdminPaymentRow[] | null);
  const paid = activePaymentRows(recentlyPaid as AdminPaymentRow[] | null);
  const expired = activePaymentRows(expiredPayments as AdminPaymentRow[] | null);

  const stageCounts = ctx.stageCounts;

  return {
    newRequests: newRequests.slice(0, 8),
    quoteAttention: officialQuoteAttention,
    upcomingShoots,
    editingQueue: editingQueue.slice(0, 8),
    readyForDelivery,
    outstandingPayments: outstanding,
    recentlyPaid: paid,
    expiredPayments: expired,
    counts: {
      newRequests: stageCounts.new_request,
      quoteAttention: stageCounts.quote,
      upcomingShoots: stageCounts.upcoming_shoot,
      editingQueue: stageCounts.editing,
      readyForDelivery: stageCounts.in_review + stageCounts.awaiting_payment,
      outstandingPayments: outstanding.length,
      recentlyPaid: paid.length,
      expiredPayments: expired.length,
      inReview: stageCounts.in_review,
      awaitingPayment: stageCounts.awaiting_payment,
      activeProjects: ctx.activeProjects.length,
      hiddenProjects: ctx.hiddenCount,
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

export type { PipelineStageParam };
