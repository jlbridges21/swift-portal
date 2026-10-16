import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Ban, CreditCard, HardDrive, Infinity as InfinityIcon, Percent } from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { MarketingHomePricing } from "@/components/marketing/marketing-home-pricing";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import { assertActivePlanKey, listPublicPlans, resolvePlanTrialDays, FALLBACK_TRIAL_DAYS } from "@/lib/entitlements";
import { formatAnnualSavingsLongLabel, formatPlanPrice, type PlanRow } from "@/lib/plan-catalog";
import {
  DemoShowcase,
  FinalCta,
  GradientText,
  Section,
  SolutionFaq,
  StepTimeline,
  TrialFacts,
} from "@/components/solutions/solution-sections";
import { ShowcaseImage } from "@/components/solutions/solution-media";
import { WorkflowCoverageMap } from "@/components/blog/conversion-parts";
import { MEDIA } from "@/lib/solution-media";

/** Revalidate so /platform plan edits show up without a redeploy. */
export const revalidate = 60;

export const metadata: Metadata = marketingPageMetadata({
  title: "Pricing",
  description:
    "One ShootPortal plan with every feature, monthly or annual. Live prices from our plan catalog. Start a free trial with no credit card required.",
  path: "/pricing",
});

/** Public plan limits. Admin seat caps are dormant on the public catalog, so they are not advertised. */
function planLimits(plan: PlanRow | null) {
  const limits = (plan?.limits ?? {}) as Record<string, unknown>;
  const storage = typeof limits.storage_gb === "number" ? limits.storage_gb : null;
  const projects = limits.projects_per_month;
  return {
    storage: storage ? `${storage} GB of media storage` : null,
    projects: projects === null ? "Unlimited projects and clients" : typeof projects === "number" ? `${projects} projects a month` : null,
  };
}

const INCLUDED: { group: string; items: string[] }[] = [
  { group: "Win the job", items: ["Branded request form and service catalog", "Automatic preliminary estimates with travel fees", "Official proposals with versions, expiry, and PDF"] },
  { group: "Run the job", items: ["Proposed shoot times clients accept or counter", "Google Calendar push and conflict view", "Project pipeline, client records, and messaging"] },
  { group: "Finish the job", items: ["Time-stamped video review with versions", "Deposits and card payments to your own Stripe", "Branded delivery with Print, MLS, and ZIP downloads"] },
  { group: "Your brand, your team", items: ["Your logo, colors, and custom domain", "Staff accounts with granular permissions", "Installable web app for your phone"] },
];

export default async function PricingPage() {
  await requirePlatformMarketingHost();

  const plans = await listPublicPlans();
  const studioPlan = plans.find((p) => p.key === "studio") ?? plans.find((p) => p.key !== "founding") ?? plans[0] ?? null;

  let trialDays = FALLBACK_TRIAL_DAYS;
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "pricing_page");
  } catch {
    /* fallback */
  }

  const monthly = studioPlan?.price_monthly_cents != null ? formatPlanPrice(studioPlan.price_monthly_cents) : null;
  const annual = studioPlan?.price_annual_cents != null ? formatPlanPrice(studioPlan.price_annual_cents) : null;
  const startingAt = annual ?? monthly;
  const savings = studioPlan ? formatAnnualSavingsLongLabel(studioPlan.price_monthly_cents, studioPlan.price_annual_cents) : null;
  const limits = planLimits(studioPlan);

  const ctx = { trialDays, studioMonthly: monthly, studioAnnual: annual };

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={trialDays > 0 ? `${trialDays} days free. No credit card required.` : null}>
        {/* Hero: copy + live plan card above the fold */}
        <section className="relative overflow-hidden border-b border-[#E2E8F0]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(79,70,229,0.15), transparent 60%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 85%)" }}
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-20 lg:pt-20">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">Pricing</p>
              <h1 className="mt-4 text-[2.15rem] font-bold leading-[1.08] tracking-tight text-[#0F172A] sm:text-5xl lg:text-[3.25rem]">
                One plan. Every feature.{" "}
                {startingAt ? <GradientText>From {startingAt} a month.</GradientText> : <GradientText>No add-ons.</GradientText>}
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-[#475569]">
                Requests, estimates, scheduling, client portal, video review, payments, and delivery in one subscription, instead of a
                stack of separate tools.
              </p>
              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: BadgeCheck, text: trialDays > 0 ? `${trialDays}-day free trial` : "Start free" },
                  { icon: CreditCard, text: "No credit card to start" },
                  { icon: Percent, text: "0% of your client payments" },
                  { icon: Ban, text: "No per-project or per-delivery fees" },
                  ...(limits.projects ? [{ icon: InfinityIcon, text: limits.projects }] : []),
                  ...(limits.storage ? [{ icon: HardDrive, text: limits.storage }] : []),
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-2.5 text-[0.98rem] text-[#1E293B]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F46E5]">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <MarketingHomePricing plan={studioPlan} trialDays={trialDays} ctaId="pricing:card" />
              <p className="mx-auto mt-4 max-w-lg text-center text-xs leading-relaxed text-[#64748B]">
                Prices load from the live plan catalog, the same source checkout uses. Client card payments go to your own Stripe
                account at Stripe&apos;s standard rates.
              </p>
            </div>
          </div>
        </section>

        {/* Everything included */}
        <Section
          eyebrow="Everything included"
          title="No tiers. No feature hunting."
          intro="Every ShootPortal account gets the whole platform. Here's what the one plan covers."
        >
          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <ShowcaseImage image={MEDIA.shared.allInOne} frame="dark" className="mk-reveal mx-auto w-full max-w-md" sizes="(min-width: 1024px) 448px, 100vw" />
            <div className="grid gap-6 sm:grid-cols-2">
              {INCLUDED.map((g) => (
                <div key={g.group} className="mk-reveal">
                  <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[#4F46E5]">{g.group}</h3>
                  <ul className="mt-3 space-y-2">
                    {g.items.map((it) => (
                      <li key={it} className="flex gap-2.5 text-sm leading-relaxed text-[#1E293B]">
                        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Replace the stack */}
        <Section
          eyebrow="Compare the alternative"
          title="One subscription instead of five apps"
          intro="Most media businesses pay for a booking tool, an invoicing app, file delivery, a CRM, and a spreadsheet, then stitch them together by hand."
          tone="cloud"
        >
          <ShowcaseImage image={MEDIA.business.comparison} className="mk-reveal mx-auto max-w-4xl" sizes="(min-width: 1024px) 896px, 100vw" />
          <div className="mx-auto mt-10 max-w-4xl">
            <WorkflowCoverageMap />
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-[#64748B]">
            Keep your editing software and your accounting software. ShootPortal runs the client side of the business around them.
          </p>
        </Section>

        <DemoShowcase
          eyebrow="See what you get"
          title="The whole plan, in under a minute"
          intro="A 52-second tour of real ShootPortal screens, from the client's request to payment and delivery under your own brand."
          video={MEDIA.shared.tour}
          points={["Requests, proposals, and scheduling", "Video review, payments, and share links", "Your own brand and domain"]}
          ctaId="pricing:demo"
          trialDays={trialDays}
        />

        {/* First week */}
        <Section eyebrow="How the trial works" title={trialDays > 0 ? `Your ${trialDays} days, step by step` : "Getting started, step by step"}>
          <StepTimeline
            steps={[
              { tag: "No card", title: "Create your studio", body: "Sign up with Google or a five-field form and pick your portal address. No card." },
              { tag: "Guided", title: "Add your brand and services", body: "Upload your logo, set colors, and start from service templates with your prices." },
              { tag: "Optional", title: "Connect Stripe", body: "Link your own Stripe account so clients can pay deposits and balances by card." },
              { tag: "Real job", title: "Send your request link", body: "Run one real client job from request to paid and delivered before you decide." },
            ]}
          />
          {trialDays === 14 ? (
            <ShowcaseImage image={MEDIA.shared.trialCard} frame="dark" className="mk-reveal mx-auto mt-12 max-w-3xl" sizes="(min-width: 768px) 768px, 100vw" />
          ) : null}
          <TrialFacts trialDays={trialDays} className="mt-8 justify-center" />
        </Section>

        <Section eyebrow="FAQ" title="Pricing questions" tone="cloud">
          <SolutionFaq
            items={[
              {
                q: "Is there really just one plan?",
                a: <p>Yes. Every account gets the full feature set. You choose monthly or annual billing{savings ? `; ${savings.charAt(0).toLowerCase()}${savings.slice(1)}` : ""}.</p>,
              },
              {
                q: "Do I need a credit card for the trial?",
                a: (
                  <p>
                    No. {trialDays > 0 ? `You get ${trialDays} days free. ` : ""}When the trial ends, you subscribe to keep using the studio side. Nothing is
                    charged automatically, because we never asked for a card.
                  </p>
                ),
              },
              {
                q: "Does ShootPortal take a percentage of my client payments?",
                a: <p>No. Client payments go directly to your own Stripe account, and ShootPortal takes 0%. Stripe&apos;s standard processing fees apply.</p>,
              },
              {
                q: "Are there per-project, per-client, or per-delivery fees?",
                a: <p>No. The subscription is flat{limits.projects ? `, with ${limits.projects.toLowerCase()}` : ""}{limits.storage ? ` and ${limits.storage}` : ""}.</p>,
              },
              {
                q: "Can I add my team?",
                a: <p>Yes. Invite staff with the permissions their role needs and assign them to the projects they work on.</p>,
              },
              {
                q: "Can I cancel?",
                a: <p>Yes, cancel anytime from billing. Your subscription runs to the end of the period you&apos;ve paid for.</p>,
              },
            ]}
          />
          <p className="mt-8 text-center text-sm text-[#64748B]">
            Want to see the workflow first?{" "}
            <Link href="/how-it-works" className="font-semibold text-[#4F46E5] hover:underline">
              See how it works
            </Link>
          </p>
        </Section>

        <FinalCta
          ctaId="pricing:final"
          ctx={ctx}
          secondary={{ href: "/how-it-works", label: "See how it works" }}
          title="Run your next job in ShootPortal"
          body="One plan with everything. Start free, put a real client job through it, and subscribe when you're convinced."
        />
      </MarketingShell>
    </BrandProvider>
  );
}
