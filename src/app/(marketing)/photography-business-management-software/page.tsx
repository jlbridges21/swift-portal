import { RelatedNext } from "@/components/tools/tool-page-parts";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Camera,
  Clapperboard,
  CreditCard,
  FolderKanban,
  Inbox,
  KeyRound,
  Plane,
  Puzzle,
  Shuffle,
  Users,
  Wallet,
} from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { loadBlogRenderContext } from "@/lib/blog/render-context";
import { getSolutionPage, solutionCtaId, type CtaPlacement } from "@/lib/solutions";
import { solutionJsonLd, solutionMetadata } from "@/lib/solutions-seo";
import { jsonLdString } from "@/lib/blog/structured-data";
import {
  AudienceSplit,
  DemoShowcase,
  FeatureCards,
  FinalCta,
  FounderNote,
  GradientText,
  PricingStrip,
  ProblemGrid,
  REAL_CAPTURE_NOTE,
  RelatedReading,
  RelatedSolutions,
  ScopeCard,
  Section,
  SolutionFaq,
  SolutionHero,
  ToolsVsPlatform,
  TrialButton,
} from "@/components/solutions/solution-sections";
import { FeatureTabs } from "@/components/solutions/feature-tabs";
import { FloatingChip } from "@/components/solutions/solution-visuals";
import { ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA } from "@/lib/solution-media";
import { WorkflowCoverageMap } from "@/components/blog/conversion-parts";

const PAGE = getSolutionPage("business-management");
const cta = (p: CtaPlacement) => solutionCtaId(PAGE.key, p);
const A = "font-medium text-[#4F46E5] underline underline-offset-2";

export const revalidate = 300;
export const metadata: Metadata = solutionMetadata(PAGE);

export default async function PhotographyBusinessManagementSoftwarePage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(solutionJsonLd(PAGE, ctx)) }} />

        <SolutionHero
          eyebrow="All-in-one for photo & video businesses"
          title={
            <>
              Photography business management software for <GradientText>the whole job</GradientText>
            </>
          }
          subtitle={
            <>
              ShootPortal is photography business management software for client-commissioned work. Clients, projects, estimates, scheduling,
              payments, video review, and delivery share one system and one branded portal, so the business side takes less of your week.
            </>
          }
          ctaId={cta("hero")}
          ctx={ctx}
          secondary={{ href: "#tour", label: "Take the tour" }}
          visual={
            <div className="relative px-2 pb-10 pt-6 sm:px-4">
              <ShowcaseImage image={MEDIA.business.hero} frame="dark" priority sizes="(min-width: 1024px) 50vw, 100vw" />
              <FloatingChip icon={Inbox} title="New request" detail="Commercial interiors · Oct 21" tone="sky" className="-left-2 top-[46%] hidden sm:-left-10 sm:flex" />
              <FloatingChip icon={CreditCard} title="Payment received" detail="Receipt emailed" tone="emerald" className="-right-1 bottom-0 hidden sm:-right-6 sm:flex" delayMs={800} />
              <p className="mt-4 text-center text-xs text-[#64748B]">{REAL_CAPTURE_NOTE}</p>
            </div>
          }
        />

        <Section
          eyebrow="The other half of the job"
          title="Great work is half the business"
          intro="The other half is inquiries, quotes, schedules, revisions, invoices, and deliveries, usually spread across more apps than clients."
          tone="cloud"
        >
          <ProblemGrid
            items={[
              { icon: Shuffle, title: "Too many tools", body: "A form builder, a calendar, an invoicing app, a file transfer service, and your inbox, each with its own login." },
              { icon: Users, title: "Clients in your head", body: "Who ordered what, what they paid, and what they prefer lives in memory and old emails." },
              { icon: FolderKanban, title: "Projects without a status", body: "You can't see at a glance which jobs need a quote, a shoot date, an edit, or a payment." },
              { icon: Wallet, title: "Money trailing the work", body: "Files go out before payment, and outstanding balances hide in a separate app." },
              { icon: KeyRound, title: "A patchwork client experience", body: "Clients get a form from one tool, a link from another, and an invoice from a third." },
              { icon: Puzzle, title: "Hard to add help", body: "Bringing on a second shooter or editor means sharing logins or forwarding everything." },
            ]}
          />
        </Section>

        <DemoShowcase
          title="See the whole business run in under a minute"
          intro="A 52-second tour of real ShootPortal screens: requests, proposals, the calendar, the pipeline, video review, payments, share links, and your own brand and domain."
          video={MEDIA.shared.tour}
          points={["Clients request and approve on your portal", "Projects, payments, and review in one place", "Everything under your own brand and domain"]}
          ctaId={cta("demo")}
          trialDays={ctx.trialDays}
          ctaLabel="Run your next job in ShootPortal"
        />

        <Section
          id="tour"
          eyebrow="Product tour"
          title="One platform, every part of the business"
          intro="Pick an area to see how it works. Every view is a real ShootPortal screen, with client details blurred."
        >
          <FeatureTabs
            label="ShootPortal business areas"
            tabs={[
              {
                key: "requests",
                title: "Requests & estimates",
                summary: "A branded request form and estimates from your service catalog.",
                visual: <ShowcaseImage image={MEDIA.booking.twoViews} sizes="(min-width: 1024px) 640px, 100vw" />,
                body: (
                  <p>
                    Clients request a service from your catalog with the address, a preferred date, and notes. ShootPortal creates the project and the
                    client record, can send a preliminary estimate automatically, and you follow with an official proposal the client approves in the
                    portal.
                  </p>
                ),
              },
              {
                key: "scheduling",
                title: "Booking & scheduling",
                summary: "Proposed shoot times, client replies, and Google Calendar.",
                visual: <ShowcaseImage image={MEDIA.booking.calendar} sizes="(min-width: 1024px) 640px, 100vw" />,
                body: (
                  <p>
                    Propose a shoot time and the client accepts, declines, or counters. Shoots push to your Google Calendar and your Google events show
                    on the ShootPortal calendar. Details on the{" "}
                    <Link href="/photography-booking-software" className={A}>
                      photography booking software
                    </Link>{" "}
                    page.
                  </p>
                ),
              },
              {
                key: "projects",
                title: "Projects & clients",
                summary: "A pipeline of every job and a record for every client.",
                visual: <ShowcaseImage image={MEDIA.workflow.stages} sizes="(min-width: 1024px) 640px, 100vw" />,
                body: (
                  <p>
                    Every job moves through eight stages from New Request to Delivered. Each client record keeps contact details, notes, a message and
                    activity timeline, project history, lifetime revenue, and outstanding balance.
                  </p>
                ),
              },
              {
                key: "payments",
                title: "Invoicing & payments",
                summary: "Deposits, payment requests, and receipts on each project.",
                visual: <ShowcaseImage image={MEDIA.invoicing.dashboard} sizes="(min-width: 1024px) 640px, 100vw" />,
                body: (
                  <p>
                    Request payment from the project and clients pay by card through Stripe Checkout into your own Stripe account. Take a deposit on
                    approval, request the balance later, and mark offline payments paid. See{" "}
                    <Link href="/photography-invoicing-software" className={A}>
                      photography invoicing software
                    </Link>
                    .
                  </p>
                ),
              },
              {
                key: "review",
                title: "Video review",
                summary: "Time-stamped comments, versions, and approvals.",
                visual: <ShowcaseImage image={MEDIA.videoReview.features} sizes="(min-width: 1024px) 640px, 100vw" />,
                body: (
                  <p>
                    Clients comment at exact timestamps, pinned to the frame, and approve each deliverable or request changes. You post numbered
                    versions on the same review. More on{" "}
                    <Link href="/video-review-approval-software" className={A}>
                      video review software
                    </Link>
                    .
                  </p>
                ),
              },
              {
                key: "delivery",
                title: "Photo & video delivery",
                summary: "Galleries, download sizes, and payment-gated downloads.",
                visual: <ShowcaseImage image={MEDIA.delivery.gallery} sizes="(min-width: 1024px) 640px, 100vw" />,
                body: (
                  <p>
                    Deliver photos, video, 360 tours, 3D embeds, and documents in the client&apos;s portal, with original or 2048px downloads and ZIP
                    files. Downloads can wait until the project is paid and delivered.
                  </p>
                ),
              },
            ]}
          />
        </Section>

        <Section eyebrow="The connected workflow" title="Request → Estimate → Schedule → Shoot → Review → Pay → Deliver" tone="cloud">
          <ShowcaseImage image={MEDIA.business.ecosystem} frame="dark" className="mk-reveal mx-auto mb-12 max-w-xl" sizes="(min-width: 640px) 576px, 100vw" />
          <figure>
            <WorkflowCoverageMap />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">ShootPortal&apos;s verified features at each stage of a job.</figcaption>
          </figure>
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-[#475569]">
            Curious which steps happen on their own? The{" "}
            <Link href="/real-estate-photography-workflow-software" className={A}>
              workflow software
            </Link>{" "}
            page separates what&apos;s automatic from what stays with you.
          </p>
        </Section>

        <Section eyebrow="Before and after" title="Your week, with fewer tools">
          <ShowcaseImage image={MEDIA.business.comparison} className="mk-reveal mx-auto mb-10 max-w-4xl" sizes="(min-width: 1024px) 896px, 100vw" />
          <ToolsVsPlatform
            rows={[
              { task: "Inquiries", before: "Email, DMs, and a form tool", after: "One branded request form that creates the project" },
              { task: "Quotes", before: "Typed fresh for every client", after: "Estimates and proposals from your service catalog" },
              { task: "Scheduling", before: "Text threads and a calendar app", after: "Proposed times the client accepts, pushed to Google Calendar" },
              { task: "Clients", before: "Contacts, spreadsheets, memory", after: "Client records with history, revenue, and balances" },
              { task: "Payments", before: "Separate invoicing app", after: "Card payments on the project, to your own Stripe" },
              { task: "Delivery", before: "File transfer links", after: "Branded portal with review, approvals, and downloads" },
            ]}
          />
          <div className="mt-10 flex justify-center">
            <TrialButton ctaId={cta("mid")} trialDays={ctx.trialDays} label="Run your next job in ShootPortal" />
          </div>
        </Section>

        <Section
          eyebrow="Who it's for"
          title="Best for commissioned, project-based work"
          intro="ShootPortal fits businesses where each job has a location, a scope, a price, and a delivery."
          tone="cloud"
        >
          <ShowcaseImage image={MEDIA.business.showcase} frame="dark" className="mk-reveal mx-auto mb-12 max-w-4xl" sizes="(min-width: 1024px) 896px, 100vw" />
          <FeatureCards
            columns={4}
            items={[
              { icon: Building2, title: "Real estate & property", body: <>Listings, rentals, and architecture. See <Link href="/real-estate-photography-software" className={A}>real estate photography software</Link>.</> },
              { icon: Plane, title: "Drone & aerial", body: <>Aerial photo, video, and survey deliverables. See <Link href="/drone-business-management-software" className={A}>drone business software</Link>.</> },
              { icon: Camera, title: "Commercial photography", body: "Interiors, products, and business clients who order repeat work." },
              { icon: Clapperboard, title: "Video production", body: "Client films with review rounds, versions, and paid delivery." },
            ]}
          />
          <div className="mt-10">
            <AudienceSplit
              items={[
                {
                  label: "Solo creators",
                  title: "Look like a studio from day one",
                  body: <p>One flat plan covers every feature, so a one-person business can offer a polished, branded client experience.</p>,
                  points: ["Fewer subscriptions to manage", "Payment-gated delivery protects small jobs", "Installable on your phone as a web app"],
                },
                {
                  label: "Small teams",
                  title: "Share the work without sharing a login",
                  body: <p>Add staff with the permissions their role needs and assign them to the projects they shoot or edit.</p>,
                  points: ["About 30 granular staff permissions", "Assign staff per project", "One pipeline of every job"],
                },
              ]}
            />
            <figure className="mk-reveal mx-auto mt-12 max-w-3xl">
              <ShowcaseImage image={MEDIA.shared.desktopMobile} frame="none" sizes="(min-width: 768px) 768px, 100vw" />
              <figcaption className="mt-2 text-center text-xs text-[#64748B]">The same studio on your laptop and your phone. ShootPortal installs to your home screen as a web app.</figcaption>
            </figure>
          </div>
        </Section>

        <Section eyebrow="Honest fit" title="Where another tool fits better">
          <ScopeCard
            title="What ShootPortal covers for a photography business"
            does={[
              "Requests, estimates, and proposals",
              "Proposed shoot times and Google Calendar",
              "Client records, messages, and project history",
              "Deposits and card payments through your Stripe",
              "Video review, approvals, and branded delivery",
            ]}
            doesNot={[
              "Contracts and e-signatures",
              "Client questionnaires and self-booking into open slots",
              "Print sales, online stores, and gallery favorites",
              "Accounting, sales tax, and QuickBooks or Xero sync",
              "Photo editing or retouching",
            ]}
          />
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-[#64748B]">
            Wedding and portrait studios that live on contracts, questionnaires, and print sales may be better served by a studio CRM. Compare
            options in our{" "}
            <Link href="/blog/best-photography-crm-software" className={A}>
              photography CRM software comparison
            </Link>
            .
          </p>
        </Section>

        <Section tone="cloud" title="Built by a working photographer">
          <FounderNote />
        </Section>

        <Section eyebrow="Pricing" title="One plan. The whole business.">
          {/* The card's artwork says "14-day free trial"; show it only while the live plan matches. */}
          {ctx.trialDays === 14 ? (
            <ShowcaseImage image={MEDIA.shared.trialCard} frame="dark" className="mk-reveal mx-auto mb-10 max-w-3xl" sizes="(min-width: 768px) 768px, 100vw" />
          ) : null}
          <PricingStrip ctx={ctx} ctaId={cta("pricing")} />
        </Section>

        <Section eyebrow="FAQ" title="Photography business management questions" tone="cloud">
          <SolutionFaq
            items={[
              {
                q: "What is photography business management software?",
                a: (
                  <p>
                    Software that runs the business side of photography: inquiries, quotes, scheduling, clients, payments, and delivery. ShootPortal
                    keeps them on one project per job, with a branded portal for your clients.
                  </p>
                ),
              },
              {
                q: "Is ShootPortal only for real estate photographers?",
                a: (
                  <p>
                    No. It was built around real estate and drone work and fits any commissioned, project-based photo or video business. It is less suited
                    to wedding and portrait studios that rely on contracts, questionnaires, and print sales.
                  </p>
                ),
              },
              {
                q: "Can my team use it?",
                a: <p>Yes. Add staff accounts with granular permissions and assign them to specific projects.</p>,
              },
              {
                q: "Is there a mobile app?",
                a: <p>ShootPortal is a web app you can install on your phone&apos;s home screen, with push notifications for the business owner. It isn&apos;t in the app stores.</p>,
              },
              {
                q: "Can clients see my brand instead of ShootPortal's?",
                a: (
                  <p>
                    The client portal uses your logo, colors, and a light or dark theme at yourname.shootportal.app or your own domain. It&apos;s a branded
                    portal rather than a fully white-label one.
                  </p>
                ),
              },
              {
                q: "Is there a free trial?",
                a: (
                  <p>
                    Yes. {ctx.trialDays > 0 ? `${ctx.trialDays} days free, ` : ""}no credit card required. Sign up with Google or a five-field form, and a
                    guided setup walks you through branding, services, and connecting Stripe.
                  </p>
                ),
              },
            ]}
          />
        </Section>

        <Section eyebrow="Keep reading" title="Guides for running a photography business">
          <RelatedReading slugs={PAGE.relatedArticles} />
        </Section>

        <Section eyebrow="More of ShootPortal" title="Go deeper on each area" tone="cloud">
          <RelatedSolutions keys={["crm", "client-portal", "workflow"]} />
        </Section>

        <RelatedNext heading="Free tools and templates" tools={["quote-builder"]} resources={["photography-project-workflow-checklist", "photography-client-questionnaire"]} />

        <FinalCta
          ctaId={cta("final")}
          ctx={ctx}
          title="Put your whole business in one place"
          body="Set up your brand and services, send your request link, and run your next job from inquiry to paid and delivered."
        />
      </MarketingShell>
    </BrandProvider>
  );
}

