import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  Camera,
  Check,
  ClipboardList,
  CreditCard,
  FileText,
  Minus,
  PackageCheck,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Conversion building blocks for blog articles. Every product statement in
 * these components is limited to verified ShootPortal behavior (see the
 * blog fact sheet); articles pass in the article-specific wording.
 */

/** Short inline panel tying the current topic to one ShootPortal capability. */
export function ProductCallout({
  title,
  children,
  href = "/how-it-works",
  linkLabel = "See how it works",
}: {
  title: string;
  children: ReactNode;
  href?: "/how-it-works" | "/pricing" | "/signup" | "/#product-demo";
  linkLabel?: string;
}) {
  return (
    <aside className="mk-reveal relative !mt-8 overflow-hidden rounded-2xl border border-[#C7D2FE] bg-gradient-to-br from-[#EEF2FF] via-white to-white p-5 sm:p-6">
      <div className="flex gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-sm">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#4F46E5]">In ShootPortal</p>
          <p className="mt-1 font-semibold leading-snug text-[#0F172A]">{title}</p>
          <div className="mt-1.5 text-[0.97rem] leading-relaxed text-[#334155] [&>p+p]:mt-2">{children}</div>
          <Link
            href={href}
            className="mk-btn mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#4F46E5] hover:text-[#4338CA]"
          >
            {linkLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </aside>
  );
}

/**
 * Trial card. Offer details are verified: trial length comes from the live
 * plan, no card is collected at signup, signup is five fields or Google, and
 * onboarding is a guided, skippable setup.
 */
export function TrialCard({
  trialDays,
  title,
  body,
  secondaryHref = "/how-it-works",
  secondaryLabel = "See how it works",
}: {
  trialDays: number;
  title: string;
  body: ReactNode;
  secondaryHref?: "/how-it-works" | "/pricing" | "/#product-demo";
  secondaryLabel?: string;
}) {
  const points = [
    trialDays > 0 ? `${trialDays}-day free trial` : "Free to start",
    "No credit card required",
    "Sign up with Google or a five-field form",
    "Guided setup for branding, services, and payments",
  ];
  return (
    <aside className="mk-reveal relative !mt-12 overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-[0_30px_70px_-50px_rgba(79,70,229,0.7)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#A855F7]" aria-hidden />
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <p className="text-xl font-semibold tracking-tight text-[#0F172A]">{title}</p>
          <div className="mt-2 text-[0.98rem] leading-relaxed text-[#475569]">{body}</div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/signup"
              data-sp-cta="blog:trial-card"
              className="mk-btn inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#4F46E5] px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-[#4338CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
            >
              {trialDays > 0 ? `Start your ${trialDays}-day free trial` : "Start free"} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={secondaryHref}
              className="mk-btn inline-flex min-h-11 items-center rounded-lg border border-[#E2E8F0] px-5 text-sm font-medium text-[#0F172A] transition hover:border-[#C7D2FE] hover:bg-[#EEF2FF]/50"
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>
        <ul className="mk-plain-list space-y-2.5 rounded-2xl bg-[#F8FAFC] p-5 text-sm text-[#1E293B]">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF]">
                <Check className="h-3 w-3 text-[#4F46E5]" strokeWidth={3} aria-hidden />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** "Who ShootPortal is best for" — ideal profiles plus honest not-a-fit cases. */
export function BestFitPanel({
  heading = "Who ShootPortal fits best",
  fits,
  notFor,
}: {
  heading?: string;
  fits: { who: string; why: ReactNode }[];
  notFor?: ReactNode[];
}) {
  return (
    <div className="mk-reveal !mt-8 overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white">
      <div className="border-b border-[#E2E8F0] bg-gradient-to-r from-[#0F172A] to-[#1E1B4B] px-6 py-4">
        <p className="text-sm font-semibold text-white">{heading}</p>
      </div>
      <ul className="mk-plain-list grid gap-px bg-[#E2E8F0] sm:grid-cols-2">
        {fits.map((f) => (
          <li key={f.who} className="bg-white p-5">
            <p className="flex items-center gap-2 font-semibold text-[#0F172A]">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              {f.who}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{f.why}</p>
          </li>
        ))}
      </ul>
      {notFor?.length ? (
        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">Probably not the right fit if</p>
          <ul className="mk-plain-list mt-2 space-y-1.5 text-sm text-[#475569]">
            {notFor.map((n, i) => (
              <li key={i} className="flex gap-2">
                <Minus className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const COVERAGE: { key: string; label: string; icon: LucideIcon; features: string[] }[] = [
  { key: "request", label: "Request", icon: ClipboardList, features: ["Branded request form", "Service catalog", "Client record created"] },
  { key: "estimate", label: "Estimate", icon: FileText, features: ["Preliminary estimate", "ZIP-distance travel fees", "Versioned estimate + PDF"] },
  { key: "schedule", label: "Schedule", icon: CalendarClock, features: ["Propose a shoot time", "Client accepts or counters", "Push to Google Calendar"] },
  { key: "shoot", label: "Shoot", icon: Camera, features: ["Brief, address, notes on the job", "Staff assigned to projects"] },
  { key: "review", label: "Review", icon: MessageSquareText, features: ["Approve or request changes", "Time-stamped video comments", "Numbered versions"] },
  { key: "pay", label: "Pay", icon: CreditCard, features: ["Deposits on approval", "Card payments via your Stripe", "Receipts by email"] },
  { key: "deliver", label: "Deliver", icon: PackageCheck, features: ["Print or MLS-size downloads", "ZIP downloads", "Optional unlock after payment"] },
];

/** Verified ShootPortal capabilities mapped onto the seven workflow stages. */
export function WorkflowCoverageMap({ highlight = [] }: { highlight?: string[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#E2E8F0] bg-gradient-to-b from-white to-[#F8FAFC] p-4 sm:p-6">
      <ol className="mk-plain-list grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {COVERAGE.map((s) => {
          const on = highlight.length === 0 || highlight.includes(s.key);
          const Icon = s.icon;
          return (
            <li
              key={s.key}
              className={cn(
                "rounded-2xl border p-3.5 transition",
                on ? "border-[#C7D2FE] bg-white shadow-[0_16px_40px_-32px_rgba(79,70,229,0.8)]" : "border-[#E2E8F0] bg-white/60 opacity-70"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  on ? "bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white" : "bg-[#F1F5F9] text-[#94A3B8]"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <p className="mt-2.5 text-sm font-semibold text-[#0F172A]">{s.label}</p>
              <ul className="mk-plain-list mt-1.5 space-y-1 text-xs leading-snug text-[#475569]">
                {s.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A realistic first-week plan for evaluating ShootPortal during the trial. */
export function TrialPlan({ steps }: { steps?: { title: string; body: ReactNode }[] }) {
  const items = steps ?? [
    { title: "Create your studio", body: "Sign up with Google or five fields, then pick your portal address." },
    { title: "Run the guided setup", body: "Add your logo and brand color, start from a service template, and connect Stripe. Any step can be skipped and finished later." },
    { title: "Put one real job through it", body: "Create a project, send the estimate, propose the shoot time, and upload the finals." },
    { title: "Look at it as your client", body: "Open the portal the way your client would: approve, review, pay, and download." },
  ];
  return (
    <ol className="mk-plain-list mk-reveal !mt-6 grid gap-3 sm:grid-cols-2">
      {items.map((s, i) => (
        <li key={s.title} className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">Step {i + 1}</p>
          <p className="mt-1 font-semibold text-[#0F172A]">{s.title}</p>
          <div className="mt-1 text-sm leading-relaxed text-[#475569]">{s.body}</div>
        </li>
      ))}
    </ol>
  );
}
