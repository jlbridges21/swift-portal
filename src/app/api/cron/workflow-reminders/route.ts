import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings, type NotificationEventKey } from "@/lib/app-settings";
import { reminderTimingToMs } from "@/lib/workflow-settings";
import { logWorkflowAudit, logWorkflowSkipped, portalLink, resolveProjectMessageTemplate } from "@/lib/workflow";
import { notifyProjectClients } from "@/lib/notifications";
import { idempotencyKey } from "@/lib/idempotency";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";

type ReminderType = "proposal" | "scheduling" | "review" | "payment";
type ReminderRow = { id: string; project_name: string; client_id: string | null; anchor: string };
type ReminderResult = {
  type: string;
  projectId: string;
  action: string;
  businessId?: string;
  reason?: string;
};
type BusinessSummary = {
  businessId: string;
  ok: boolean;
  processed: number;
  error?: string;
};

/**
 * Backlog safety for first enable of workflow-reminders.
 *
 * If WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE is unset, defaults to "now" so no
 * historical project can qualify (safe no-op). Set the env to a past UTC ISO
 * when you intentionally want reminders for recent work, e.g. 7 days ago.
 *
 * Idempotency: activity_logs.idempotency_key via idempotencyKey("reminder", …).
 */
function anchorNotBeforeMs(nowMs: number): number {
  const raw = process.env.WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE?.trim();
  if (!raw) return nowMs;
  const parsed = new Date(raw).getTime();
  if (!Number.isFinite(parsed)) {
    console.warn(
      "[cron/workflow-reminders] WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE invalid — treating as now (no backlog)"
    );
    return nowMs;
  }
  return parsed;
}

/**
 * Workflow reminder processor — Vercel cron or Authorization: Bearer CRON_SECRET
 * GET /api/cron/workflow-reminders
 * GET /api/cron/workflow-reminders?dryRun=1  — report without sending
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const dryRun = cronDryRunRequested(request);
  const nowMs = Date.now();
  const notBeforeMs = anchorNotBeforeMs(nowMs);
  if (!process.env.WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE?.trim()) {
    console.warn(
      "[cron/workflow-reminders] WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE unset — skipping all anchors (backlog safety). Set a past UTC ISO to enable."
    );
  }

  const raw = await createServiceClient();
  const { data: businesses, error: businessesError } = await raw
    .from("businesses")
    .select("id")
    .eq("status", "active")
    .is("deleted_at", null);

  if (businessesError) {
    console.error("[cron/workflow-reminders] failed to list businesses:", businessesError.message);
    return NextResponse.json({ error: "Failed to list businesses" }, { status: 500 });
  }

  const results: ReminderResult[] = [];
  const summaries: BusinessSummary[] = [];

  for (const business of businesses ?? []) {
    try {
      const processed = await sweepBusiness(business.id, results, {
        dryRun,
        nowMs,
        notBeforeMs,
      });
      summaries.push({ businessId: business.id, ok: true, processed });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[cron/workflow-reminders] business sweep failed", {
        businessId: business.id,
        error: message,
      });
      summaries.push({ businessId: business.id, ok: false, processed: 0, error: message });
    }
  }

  return NextResponse.json({
    dryRun,
    anchorNotBefore: new Date(notBeforeMs).toISOString(),
    anchorNotBeforeConfigured: Boolean(process.env.WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE?.trim()),
    processed: results.filter((r) => r.action === "sent" || r.action === "would_send").length,
    results,
    businesses: summaries,
  });
}

async function sweepBusiness(
  businessId: string,
  results: ReminderResult[],
  opts: { dryRun: boolean; nowMs: number; notBeforeMs: number }
): Promise<number> {
  const appSettings = await getAppSettings(businessId);
  const { reminders } = appSettings.workflow;
  const db = await createTenantServiceClient(businessId);
  const before = results.length;

  async function processReminder(
    type: ReminderType,
    timing: typeof reminders.proposal,
    query: () => Promise<ReminderRow[]>
  ) {
    const ms = reminderTimingToMs(timing);
    if (!ms) return;

    const rows = await query();
    for (const row of rows) {
      const anchorTime = new Date(row.anchor).getTime();
      if (Number.isNaN(anchorTime)) continue;
      if (anchorTime < opts.notBeforeMs) {
        results.push({
          type,
          projectId: row.id,
          businessId,
          action: "skipped_before_cutoff",
          reason: `anchor ${row.anchor} < notBefore`,
        });
        continue;
      }
      if (opts.nowMs - anchorTime < ms) continue;

      const key = idempotencyKey("reminder", type, row.id, timing);
      const existing = await db
        .from("activity_logs")
        .select("id")
        .eq("project_id", row.id)
        .eq("idempotency_key", key)
        .maybeSingle();

      if (existing.data) {
        results.push({ type, projectId: row.id, businessId, action: "already_sent" });
        continue;
      }

      const link = `/dashboard/projects/${row.id}`;
      let title = "Reminder";
      let body = "Please take action in your portal.";
      let eventKey: NotificationEventKey = "official_proposal_sent";

      if (type === "proposal") {
        title = "Proposal reminder";
        body = await resolveProjectMessageTemplate(
          appSettings.workflow,
          "proposal_ready",
          row.id,
          { project_name: row.project_name, portal_link: await portalLink(`${link}#quote`, businessId) },
          `Your proposal for ${row.project_name} is waiting for review.`
        );
        eventKey = "official_proposal_sent";
      } else if (type === "scheduling") {
        title = "Scheduling reminder";
        body = await resolveProjectMessageTemplate(
          appSettings.workflow,
          "scheduling_request",
          row.id,
          { portal_link: await portalLink(`${link}?scheduling=pending#scheduling`, businessId) },
          "Please confirm or suggest a shoot time in your portal."
        );
        eventKey = "shoot_time_proposed";
      } else if (type === "review") {
        title = "Review reminder";
        body = await resolveProjectMessageTemplate(
          appSettings.workflow,
          "deliverables_ready",
          row.id,
          { project_name: row.project_name, portal_link: await portalLink(`${link}#deliverables`, businessId) },
          `Your deliverables for ${row.project_name} are ready for review.`
        );
        eventKey = "deliverables_ready";
      } else {
        title = "Payment reminder";
        body = await resolveProjectMessageTemplate(
          appSettings.workflow,
          "payment_request",
          row.id,
          { portal_link: await portalLink(`${link}#payments`, businessId) },
          "Your final payment is ready. Complete it to unlock downloads."
        );
        eventKey = "payment_link_sent";
      }

      const channel = appSettings.notifications[eventKey];
      if (!channel?.inApp && !channel?.email) {
        if (!opts.dryRun) {
          await logWorkflowSkipped(
            row.id,
            `${title} skipped — notifications disabled for this event.`,
            key
          );
        }
        results.push({ type, projectId: row.id, businessId, action: "skipped" });
        continue;
      }

      if (opts.dryRun) {
        results.push({
          type,
          projectId: row.id,
          businessId,
          action: "would_send",
          reason: title,
        });
        continue;
      }

      await notifyProjectClients({
        type: type === "payment" ? "invoice_available" : "status_changed",
        eventKey,
        title,
        body,
        link,
        projectId: row.id,
        businessId,
      });

      await logWorkflowAudit(row.id, `Reminder email automatically sent: ${title}.`, {
        idempotencyKey: key,
        metadata: { reminderType: type, timing },
      });
      results.push({ type, projectId: row.id, businessId, action: "sent" });
    }
  }

  await processReminder("proposal", reminders.proposal, async () => {
    const { data } = await db
      .from("projects")
      .select("id, project_name, client_id, updated_at")
      .eq("status", "quote_sent");
    return (data ?? []).map((p) => ({ ...p, anchor: p.updated_at }));
  });

  await processReminder("scheduling", reminders.scheduling, async () => {
    const { data } = await db
      .from("projects")
      .select("id, project_name, client_id, updated_at")
      .eq("status", "proposal_approved");
    return (data ?? []).map((p) => ({ ...p, anchor: p.updated_at }));
  });

  await processReminder("review", reminders.review, async () => {
    const { data } = await db
      .from("projects")
      .select("id, project_name, client_id, updated_at")
      .eq("status", "ready_for_review");
    return (data ?? []).map((p) => ({ ...p, anchor: p.updated_at }));
  });

  await processReminder("payment", reminders.payment, async () => {
    const { data } = await db
      .from("projects")
      .select("id, project_name, client_id, updated_at")
      .eq("status", "awaiting_payment");
    return (data ?? []).map((p) => ({ ...p, anchor: p.updated_at }));
  });

  return results.length - before;
}
