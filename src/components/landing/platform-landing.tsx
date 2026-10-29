import Link from "next/link";
import {
  formatAnnualSavingsLabel,
  formatAnnualSavingsLongLabel,
  formatTrialDaysLabel,
  formatPlanPrice,
} from "@/lib/plan-catalog";
import type { PlanRow } from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";
import {
  MarketingShell,
  MarketingCtaBand,
} from "@/components/marketing/marketing-chrome";
import { MarketingHomePricing } from "@/components/marketing/marketing-home-pricing";
import { MarketingFaq } from "@/components/marketing/marketing-faq";
import { HomepageWorkflowMarquee } from "@/components/marketing/home/workflow-marquee";
import { ConsolidationPills } from "@/components/marketing/home/consolidation-pills";
import { HomePainConverge } from "@/components/marketing/home/pain-converge";
import { FeatureTabs } from "@/components/solutions/feature-tabs";
import { LoopVideo, ShowcaseImage } from "@/components/solutions/solution-media";
import { DemoShowcase, FounderNote, SolutionPreviewCards, TrialFacts } from "@/components/solutions/solution-sections";
import { MEDIA } from "@/lib/solution-media";
import { jsonLdString } from "@/lib/blog/structured-data";
import { graph, webPageNode, websiteNode, softwareNode, videoNode, DEMO_VIDEO_UPLOAD_DATE } from "@/lib/marketing-jsonld";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FolderKanban,
  Images,
  Link2,
  MessageSquare,
  Paintbrush,
  Palette,
  Users,
  FileText,
  UserPlus,
} from "lucide-react";

const FEATURES = [
  {
    icon: Palette,
    title: "Branded client portal",
    body: "Give clients one professional place to approve work, view project details, access media, and handle payment.",
  },
  {
    icon: FileText,
    title: "Estimates and approvals",
    body: "Send clear estimates and let clients approve the project before the shoot moves forward.",
  },
  {
    icon: CalendarClock,
    title: "Scheduling",
    body: "Keep shoot dates connected to the project so scheduling stays with the job, not in a separate calendar tab.",
  },
  {
    icon: MessageSquare,
    title: "Client communication",
    body: "Stop searching old texts and emails for what the client asked for. Keep the conversation on the job.",
  },
  {
    icon: Images,
    title: "Media delivery",
    body: "Give clients one clean place to get their photos and videos instead of sending another random download link.",
  },
  {
    icon: FolderKanban,
    title: "Project management",
    body: "Open the project and see exactly what needs to happen next.",
  },
  {
    icon: CreditCard,
    title: "Invoices and payments",
    body: "Send the invoice from the project and know what has been paid without another follow-up chase.",
  },
  {
    icon: Users,
    title: "Client management",
    body: "Keep contact information, previous jobs, project history, and payment activity in one place.",
  },
  {
    icon: UserPlus,
    title: "Lead capture",
    body: "Turn website inquiries into organized leads and projects instead of letting them disappear into your inbox.",
  },
  {
    icon: Link2,
    title: "One record for every job",
    body: "Scheduling, messages, files, approvals, invoices, and payments stay connected to the same project.",
  },
  {
    icon: CheckCircle2,
    title: "Client approvals",
    body: "Let clients approve estimates, shoot details, and project decisions without chasing another text or email.",
  },
  {
    icon: Paintbrush,
    title: "Business branding",
    body: "Customize the client experience with your logo, colors, services, and branded communication.",
  },
] as const;

const PAIN_POINTS = [
  "No more hunting through old texts and emails for project details.",
  "No more wondering which jobs still need payment.",
  "No more sending clients five different links.",
  "No more keeping your calendar separate from your projects.",
  "No more building your own workflow out of disconnected software.",
] as const;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">
      {children}
    </p>
  );
}

export function PlatformLanding({
  trialDays,
  plans,
}: {
  trialDays: number;
  plans: PlanRow[];
}) {
  const studioPlan =
    plans.find((p) => p.key === "studio") ?? plans.find((p) => p.key !== "founding") ?? plans[0];
  const monthlyPriceLabel = studioPlan ? formatPlanPrice(studioPlan.price_monthly_cents) : "$29";
  const annualPriceLabel = studioPlan?.price_annual_cents
    ? formatPlanPrice(studioPlan.price_annual_cents)
    : monthlyPriceLabel;
  const annualSavingsLabel = studioPlan
    ? formatAnnualSavingsLabel(studioPlan.price_monthly_cents, studioPlan.price_annual_cents)
    : null;
  const annualSavingsLongLabel = studioPlan
    ? formatAnnualSavingsLongLabel(studioPlan.price_monthly_cents, studioPlan.price_annual_cents)
    : null;
  const trialDaysLabel = formatTrialDaysLabel(trialDays);

  const trialNote =
    trialDays > 0
      ? `${trialDays} days free. No credit card required.`
      : "Create your studio. Subscribe when you are ready.";

  const finalTrialNote =
    trialDays > 0
      ? `${monthlyPriceLabel} a month after your ${trialDays} day trial. Cancel anytime.`
      : `${monthlyPriceLabel} a month. Cancel anytime.`;

  return (
    <MarketingShell trialNote={trialNote}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            graph(
              websiteNode(),
              softwareNode(studioPlan ? monthlyPriceLabel : null, trialDays),
              webPageNode("/", "ShootPortal: Run Your Media Business in One Place", "Requests, estimates, scheduling, client portal, video review, payments, and delivery in one platform for photographers, videographers, and drone pilots."),
              videoNode(MEDIA.shared.tour, {
                name: "ShootPortal product tour",
                description: "A 52-second tour of real ShootPortal screens: client requests, proposal approval, calendar, pipeline, time-stamped video review, payments, share links, and branding.",
                uploadDate: DEMO_VIDEO_UPLOAD_DATE,
                duration: "PT52S",
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
        <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pb-10 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>BUILT FOR REAL ESTATE MEDIA</SectionEyebrow>
            <h1 className="mt-5 text-[2.125rem] font-bold leading-[1.12] tracking-tight text-[#0F172A] sm:text-5xl sm:leading-[1.08] lg:text-[3.5rem] lg:leading-[1.05]">
              Run your entire media business from one place.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#475569] sm:text-lg sm:leading-relaxed">
              Manage leads, projects, scheduling, client communication, media delivery, invoices,
              and payments in one simple portal built for real estate media professionals.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="inline-flex" data-sp-cta="home:hero">
                <Button className="min-h-12 bg-[#4F46E5] px-7 text-base font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-[#4338CA] focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2">
                  {trialDays > 0 ? `Start your ${trialDays}-day free trial` : "Start free"}
                </Button>
              </Link>
              <a href="#product-demo" className="inline-flex">
                <Button
                  variant="outline"
                  className="min-h-12 border-[#E2E8F0] bg-white/80 px-6 text-base font-medium text-[#0F172A] hover:bg-white focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
                >
                  Watch the 1-minute tour
                </Button>
              </a>
            </div>
            <TrialFacts trialDays={trialDays} className="mt-5 justify-center" />
            <p className="mt-3 text-sm text-[#475569]">
              Already know you want it?{" "}
              <a href="#pricing" className="font-semibold text-[#4F46E5] underline-offset-4 hover:underline">
                Choose a plan and subscribe now
              </a>
            </p>
          </div>

          <figure className="relative mx-auto mt-14 max-w-5xl lg:mt-16">
            <div
              className="pointer-events-none absolute -inset-x-10 -bottom-10 top-10 rounded-[3rem] bg-gradient-to-b from-[#4F46E5]/25 via-[#7C3AED]/15 to-transparent blur-3xl"
              aria-hidden
            />
            <ShowcaseImage image={MEDIA.business.hero} frame="dark" priority sizes="(min-width: 1024px) 1024px, 100vw" className="relative ring-1 ring-black/5" />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">
              The ShootPortal Command Center with video review and payments. Real screens from a live account.
            </figcaption>
          </figure>
        </div>
        <div
          className="pointer-events-none h-10 bg-gradient-to-b from-transparent to-white"
          aria-hidden
        />
      </section>

      {/* Consolidation strip */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-[#64748B]">
            ONE PORTAL INSTEAD OF
          </h2>
          <ConsolidationPills />
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-[#475569]">
            Your clients, projects, schedule, media, messages, invoices, and payments all stay
            connected to the same job.
          </p>
        </div>
      </section>

      {/* Product tour: real demo video, then real screens by area */}
      <DemoShowcase
        id="product-demo"
        eyebrow="Product tour"
        title="See a real job go from request to paid"
        intro="A 52-second tour of real ShootPortal screens: the client's request, proposal approval, your calendar, the pipeline, time-stamped video review, payments, share links, and your own brand and domain."
        video={MEDIA.shared.tour}
        points={["Clients request and approve on your branded portal", "Video review, payments, and files on the same project", "Everything under your own brand and domain"]}
        ctaId="home:demo"
        trialDays={trialDays}
        ctaLabel="Try it on your next job"
      />

      <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <SectionEyebrow>EXPLORE THE PRODUCT</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
              Every part of the job, on real screens.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#475569]">
              Pick an area. Each view is ShootPortal as it runs today, with client details blurred.
            </p>
          </div>
          <div className="mt-10">
            <FeatureTabs
              label="ShootPortal product areas"
              tabs={[
                { key: "requests", title: "Requests", summary: "Clients request a shoot from your branded form.", visual: <ShowcaseImage image={MEDIA.booking.twoViews} sizes="(min-width: 1024px) 640px, 100vw" />, body: <p>The request form captures the address, the service from your catalog, a preferred date, and notes, then creates the project and the client&apos;s account.</p> },
                { key: "estimates", title: "Estimates & approvals", summary: "Send the proposal; the client approves online.", visual: <ShowcaseImage image={MEDIA.realEstate.twoSided} sizes="(min-width: 1024px) 640px, 100vw" />, body: <p>Preliminary estimates can go out automatically. You send the official proposal and the client approves it or requests changes in their portal.</p> },
                { key: "calendar", title: "Scheduling", summary: "Shoots on your calendar, next to Google.", visual: <ShowcaseImage image={MEDIA.booking.calendar} sizes="(min-width: 1024px) 640px, 100vw" />, body: <p>Propose a shoot time and the client accepts or counters. Shoots push to your Google Calendar, and your Google events show alongside them.</p> },
                { key: "pipeline", title: "Projects", summary: "Every job on one board, from request to delivered.", visual: <ShowcaseImage image={MEDIA.workflow.stages} sizes="(min-width: 1024px) 640px, 100vw" />, body: <p>Projects move through clear stages, and your client follows the same progress in their portal.</p> },
                { key: "review", title: "Video review", summary: "Feedback pinned to the exact second.", visual: <ShowcaseImage image={MEDIA.videoReview.features} sizes="(min-width: 1024px) 640px, 100vw" />, body: <p>Clients comment at a timestamp; you reply, resolve, and upload numbered versions.</p> },
                { key: "payments", title: "Payments", summary: "Deposits and card payments on the project.", visual: <ShowcaseImage image={MEDIA.invoicing.clientView} sizes="(min-width: 1024px) 640px, 100vw" />, body: <p>Request payment from the project. Clients pay by card through Stripe, straight to your own account, and see what&apos;s still owed.</p> },
                { key: "delivery", title: "Delivery", summary: "Photos and video in a branded portal.", visual: <ShowcaseImage image={MEDIA.delivery.gallery} sizes="(min-width: 1024px) 640px, 100vw" />, body: <p>Deliver photos, video, tours, and documents with full-size or 2048px downloads and ZIP files. Downloads can wait for payment.</p> },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <SectionEyebrow>ONE SIMPLE WORKFLOW</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
            The path every job follows.
          </h2>
          <p className="mt-3 max-w-2xl text-base text-[#475569]">
            From the first request to final delivery and payment, every step stays connected to the
            same project.
          </p>
          <div className="mt-10">
            <HomepageWorkflowMarquee />
          </div>
          <div className="mt-8">
            <Link
              href="/how-it-works"
              className="text-sm font-semibold text-[#4F46E5] hover:underline"
            >
              See the full workflow
            </Link>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <SectionEyebrow>BUILT FOR YOUR KIND OF WORK</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
              Real estate, drone, and video businesses run on ShootPortal.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#475569]">
              One platform, shaped around how commissioned media work actually happens. See it through your lens.
            </p>
          </div>
          <div className="mt-10">
            <SolutionPreviewCards
              items={[
                { key: "real-estate-software", image: MEDIA.realEstate.twoSided, blurb: "Agents request from your menu, approve online, and download MLS-ready files." },
                { key: "drone-software", image: MEDIA.drone.dashboard, blurb: "Quotes with travel fees, weather reschedules, video review, and paid delivery." },
                { key: "video-review", image: MEDIA.videoReview.hero, blurb: "Client feedback pinned to the second, numbered versions, and approval per deliverable." },
                { key: "client-portal", image: MEDIA.portal.twoSided, blurb: "One branded link for every client: estimate, schedule, messages, payment, and files." },
                { key: "invoicing", image: MEDIA.invoicing.dashboard, blurb: "Deposits, payment links, and receipts tied to each job, paid to your own Stripe." },
                { key: "crm", image: MEDIA.crm.dashboard, blurb: "Every agent, property, project, and balance in one connected record." },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <SectionEyebrow>BUILT FOR THE WAY YOU WORK</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
            What ShootPortal actually does for your business.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#475569]">
            The tools you need to handle the work around the shoot, without building your own system
            out of five different apps.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-xl border border-[#E2E8F0] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:bg-[#FAFBFF] hover:shadow-md"
                >
                  <Icon
                    className="h-5 w-5 text-[#4F46E5] transition group-hover:scale-110"
                    aria-hidden
                  />
                  <h3 className="mt-3 text-sm font-semibold text-[#0F172A]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pain */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <SectionEyebrow>LESS ADMIN. MORE SHOOTING.</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                Your business should not feel held together with duct tape.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#475569]">
                A lot of media businesses start with texts, calendar apps, Dropbox, Stripe,
                spreadsheets, and whatever else gets the job done. That works until the business gets
                busy.
              </p>
              <p className="mt-4 text-base leading-relaxed text-[#475569]">
                ShootPortal gives you one system for the entire job so you spend less time searching
                for information, following up on payments, sending links, and trying to remember what
                happens next.
              </p>
              <ul className="mt-8 space-y-3">
                {PAIN_POINTS.map((point) => (
                  <li key={point} className="flex gap-3 text-base text-[#0F172A]">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4F46E5]"
                      aria-hidden
                    />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-lg font-semibold text-[#0F172A]">Shoot more. Manage less.</p>
            </div>
            <HomePainConverge />
          </div>
        </div>
      </section>

      {/* Founder + brand film (replaces an unattributed quote) */}
      <section className="relative overflow-hidden border-b border-[#E2E8F0] bg-[#0B1124]">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 60% at 80% 0%, rgba(99,102,241,0.35), transparent 60%)" }} aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#A5B4FC]">BUILT BY A WORKING PHOTOGRAPHER</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Built around real client jobs.</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              ShootPortal started inside a working aerial and real estate media business, to run real jobs: requests, quotes, weather
              reschedules, revision rounds, payments, and deliveries. Every feature exists because a client job needed it.
            </p>
            <div className="mt-6 [&>div]:border-white/10 [&>div]:bg-white/5 [&_p]:text-slate-300 [&_p:first-child]:text-white">
              <FounderNote />
            </div>
          </div>
          <LoopVideo video={MEDIA.drone.film} frame="dark" />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>SIMPLE PRICING</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
              Everything you need to run the business. Starting at {annualPriceLabel} a month.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#475569]">
              One plan with the full ShootPortal experience. Manage clients, projects, scheduling,
              media delivery, invoices, and payments without paying for a stack of separate tools.
            </p>
            <ul
              className="mx-auto mt-6 max-w-xl space-y-2 text-left text-sm text-[#475569] sm:text-center sm:space-y-1"
              aria-label="Studio plan highlights"
            >
              <li>One plan with the full feature set</li>
              <li>Client card payments go straight to your Stripe account. ShootPortal takes no cut.</li>
              <li>{monthlyPriceLabel} per month billed monthly</li>
              {studioPlan?.price_annual_cents != null ? (
                <li>{annualPriceLabel} per month billed annually</li>
              ) : null}
              {annualSavingsLongLabel ? <li>{annualSavingsLongLabel}</li> : null}
              {trialDays > 0 ? (
                <li>
                  {trialDays} day free trial. No credit card required. Cancel anytime.
                </li>
              ) : (
                <li>Cancel anytime</li>
              )}
            </ul>
          </div>
          <div className="mt-10">
            <MarketingHomePricing plan={studioPlan ?? null} trialDays={trialDays} ctaId="home:pricing" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-[#0F172A]">
            Straight answers.
          </h2>
          <div className="mt-10">
            <MarketingFaq
              trialDaysLabel={trialDaysLabel}
              monthlyPriceLabel={monthlyPriceLabel}
              annualPriceLabel={annualPriceLabel}
              annualSavingsLabel={annualSavingsLabel}
            />
          </div>
        </div>
      </section>

      <MarketingCtaBand
        title="Put your next shoot in one portal."
        body="Start with your next job. Keep the client, schedule, messages, media, invoice, and payment together from beginning to end."
        trialLabel={finalTrialNote}
        secondaryHref="#product-demo"
        secondaryLabel="See how it works"
      />
    </MarketingShell>
  );
}
