import { createClient } from "@/lib/supabase/server";
import { normalizeStatus, type ProjectStatus } from "@/lib/constants";
import { isPreliminaryQuote } from "@/lib/quote-display";
import type { ProjectQuote } from "@/lib/types";

export type PipelineStageParam =
  | "new_request"
  | "quote"
  | "upcoming_shoot"
  | "editing"
  | "in_review"
  | "awaiting_payment";

export const PIPELINE_STAGE_PARAMS: PipelineStageParam[] = [
  "new_request",
  "quote",
  "upcoming_shoot",
  "editing",
  "in_review",
  "awaiting_payment",
];

export interface PipelineStageConfig {
  param: PipelineStageParam;
  label: string;
  scrollToStatus: ProjectStatus;
}

export const PIPELINE_STAGE_CONFIG: Record<PipelineStageParam, PipelineStageConfig> = {
  new_request: { param: "new_request", label: "New Requests", scrollToStatus: "new_request" },
  quote: { param: "quote", label: "Quotes", scrollToStatus: "quote_sent" },
  upcoming_shoot: { param: "upcoming_shoot", label: "Upcoming Shoots", scrollToStatus: "scheduled" },
  editing: { param: "editing", label: "Editing", scrollToStatus: "shoot_complete_editing" },
  in_review: { param: "in_review", label: "In Review", scrollToStatus: "ready_for_review" },
  awaiting_payment: {
    param: "awaiting_payment",
    label: "Awaiting Payment",
    scrollToStatus: "awaiting_payment",
  },
};

export function pipelineStageHref(stage: PipelineStageParam): string {
  return `/admin/projects?stage=${stage}`;
}

export function parsePipelineStageParam(
  value: string | null | undefined
): PipelineStageParam | null {
  if (!value) return null;
  return PIPELINE_STAGE_PARAMS.includes(value as PipelineStageParam)
    ? (value as PipelineStageParam)
    : null;
}

export interface PipelineProjectRow {
  id: string;
  project_name: string;
  property_address: string;
  service_type: string;
  status: ProjectStatus;
  shoot_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  clients: { name: string; company: string | null; deleted_at?: string | null } | null;
  pendingPayment?: boolean;
  recentActivity?: string;
  confirmedShootAt?: string | null;
}

type ClientRef = { name: string; company: string | null; deleted_at?: string | null } | null;

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

export function isVisibleActiveProject(project: {
  deleted_at?: string | null;
  clients?: ClientRef;
}): boolean {
  if (project.deleted_at) return false;
  if (project.clients?.deleted_at) return false;
  return true;
}

function countByStage(
  projects: PipelineProjectRow[],
  quoteProjectIds: Set<string>,
  upcomingProjectIds: Set<string>
): Record<PipelineStageParam, number> {
  const active = projects.filter(isVisibleActiveProject);

  return {
    new_request: active.filter((p) => p.status === "new_request").length,
    quote: active.filter((p) => quoteProjectIds.has(p.id)).length,
    upcoming_shoot: active.filter((p) => upcomingProjectIds.has(p.id)).length,
    editing: active.filter((p) => p.status === "shoot_complete_editing").length,
    in_review: active.filter((p) => p.status === "ready_for_review").length,
    awaiting_payment: active.filter((p) => p.status === "awaiting_payment").length,
  };
}

export function filterProjectsForStage(
  projects: PipelineProjectRow[],
  stage: PipelineStageParam,
  quoteProjectIds: Set<string>,
  upcomingProjectIds: Set<string>
): PipelineProjectRow[] {
  const active = projects.filter(isVisibleActiveProject);

  switch (stage) {
    case "new_request":
      return active.filter((p) => p.status === "new_request");
    case "quote":
      return active.filter((p) => quoteProjectIds.has(p.id));
    case "upcoming_shoot":
      return active.filter((p) => upcomingProjectIds.has(p.id));
    case "editing":
      return active.filter((p) => p.status === "shoot_complete_editing");
    case "in_review":
      return active.filter((p) => p.status === "ready_for_review");
    case "awaiting_payment":
      return active.filter((p) => p.status === "awaiting_payment");
    default:
      return active;
  }
}

async function loadQuoteProjectIds(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Set<string>> {
  const { data: quoteRows } = await supabase
    .from("project_quotes")
    .select("project_id, title, quote_kind, status, projects(deleted_at, clients(deleted_at))")
    .in("status", ["draft", "sent", "changes_requested"]);

  const ids = new Set<string>();
  for (const row of quoteRows ?? []) {
    const quote = row as { project_id: string; title?: string; quote_kind?: string };
    if (isPreliminaryQuote(quote as ProjectQuote)) continue;
    const project = row.projects as unknown as { deleted_at?: string | null; clients?: ClientRef } | null;
    if (project?.deleted_at || project?.clients?.deleted_at) continue;
    ids.add(row.project_id);
  }
  return ids;
}

async function loadUpcomingProjectIds(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Set<string>> {
  const today = startOfToday();
  const twoWeeksOut = addDays(today, 14);

  const [{ data: scheduledProjects }, { data: shootProposals }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, shoot_date, deleted_at, clients(deleted_at)")
      .is("deleted_at", null)
      .eq("status", "scheduled"),
    supabase
      .from("shoot_proposals")
      .select("project_id, proposed_at, projects(id, deleted_at, clients(deleted_at))")
      .eq("status", "confirmed")
      .gte("proposed_at", today.toISOString())
      .lte("proposed_at", twoWeeksOut.toISOString()),
  ]);

  const ids = new Set<string>();

  for (const p of scheduledProjects ?? []) {
    const project = p as unknown as {
      id: string;
      shoot_date: string | null;
      deleted_at?: string | null;
      clients?: ClientRef;
    };
    if (!isVisibleActiveProject(project)) continue;
    if (!p.shoot_date) continue;
    const shootDay = new Date(`${p.shoot_date}T12:00:00`);
    if (shootDay >= today && shootDay <= twoWeeksOut) {
      ids.add(project.id);
    }
  }

  for (const sp of shootProposals ?? []) {
    const project = sp.projects as unknown as { id?: string; deleted_at?: string | null; clients?: ClientRef } | null;
    if (!project?.id || !isVisibleActiveProject(project)) continue;
    ids.add(project.id);
  }

  return ids;
}

function enrichProjects(
  rows: Array<Record<string, unknown>>,
  pendingSet: Set<string>,
  latestActivity: Map<string, string>,
  confirmedShootMap: Map<string, string>
): PipelineProjectRow[] {
  return rows.map((p) => ({
    id: p.id as string,
    project_name: p.project_name as string,
    property_address: p.property_address as string,
    service_type: p.service_type as string,
    status: normalizeStatus(p.status as string),
    shoot_date: (p.shoot_date as string | null) ?? null,
    created_at: p.created_at as string,
    updated_at: p.updated_at as string,
    deleted_at: (p.deleted_at as string | null) ?? null,
    clients: p.clients as PipelineProjectRow["clients"],
    pendingPayment: pendingSet.has(p.id as string),
    recentActivity: latestActivity.get(p.id as string),
    confirmedShootAt: confirmedShootMap.get(p.id as string) ?? null,
  }));
}

export interface PipelineContext {
  activeProjects: PipelineProjectRow[];
  hiddenCount: number;
  quoteProjectIds: Set<string>;
  upcomingProjectIds: Set<string>;
  stageCounts: Record<PipelineStageParam, number>;
}

export async function buildPipelineContext(): Promise<PipelineContext> {
  const supabase = await createClient();

  const [
    { data: allProjects },
    { count: hiddenCount },
    quoteProjectIds,
    upcomingProjectIds,
    { data: payments },
    { data: activities },
    { data: confirmedShoots },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, clients(name, company, deleted_at)")
      .order("updated_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    loadQuoteProjectIds(supabase),
    loadUpcomingProjectIds(supabase),
    supabase.from("payments").select("project_id, status").in("status", ["pending", "sent"]),
    supabase
      .from("activity_logs")
      .select("project_id, description, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("shoot_proposals").select("project_id, proposed_at").eq("status", "confirmed"),
  ]);

  const pendingSet = new Set((payments ?? []).map((p) => p.project_id));
  const latestActivity = new Map<string, string>();
  activities?.forEach((a) => {
    if (a.project_id && !latestActivity.has(a.project_id)) {
      latestActivity.set(a.project_id, a.description);
    }
  });
  const confirmedShootMap = new Map(confirmedShoots?.map((s) => [s.project_id, s.proposed_at]));

  const activeProjects = enrichProjects(
    (allProjects ?? []).filter(isVisibleActiveProject),
    pendingSet,
    latestActivity,
    confirmedShootMap
  );

  return {
    activeProjects,
    hiddenCount: hiddenCount ?? 0,
    quoteProjectIds,
    upcomingProjectIds,
    stageCounts: countByStage(activeProjects, quoteProjectIds, upcomingProjectIds),
  };
}

export async function loadPipelinePageProjects(options: {
  showDeleted: boolean;
  stage: PipelineStageParam | null;
}): Promise<{
  projects: PipelineProjectRow[];
  activeCount: number;
  hiddenCount: number;
  stageCounts: Record<PipelineStageParam, number>;
  stage: PipelineStageParam | null;
}> {
  const ctx = await buildPipelineContext();

  if (options.showDeleted) {
    const supabase = await createClient();
    const [{ data: hiddenProjects }, { data: payments }, { data: activities }, { data: confirmedShoots }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("*, clients(name, company, deleted_at)")
          .not("deleted_at", "is", null)
          .order("updated_at", { ascending: false }),
        supabase.from("payments").select("project_id, status").in("status", ["pending", "sent"]),
        supabase
          .from("activity_logs")
          .select("project_id, description, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("shoot_proposals").select("project_id, proposed_at").eq("status", "confirmed"),
      ]);

    const pendingSet = new Set((payments ?? []).map((p) => p.project_id));
    const latestActivity = new Map<string, string>();
    activities?.forEach((a) => {
      if (a.project_id && !latestActivity.has(a.project_id)) {
        latestActivity.set(a.project_id, a.description);
      }
    });
    const confirmedShootMap = new Map(confirmedShoots?.map((s) => [s.project_id, s.proposed_at]));

    return {
      projects: enrichProjects(hiddenProjects ?? [], pendingSet, latestActivity, confirmedShootMap),
      activeCount: ctx.activeProjects.length,
      hiddenCount: ctx.hiddenCount,
      stageCounts: ctx.stageCounts,
      stage: null,
    };
  }

  let projects = ctx.activeProjects;
  if (options.stage) {
    projects = filterProjectsForStage(
      ctx.activeProjects,
      options.stage,
      ctx.quoteProjectIds,
      ctx.upcomingProjectIds
    );
  }

  return {
    projects,
    activeCount: ctx.activeProjects.length,
    hiddenCount: ctx.hiddenCount,
    stageCounts: ctx.stageCounts,
    stage: options.stage,
  };
}
