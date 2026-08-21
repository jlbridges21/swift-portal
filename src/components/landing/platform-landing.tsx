import Link from "next/link";
import { SITE } from "@/lib/site-metadata";
import { MARKETING_BRAND } from "@/lib/marketing";
import { formatTrialDaysLabel } from "@/lib/plan-catalog";
import type { PlanRow } from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";
import {
  MarketingShell,
  MarketingCtaBand,
} from "@/components/marketing/marketing-chrome";
import { WorkflowStepGrid } from "@/components/marketing/workflow-steps";
import { MarketingPricingGrid } from "@/components/marketing/marketing-pricing";
import { MarketingFaq } from "@/components/marketing/marketing-faq";
import { PortalMockup, ClientPortalMockup } from "@/components/marketing/product-mockups";
import {
  FolderKanban,
  Link2,
  MessageSquare,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const PROBLEMS = [
  {
    title: "Five tools for one job",
    body: "CRM in one tab, calendar in another, Dropbox for files, a proofing link that expires, and invoices somewhere else. You are the glue.",
  },
  {
    title: "Clients get lost in email",
    body: "Estimates buried in threads. Shoot times negotiated by text. Finals sent as zip files with no context. Everyone loses the plot.",
  },
  {
    title: "Your brand never shows up",
    body: "Shared folder links look the same for every shooter. Your client portal should look like your studio — not a generic file dump.",
  },
] as const;

const FEATURES = [
  {
    icon: FolderKanban,
    title: "One project record",
    body: "Request, estimate, schedule, media, messages, and payments stay attached to the same job.",
  },
  {
    icon: Palette,
    title: "Your branding",
    body: "Logo, colors, and portal name on the client experience — so the work feels like your studio.",
  },
  {
    icon: MessageSquare,
    title: "In-portal messaging",
    body: "Talk to clients where the files and approvals already live. Fewer “which Dropbox?” replies.",
  },
  {
    icon: Link2,
    title: "Custom domain",
    body: "On plans that include it, clients open your portal on a domain you own.",
  },
  {
    icon: ShieldCheck,
    title: "Payments that fit the job",
    body: "Stripe checkout from the project, with Connect so you can get paid without a separate invoicing stack.",
  },
  {
    icon: Sparkles,
    title: "Built for media work",
    body: "Photos, video, and delivery workflows — not a generic CRM with an upload button bolted on.",
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
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 70% -10%, rgba(79,70,229,0.14), transparent), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
              {SITE.name}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-[#0F172A] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
              {MARKETING_BRAND.hero}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#475569]">
              {MARKETING_BRAND.heroSupport}
            </p>
            <p className="mt-3 text-base font-medium text-[#0F172A]">
              {MARKETING_BRAND.tagline}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button className="min-h-11 bg-[#4F46E5] px-6 text-white hover:bg-[#4338CA]">
                  Start free trial
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button
                  variant="outline"
                  className="min-h-11 border-[#E2E8F0] bg-white px-6 text-[#0F172A]"
                >
                  See how it works
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-[#475569]">{trialLabel}</p>
          </div>
          <PortalMockup />
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
          You did not become a photographer to manage software.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#475569]">
          If your week is email threads, calendar pings, and “here’s another link,” you are paying
          for five products to do one job: run the client from request to delivery.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PROBLEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-[#0F172A]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="border-y border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
            Request → Estimate → Schedule → Shoot → Review → Pay → Deliver
          </h2>
          <p className="mt-4 max-w-2xl text-base text-[#475569]">
            One portal for the whole path. Your clients always know what happens next.
          </p>
          <div className="mt-10">
            <WorkflowStepGrid />
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
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
              Replace the patchwork — not your craft.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#475569]">
              ShootPortal is for photographers, videographers, drone operators, real estate media
              companies, and event shooters who want one branded client experience instead of a
              Frankenstein stack.
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
          <ClientPortalMockup />
        </div>
      </section>

      {/* Social proof placeholder */}
      <section className="border-y border-[#E2E8F0] bg-[#0F172A]">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            Built with working studios
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            ShootPortal is used by media businesses running real client work — estimates, shoots,
            reviews, and delivery — in production today. Case studies coming soon.
          </p>
        </div>
      </section>

      {/* Pricing summary */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
              Simple plans for working shooters
            </h2>
            <p className="mt-3 max-w-xl text-base text-[#475569]">
              Prices and trial length come from your live plan catalog — what you see here is what
              billing uses.
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
            Questions photographers actually ask
          </h2>
          <div className="mt-10">
            <MarketingFaq trialDaysLabel={formatTrialDaysLabel(trialDays)} />
          </div>
        </div>
      </section>

      <MarketingCtaBand
        title="Run your next job in one portal."
        body="Start a Studio trial, brand your client experience, and stop stitching tools together."
        trialLabel={trialLabel}
      />
    </MarketingShell>
  );
}
