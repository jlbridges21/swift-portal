import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Box,
  Building2,
  CalendarClock,
  CalendarCheck,
  Check,
  Clapperboard,
  CloudRain,
  CreditCard,
  FileText,
  Globe,
  HardDriveUpload,
  HardHat,
  House,
  Images,
  Lock,
  MapPin,
  MessageSquareText,
  Orbit,
  Palette,
  Repeat2,
  Route,
  Wallet,
} from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { loadBlogRenderContext } from "@/lib/blog/render-context";
import { getSolutionPage, solutionCtaId } from "@/lib/solutions";
import { solutionJsonLd, solutionMetadata } from "@/lib/solutions-seo";
import { jsonLdString } from "@/lib/blog/structured-data";
import {
  AudienceSplit,
  FeatureCards,
  FeatureSpotlight,
  FinalCta,
  FounderNote,
  PricingStrip,
  RelatedReading,
  ScopeCard,
  Section,
  SolutionFaq,
  SolutionHero,
  ToolsVsPlatform,
  TrialButton,
} from "@/components/solutions/solution-sections";
import { FloatingChip, AerialArt } from "@/components/solutions/solution-visuals";
import { VideoReviewDiagram } from "@/components/blog/diagrams";
import { ProjectBoardDiagram, SampleEstimate, ServiceMenu } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";

const PAGE = getSolutionPage("drone-software");
const cta = (p: "hero" | "mid" | "final" | "pricing") => solutionCtaId(PAGE.key, p);

export const revalidate = 300;
export const metadata: Metadata = solutionMetadata(PAGE);

const linkCls = "font-medium text-[#4F46E5] underline underline-offset-2";

/** The six client-side headaches of drone work, each paired with what changes. */
const PAINS: { icon: LucideIcon; pain: string; detail: string; fix: string }[] = [
  {
    icon: FileText,
    pain: "Every quote is custom",
    detail: "Acreage, altitude, stills or video, edited or raw: no two aerial jobs are priced the same way.",
    fix: "Build estimates from your own service catalog, then adjust line items per job.",
  },
  {
    icon: Route,
    pain: "Travel eats the margin",
    detail: "A 70-mile drive to a rural site is easy to forget when you quote from your phone.",
    fix: "Travel fees are added from ZIP-to-ZIP distance, using your tiers or a per-mile rate.",
  },
  {
    icon: CloudRain,
    pain: "Weather moves the date",
    detail: "Wind or rain grounds the flight and the rescheduling starts over by text.",
    fix: "Propose a new time on the same project; the client accepts or counters.",
  },
  {
    icon: HardDriveUpload,
    pain: "Video files are huge",
    detail: "A few minutes of high-bitrate footage breaks email and clutters shared folders.",
    fix: "Resumable uploads attach finished files to the project, not to a loose link.",
  },
  {
    icon: Repeat2,
    pain: "Revisions get vague",
    detail: "\"Can you change the part near the start?\" arrives three emails deep.",
    fix: "Clients leave comments at exact timestamps on each numbered video version.",
  },
  {
    icon: Wallet,
    pain: "Getting paid lags delivery",
    detail: "The footage is out, the invoice is in someone's inbox, and you're following up again.",
    fix: "Request payment from the project and keep downloads locked until it's paid.",
  },
];

const EMBEDS = ["DroneDeploy", "Pix4D", "Agisoft", "Cesium", "ArcGIS", "MipMap", "Matterport", "Polycam", "Sketchfab"];

/** Drone-specific job walkthroughs (no inspection-software claims). */
const PLAYBOOKS: { icon: LucideIcon; label: string; title: string; steps: string[] }[] = [
  {
    icon: House,
    label: "Real estate aerials",
    title: "Listing aerials and a twilight orbit",
    steps: [
      "The agent requests your aerial package with the address and a preferred date",
      "A preliminary estimate adds the travel fee for the listing's ZIP code",
      "You propose a late-afternoon slot; the agent accepts and it lands in Google Calendar",
      "Stills download as Print or MLS (2048px) files, plus the orbit video in the portal",
    ],
  },
  {
    icon: HardHat,
    label: "Construction progress",
    title: "A monthly progress series for one site",
    steps: [
      "Each monthly flight is its own project under the same contractor and site address",
      "The site's property history shows every visit and what it earned",
      "Deliver stills by folder and embed the DroneDeploy or Pix4D output you processed",
      "Request payment per visit and see any outstanding balance on the client record",
    ],
  },
  {
    icon: Building2,
    label: "Roof & inspection imagery",
    title: "Close-up stills for a roofer or adjuster",
    steps: [
      "Quote the flight from your catalog, with a deposit on approval if you want one",
      "Upload the image set in folders, with any report you wrote elsewhere as a document",
      "The client approves each deliverable or asks for changes in writing",
      "Downloads unlock after final payment, while previews stay viewable",
    ],
  },
];

export default async function DroneBusinessManagementSoftwarePage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(solutionJsonLd(PAGE, ctx)) }} />

        <SolutionHero
          tone="dark"
          eyebrow="Drone business management software"
          title={
            <>
              Spend more time flying.{" "}
              <span className="bg-gradient-to-r from-[#A5B4FC] via-[#C4B5FD] to-[#F0ABFC] bg-clip-text text-transparent">
                Less time managing your drone business.
              </span>
            </>
          }
          subtitle={
            <>
              You invested in the aircraft, the batteries, and the Part 107. ShootPortal runs the client side of commercial drone
              work: quotes with travel fees, shoot times that survive weather delays, video revisions, payments, and delivery of
              photos, video, and maps in one portal branded to your business.
            </>
          }
          ctaId={cta("hero")}
          ctx={ctx}
          visual={
            <div className="relative px-2 pb-12 pt-8 sm:px-6">
              <div className="overflow-hidden rounded-3xl ring-1 ring-white/15 shadow-[0_60px_120px_-50px_rgba(99,102,241,0.75)]">
                <AerialArt idPrefix="drone-hero" />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0F172A]/95 px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-white">Ridgeline Estates · Phase 2</p>
                    <p className="text-xs text-slate-400">Progress aerials + site flyover video</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#C7D2FE]">Review</span>
                </div>
              </div>
              <FloatingChip icon={MapPin} title="Estimate sent" detail="Includes travel fee · 38 mi" tone="indigo" className="-left-1 top-0 sm:-left-6" />
              <FloatingChip icon={CloudRain} title="New time proposed" detail="Wind delay → Thu 7:30 AM" tone="sky" className="-right-1 top-[30%] sm:-right-8" delayMs={500} />
              <FloatingChip icon={MessageSquareText} title="Comment at 0:42" detail="“Slow the orbit here”" tone="amber" className="bottom-14 -left-1 sm:-left-8" delayMs={1000} />
              <FloatingChip icon={CreditCard} title="Paid" detail="Downloads unlocked" tone="emerald" className="-right-1 bottom-0 sm:right-4" delayMs={1500} />
            </div>
          }
        />

        <Section
          eyebrow="What ShootPortal is for drone businesses"
          title="The client side of commercial drone work"
          intro={
            <>
              Most &quot;drone management&quot; software is about the aircraft: flight plans, logs, batteries, airspace. ShootPortal is
              about the customer: the quote, the date, the revisions, the invoice, and the files. Here is exactly where the line sits.
            </>
          }
        >
          <div className="mx-auto max-w-5xl">
            <ScopeCard
              title="ShootPortal runs the business behind the footage"
              does={[
                "Requests, estimates, and travel fees from your service catalog",
                "Proposing shoot times and rescheduling, with Google Calendar push",
                "Client records, project pipeline, and two-way messages",
                "Deposits and payments through your own Stripe account",
                "Photo, video, 360 tour, and 3D or map embed delivery",
                "Time-stamped video review and revision rounds",
              ]}
              doesNot={[
                "Flight planning and automated missions",
                "Flight logs and pilot hours",
                "Fleet, battery, and maintenance tracking",
                "LAANC and airspace authorization",
                "Remote ID compliance",
                "Mapping and photogrammetry processing (ShootPortal can embed the DroneDeploy or Pix4D output for delivery)",
              ]}
            />
            <p className="mt-6 text-center text-sm text-[#64748B]">
              Keep your flight app and your processing software. ShootPortal sits between the client and everything you deliver.
            </p>
          </div>
        </Section>

        <Section
          tone="dark"
          eyebrow="Where drone jobs get messy"
          title="Flying is the easy part"
          intro="The aircraft does what you tell it. Clients, calendars, and invoices are less predictable. These are the six places aerial businesses lose time, and what changes in ShootPortal."
        >
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PAINS.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.pain} className="mk-reveal flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#C7D2FE]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-semibold text-white">{p.pain}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{p.detail}</p>
                  <p className="mt-4 flex gap-2 border-t border-white/10 pt-4 text-sm leading-relaxed text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                    <span>{p.fix}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section
          eyebrow="Estimates & services"
          title="Quote a roof, a site, and a listing from one catalog"
          intro="Aerial work is varied, so your pricing should be organized, not improvised. Publish packages once, then build each estimate from them."
          tone="cloud"
        >
          <figure>
            <ServiceMenu
              packages={[
                {
                  name: "Listing aerials",
                  price: "From $175",
                  blurb: "Residential listings and land.",
                  includes: ["15 edited aerial stills", "MLS and print sizes", "Delivered in your portal"],
                },
                {
                  name: "Aerial video",
                  price: "From $350",
                  blurb: "Property films, events, and promos.",
                  includes: ["60–90 second edited film", "Two revision rounds", "Time-stamped review"],
                  highlight: true,
                },
                {
                  name: "Site progress visit",
                  price: "From $295",
                  blurb: "Construction and development sites.",
                  includes: ["Fixed-angle progress stills", "Map or model embed", "Per-visit billing"],
                },
              ]}
              addons={[
                { name: "Twilight flight", price: "$95" },
                { name: "Raw footage", price: "$75" },
                { name: "Rush delivery", price: "$60" },
                { name: "Extra revision round", price: "$50" },
              ]}
            />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">Example drone service catalog with illustrative prices. You set your own.</figcaption>
          </figure>

          <div className="mt-16 lg:mt-20">
            <FeatureSpotlight
              eyebrow="Travel fees, handled"
              title="The drive is on the estimate before you forget it"
              body={
                <>
                  <p>
                    When a request comes in, ShootPortal can build a preliminary estimate from the service the client picked and add a
                    travel fee calculated from the straight-line distance between your base ZIP code and the job&apos;s. Use mileage
                    tiers, or a free radius plus a per-mile rate with a cap.
                  </p>
                  <p>
                    Then refine it: add the twilight flight, remove the raw footage, send the official estimate. The client approves or
                    asks for changes in the portal, and every version is kept with its expiry date and a PDF.
                  </p>
                </>
              }
              bullets={[
                "Option to hide prices on the catalog for custom commercial work",
                "Collect a percentage or flat deposit when the estimate is approved",
                <>
                  Not sure what to charge? Start with our{" "}
                  <Link href="/blog/drone-photography-pricing-guide" className={linkCls}>
                    drone photography pricing guide
                  </Link>
                  .
                </>,
              ]}
              visual={
                <SampleEstimate
                  title="Ridgeline Estates · Phase 2 progress"
                  client="Dana Ruiz, Atlas Build"
                  depositPercent={25}
                  lines={[
                    { label: "Site progress visit", detail: "Fixed-angle stills, 12 positions", amount: 295 },
                    { label: "Site flyover video", detail: "60 seconds, edited", amount: 250 },
                    { label: "Map embed", detail: "Your processed orthomosaic, embedded for the client", amount: 75 },
                    { label: "Travel fee", detail: "38 miles from base ZIP", amount: 45 },
                  ]}
                />
              }
              caption="Example estimate with illustrative prices and a ZIP-distance travel fee."
            />
          </div>
        </Section>

        <Section
          eyebrow="Scheduling"
          title="When the wind picks up, the reschedule takes one message"
          intro="Clients don't book open slots on their own. You propose a time that suits the forecast and the light, and they respond in the portal."
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
            <div className="mk-reveal space-y-4 text-base leading-relaxed text-[#475569]">
              <h3 className="text-2xl font-semibold tracking-tight text-[#0F172A]">Propose, counter, confirm</h3>
              <p>
                Pick a time from the project and the client accepts, declines, or suggests another. If the forecast changes, propose a
                new time on the same project: the history stays with the job instead of scrolling away in a text thread.
              </p>
              <p>
                Scheduled shoots push to the Google Calendar you choose, and your Google events appear read-only inside the ShootPortal
                calendar, so a dentist appointment doesn&apos;t collide with a sunrise flight.
              </p>
              <ul className="space-y-2 pt-2 text-[0.98rem] text-[#1E293B]">
                {["Reminder emails for proposals and scheduling", "Shoot details, address, and notes on the project", "Assign a second pilot or editor to the job"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <figure className="mk-reveal">
              <div className="rounded-3xl border border-[#E2E8F0] bg-gradient-to-b from-white to-[#F8FAFC] p-5 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.6)] sm:p-6" aria-hidden>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#0F172A]">Hillcrest Winery · Promo flight</p>
                  <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#4F46E5]">Scheduling</span>
                </div>
                <ol className="mt-5 space-y-3">
                  <li className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B]">You proposed</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-[#94A3B8] line-through">
                      <CalendarClock className="h-4 w-4" />
                      Tue, 6:45 AM
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">Gusts forecast at 25 mph. Moving it.</p>
                  </li>
                  <li className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B]">You proposed a new time</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                      <CalendarClock className="h-4 w-4 text-[#4F46E5]" />
                      Thu, 6:45 AM
                    </p>
                  </li>
                  <li className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-700">Client counter-proposed</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                      <CalendarClock className="h-4 w-4 text-sky-600" />
                      Thu, 7:30 AM
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">&quot;Staff arrive at 7:15, gates open then.&quot;</p>
                  </li>
                  <li className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <span className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <CalendarCheck className="h-4 w-4" />
                      Confirmed · Thu 7:30 AM
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">Added to Google Calendar</span>
                  </li>
                </ol>
              </div>
              <figcaption className="mt-3 text-center text-xs text-[#64748B]">Illustration of a weather reschedule on one project (fictional client).</figcaption>
            </figure>
          </div>
        </Section>

        <Section
          eyebrow="Projects & clients"
          title="Every site, every visit, every client in one pipeline"
          intro="Each job moves through eight fixed stages, from new request to delivered. You see what's waiting on a quote, a shoot time, client review, or payment without opening five apps."
          tone="cloud"
        >
          <figure>
            <ProjectBoardDiagram />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">Example pipeline with ShootPortal&apos;s real stages and fictional jobs. Scroll sideways on small screens.</figcaption>
          </figure>
          <div className="mt-10">
            <FeatureCards
              columns={3}
              items={[
                {
                  icon: Building2,
                  title: "Client records that remember",
                  body: "Contact details, notes, a timeline of messages and activity, lifetime revenue, outstanding balance, and last payment.",
                },
                {
                  icon: MapPin,
                  title: "Property and site history",
                  body: "Every address you've flown for a client, with the projects and revenue for each. Ideal for repeat sites.",
                },
                {
                  icon: MessageSquareText,
                  title: "Messages on the job",
                  body: "Two-way messages stay attached to the project, with email notifications to the client.",
                },
              ]}
            />
          </div>
        </Section>

        <Section
          eyebrow="Payments"
          title="Deposit to book. Balance to download."
          intro="Payments go straight to your own Stripe account through Stripe Connect. Stripe's standard processing fees apply."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Check,
                step: "On approval",
                title: "Deposit secures the date",
                body: "Take a percentage or flat deposit when the client approves the estimate, or skip it and bill in full later.",
                tone: "border-[#E2E8F0] bg-white",
              },
              {
                icon: Lock,
                step: "After the flight",
                title: "Previews, not downloads",
                body: "Upload the finals. With “unlock downloads after payment” on, the client can view everything but can't download yet.",
                tone: "border-amber-200 bg-amber-50/40",
              },
              {
                icon: CreditCard,
                step: "Final payment",
                title: "Paid, then delivered",
                body: "The client pays the balance by card through Stripe Checkout. The project can move to Delivered and downloads open.",
                tone: "border-emerald-200 bg-emerald-50/40",
              },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className={`mk-reveal rounded-3xl border p-6 ${s.tone}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                      {i + 1}. {s.step}
                    </span>
                    <Icon className="h-5 w-5 text-[#4F46E5]" aria-hidden />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[#0F172A]">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{s.body}</p>
                </div>
              );
            })}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#64748B]">
            Email receipts go out automatically, and you can mark a check or bank transfer as paid by hand. If you&apos;re weighing a
            dedicated billing app instead, compare the options in our{" "}
            <Link href="/blog/best-photography-invoicing-software" className={linkCls}>
              photography invoicing software roundup
            </Link>
            .
          </p>
        </Section>

        <Section
          eyebrow="Deliverables"
          title="Stills, films, tours, and maps behind one link"
          intro="Aerial clients rarely get only photos. Put everything for the job on the project and choose which sections the client sees."
          tone="cloud"
        >
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
            <FeatureCards
              columns={2}
              items={[
                { icon: Images, title: "Photos in folders", body: "Download as Print (original) or MLS (2048px long edge), one file or a ZIP." },
                { icon: Clapperboard, title: "Video files", body: "Upload finished films with resumable uploads, or embed a YouTube link." },
                { icon: Orbit, title: "Kuula 360 tours", body: "Embed aerial panoramas so clients can look around the site." },
                { icon: FileText, title: "Documents", body: "Attach a site plan, shot list, or report you produced elsewhere." },
              ]}
            />
            <div className="mk-reveal rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F172A] to-[#312E81] text-white">
                  <Box className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-[#0F172A]">3D model and map embeds</h3>
                  <p className="text-sm text-[#64748B]">Process where you already do. Deliver it alongside everything else.</p>
                </div>
              </div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {EMBEDS.map((e) => (
                  <li key={e} className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-sm font-medium text-[#334155]">
                    {e}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm leading-relaxed text-[#475569]">
                Paste the share link from your mapping or modeling platform and the map or model appears on the
                client&apos;s project, next to the stills and the flyover video. ShootPortal displays it; the processing stays in the
                tool that made it.
              </p>
              <p className="mt-4 border-t border-[#F1F5F9] pt-4 text-sm text-[#475569]">
                Want delivery in more depth? See{" "}
                <Link href="/photo-video-delivery-software" className={linkCls}>
                  ShootPortal&apos;s photo and video delivery software
                </Link>
                .
              </p>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Video review & revisions"
          title="Feedback pinned to the second, not buried in an email"
          intro="Drone films live or die on pacing. Let clients point to the exact moment."
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <figure className="mk-reveal">
              <VideoReviewDiagram />
              <figcaption className="mt-3 text-center text-xs text-[#64748B]">Illustration of time-stamped comments across numbered versions.</figcaption>
            </figure>
            <div className="mk-reveal">
              <ul className="space-y-5">
                {[
                  { title: "Comments at a timestamp", body: "Clients comment at the exact moment in the film, and can pin a comment to a spot on the frame." },
                  { title: "Threaded replies", body: "Answer a note in place: \"The reveal is slower in v3, take a look.\"" },
                  { title: "Resolve and reopen", body: "Mark notes resolved as you fix them; reopen if the client disagrees." },
                  { title: "Numbered versions", body: "Upload v2 and v3 on the same deliverable, so nobody reviews the wrong cut." },
                ].map((r) => (
                  <li key={r.title} className="flex gap-4">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <MessageSquareText className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-semibold text-[#0F172A]">{r.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-[#475569]">{r.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-2xl bg-[#F8FAFC] p-4 text-sm leading-relaxed text-[#475569]">
                For stills, maps, and documents, clients approve or reject each deliverable with written feedback and can submit a
                revision request, so &quot;looks good&quot; and &quot;redo #14&quot; are both on the record.
              </p>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Your client portal"
          title="Look like the professional operation you are"
          intro="Clients get one portal with your logo, your brand color, and a light or dark theme, at yourname.shootportal.app or your own domain."
          tone="cloud"
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
            <figure>
              <ProductPreview view="client-portal" />
              <figcaption className="mt-3 text-center text-xs text-[#64748B]">
                Product illustration: a client&apos;s project steps, from estimate to shoot, media, payment, and files (demo data).
              </figcaption>
            </figure>
            <ul className="space-y-4">
              {[
                { icon: Palette, title: "Branded, not anonymous", body: "Your logo and colors on every page and email. It's a branded portal, not a fully white-labeled one." },
                { icon: Globe, title: "Your domain", body: "Connect portal.yourcompany.com with DNS verification, and send email from your own domain." },
                { icon: Check, title: "A landing page and request form", body: "Show your services and showreel, and take requests that land as new projects." },
              ].map((b) => {
                const Icon = b.icon;
                return (
                  <li key={b.title} className="mk-reveal flex gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#4F46E5]" aria-hidden />
                    <div>
                      <h3 className="font-semibold text-[#0F172A]">{b.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-[#475569]">{b.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>

        <Section
          eyebrow="Separate tools vs. one system"
          title="What one aerial job looks like, before and after"
          intro="Most drone operators run the business on a spreadsheet, an inbox, a transfer service, and a payment app. Each one is fine. The gaps between them are where time goes."
        >
          <ToolsVsPlatform
            leftTitle="Patchwork of apps"
            rows={[
              { task: "Inquiry", before: "DM or email; you copy the address into a spreadsheet", after: "Request form with service, address, date, and notes creates the project" },
              { task: "Quote", before: "Calculator, a guess at mileage, a PDF template", after: "Estimate from your catalog with a ZIP-distance travel fee" },
              { task: "Weather delay", before: "New text thread, calendar edited by hand", after: "Propose a new time; client accepts or counters; Google Calendar updated" },
              { task: "Big files", before: "Transfer link that expires before the client opens it", after: "Resumable uploads to the project; one portal link for everything" },
              { task: "Revisions", before: "\"Around the middle, the turn\" in an email", after: "Comments at the exact timestamp on numbered versions" },
              { task: "Payment", before: "Invoice app, reminder emails, files already sent", after: "Request payment from the project; downloads unlock when it's paid" },
            ]}
          />
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#64748B]">
            For the bigger picture on cutting manual steps, read our guide to{" "}
            <Link href="/blog/photography-workflow-automation" className={linkCls}>
              automating a photography and drone workflow
            </Link>
            .
          </p>
        </Section>

        <Section
          tone="dark"
          eyebrow="Drone workflows"
          title="How three kinds of aerial jobs run in ShootPortal"
          intro="Same system, different jobs. These are example workflows with fictional clients."
        >
          <div className="grid gap-5 lg:grid-cols-3">
            {PLAYBOOKS.map((pb) => {
              const Icon = pb.icon;
              return (
                <div key={pb.label} className="mk-reveal rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A5B4FC]">{pb.label}</p>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{pb.title}</h3>
                  <ol className="mt-4 space-y-3">
                    {pb.steps.map((s, i) => (
                      <li key={s} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-[#C7D2FE]">{i + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-center text-sm text-slate-400">
            ShootPortal delivers inspection imagery; it doesn&apos;t analyze it, measure roofs, or generate reports.
          </p>
        </Section>

        <Section eyebrow="Who it's for" title="From one pilot to a small aerial media team">
          <AudienceSplit
            items={[
              {
                label: "Solo Part 107 pilots",
                title: "Run it all from your phone and laptop",
                body: <p>One flat plan covers every feature, and ShootPortal installs on your phone as a web app for checking jobs between flights.</p>,
                points: [
                  "Quote, schedule, deliver, and get paid without five subscriptions",
                  "Deposits on approval help hold your calendar",
                  "A branded portal makes a one-person operation look established",
                ],
              },
              {
                label: "Growing drone media businesses",
                title: "Add pilots and editors without losing the thread",
                body: <p>Give each staff member an account with the permissions they need, and assign them to the projects they fly or edit.</p>,
                points: [
                  "Pipeline view of every job by stage",
                  "Client and site history for repeat commercial work",
                  "Your brand on every portal, whoever flew the job",
                ],
              },
            ]}
          />
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[#64748B]">Run your next aerial job through it, from quote to paid.</p>
            <TrialButton ctaId={cta("mid")} trialDays={ctx.trialDays} label="Try it on your next flight" />
          </div>
        </Section>

        <Section tone="cloud" title="Built by a pilot who flies paid jobs">
          <FounderNote detail="The weather reschedules, travel fees, video revision rounds, and payment-before-download flow all come from running a drone and real estate media business." />
        </Section>

        <Section eyebrow="Pricing" title="Priced like a tool, not a fleet contract">
          <PricingStrip ctx={ctx} ctaId={cta("pricing")} />
        </Section>

        <Section eyebrow="FAQ" title="Drone business management software questions" tone="cloud">
          <SolutionFaq
            items={[
              {
                q: "What is drone business management software?",
                a: (
                  <p>
                    The term covers two kinds of tools. Flight operations software handles flight planning, logs, fleet maintenance, and
                    airspace. Business management software handles clients: quotes, scheduling, payments, and delivery. ShootPortal is
                    the second kind, built for aerial photo and video businesses.
                  </p>
                ),
              },
              {
                q: "Does ShootPortal log flights, track batteries, or request LAANC authorization?",
                a: (
                  <p>
                    No. ShootPortal doesn&apos;t plan flights, keep flight logs, track fleet or battery maintenance, request airspace
                    authorization, or handle Remote ID. Keep a dedicated flight operations app for that and use ShootPortal for the
                    client side.
                  </p>
                ),
              },
              {
                q: "Can I deliver DroneDeploy or Pix4D maps to clients?",
                a: (
                  <p>
                    Yes, as embeds. Process the map or model in DroneDeploy, Pix4D, Agisoft, or another supported platform, then add its
                    share link to the project. ShootPortal also embeds Cesium, ArcGIS, MipMap, Matterport, Polycam, Sketchfab, and Kuula
                    360 tours. It doesn&apos;t process imagery itself.
                  </p>
                ),
              },
              {
                q: "How do travel fees work?",
                a: (
                  <p>
                    ShootPortal measures the straight-line distance between your base ZIP code and the job&apos;s ZIP code, then applies
                    your mileage tiers or a free radius plus a per-mile rate with an optional cap. The fee shows up as a line on the
                    estimate, which you can edit before sending.
                  </p>
                ),
              },
              {
                q: "What happens when weather cancels a flight?",
                a: (
                  <p>
                    Propose a new time on the same project. The client accepts, declines, or suggests another time in the portal, and the
                    confirmed time pushes to your Google Calendar. Clients respond to times you propose; they don&apos;t pick open slots
                    themselves.
                  </p>
                ),
              },
              {
                q: "How do clients pay, and can I hold files until they do?",
                a: (
                  <p>
                    You connect your own Stripe account, and clients pay by card through Stripe Checkout. You can take a deposit on
                    approval and turn on &quot;unlock downloads after payment&quot; so clients can preview the work but download only after
                    the final payment.
                  </p>
                ),
              },
              {
                q: "Is there a free trial?",
                a: (
                  <p>
                    Yes. {ctx.trialDays > 0 ? `${ctx.trialDays} days free, ` : ""}no credit card required. Sign up with Google or a
                    five-field form, then a guided setup walks you through branding, services from templates, and connecting Stripe. Any
                    step can be skipped and finished later.
                  </p>
                ),
              },
            ]}
          />
        </Section>

        <Section eyebrow="Keep reading" title="Guides for drone business owners">
          <RelatedReading slugs={PAGE.relatedArticles} />
        </Section>

        <FinalCta
          ctaId={cta("final")}
          ctx={ctx}
          title="You handle the flying. Let ShootPortal handle the clients."
          body="Put your next aerial job through ShootPortal: quote it with the travel fee, confirm the date, collect the deposit, and deliver the footage in a portal with your name on it."
        />
      </MarketingShell>
    </BrandProvider>
  );
}
