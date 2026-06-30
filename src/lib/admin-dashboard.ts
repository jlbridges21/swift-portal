import { createClient } from "@/lib/supabase/server";
import {
  getQuoteAttentionLabelFromReason,
  getQuoteAttentionReason,
  needsQuoteAttention,
} from "@/lib/admin-project-status";
import {
  buildPipelineContext,
  filterProjectsForStage,
  type PipelineStageParam,
} from "@/lib/admin-project-pipeline";
import type { Payment } from "@/lib/types";

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
  project_id: string;
  project_name: string;
  client_name: string | null;
  status: string;
  updated_at: string;
  attentionReason: "needs_quote_sent" | "needs_payment_link";
  attentionLabel: string;
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
    quotesWaiting: number;
    quotesNeedingAttention: number;
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
  const sevenDaysAgo = addDays(startOfToday(), -7);

  const [{ data: outstandingPayments }, { data: recentlyPaid }, { data: expiredPayments }] =
    await Promise.all([
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

  const newRequests = filterProjectsForStage(
    ctx.activeProjects,
    "new_request",
    ctx.adminContext,
    ctx.upcomingProjectIds
  ).map(toDashboardRow);

  const editingQueue = filterProjectsForStage(
    ctx.activeProjects,
    "editing",
    ctx.adminContext,
    ctx.upcomingProjectIds
  ).map(toDashboardRow);

  const readyForReview = filterProjectsForStage(
    ctx.activeProjects,
    "in_review",
    ctx.adminContext,
    ctx.upcomingProjectIds
  ).map(toDashboardRow);

  const awaitingPaymentProjects = filterProjectsForStage(
    ctx.activeProjects,
    "awaiting_payment",
    ctx.adminContext,
    ctx.upcomingProjectIds
  ).map(toDashboardRow);

  const upcomingShoots = filterProjectsForStage(
    ctx.activeProjects,
    "upcoming_shoot",
    ctx.adminContext,
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

  const allQuoteAttention: AdminQuoteAttentionRow[] = [];

  for (const project of ctx.activeProjects) {
    const adminCtx = ctx.adminContext.get(project.id);
    if (!adminCtx || !needsQuoteAttention(project, adminCtx)) continue;

    const reason = getQuoteAttentionReason(project, adminCtx);
    if (!reason) continue;

    allQuoteAttention.push({
      id: project.id,
      project_id: project.id,
      project_name: project.project_name,
      client_name: project.clients?.name ?? null,
      status: project.status,
      updated_at: project.updated_at,
      attentionReason: reason,
      attentionLabel: getQuoteAttentionLabelFromReason(reason),
    });
  }

  allQuoteAttention.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const quoteAttention = allQuoteAttention.slice(0, 12);

  const outstanding = activePaymentRows(outstandingPayments as AdminPaymentRow[] | null);
  const paid = activePaymentRows(recentlyPaid as AdminPaymentRow[] | null);
  const expired = activePaymentRows(expiredPayments as AdminPaymentRow[] | null);

  const stageCounts = ctx.stageCounts;

  return {
    newRequests: newRequests.slice(0, 8),
    quoteAttention,
    upcomingShoots,
    editingQueue: editingQueue.slice(0, 8),
    readyForDelivery,
    outstandingPayments: outstanding,
    recentlyPaid: paid,
    expiredPayments: expired,
    counts: {
      newRequests: stageCounts.new_request,
      quotesWaiting: stageCounts.quote,
      quotesNeedingAttention: allQuoteAttention.length,
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
    case "needs_quote_sent":
      return "Finish & send quote";
    case "needs_payment_link":
      return "Send payment link";
    default:
      return status.replace(/_/g, " ");
  }
}

export type { PipelineStageParam };
