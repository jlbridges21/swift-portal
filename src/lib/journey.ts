import { PROJECT_STATUSES, normalizeStatus, getClientStatusLabel } from "@/lib/constants";
import type { Project } from "@/lib/types";
import { formatShootDateTime, getProjectShootDateTime } from "@/lib/scheduling";
import type { ShootProposal } from "@/lib/types";

export interface NextStepInfo {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  variant: "info" | "success" | "warning" | "accent";
}

export function getClientNextStep(
  project: Project,
  hasPendingPayment: boolean,
  proposals: ShootProposal[] = []
): NextStepInfo {
  const status = normalizeStatus(project.status);
  const shootWhen = getProjectShootDateTime(project, proposals);
  const shootFormatted = formatShootDateTime(shootWhen, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const pendingAdminProposal = proposals.find((p) => p.status === "pending" && p.proposed_by === "admin");
  const pendingClientProposal = proposals.find((p) => p.status === "pending" && p.proposed_by === "client");

  switch (status) {
    case "new_request":
      return {
        title: getClientStatusLabel("new_request"),
        description: "Swift Aerial Media is reviewing your request. We'll send your proposal soon.",
        variant: "info",
      };
    case "quote_sent":
      return {
        title: getClientStatusLabel("quote_sent"),
        description: "Review your proposal and approve it to move forward with scheduling your shoot.",
        actionLabel: "Review Proposal",
        actionHref: "#quote",
        variant: "accent",
      };
    case "proposal_approved":
      if (pendingAdminProposal) {
        return {
          title: getClientStatusLabel("proposal_approved"),
          description: `Swift Aerial Media proposed ${formatShootDateTime(pendingAdminProposal.proposed_at)}. Approve the time or request a different one.`,
          actionLabel: "Review Schedule",
          actionHref: "#scheduling",
          variant: "accent",
        };
      }
      if (pendingClientProposal) {
        return {
          title: getClientStatusLabel("proposal_approved"),
          description: "Your suggested shoot time is awaiting review from Swift Aerial Media.",
          actionHref: "#scheduling",
          variant: "info",
        };
      }
      return {
        title: getClientStatusLabel("proposal_approved"),
        description: "Suggest a shoot date and time that works for you, or wait for our team to propose one.",
        actionLabel: "Suggest a Time",
        actionHref: "#scheduling",
        variant: "accent",
      };
    case "scheduled":
      return {
        title: getClientStatusLabel("scheduled"),
        description: shootFormatted
          ? `Your shoot is confirmed for ${shootFormatted}.`
          : "Your shoot date is confirmed. We'll see you on site!",
        variant: "success",
      };
    case "shoot_complete_editing":
      return {
        title: getClientStatusLabel("shoot_complete_editing"),
        description: "Your shoot is complete. We're preparing your finished deliverables and will notify you when they're ready to review.",
        variant: "info",
      };
    case "ready_for_review":
      return {
        title: getClientStatusLabel("ready_for_review"),
        description: "Preview your photos, videos, and tours. Approve each item when you're satisfied.",
        actionLabel: "Review Deliverables",
        actionHref: "#deliverables",
        variant: "accent",
      };
    case "awaiting_payment":
      return {
        title: getClientStatusLabel("awaiting_payment"),
        description: hasPendingPayment
          ? "Your deliverables are approved. Complete your final payment to unlock all downloads."
          : "Please complete your outstanding invoice to receive your deliverables.",
        actionLabel: "View Invoice",
        actionHref: "#payments",
        variant: "warning",
      };
    case "delivered":
      return {
        title: getClientStatusLabel("delivered"),
        description: "Thank you for choosing Swift Aerial Media! All deliverables are available to download.",
        actionLabel: "Request Another Project",
        actionHref: "/dashboard/request",
        variant: "success",
      };
    default:
      return {
        title: getClientStatusLabel(project.status),
        description: "Track your project progress below.",
        variant: "info",
      };
  }
}

export function getAdminNextStep(project: Project, proposals: ShootProposal[] = []): NextStepInfo {
  const status = normalizeStatus(project.status);
  const shootWhen = getProjectShootDateTime(project, proposals);
  const pendingClientProposal = proposals.find((p) => p.status === "pending" && p.proposed_by === "client");
  const pendingAdminProposal = proposals.find((p) => p.status === "pending" && p.proposed_by === "admin");

  switch (status) {
    case "new_request":
      return {
        title: "New request",
        description: "Create and send a quote to the client.",
        actionLabel: "Create Quote",
        actionHref: "#quote",
        variant: "accent",
      };
    case "quote_sent":
      return {
        title: "Awaiting quote approval",
        description: "Client is reviewing the quote.",
        variant: "info",
      };
    case "proposal_approved":
      if (pendingClientProposal) {
        return {
          title: "Client suggested a shoot time",
          description: `Review ${formatShootDateTime(pendingClientProposal.proposed_at)} and approve or propose a different time.`,
          actionLabel: "Review Schedule",
          actionHref: "#scheduling",
          variant: "accent",
        };
      }
      if (pendingAdminProposal) {
        return {
          title: "Awaiting client confirmation",
          description: "The client is reviewing your proposed shoot time.",
          actionHref: "#scheduling",
          variant: "info",
        };
      }
      return {
        title: "Proposal approved",
        description: "Propose a shoot date for the client to confirm, or wait for their suggestion.",
        actionLabel: "Propose Shoot Date",
        actionHref: "#scheduling",
        variant: "accent",
      };
    case "scheduled":
      return {
        title: "Shoot scheduled",
        description: shootWhen
          ? `Shoot on ${formatShootDateTime(shootWhen, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}. Upload deliverables after the shoot.`
          : "Shoot confirmed. Upload deliverables when ready.",
        variant: "success",
      };
    case "shoot_complete_editing":
      return {
        title: "Upload deliverables",
        description: "Upload finished media and send the project for client review when ready.",
        actionLabel: "Send for Review",
        actionHref: "#deliverables-admin",
        variant: "info",
      };
    case "ready_for_review":
      return {
        title: "Client reviewing deliverables",
        description: "Client is previewing and approving deliverables.",
        variant: "accent",
      };
    case "awaiting_payment":
      return {
        title: "Awaiting payment",
        description: "Invoice sent. Payment will automatically unlock downloads and mark delivered.",
        variant: "warning",
      };
    case "delivered":
      return {
        title: "Project complete",
        description: "This project is delivered.",
        variant: "success",
      };
    default:
      return {
        title: PROJECT_STATUSES.find((s) => s.value === status)?.label ?? status,
        description: "Manage this project below.",
        variant: "info",
      };
  }
}
