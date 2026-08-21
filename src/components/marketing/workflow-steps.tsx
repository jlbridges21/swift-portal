import {
  ClipboardList,
  FileText,
  CalendarClock,
  Camera,
  Images,
  CreditCard,
  PackageCheck,
} from "lucide-react";

export const WORKFLOW_STEPS = [
  {
    key: "request",
    title: "Request",
    icon: ClipboardList,
    summary: "Clients submit a project request from your branded portal — no email scavenger hunt.",
    detail:
      "Publish a request form under your business branding. Capture property details, services, and notes in one place so every job starts clean.",
  },
  {
    key: "estimate",
    title: "Estimate",
    icon: FileText,
    summary: "Send a preliminary estimate, then lock in an official estimate for approval.",
    detail:
      "Turn intake into pricing your client can review in the portal. When they approve, you move forward without chasing PDFs in inboxes.",
  },
  {
    key: "schedule",
    title: "Schedule",
    icon: CalendarClock,
    summary: "Propose shoot times and let clients confirm inside the portal.",
    detail:
      "Stop trading texts about availability. Propose times, get a clear yes/no, and keep the calendar aligned with the project.",
  },
  {
    key: "shoot",
    title: "Shoot",
    icon: Camera,
    summary: "Show up prepared — the project already has the brief, estimate, and schedule.",
    detail:
      "Your team opens one project record with everything attached: address, services, approvals, and messages. Less prep, fewer surprises.",
  },
  {
    key: "review",
    title: "Review",
    icon: Images,
    summary: "Upload media for client review without Dropbox links that go stale.",
    detail:
      "Clients review photos and video in your portal, leave feedback, and approve deliverables where the rest of the job already lives.",
  },
  {
    key: "pay",
    title: "Pay",
    icon: CreditCard,
    summary: "Collect payment from the same project experience via Stripe.",
    detail:
      "Send a payment request tied to the project. Clients pay online; you get paid through Stripe Connect without inventing a second billing tool.",
  },
  {
    key: "deliver",
    title: "Deliver",
    icon: PackageCheck,
    summary: "Hand off finals from the portal when the work and payment are done.",
    detail:
      "Mark the project delivered and keep downloads in one branded place your client already knows how to use.",
  },
] as const;

export function WorkflowStepGrid({ detailed = false }: { detailed?: boolean }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {WORKFLOW_STEPS.map((step, i) => {
        const Icon = step.icon;
        return (
          <li
            key={step.key}
            className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4F46E5]/10 text-[#4F46E5]">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#475569]">
                  Step {i + 1}
                </p>
                <h3 className="text-base font-semibold text-[#0F172A]">{step.title}</h3>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#475569]">
              {detailed ? step.detail : step.summary}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
