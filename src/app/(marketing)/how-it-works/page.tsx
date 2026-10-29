import type { Metadata } from "next";
import Link from "next/link";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { InteractiveWorkflow } from "@/components/marketing/how-it-works/interactive-workflow";
import { BeforeAfterConverge } from "@/components/marketing/how-it-works/before-after";
import { DemoVideo, LoopVideo, ShowcaseImage } from "@/components/solutions/solution-media";
import { REAL_CAPTURE_NOTE, TrialFacts } from "@/components/solutions/solution-sections";
import { MEDIA } from "@/lib/solution-media";
import { jsonLdString } from "@/lib/blog/structured-data";
import { graph, webPageNode, videoNode, DEMO_VIDEO_UPLOAD_DATE } from "@/lib/marketing-jsonld";
import { Check } from "lucide-react";
import { OutcomeCards } from "@/components/marketing/how-it-works/outcome-cards";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import {
  assertActivePlanKey,
  listPublicPlans,
  resolvePlanTrialDays,
  FALLBACK_TRIAL_DAYS,
} from "@/lib/entitlements";
import { formatPlanPrice } from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";

export const revalidate = 300;

export const metadata: Metadata = marketingPageMetadata({
  title: "How it works",
  description:
    "See how ShootPortal keeps every job connected from new request to paid and delivered: estimate, schedule, shoot, review, invoice, and media delivery in one place.",
  path: "/how-it-works",
});

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">
      {children}
    </p>
  );
}

export default async function HowItWorksPage() {
  await requirePlatformMarketingHost();

  let trialDays = FALLBACK_TRIAL_DAYS;
  let studioPlan: Awaited<ReturnType<typeof listPublicPlans>>[number] | null = null;
  try {
    const studio = await assertActivePlanKey("studio");
    trialDays = resolvePlanTrialDays(studio, "how_it_works");
    studioPlan = studio;
  } catch {
    try {
      const plans = await listPublicPlans();
      studioPlan =
        plans.find((p) => p.key === "studio") ??
        plans.find((p) => p.key !== "founding") ??
        plans[0] ??
        null;
    } catch {
      /* fallback */
    }
  }

  const monthlyPriceLabel =
    studioPlan?.price_monthly_cents != null
      ? formatPlanPrice(studioPlan.price_monthly_cents)
      : "$29";
  const annualPriceLabel =
    studioPlan?.price_annual_cents != null
      ? formatPlanPrice(studioPlan.price_annual_cents)
      : "$24";

  const trialNote =
    trialDays > 0
      ? `${trialDays} days free. No credit card required.`
      : "Create your studio. Subscribe when you are ready.";

  const pricingNote =
    studioPlan?.price_annual_cents != null
      ? `Then ${monthlyPriceLabel} per month, or ${annualPriceLabel} per month billed annually.`
      : `Then ${monthlyPriceLabel} per month.`;

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={trialNote}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString(
              graph(
                webPageNode("/how-it-works", "How ShootPortal works", "How ShootPortal keeps every job connected from new request to paid and delivered.", [{ name: "How it works", path: "/how-it-works" }]),
                videoNode(MEDIA.realEstate.demo, {
                  name: "A job from request to paid in ShootPortal",
                  description: "Step by step on real ShootPortal screens: request, automatic preliminary estimate, scheduling, time-stamped video feedback, and Stripe payment.",
                  uploadDate: DEMO_VIDEO_UPLOAD_DATE,
                  duration: "PT37S",
                })
              )
            ),
          }}
        />
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-[#E2E8F0]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(79,70,229,0.14), transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 72%, #F1F5F9 100%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 sm:pt-16 lg:px-8 lg:pb-14 lg:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>HOW IT WORKS</SectionEyebrow>
              <h1 className="mt-4 text-[2rem] font-bold leading-[1.12] tracking-tight text-[#0F172A] sm:text-5xl sm:leading-[1.08] lg:text-[3.25rem] lg:leading-[1.05]">
                From new request to paid and delivered. All in one place.
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#475569] sm:text-lg">
                ShootPortal keeps every part of the job connected, so you are not jumping between
                texts, email, calendars, file links, invoices, and payment apps just to finish one
                project.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup" className="inline-flex" data-sp-cta="hiw:hero">
                  <Button className="min-h-12 bg-[#4F46E5] px-7 text-base font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-[#4338CA] focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2">
                    {trialDays > 0 ? `Start your ${trialDays}-day free trial` : "Start free"}
                  </Button>
                </Link>
                <a href="#workflow" className="inline-flex">
                  <Button
                    variant="outline"
                    className="min-h-12 border-[#E2E8F0] bg-white/80 px-6 text-base font-medium text-[#0F172A] hover:bg-white focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
                  >
                    See the workflow
                  </Button>
                </a>
              </div>
              <TrialFacts trialDays={trialDays} className="mt-5 justify-center" />
            </div>

            <div className="relative mx-auto mt-12 max-w-5xl lg:mt-14">
              <div
                className="pointer-events-none absolute -inset-x-10 -bottom-10 top-10 rounded-[3rem] bg-gradient-to-b from-[#4F46E5]/25 via-[#7C3AED]/15 to-transparent blur-3xl"
                aria-hidden
              />
              <DemoVideo
                video={MEDIA.realEstate.demo}
                className="relative"
                ctaHint="Watch one job go from the client's request to paid, step by step. Real ShootPortal screens, no sound."
              />
            </div>
          </div>
        </section>

        {/* Interactive workflow */}
        <section id="workflow" className="scroll-mt-24 border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>ONE PROJECT. ONE WORKFLOW.</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                See exactly what happens next.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                Every step of the job stays connected, so you always know where a project stands and
                what needs your attention.
              </p>
            </div>
            <div className="mt-10 lg:mt-12">
              <InteractiveWorkflow />
            </div>
          </div>
        </section>

        {/* Pain to solution */}
        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>LESS ADMIN. MORE SHOOTING.</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                Stop running every job through five different apps.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                A lot of media businesses start with texts, calendar apps, Dropbox, Stripe,
                spreadsheets, and whatever else gets the job done. It works until the volume picks
                up.
              </p>
            </div>
            <div className="mt-10 lg:mt-12">
              <BeforeAfterConverge />
            </div>
          </div>
        </section>

        {/* Admin side */}
        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-20">
            <div>
              <SectionEyebrow>YOUR STUDIO</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                Everything you need to run the job.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#475569]">
                Projects, scheduling, messages, media, invoices, and client details stay connected
                to the same project. When you need something, open the job instead of searching
                through five different apps.
              </p>
            </div>
            <figure>
              <ShowcaseImage image={MEDIA.realEstate.heroDashboard} frame="none" sizes="(min-width: 1024px) 560px, 100vw" />
              <figcaption className="mt-2 text-center text-xs text-[#64748B]">Your Command Center on desktop and phone. {REAL_CAPTURE_NOTE}</figcaption>
            </figure>
          </div>
        </section>

        {/* Client side */}
        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-20">
            <figure className="order-2 lg:order-1">
              <LoopVideo video={MEDIA.portal.film} frame="dark" />
              <figcaption className="mt-2 text-center text-xs text-[#64748B]">What your client sees: projects, progress, proposals, payments, and media.</figcaption>
            </figure>
            <div className="order-1 lg:order-2">
              <SectionEyebrow>CLIENT PORTAL</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                A better experience for your clients too.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#475569]">
                Your client gets one clean place to approve the project, confirm the shoot, review
                media, pay, and download the final files. No account juggling. No mystery folders.
                No hunting through old emails.
              </p>
              <p className="mt-4 text-sm font-medium text-[#0F172A]">
                You look more professional without adding more work.
              </p>
            </div>
          </div>
        </section>

        {/* What runs on its own */}
        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12 lg:px-8 lg:py-20">
            <div>
              <SectionEyebrow>WHAT RUNS ON ITS OWN</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                The hand-offs happen while you&apos;re shooting.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#475569]">
                When a client acts, ShootPortal takes the next step. You keep the decisions; the busywork moves on its own.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "A request creates the project, the client account, and a confirmation email",
                  "A preliminary estimate can go out the moment the request arrives",
                  "Approving a proposal can create the payment link",
                  "Payment sends a receipt and can open the downloads",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-[0.98rem] text-[#1E293B]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                      <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} aria-hidden />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <Link href="/real-estate-photography-workflow-software" className="mt-6 inline-flex text-sm font-semibold text-[#4F46E5] hover:underline">
                See exactly what&apos;s automatic and what stays with you
              </Link>
            </div>
            <figure>
              <ShowcaseImage image={MEDIA.workflow.hero} frame="dark" sizes="(min-width: 1024px) 620px, 100vw" />
              <figcaption className="mt-2 text-center text-xs text-[#64748B]">Automatic client emails and optional payment automations. {REAL_CAPTURE_NOTE}</figcaption>
            </figure>
          </div>
        </section>

        {/* Outcomes */}
        <section className="border-b border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>WHAT CHANGES</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                Less time managing the business. More time doing the work.
              </h2>
            </div>
            <div className="mt-10">
              <OutcomeCards />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden bg-[#0F172A]">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 70% 20%, rgba(79,70,229,0.35), transparent 55%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A5B4FC]">
                READY TO TRY IT?
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Put your next shoot in ShootPortal.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                Start with one real project and see how much easier it is when the client,
                schedule, messages, media, invoice, and payment all stay together.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup" className="inline-flex" data-sp-cta="hiw:final">
                  <Button className="min-h-12 bg-[#4F46E5] px-7 text-base font-semibold text-white hover:bg-[#4338CA]">
                    Start your free trial
                  </Button>
                </Link>
                <Link href="/pricing" className="inline-flex">
                  <Button
                    variant="outline"
                    className="min-h-12 border-white/20 bg-transparent px-6 text-base font-medium text-white hover:bg-white/10"
                  >
                    View pricing
                  </Button>
                </Link>
              </div>
              {trialDays > 0 ? (
                <p className="mt-4 text-sm text-slate-300">{trialNote}</p>
              ) : null}
              <p className="mt-2 text-sm text-slate-400">{pricingNote}</p>
            </div>
          </div>
        </section>
      </MarketingShell>
    </BrandProvider>
  );
}
