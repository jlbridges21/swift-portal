import {
  ClipboardList,
  FileText,
  CalendarClock,
  Camera,
  Images,
  CreditCard,
  PackageCheck,
} from "lucide-react";

/** Homepage workflow stages with short summaries for the marketing landing page. */
export const HOMEPAGE_WORKFLOW_STEPS = [
  { key: "request", title: "Request", summary: "A new job comes in." },
  { key: "estimate", title: "Estimate", summary: "Send pricing and project details." },
  { key: "approval", title: "Approval", summary: "The client approves the work." },
  { key: "schedule", title: "Schedule", summary: "Set the shoot date and time." },
  { key: "shoot", title: "Shoot", summary: "Complete the project." },
  { key: "review", title: "Review", summary: "Client feedback stays on the job." },
  { key: "invoice", title: "Invoice", summary: "Send the invoice from the project." },
  { key: "payment", title: "Payment", summary: "Collect payment in the portal." },
  { key: "deliver", title: "Deliver", summary: "Hand off finals in one place." },
] as const;

/** @deprecated Prefer HomepageWorkflowMarquee on the homepage for motion. */
export function HomepageWorkflowRibbon() {
  return (
    <ol className="relative flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:pb-0 lg:grid-cols-9">
      {HOMEPAGE_WORKFLOW_STEPS.map((step, i) => (
        <li
          key={step.key}
          className="relative flex w-[7.5rem] shrink-0 flex-col items-center text-center sm:w-auto"
        >
          {i < HOMEPAGE_WORKFLOW_STEPS.length - 1 ? (
            <span
              className="pointer-events-none absolute left-[calc(50%+1.75rem)] top-5 hidden h-px w-[calc(100%-1.5rem)] bg-[#E2E8F0] sm:block lg:left-[calc(50%+1.25rem)]"
              aria-hidden
            />
          ) : null}
          <span className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-sm font-bold text-[#4F46E5] shadow-sm">
            {i + 1}
          </span>
          <h3 className="mt-2 text-sm font-semibold text-[#0F172A]">{step.title}</h3>
          <p className="mt-1 text-[11px] leading-snug text-[#475569]">{step.summary}</p>
        </li>
      ))}
    </ol>
  );
}

export const WORKFLOW_STEPS = [
  {
    key: "request",
    title: "Request",
    icon: ClipboardList,
    summary: "Clients submit a project request from your branded portal. No email scavenger hunt.",
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
    summary: "Show up prepared. The project already has the brief, estimate, and schedule.",
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

/** Compact visual path for the homepage. Links to /how-it-works for depth. */
export function WorkflowRibbon() {
  return (
    <ol className="relative flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-7 sm:gap-3 sm:overflow-visible sm:pb-0">
      {WORKFLOW_STEPS.map((step, i) => {
        const Icon = step.icon;
        return (
          <li
            key={step.key}
            className="relative flex w-[7.5rem] shrink-0 flex-col items-center text-center sm:w-auto"
          >
            {i < WORKFLOW_STEPS.length - 1 ? (
              <span
                className="pointer-events-none absolute left-[calc(50%+1.75rem)] top-5 hidden h-px w-[calc(100%-1.5rem)] bg-[#E2E8F0] sm:block"
                aria-hidden
              />
            ) : null}
            <span className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#4F46E5] shadow-sm">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              {i + 1}
            </span>
            <h3 className="mt-0.5 text-sm font-semibold text-[#0F172A]">{step.title}</h3>
            <p className="mt-1 hidden text-[11px] leading-snug text-[#64748B] lg:block">
              {step.summary}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
