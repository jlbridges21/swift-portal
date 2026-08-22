import Link from "next/link";
import dynamic from "next/dynamic";
import { formatTrialDaysLabel } from "@/lib/plan-catalog";
import type { PlanRow } from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";
import {
  MarketingShell,
  MarketingCtaBand,
} from "@/components/marketing/marketing-chrome";
import { WorkflowRibbon } from "@/components/marketing/workflow-steps";
import { MarketingPricingGrid } from "@/components/marketing/marketing-pricing";
import { MarketingFaq } from "@/components/marketing/marketing-faq";
import { ClientPortalMockup } from "@/components/marketing/product-mockups";
import { HeroProductVizLazy } from "@/components/marketing/hero-viz-lazy";
import {
  CalendarClock,
  CreditCard,
  FolderKanban,
  Globe,
  Images,
  Link2,
  MessageSquare,
  Palette,
  Receipt,
  Users,
} from "lucide-react";

const WORKFLOW_STEPS = [
  "Request",
  "Estimate",
  "Schedule",
  "Shoot",
  "Review",
  "Pay",
  "Deliver",
] as const;

function HeroWorkflowStrip() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2" aria-label="Job workflow">
      {WORKFLOW_STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-1 text-sm">
          {i > 0 ? (
            <span className="mx-1 text-[#CBD5E1]" aria-hidden>
              →
            </span>
          ) : null}
          <span className="font-medium text-[#0F172A]">{step}</span>
        </li>
      ))}
    </ul>
  );
}

const ProductDemo = dynamic(
  () =>
    import("@/components/marketing/product-demo/product-demo").then((m) => m.ProductDemo),
  {
    ssr: true,
    loading: () => (
      <div
        className="mx-auto h-[560px] max-w-6xl animate-pulse rounded-2xl bg-[#F1F5F9]"
        aria-hidden
      />
    ),
  }
);

const REPLACES = [
  { label: "CRM", icon: Users },
  { label: "Scheduling", icon: CalendarClock },
  { label: "File delivery", icon: FolderKanban },
  { label: "Proofing", icon: Images },
  { label: "Invoicing", icon: Receipt },
] as const;

const FEATURES = [
  {
    icon: Palette,
    title: "Branded client portal",
    body: "Logo, colors, and your studio name on every client touchpoint — request through delivery.",
  },
  {
    icon: FolderKanban,
    title: "Services and pricing you define",
    body: "Per-business catalogs so estimates match what you actually sell, not a generic template.",
  },
  {
    icon: Receipt,
    title: "Preliminary estimates",
    body: "Send pricing from the project, get approval in-portal, and keep the paper trail with the job.",
  },
  {
    icon: CalendarClock,
    title: "Shoot scheduling with counter-proposals",
    body: "Propose times; clients can counter. Confirmation lands on the same calendar you run.",
  },
  {
    icon: Images,
    title: "Media review and approval",
    body: "Clients review deliverables where the project already lives — no expiring Dropbox links.",
  },
  {
    icon: MessageSquare,
    title: "In-portal messaging",
    body: "Threads stay on the client and project. Read receipts on admin messages so you know they saw it.",
  },
  {
    icon: CreditCard,
    title: "Stripe payments to your account",
    body: "Checkout from the project via Stripe Connect. ShootPortal does not take a cut of client payments.",
  },
  {
    icon: Globe,
    title: "Custom domain",
    body: "On plans that include it, clients open your portal on a domain you own.",
  },
] as const;

export function PlatformLanding({
  trialDays,
  plans,
}: {
  trialDays: number;
  plans: PlanRow[];
}) {
  const trialLabel =
    trialDays > 0
      ? `${formatTrialDaysLabel(trialDays)} Studio trial. No credit card required.`
      : "Create your studio — subscribe when you are ready.";

  const previewPlans = plans.filter((p) => p.key !== "founding").slice(0, 3);
  const pricingPlans = previewPlans.length ? previewPlans : plans.slice(0, 3);

  return (
    <MarketingShell trialNote={trialLabel}>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#E2E8F0]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(79,70,229,0.14), transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 72%, #F1F5F9 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pb-10 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold text-[#4F46E5]">
              For drone pilots, real estate media &amp; event shooters
            </p>
            <h1 className="mt-5 text-[2.125rem] font-bold leading-[1.12] tracking-tight text-[#0F172A] sm:text-5xl sm:leading-[1.08] lg:text-[3.5rem] lg:leading-[1.05]">
              Run your entire media business from one place.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#475569] sm:text-lg sm:leading-relaxed">
              Manage leads, projects, scheduling, client communication, media delivery, invoices,
              and payments in one streamlined portal built for media professionals.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="inline-flex">
                <Button className="min-h-12 bg-[#4F46E5] px-7 text-base font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-[#4338CA] focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2">
                  Start your free trial
                </Button>
              </Link>
              <a href="#product-demo" className="inline-flex">
                <Button
                  variant="outline"
                  className="min-h-12 border-[#E2E8F0] bg-white/80 px-6 text-base font-medium text-[#0F172A] hover:bg-white focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
                >
                  See it in action
                </Button>
              </a>
            </div>
            {trialDays > 0 ? (
              <p className="mt-4 text-sm text-[#475569]">
                {formatTrialDaysLabel(trialDays)} Studio trial — no credit card required.
              </p>
            ) : (
              <p className="mt-4 text-sm text-[#475569]">Create your studio — subscribe when ready.</p>
            )}
            <div className="mt-8 flex justify-center">
              <HeroWorkflowStrip />
            </div>
          </div>

          <div className="relative mx-auto mt-14 max-w-5xl lg:mt-16">
            <HeroProductVizLazy />
          </div>
        </div>
        <div
          className="pointer-events-none h-10 bg-gradient-to-b from-transparent to-white"
          aria-hidden
        />
      </section>

      {/* Replaces */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-[#64748B]">
            One portal instead of
          </h2>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {REPLACES.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.label}
                  className="flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm font-medium text-[#0F172A]"
                >
                  <Icon className="h-4 w-4 text-[#4F46E5]" aria-hidden />
                  {item.label}
                </li>
              );
            })}
          </ul>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-[#475569]">
            The point is consolidation — not another place to store files. Clients, projects,
            schedules, media, messages, and payments stay on the same job record.
          </p>
        </div>
      </section>

      {/* Interactive demo — centerpiece */}
      <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <ProductDemo />
        </div>
      </section>

      {/* Workflow ribbon */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
            The path every job follows
          </h2>
          <p className="mt-3 max-w-2xl text-base text-[#475569]">
            Request → Estimate → Schedule → Shoot → Review → Pay → Deliver — visible to you and your
            client in the same portal.
          </p>
          <div className="mt-10">
            <WorkflowRibbon />
          </div>
          <div className="mt-8">
            <Link
              href="/how-it-works"
              className="text-sm font-semibold text-[#4F46E5] hover:underline"
            >
              Explore the workflow in depth →
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
              What ShootPortal actually does for the business
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#475569]">
              Built for photographers, videographers, drone operators, and real estate media
              companies — features that exist in the product today, not a roadmap slide.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                    <Icon className="h-5 w-5 text-[#4F46E5]" aria-hidden />
                    <h3 className="mt-3 text-sm font-semibold text-[#0F172A]">{f.title}</h3>
                    <p className="mt-1 text-sm text-[#475569]">{f.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="lg:sticky lg:top-24">
            <ClientPortalMockup />
            <p className="mt-4 flex items-start gap-2 text-sm text-[#64748B]">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
              Client-facing portal mock — same branding controls you configure in admin settings.
            </p>
          </div>
        </div>
      </section>

      {/* Social proof — intentional placeholder, no fake quotes/logos */}
      <section className="border-y border-[#E2E8F0] bg-[#0F172A]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-[#818CF8]">
            Studios in production
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-300">
            Real testimonials and logos will live here. Until then we are not inventing them —
            ShootPortal is already running live client work for media businesses.
          </p>
          <div
            className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
            aria-hidden
          >
            {["Quote", "Logo", "Quote", "Logo"].map((label, i) => (
              <div
                key={`${label}-${i}`}
                className="flex h-16 items-center justify-center rounded-lg border border-dashed border-slate-500 bg-slate-900/40 text-xs font-medium uppercase tracking-wider text-slate-400"
              >
                {label} soon
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
              Plans from the live catalog
            </h2>
            <p className="mt-3 max-w-xl text-base text-[#475569]">
              Prices and trial length are read from the plans table — change them in platform admin
              and this page follows.
            </p>
          </div>
          <Link href="/pricing" className="text-sm font-semibold text-[#4F46E5] hover:underline">
            Full comparison →
          </Link>
        </div>
        <div className="mt-10">
          <MarketingPricingGrid plans={pricingPlans} />
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-[#0F172A]">
            Straight answers
          </h2>
          <div className="mt-10">
            <MarketingFaq trialDaysLabel={formatTrialDaysLabel(trialDays)} />
          </div>
        </div>
      </section>

      <MarketingCtaBand
        title="Put the next shoot in one portal."
        body="Start a Studio trial, brand the client experience, and stop stitching tools together between jobs."
        trialLabel={trialLabel}
      />
    </MarketingShell>
  );
}
