import type { NotificationType } from "@/lib/types";
import type { NotificationEventKey } from "@/lib/app-settings";

interface NotifyContext {
  type: NotificationType;
  title: string;
  body?: string;
  notifyAdmins?: boolean;
  notifyClients?: boolean;
  eventKey?: NotificationEventKey;
}

export function resolveNotificationEventKey(ctx: NotifyContext): NotificationEventKey | null {
  if (ctx.eventKey) return ctx.eventKey;

  const title = ctx.title.toLowerCase();
  const body = (ctx.body ?? "").toLowerCase();
  const combined = `${title} ${body}`;

  if (ctx.notifyAdmins) {
    switch (ctx.type) {
      case "proposal_submitted":
        return "new_project_request";
      case "proposal_approved":
        return "proposal_approved";
      case "proposal_changes":
        return "proposal_changes_requested";
      case "revision_requested":
        return "revision_requested";
      case "payment_received":
        if (title.includes("fail")) return "payment_failed";
        return "payment_received";
      case "invoice_available":
        if (title.includes("expired")) return "payment_link_sent";
        return "payment_link_sent";
      case "shoot_proposed":
        if (combined.includes("declin")) return "shoot_time_declined";
        if (combined.includes("confirm")) return "shoot_time_confirmed";
        if (combined.includes("reschedul")) return "shoot_rescheduled";
        return "shoot_time_proposed";
      case "schedule_change_requested":
        return "shoot_time_declined";
      case "status_changed":
        if (combined.includes("revision")) return "revision_requested";
        return null;
      default:
        return null;
    }
  }

  if (ctx.notifyClients) {
    switch (ctx.type) {
      case "quote_sent":
        return "official_proposal_sent";
      case "status_changed":
        if (combined.includes("preliminary estimate")) return "preliminary_estimate_created";
        if (combined.includes("deliverable") || combined.includes("review your")) return "deliverables_ready";
        if (combined.includes("shoot scheduled") || combined.includes("scheduled")) return "shoot_scheduled";
        if (combined.includes("reschedul")) return "shoot_rescheduled";
        if (combined.includes("complete") && combined.includes("project")) return "project_delivered";
        if (combined.includes("production") || combined.includes("shoot complete")) return "shoot_completed";
        return null;
      case "shoot_proposed":
        return "shoot_time_proposed";
      case "schedule_change_requested":
        return "shoot_rescheduled";
      case "revision_requested":
        return "revision_completed";
      case "deliverables_uploaded":
        return "deliverables_ready";
      case "invoice_available":
        return "payment_link_sent";
      case "payment_confirmed":
        return "project_delivered";
      default:
        return null;
    }
  }

  return null;
}
