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

  switch (status) {
    case "new_request":
      return {
        title: "Request received",
        description: "Swift Aerial Media is reviewing your request. We'll send your quote soon.",
        variant: "info",
      };
    case "quote_sent":
      return {
        title: "Your quote is ready",
        description: "Review your proposal and approve it to move forward with scheduling.",
        actionLabel: "Review Quote",
        actionHref: "#quote",
        variant: "accent",
      };
    case "proposal_approved":
      return {
        title: "Awaiting scheduling",
        description: "Your proposal is approved. We'll propose a shoot date for your confirmation.",
        variant: "info",
      };
    case "scheduled":
      return {
        title: "Shoot scheduled",
        description: shootFormatted
          ? `Your shoot is confirmed for ${shootFormatted}.`
          : "Your shoot date is confirmed. We'll see you on site!",
        variant: "success",
      };
    case "shoot_complete_editing":
      return {
        title: "Media being prepared",
        description: "Your shoot is complete. We're preparing your finished deliverables and will notify you when they're ready for review.",
        variant: "info",
      };
    case "ready_for_review":
      return {
        title: "Review your deliverables",
        description: "Preview your photos, videos, and tours. Approve each item when you're satisfied.",
        actionLabel: "Review Deliverables",
        actionHref: "#deliverables",
        variant: "accent",
      };
    case "awaiting_payment":
      return {
        title: "Final payment",
        description: hasPendingPayment
          ? "Your project has been approved. Complete your payment to unlock all final downloads."
          : "Please complete your outstanding invoice to receive your deliverables.",
        actionLabel: "View Invoice",
        actionHref: "#payments",
        variant: "warning",
      };
    case "delivered":
      return {
        title: "Project complete",
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
      return {
        title: "Proposal approved",
        description: "Propose a shoot date for the client to confirm.",
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
