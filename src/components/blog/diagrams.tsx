import {
  CalendarClock,
  Camera,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Images,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  MessageSquareText,
  PackageCheck,
  Receipt,
  Sheet,
  Smartphone,
  UserRound,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Explanatory diagrams for blog articles. HTML + CSS (not images) so text is
 * indexable, scales on phones, and honours prefers-reduced-motion via the
 * mk-* animation classes in marketing.css. Each one is labelled as a
 * conceptual diagram by the <Figure> caption that wraps it.
 */

const WORKFLOW: { key: string; label: string; icon: LucideIcon; hint: string }[] = [
  { key: "request", label: "Request", icon: ClipboardList, hint: "Client submits the job" },
  { key: "estimate", label: "Estimate", icon: FileText, hint: "Pricing sent for approval" },
  { key: "schedule", label: "Schedule", icon: CalendarClock, hint: "Shoot time confirmed" },
  { key: "shoot", label: "Shoot", icon: Camera, hint: "Brief, address, notes in hand" },
  { key: "review", label: "Review", icon: MessageSquareText, hint: "Feedback on the media" },
  { key: "pay", label: "Pay", icon: CreditCard, hint: "Invoice paid online" },
  { key: "deliver", label: "Deliver", icon: PackageCheck, hint: "Final files downloaded" },
];

export type WorkflowStepKey = (typeof WORKFLOW)[number]["key"];

/** Request → Estimate → Schedule → Shoot → Review → Pay → Deliver. */
export function WorkflowDiagram({ highlight = [] }: { highlight?: string[] }) {
  return (
    <div className="rounded-3xl border border-[#E2E8F0] bg-gradient-to-b from-white to-[#F8FAFC] p-5 sm:p-7">
      <ol className="mk-plain-list relative grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 lg:gap-2">
        <svg className="pointer-events-none absolute left-[7%] right-[7%] top-7 hidden h-2 lg:block" preserveAspectRatio="none" viewBox="0 0 100 2" aria-hidden>
          <line x1="0" y1="1" x2="100" y2="1" stroke="#A5B4FC" strokeWidth="0.6" className="mk-flow-line" vectorEffect="non-scaling-stroke" />
        </svg>
        {WORKFLOW.map((s, i) => {
          const on = highlight.length === 0 || highlight.includes(s.key);
          const Icon = s.icon;
          return (
            <li key={s.key} className="relative flex flex-col items-center text-center" style={{ animationDelay: `${i * 70}ms` }}>
              <span
                className={cn(
                  "relative z-[1] flex h-14 w-14 items-center justify-center rounded-2xl border transition",
                  on
                    ? "border-transparent bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-lg shadow-indigo-500/25"
                    : "border-[#E2E8F0] bg-white text-[#94A3B8]"
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className={cn("mt-2.5 text-sm font-semibold", on ? "text-[#0F172A]" : "text-[#94A3B8]")}>{s.label}</span>
              <span className="mt-0.5 text-xs leading-snug text-[#64748B]">{s.hint}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const SPRAWL: { label: string; icon: LucideIcon; x: string; y: string }[] = [
  { label: "Email threads", icon: Mail, x: "6%", y: "8%" },
  { label: "Text messages", icon: Smartphone, x: "52%", y: "2%" },
  { label: "Calendar app", icon: CalendarClock, x: "4%", y: "44%" },
  { label: "Spreadsheet", icon: Sheet, x: "56%", y: "38%" },
  { label: "Cloud folders", icon: FolderOpen, x: "10%", y: "78%" },
  { label: "Invoice app", icon: Receipt, x: "54%", y: "74%" },
];

/** "Disconnected tools" vs "one project record". */
export function ToolSprawlDiagram() {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
      <div className="rounded-3xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">Before: one job, six places</p>
        <div className="relative mt-4 h-64">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path d="M20 16 L70 10 L22 52 L74 46 L26 86 L72 82 L20 16" fill="none" stroke="#CBD5E1" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
          </svg>
          {SPRAWL.map((t) => {
            const Icon = t.icon;
            return (
              <span
                key={t.label}
                className="absolute inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#475569] shadow-sm"
                style={{ left: t.x, top: t.y }}
              >
                <Icon className="h-3.5 w-3.5 text-[#94A3B8]" aria-hidden />
                {t.label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-center text-[#4F46E5]" aria-hidden>
        <svg width="56" height="24" viewBox="0 0 56 24" className="rotate-90 md:rotate-0">
          <path d="M2 12 H48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="mk-flow-line" />
          <path d="M42 5 L52 12 L42 19" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="rounded-3xl border border-[#C7D2FE] bg-white p-5 shadow-[0_20px_50px_-36px_rgba(79,70,229,0.6)]">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F46E5]">After: one project record</p>
        <div className="mt-4 rounded-2xl border border-[#E2E8F0]">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">214 Oak Street</p>
              <p className="text-xs text-[#64748B]">Listing photos + aerials</p>
            </div>
            <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#4F46E5]">Scheduled</span>
          </div>
          <ul className="mk-plain-list grid grid-cols-2 gap-2 p-3 text-xs text-[#334155]">
            {[
              [UserRound, "Client + contact info"],
              [FileText, "Approved estimate"],
              [CalendarClock, "Shoot date"],
              [MessageSquare, "Messages"],
              [Images, "Photos + video"],
              [CreditCard, "Payment status"],
            ].map(([Icon, label]) => {
              const I = Icon as LucideIcon;
              return (
                <li key={label as string} className="flex items-center gap-2 rounded-lg bg-[#F8FAFC] px-2.5 py-2">
                  <I className="h-3.5 w-3.5 text-[#4F46E5]" aria-hidden />
                  {label as string}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Upload → client review → payment → download unlock. */
export function DeliveryPathDiagram({ showPaywall = true }: { showPaywall?: boolean }) {
  const steps: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Images, title: "Upload", body: "Photos, video, tours, and documents attach to the project." },
    { icon: MessageSquareText, title: "Review", body: "Client approves items or requests changes with written feedback." },
    ...(showPaywall
      ? [{ icon: Lock, title: "Pay", body: "Optional: downloads stay locked until the final payment clears." }]
      : []),
    { icon: Download, title: "Download", body: "Full-resolution or MLS-sized files, one at a time or as a ZIP." },
  ];
  return (
    <ol className="mk-plain-list grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <li key={s.title} className="relative rounded-2xl border border-[#E2E8F0] bg-white p-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">Step {i + 1}</span>
            <span className="mt-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 font-semibold text-[#0F172A]">{s.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#475569]">{s.body}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Request form → preliminary estimate → approval → proposed time ↔ client → calendar. */
export function BookingFlowDiagram() {
  const rows: { icon: LucideIcon; who: "Client" | "You" | "System"; title: string; body: string }[] = [
    { icon: ClipboardList, who: "Client", title: "Submits a request", body: "Picks a service from your catalog, adds the property address, preferred date, and notes." },
    { icon: MapPin, who: "System", title: "Preliminary estimate", body: "Package price plus a travel fee calculated from ZIP-to-ZIP distance, if you enable it." },
    { icon: FileText, who: "You", title: "Official estimate", body: "Adjust line items and send. The client approves or asks for changes in the portal." },
    { icon: CalendarClock, who: "You", title: "Propose a shoot time", body: "The client accepts, declines, or counter-proposes. No text-message ping-pong." },
    { icon: CreditCard, who: "Client", title: "Deposit (optional)", body: "Collect a percentage or flat deposit on approval through your own Stripe account." },
  ];
  const tone = { Client: "bg-sky-50 text-sky-700", You: "bg-[#EEF2FF] text-[#4F46E5]", System: "bg-emerald-50 text-emerald-700" };
  return (
    <ol className="mk-plain-list relative space-y-3 before:absolute before:bottom-6 before:left-[1.65rem] before:top-6 before:w-px before:bg-gradient-to-b before:from-[#C7D2FE] before:to-[#E2E8F0]">
      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <li key={r.title} className="relative flex gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-4">
            <span className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#0F172A]">{r.title}</p>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tone[r.who])}>{r.who}</span>
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-[#475569]">{r.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Time-stamped video feedback across versions. */
export function VideoReviewDiagram() {
  const pins = [
    { at: 18, time: "0:09", text: "Can we hold on the front elevation a beat longer?" },
    { at: 46, time: "0:23", text: "Swap this kitchen clip for the wide angle." },
    { at: 81, time: "0:41", text: "Music fade is perfect." },
  ];
  return (
    <div className="overflow-hidden rounded-3xl border border-[#E2E8F0] bg-[#0F172A] p-5 text-white sm:p-6">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold text-slate-200">Listing_Film_v2.mp4</span>
        <span className="flex gap-1.5">
          <span className="rounded-full bg-white/10 px-2 py-0.5">v1</span>
          <span className="rounded-full bg-[#4F46E5] px-2 py-0.5 text-white">v2</span>
        </span>
      </div>
      <div className="relative mt-4 aspect-[16/7] rounded-2xl bg-gradient-to-br from-[#1E293B] to-[#312E81]">
        <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 backdrop-blur">
          <Video className="h-6 w-6" aria-hidden />
        </span>
        <span className="mk-pulse absolute left-[62%] top-[38%] h-5 w-5 rounded-full border-2 border-white bg-amber-400" aria-hidden />
      </div>
      <div className="relative mt-5 h-1.5 rounded-full bg-white/15">
        <div className="absolute inset-y-0 left-0 w-[46%] rounded-full bg-[#818CF8]" />
        {pins.map((p) => (
          <span key={p.time} className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0F172A] bg-amber-300" style={{ left: `${p.at}%` }} aria-hidden />
        ))}
      </div>
      <ul className="mk-plain-list mt-5 space-y-2">
        {pins.map((p) => (
          <li key={p.time} className="flex gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-sm">
            <span className="shrink-0 rounded-md bg-amber-300/15 px-1.5 py-0.5 font-mono text-xs text-amber-200">{p.time}</span>
            <span className="text-slate-200">{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What a client sees in a project portal. */
export function PortalAnatomyDiagram() {
  const blocks: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: PackageCheck, title: "Project status", body: "Plain-language stages so clients stop asking “any update?”" },
    { icon: FileText, title: "Estimate", body: "Review, approve, request changes, download the PDF." },
    { icon: CalendarClock, title: "Shoot time", body: "Accept, decline, or suggest another time." },
    { icon: Images, title: "Media", body: "Photos, video, 3D tours, and documents in one place." },
    { icon: MessageSquare, title: "Messages", body: "Conversation stays attached to the project." },
    { icon: CreditCard, title: "Payments", body: "Pay deposits and balances by card online." },
  ];
  return (
    <div className="overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.5)]">
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#CBD5E1]" aria-hidden />
        ))}
        <span className="ml-3 truncate rounded-md bg-white px-3 py-1 text-xs text-[#64748B] ring-1 ring-[#E2E8F0]">portal.yourstudio.com</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {blocks.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.title} className="rounded-2xl border border-[#E2E8F0] p-4 transition hover:border-[#C7D2FE] hover:bg-[#EEF2FF]/40">
              <Icon className="h-5 w-5 text-[#4F46E5]" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-[#0F172A]">{b.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#64748B]">{b.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Three categories of software and what each covers. */
export function ToolCategoryMap({
  columns,
}: {
  columns: { title: string; examples: string; covers: string[]; gaps: string[]; accent?: boolean }[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {columns.map((c) => (
        <div
          key={c.title}
          className={cn(
            "mk-reveal flex flex-col rounded-3xl border p-5",
            c.accent ? "border-[#A5B4FC] bg-gradient-to-b from-[#EEF2FF] to-white" : "border-[#E2E8F0] bg-white"
          )}
        >
          <p className="text-base font-semibold text-[#0F172A]">{c.title}</p>
          <p className="mt-1 text-xs text-[#64748B]">{c.examples}</p>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Covers</p>
          <ul className="mk-plain-list mt-1.5 space-y-1 text-sm text-[#334155]">
            {c.covers.map((x) => (
              <li key={x}>· {x}</li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#C2410C]">Usually needs a second tool for</p>
          <ul className="mk-plain-list mt-1.5 space-y-1 text-sm text-[#334155]">
            {c.gaps.map((x) => (
              <li key={x}>· {x}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The CRM record layers for a media business. */
export function CrmRecordDiagram() {
  const layers: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: UserRound, title: "Contact", body: "Name, email, phone, company, referral source" },
    { icon: MapPin, title: "Properties", body: "Every address you've shot for this client" },
    { icon: ClipboardList, title: "Projects", body: "Stage, services, shoot date, assigned staff" },
    { icon: MessageSquare, title: "Timeline", body: "Notes, messages, and activity in order" },
    { icon: CreditCard, title: "Money", body: "Lifetime revenue, balances, last payment" },
  ];
  return (
    <div className="rounded-3xl border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-sm font-bold text-white">AC</span>
        <div>
          <p className="font-semibold text-[#0F172A]">Avery Chen</p>
          <p className="text-xs text-[#64748B]">Listing agent · Northside Realty</p>
        </div>
      </div>
      <ul className="mk-plain-list mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {layers.map((l) => {
          const Icon = l.icon;
          return (
            <li key={l.title} className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5">
              <Icon className="h-4 w-4 text-[#4F46E5]" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-[#0F172A]">{l.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#64748B]">{l.body}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
