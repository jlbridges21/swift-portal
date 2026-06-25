import { getClientStatusLabel, normalizeStatus } from "@/lib/constants";

/** Client-facing notification copy — never expose internal status names. */
export function clientStatusNotification(status: string): { title: string; body: string } {
  const s = normalizeStatus(status);
  const label = getClientStatusLabel(s);

  const messages: Record<string, { title: string; body: string }> = {
    new_request: {
      title: "We've received your request",
      body: "Swift Aerial Media is reviewing your project details. We'll be in touch shortly.",
    },
    quote_sent: {
      title: "Your quote is ready to review",
      body: "We've prepared a proposal for your project. Review and approve it in your portal to move forward.",
    },
    proposal_approved: {
      title: "Proposal approved",
      body: "Thank you! We'll propose a shoot date for your confirmation soon.",
    },
    scheduled: {
      title: "Your shoot is scheduled",
      body: "Your shoot date is confirmed. We'll see you on site!",
    },
    shoot_complete_editing: {
      title: "Your shoot is complete",
      body: "We're preparing your finished media. You'll be notified when everything is ready for review.",
    },
    ready_for_review: {
      title: "Your deliverables are ready",
      body: "Preview your photos, videos, and tours. Approve when you're happy with everything.",
    },
    awaiting_payment: {
      title: "Complete your final payment",
      body: "Your project has been approved. Complete your payment to unlock your final downloads.",
    },
    delivered: {
      title: "Your project is complete",
      body: "Payment confirmed — all deliverables are now available to download. Thank you for choosing Swift Aerial Media!",
    },
  };

  return messages[s] ?? {
    title: "Project update",
    body: `Your project is now: ${label}.`,
  };
}
