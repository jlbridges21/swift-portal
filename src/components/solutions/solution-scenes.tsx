import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDot,
  Clock,
  CreditCard,
  FileText,
  Lock,
  MapPin,
  MessageSquareText,
  Play,
  Receipt,
  RotateCcw,
  Send,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Product illustrations for Solutions pages 6–10. Each mirrors a verified ShootPortal
 * state (public request form fields, single-time shoot proposals with accept / decline /
 * counter, Stripe Checkout payments with deposits and balances, time-stamped pinned video
 * comments with versions, forward-only automatic stage changes). Demo data only; the
 * mockups are aria-hidden and every page repeats their meaning in text or a caption.
 */

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_30px_70px_-45px_rgba(15,23,42,0.6)]", className)}>{children}</div>
  );
}

function FieldRow({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A]">
        {Icon ? <Icon className="h-3.5 w-3.5 text-[#64748B]" /> : null}
        <span className="truncate">{value}</span>
      </p>
    </div>
  );
}

/** The public request form: contact, address, one service from your catalog, preferred date, notes. */
export function RequestFormCard({ className }: { className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <div aria-hidden>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0F172A]">Request a shoot</p>
          <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold text-[#4F46E5]">yourstudio.com</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <FieldRow label="Name" value="Avery Chen" />
          <FieldRow label="Company" value="Northside Realty" />
        </div>
        <div className="mt-3">
          <FieldRow label="Property address" value="214 Oak Street, 78704" icon={MapPin} />
        </div>
        <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-3">
          <FieldRow label="Service" value="Listing photos + aerials" />
          <FieldRow label="Preferred date" value="Sat, Oct 18" icon={CalendarClock} />
        </div>
        <div className="mt-3">
          <FieldRow label="Notes" value="Lockbox on side gate. Seller home until 9." />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#64748B]">Creates your client account</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F46E5] px-3 py-1.5 text-xs font-semibold text-white">
            Submit request <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Card>
  );
}

/** One proposed shoot time with the client's three choices. */
export function ShootProposalCard({ className, state = "pending" }: { className?: string; state?: "pending" | "accepted" }) {
  return (
    <Card className={cn("p-5", className)}>
      <div aria-hidden>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Proposed shoot time</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
            <span className="text-[9px] font-bold uppercase leading-none">Oct</span>
            <span className="text-base font-bold leading-tight">18</span>
          </span>
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Saturday · 10:00 AM</p>
            <p className="text-[11px] text-[#64748B]">214 Oak Street · Listing photos + aerials</p>
          </div>
        </div>
        {state === "pending" ? (
          <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-semibold">
            <span className="rounded-lg bg-[#4F46E5] py-1.5 text-center text-white">Accept</span>
            <span className="rounded-lg border border-[#E2E8F0] py-1.5 text-center text-[#334155]">Suggest time</span>
            <span className="rounded-lg border border-[#E2E8F0] py-1.5 text-center text-[#334155]">Decline</span>
          </div>
        ) : (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
            <CalendarCheck className="h-3.5 w-3.5" /> Accepted · shoot date set
          </p>
        )}
      </div>
    </Card>
  );
}

/** Card payment page (Stripe Checkout) for a project payment request. */
export function CheckoutCard({ className, amount = "$162.00", label = "Deposit (30%)" }: { className?: string; amount?: string; label?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div aria-hidden>
        <div className="bg-gradient-to-br from-[#0F172A] to-[#312E81] px-5 py-4 text-white">
          <p className="text-[11px] text-indigo-200">Pay Northfield Media</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{amount}</p>
          <p className="text-[11px] text-indigo-200">214 Oak Street · {label}</p>
        </div>
        <div className="space-y-2.5 p-5">
          <div className="h-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 text-[11px] leading-8 text-[#94A3B8]">avery@northsiderealty.com</div>
          <div className="flex h-8 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 text-[11px] text-[#94A3B8]">
            <CreditCard className="h-3.5 w-3.5" /> Card number
          </div>
          <div className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#4F46E5] text-xs font-semibold text-white">
            <Lock className="h-3 w-3" /> Pay {amount}
          </div>
          <p className="text-center text-[10px] text-[#94A3B8]">Secure checkout by Stripe · paid to your Stripe account</p>
        </div>
      </div>
    </Card>
  );
}

/** Payments section of a project: deposit paid, balance requested, receipt. */
export function PaymentLedgerCard({ className }: { className?: string }) {
  const rows: { label: string; amount: string; status: "paid" | "sent"; detail: string }[] = [
    { label: "Deposit (30%)", amount: "$162.00", status: "paid", detail: "Paid Oct 12 · card ••4242" },
    { label: "Balance", amount: "$378.00", status: "sent", detail: "Payment link sent" },
  ];
  return (
    <Card className={cn("p-5", className)}>
      <div aria-hidden>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Payments</p>
            <p className="text-[11px] text-[#64748B]">Approved proposal · $540.00</p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">$378.00 still owed</span>
        </div>
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5">
              <span className="flex items-center gap-2.5">
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", r.status === "paid" ? "bg-emerald-50 text-emerald-600" : "bg-[#EEF2FF] text-[#4F46E5]")}>
                  {r.status === "paid" ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                </span>
                <span>
                  <span className="block text-xs font-semibold text-[#0F172A]">{r.label}</span>
                  <span className="block text-[10px] text-[#64748B]">{r.detail}</span>
                </span>
              </span>
              <span className="text-xs font-semibold tabular-nums text-[#0F172A]">{r.amount}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
          {[
            { icon: Receipt, t: "Receipt emailed" },
            { icon: FileText, t: "Estimate PDF" },
            { icon: CheckCircle2, t: "Mark paid (offline)" },
          ].map(({ icon: Icon, t }) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2 py-1 text-[#334155]">
              <Icon className="h-3 w-3 text-[#4F46E5]" /> {t}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** Large video review player: pinned frame marker, timeline markers, thread with replies and resolve. */
export function ReviewPlayer({ className }: { className?: string }) {
  const comments = [
    { t: "0:14", who: "Avery (client)", text: "Can we hold on the front elevation a beat longer?", resolved: true, reply: "Done in v2, extended to 4 seconds." },
    { t: "0:38", who: "Avery (client)", text: "Swap this clip for the dusk pass if you have it.", resolved: false, reply: null },
    { t: "1:02", who: "Jordan (editor)", text: "Music fades early here, fixing in v3.", resolved: false, reply: null },
  ];
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-white/10 bg-[#0B1124] text-white shadow-[0_50px_100px_-50px_rgba(15,23,42,0.95)]", className)} aria-hidden>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs">
        <span className="font-semibold text-slate-100">214 Oak Street · Property film</span>
        <span className="flex gap-1.5">
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-slate-300">v1</span>
          <span className="rounded-full bg-[#4F46E5] px-2.5 py-0.5 font-semibold">v2</span>
        </span>
      </div>
      <div className="grid lg:grid-cols-[1.45fr_1fr]">
        <div className="p-5">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E293B] via-[#312E81] to-[#9333EA]">
            <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full opacity-70">
              <path d="M0 140 C 60 120, 120 135, 180 125 S 280 110, 320 122 V180 H0Z" fill="#0B1124" opacity="0.55" />
              <g transform="translate(110 70)">
                <path d="M0 45 L50 12 L100 45 Z" fill="#1F2937" />
                <rect x="8" y="45" width="84" height="40" fill="#E5E7EB" />
                <rect x="20" y="55" width="16" height="14" fill="#FCD34D" />
                <rect x="64" y="55" width="16" height="14" fill="#FCD34D" />
                <rect x="43" y="62" width="14" height="23" fill="#92400E" />
              </g>
            </svg>
            <span className="mk-pulse absolute left-[57%] top-[44%] h-5 w-5 rounded-full border-2 border-white bg-amber-400" />
            <span className="absolute left-[57%] top-[44%] ml-6 -mt-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-amber-100 backdrop-blur">0:38 · pinned here</span>
            <span className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <Play className="h-4 w-4 fill-white" />
            </span>
          </div>
          <div className="relative mt-4 h-2 rounded-full bg-white/10">
            <div className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-[#818CF8]" />
            {[18, 38, 62].map((at, i) => (
              <span
                key={at}
                className={cn("absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0B1124]", i === 0 ? "bg-emerald-400" : "bg-amber-300")}
                style={{ left: `${at}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-500">
            <span>0:00</span>
            <span>1:40</span>
          </div>
        </div>
        <ul className="space-y-2.5 border-t border-white/10 p-5 lg:border-l lg:border-t-0">
          {comments.map((c) => (
            <li key={c.t} className={cn("rounded-xl px-3 py-2.5 text-xs", c.resolved ? "bg-emerald-400/10" : "bg-white/5")}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="rounded bg-amber-300/15 px-1.5 font-mono text-[11px] text-amber-200">{c.t}</span>
                  <span className="text-[11px] text-slate-400">{c.who}</span>
                </span>
                {c.resolved ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> Resolved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <CircleDot className="h-3 w-3" /> Open
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-slate-100">{c.text}</p>
              {c.reply ? (
                <p className="mt-2 border-l-2 border-white/15 pl-2 text-[11px] text-slate-300">
                  <span className="font-semibold text-slate-200">Reply:</span> {c.reply}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The deliverable-level decision that sits beside video review. */
export function DeliverableDecisionCard({ className }: { className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <div aria-hidden>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Deliverable review</p>
        <ul className="mt-3 space-y-2">
          {[
            { name: "Property_Film_v2.mp4", s: "approved" as const },
            { name: "Aerial_Reel.mp4", s: "changes" as const },
            { name: "Listing photos (35)", s: "approved" as const },
          ].map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-3 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2">
              <span className="truncate text-xs font-medium text-[#0F172A]">{d.name}</span>
              {d.s === "approved" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <Check className="h-3 w-3" /> Approved
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <RotateCcw className="h-3 w-3" /> Changes requested
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-[#64748B]">When every deliverable is approved, the project moves to Awaiting Payment.</p>
      </div>
    </Card>
  );
}

export type AutomationKind = "automatic" | "one-click" | "you";

const KIND_STYLE: Record<AutomationKind, { label: string; className: string; icon: LucideIcon }> = {
  automatic: { label: "Automatic", className: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: Zap },
  "one-click": { label: "One step", className: "bg-[#EEF2FF] text-[#4338CA] ring-[#C7D2FE]", icon: Send },
  you: { label: "Your call", className: "bg-[#F1F5F9] text-[#475569] ring-[#E2E8F0]", icon: Clock },
};

export function AutomationBadge({ kind }: { kind: AutomationKind }) {
  const k = KIND_STYLE[kind];
  const Icon = k.icon;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", k.className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {k.label}
    </span>
  );
}

/** Honest automation ledger: what happens, what triggers it, and who does it. Real text, not decorative. */
export function AutomationLedger({
  rows,
}: {
  rows: { when: string; then: ReactNode; kind: AutomationKind; note?: string }[];
}) {
  return (
    <div className="mk-reveal overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-[0_30px_70px_-55px_rgba(15,23,42,0.7)]">
      <div className="hidden grid-cols-[1fr_1.5fr_auto] gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#64748B] md:grid">
        <span>When</span>
        <span>What happens</span>
        <span>Who does it</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.when} className="grid gap-2 border-b border-[#F1F5F9] px-6 py-4 last:border-0 md:grid-cols-[1fr_1.5fr_auto] md:items-center md:gap-4">
            <p className="font-semibold text-[#0F172A]">{r.when}</p>
            <div className="text-sm leading-relaxed text-[#475569]">
              {r.then}
              {r.note ? <span className="mt-1 block text-xs text-[#94A3B8]">{r.note}</span> : null}
            </div>
            <AutomationBadge kind={r.kind} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Animated node rail for heroes: stages with automatic hand-offs marked. */
export function AutomationRail({ className }: { className?: string }) {
  const nodes: { label: string; kind: AutomationKind }[] = [
    { label: "Request in", kind: "automatic" },
    { label: "Estimate sent", kind: "automatic" },
    { label: "Proposal", kind: "one-click" },
    { label: "Time accepted", kind: "automatic" },
    { label: "Send for review", kind: "one-click" },
    { label: "All approved", kind: "automatic" },
    { label: "Paid → delivered", kind: "automatic" },
  ];
  return (
    <div className={cn("relative rounded-3xl border border-[#E2E8F0] bg-white/90 p-5 shadow-[0_40px_90px_-55px_rgba(49,46,129,0.7)] backdrop-blur sm:p-7", className)} aria-hidden>
      <svg className="pointer-events-none absolute inset-x-8 top-[2.75rem] hidden h-3 w-[calc(100%-4rem)] sm:block" preserveAspectRatio="none" viewBox="0 0 100 4">
        <line x1="0" y1="2" x2="100" y2="2" stroke="#C7D2FE" strokeWidth="1.2" strokeDasharray="2 2.5" className="mk-flow-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <ol className="relative grid grid-cols-2 gap-3 sm:grid-cols-7 sm:gap-2">
        {nodes.map((n, i) => {
          const s = KIND_STYLE[n.kind];
          const Icon = s.icon;
          return (
            <li key={n.label} className="flex flex-col items-center text-center">
              <span
                className={cn(
                  "mk-float flex h-11 w-11 items-center justify-center rounded-2xl ring-1",
                  n.kind === "automatic" ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white ring-emerald-300" : "bg-white text-[#4F46E5] ring-[#C7D2FE]"
                )}
                style={{ animationDelay: `${i * 220}ms` }}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="mt-2 text-[11px] font-semibold leading-tight text-[#0F172A]">{n.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <AutomationBadge kind="automatic" />
        <AutomationBadge kind="one-click" />
      </div>
    </div>
  );
}

/** Business overview: stage counts, upcoming shoot, outstanding payments (mirrors the admin dashboard). */
export function BusinessHubCard({ className }: { className?: string }) {
  const stages = [
    { s: "New request", n: 3, c: "bg-sky-500" },
    { s: "Quote sent", n: 4, c: "bg-indigo-400" },
    { s: "Scheduled", n: 6, c: "bg-violet-500" },
    { s: "Review", n: 2, c: "bg-amber-400" },
    { s: "Awaiting payment", n: 3, c: "bg-rose-400" },
    { s: "Delivered", n: 18, c: "bg-emerald-500" },
  ];
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div aria-hidden>
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-5 py-3">
          <p className="text-sm font-semibold text-[#0F172A]">Northfield Media</p>
          <span className="text-[11px] text-[#64748B]">This month</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Projects by stage</p>
            <ul className="mt-2.5 space-y-2">
              {stages.map((st) => (
                <li key={st.s} className="flex items-center gap-2 text-[11px]">
                  <span className="w-[6.5rem] shrink-0 truncate text-[#475569]">{st.s}</span>
                  <span className="h-2 flex-1 rounded-full bg-[#F1F5F9]">
                    <span className={cn("block h-2 rounded-full", st.c)} style={{ width: `${Math.min(100, st.n * 5.5)}%` }} />
                  </span>
                  <span className="w-5 text-right font-semibold tabular-nums text-[#0F172A]">{st.n}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-[#E0E7FF] bg-[#EEF2FF]/60 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4F46E5]">
                <CalendarCheck className="h-3 w-3" /> Next shoot
              </p>
              <p className="mt-1 text-xs font-semibold text-[#0F172A]">Sat 10:00 AM · 214 Oak St</p>
              <p className="text-[10px] text-[#64748B]">Photos + aerials · Avery Chen</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                <CreditCard className="h-3 w-3" /> Outstanding
              </p>
              <p className="mt-1 text-xs font-semibold text-[#0F172A]">3 payments · $1,140</p>
              <p className="text-[10px] text-[#64748B]">Oldest sent 6 days ago</p>
            </div>
            <div className="rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                <MessageSquareText className="h-3 w-3" /> New messages
              </p>
              <p className="mt-1 text-xs font-semibold text-[#0F172A]">2 clients replied</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
