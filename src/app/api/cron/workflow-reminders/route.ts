import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettings, type NotificationEventKey } from "@/lib/app-settings";
import { reminderTimingToMs } from "@/lib/workflow-settings";
import { logWorkflowAudit, logWorkflowSkipped, portalLink, resolveMessageTemplate } from "@/lib/workflow";
import { notifyProjectClients } from "@/lib/notifications";
import { idempotencyKey } from "@/lib/idempotency";

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

  const appSettings = await getAppSettings();
  const { reminders } = appSettings.workflow;
  const supabase = await createServiceClient();
  const now = Date.now();
  const results: { type: string; projectId: string; action: string }[] = [];

  async function processReminder(
    type: "proposal" | "scheduling" | "review" | "payment",
    timing: typeof reminders.proposal,
    query: () => Promise<{ id: string; project_name: string; client_id: string | null; anchor: string }[]>
  ) {
    const ms = reminderTimingToMs(timing);
    if (!ms) return;

    const rows = await query();
    for (const row of rows) {
      const anchorTime = new Date(row.anchor).getTime();
      if (Number.isNaN(anchorTime) || now - anchorTime < ms) continue;

      const key = idempotencyKey("reminder", type, row.id, timing);
      const existing = await supabase
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
        body = resolveMessageTemplate(
          appSettings.workflow,
          "proposal_ready",
          { project_name: row.project_name, portal_link: portalLink(`${link}#quote`) },
          `Your proposal for ${row.project_name} is waiting for review.`
        );
        eventKey = "official_proposal_sent";
      } else if (type === "scheduling") {
        title = "Scheduling reminder";
        body = resolveMessageTemplate(
          appSettings.workflow,
          "scheduling_request",
          { portal_link: portalLink(`${link}?scheduling=pending#scheduling`) },
          "Please confirm or suggest a shoot time in your portal."
        );
        eventKey = "shoot_time_proposed";
      } else if (type === "review") {
        title = "Review reminder";
        body = resolveMessageTemplate(
          appSettings.workflow,
          "deliverables_ready",
          { project_name: row.project_name, portal_link: portalLink(`${link}#deliverables`) },
          `Your deliverables for ${row.project_name} are ready for review.`
        );
        eventKey = "deliverables_ready";
      } else {
        title = "Payment reminder";
        body = resolveMessageTemplate(
          appSettings.workflow,
          "payment_request",
          { portal_link: portalLink(`${link}#payments`) },
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
      });

      await logWorkflowAudit(row.id, `Reminder email automatically sent: ${title}.`, {
        idempotencyKey: key,
        metadata: { reminderType: type, timing },
      });
      results.push({ type, projectId: row.id, action: "sent" });
    }
  }

  await processReminder("proposal", reminders.proposal, async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, project_name, client_id, updated_at")
      .eq("status", "quote_sent");
    return (data ?? []).map((p) => ({ ...p, anchor: p.updated_at }));
  });

  await processReminder("scheduling", reminders.scheduling, async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, project_name, client_id, updated_at")
      .eq("status", "proposal_approved");
    return (data ?? []).map((p) => ({ ...p, anchor: p.updated_at }));
  });

  await processReminder("review", reminders.review, async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, project_name, client_id, updated_at")
      .eq("status", "ready_for_review");
    return (data ?? []).map((p) => ({ ...p, anchor: p.updated_at }));
  });

  await processReminder("payment", reminders.payment, async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, project_name, client_id, updated_at")
      .eq("status", "awaiting_payment");
    return (data ?? []).map((p) => ({ ...p, anchor: p.updated_at }));
  });

  return NextResponse.json({ processed: results.length, results });
}
