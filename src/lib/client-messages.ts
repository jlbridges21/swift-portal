import { getClientStatusLabel, normalizeStatus } from "@/lib/constants";

/** Client-facing notification copy — never expose internal status names. */
export function clientStatusNotification(status: string): { title: string; body: string } {
  const s = normalizeStatus(status);
  const label = getClientStatusLabel(s);

  const messages: Record<string, { title: string; body: string }> = {
    new_request: {
      title: "Request Received",
      body: "Swift Aerial Media is reviewing your project details. We'll be in touch shortly.",
    },
    quote_sent: {
      title: "Review Your Proposal",
      body: "We've prepared a proposal for your project. Review and approve it in your portal to move forward.",
    },
    proposal_approved: {
      title: "Scheduling Your Shoot",
      body: "Your proposal is approved. Suggest a shoot time or confirm a date we propose in your portal.",
    },
    scheduled: {
      title: "Shoot Scheduled",
      body: "Your shoot date is confirmed. We'll see you on site!",
    },
    shoot_complete_editing: {
      title: "Media in Production",
      body: "Your shoot is complete. We're preparing your finished media and will notify you when it's ready to review.",
    },
    ready_for_review: {
      title: "Review Your Deliverables",
      body: "Preview your photos, videos, and tours. Approve each item when you're satisfied.",
    },
    awaiting_payment: {
      title: "Final Payment",
      body: "Your deliverables are approved. Complete your final payment to unlock all downloads.",
    },
    delivered: {
      title: "Project Complete",
      body: "Payment confirmed — all deliverables are now available to download. Thank you for choosing Swift Aerial Media!",
    },
  };

  return messages[s] ?? {
    title: label,
    body: `Your project is now at: ${label}.`,
  };
}
