import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings, type NotificationEventKey } from "@/lib/app-settings";
import { reminderTimingToMs } from "@/lib/workflow-settings";
import { logWorkflowAudit, logWorkflowSkipped, portalLink, resolveProjectMessageTemplate } from "@/lib/workflow";
import { notifyProjectClients } from "@/lib/notifications";
import { idempotencyKey } from "@/lib/idempotency";

type ReminderType = "proposal" | "scheduling" | "review" | "payment";
type ReminderRow = { id: string; project_name: string; client_id: string | null; anchor: string };
type ReminderResult = { type: string; projectId: string; action: string };
type BusinessSummary = {
  businessId: string;
  ok: boolean;
  processed: number;
  error?: string;
};

/**
 * Workflow reminder processor — call via cron with Authorization: Bearer CRON_SECRET
 * GET /api/cron/workflow-reminders
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      const processed = await sweepBusiness(business.id, results);
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

  return NextResponse.json({ processed: results.length, results, businesses: summaries });
}

async function sweepBusiness(businessId: string, results: ReminderResult[]): Promise<number> {
  const appSettings = await getAppSettings(businessId);
  const { reminders } = appSettings.workflow;
  const db = await createTenantServiceClient(businessId);
  const now = Date.now();
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
      if (Number.isNaN(anchorTime) || now - anchorTime < ms) continue;

      const key = idempotencyKey("reminder", type, row.id, timing);
      const existing = await db
        .from("activity_logs")
        .select("id")
        .eq("project_id", row.id)
        .eq("idempotency_key", key)
        .maybeSingle();

      if (existing.data) continue;

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
        await logWorkflowSkipped(
          row.id,
          `${title} skipped — notifications disabled for this event.`,
          key
        );
        results.push({ type, projectId: row.id, action: "skipped" });
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
      results.push({ type, projectId: row.id, action: "sent" });
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
