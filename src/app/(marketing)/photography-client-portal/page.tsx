import { RelatedNext } from "@/components/tools/tool-page-parts";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  Check,
  CreditCard,
  Download,
  FileStack,
  Globe,
  Inbox,
  KeyRound,
  Link2,
  LogIn,
  Mail,
  MessageSquare,
  Moon,
  Palette,
  Receipt,
  Share2,
  UserRound,
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
  FeatureCards,
  FeatureSpotlight,
  FinalCta,
  FounderNote,
  GradientText,
  PricingStrip,
  ProblemGrid,
  RelatedReading,
  ScopeCard,
  Section,
  SolutionFaq,
  SolutionHero,
  TrialButton,
  DemoShowcase,
  FilmBand,
  REAL_CAPTURE_NOTE,
} from "@/components/solutions/solution-sections";
import { FloatingChip, GalleryCard, VideoReviewCard } from "@/components/solutions/solution-visuals";
import { LoopVideo, ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA } from "@/lib/solution-media";
import { BeforeAfter, PaymentFlowDiagram } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";

const PAGE = getSolutionPage("client-portal");
const cta = (p: CtaPlacement) => solutionCtaId(PAGE.key, p);

export const revalidate = 300;
export const metadata: Metadata = solutionMetadata(PAGE);

const LINK = "font-medium text-[#4F46E5] underline underline-offset-2";

/** Studio stage names and the labels clients see for the same stage (src/lib/constants.ts). */
const STAGE_LABELS = [
  { studio: "New Request", client: "Request Received" },
  { studio: "Quote Sent", client: "Review Proposal" },
  { studio: "Proposal Approved", client: "Scheduling Your Shoot" },
  { studio: "Scheduled", client: "Shoot Scheduled" },
  { studio: "Shoot Complete", client: "Media in Production" },
  { studio: "Review", client: "Review Your Deliverables" },
  { studio: "Awaiting Payment", client: "Final Payment" },
  { studio: "Delivered", client: "Project Complete" },
];

/** The client's journey through one project, in their words. */
const JOURNEY = [
  { icon: Inbox, title: "Ask", body: "Send a request from your form, or open the project you created for them." },
  { icon: Receipt, title: "Approve", body: "Read the estimate, approve it or ask for changes, download the PDF." },
  { icon: CalendarCheck, title: "Confirm", body: "Accept the shoot time you proposed, or suggest another." },
  { icon: FileStack, title: "Review", body: "Approve each deliverable or send written feedback." },
  { icon: CreditCard, title: "Pay", body: "Deposit and balance by card through Stripe Checkout." },
  { icon: Download, title: "Download", body: "Single files or one ZIP, whenever they need them again." },
];

function ConnectorHorizontal() {
  return (
    <svg viewBox="0 0 96 160" className="hidden h-auto w-full lg:block" aria-hidden>
      <path d="M6 58 H84" fill="none" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" className="mk-flow-line" />
      <path d="M78 51 L88 58 L78 65" fill="none" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M90 102 H12" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" className="mk-flow-line" />
      <path d="M18 95 L8 102 L18 109" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="48" cy="58" r="5" fill="#4F46E5" className="mk-pulse" />
      <circle cx="48" cy="102" r="5" fill="#10B981" className="mk-pulse" />
      <text x="48" y="40" textAnchor="middle" fontSize="9" fontWeight="600" fill="#4F46E5">
        updates
      </text>
      <text x="48" y="126" textAnchor="middle" fontSize="9" fontWeight="600" fill="#047857">
        approvals
      </text>
    </svg>
  );
}

function ConnectorVertical() {
  return (
    <svg viewBox="0 0 200 64" className="mx-auto block h-16 w-48 lg:hidden" aria-hidden>
      <path d="M80 4 V56" fill="none" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" className="mk-flow-line" />
      <path d="M73 50 L80 60 L87 50" fill="none" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M120 60 V8" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" className="mk-flow-line" />
      <path d="M113 14 L120 4 L127 14" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


export default async function PhotographyClientPortalPage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(solutionJsonLd(PAGE, ctx)) }} />

        <SolutionHero
          layout="stacked"
          eyebrow="Photography client portal"
          title={
            <>
              Give your photography clients a <GradientText>better experience</GradientText>
            </>
          }
          subtitle={
            <>
              One branded link where clients approve the estimate, confirm the shoot time, follow progress, message you, pay, and download
              their photos and video. You work from the studio side of the same project, so both of you always see the same thing.
            </>
          }
          ctaId={cta("hero")}
          ctx={ctx}
          secondary={{ href: "/how-it-works", label: "See both sides in action" }}
          visual={
            <div className="relative px-1 pb-12 pt-20 text-left [contain:inline-size] sm:px-4">
              <div className="grid items-center gap-2 lg:grid-cols-[1.5fr_96px_1fr] lg:gap-3">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">
                    <span className="h-2 w-2 rounded-full bg-[#4F46E5]" aria-hidden />
                    Your studio
                  </p>
                  <ProductPreview view="studio" />
                </div>
                <div>
                  <ConnectorHorizontal />
                  <ConnectorVertical />
                </div>
                <div className="lg:-mt-6">
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                    Your client&apos;s portal
                  </p>
                  <ProductPreview view="client-portal" />
                </div>
              </div>
              <FloatingChip icon={Check} title="Estimate approved" detail="Brand photography package" tone="emerald" className="-left-1 top-0 sm:-left-4" />
              <FloatingChip icon={CalendarCheck} title="Shoot confirmed" detail="Client accepted Thu 9:00 AM" tone="indigo" className="right-0 top-0 hidden sm:flex" delayMs={500} />
              <FloatingChip icon={CreditCard} title="Payment received" detail="Paid by card through Stripe" tone="amber" className="-bottom-1 left-4 hidden sm:flex lg:left-1/4" delayMs={1000} />
              <FloatingChip icon={Download} title="Files ready" detail="Single files or one ZIP" tone="sky" className="-bottom-1 right-2" delayMs={1500} />
            </div>
          }
        />

        <FilmBand
          video={MEDIA.portal.film}
          eyebrow="The client side"
          title="Your clients get a portal with your name on it"
          body="Projects, progress, proposals, payments, and media in one branded place. Real ShootPortal screens."
        />

        <Section
          eyebrow="What it is"
          title="A client portal is the client's view of the whole project"
          intro="Many photography portals are a gallery with a password. That covers the last step. A full client portal covers everything before it too."
          align="left"
        >
          <div className="grid gap-10 lg:grid-cols-[1fr_1.35fr] lg:items-start">
            <div className="space-y-4 text-base leading-relaxed text-[#475569]">
              <p>
                In ShootPortal, every job is one project record. You see the studio side: stage, notes, uploads, payments. Your client sees
                the same project through the portal, in plain language, with the actions that are theirs to take.
              </p>
              <p>
                Nothing is copied between systems. When you upload the final edit, it&apos;s in their portal. When they approve the estimate,
                the project moves forward on your board. That shared record is what makes it a portal rather than another inbox.
              </p>
              <p>
                Setting one up yourself from separate tools is possible, and our guide on{" "}
                <Link href="/blog/how-to-create-photography-client-portal" className={LINK}>
                  how to create a photography client portal
                </Link>{" "}
                walks through the options.
              </p>
            </div>
            <ol className="mk-plain-list grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {JOURNEY.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="mk-reveal relative rounded-2xl border border-[#E2E8F0] bg-white p-5">
                    <span className="absolute right-4 top-4 text-xs font-bold text-[#CBD5E1]">0{i + 1}</span>
                    <Icon className="h-5 w-5 text-[#4F46E5]" aria-hidden />
                    <h3 className="mt-3 font-semibold text-[#0F172A]">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#475569]">{s.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </Section>

        <Section
          eyebrow="The usual way"
          title="Why client communication gets messy"
          intro="Most photographers piece the client experience together from tools the client already has. Each one works on its own. Together they leave the client doing the organizing."
          tone="cloud"
        >
          <ProblemGrid
            items={[
              { icon: Mail, title: "Endless email threads", body: "The estimate is in one thread, the shoot time in another, and the revision notes are buried under a reply-all." },
              { icon: Link2, title: "File links everywhere", body: "A cloud folder for photos, a different link for the video, and a third when the client asks for smaller files." },
              { icon: Receipt, title: "Invoices from somewhere else", body: "Payment arrives through a separate app that has no idea whether the files went out." },
              { icon: BellRing, title: "\"Any update?\"", body: "Clients can't see where their project stands, so they ask. You stop editing to answer." },
              { icon: KeyRound, title: "Too many logins", body: "Gallery site, invoicing site, scheduling link. Clients forget which one holds what." },
              { icon: Palette, title: "Your brand disappears", body: "Every handoff happens on someone else's branded screen, not yours." },
            ]}
          />
        </Section>

        <Section
          eyebrow="Why centralize it"
          title="One link the client can always come back to"
          intro="When everything about a job lives on one project, the experience feels calmer for the client and lighter for you."
        >
          <LoopVideo video={MEDIA.portal.journeyLoop} frame="dark" className="mk-reveal mx-auto mb-10 max-w-4xl" />
          <FeatureCards
            columns={4}
            items={[
              { icon: Inbox, title: "Nothing to dig for", body: "Estimate, shoot time, files, and receipts sit in one place, months later too." },
              { icon: BellRing, title: "Fewer status questions", body: "Clients see the current stage, and email notifications tell them when something needs their attention." },
              { icon: CreditCard, title: "Faster payment", body: "The payment request lives next to the work it pays for, with card checkout one click away." },
              { icon: Palette, title: "A consistent brand", body: "Every step happens on a portal with your logo and colors, at your address." },
            ]}
          />
        </Section>

        <Section
          tone="dark"
          eyebrow="Branded access"
          title="Your logo, your colors, your address"
          intro="Clients sign in to a portal that looks like your studio. Set it up once in the guided setup and every project inherits it."
        >
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
            <ul className="mk-plain-list space-y-5">
              {[
                { icon: Palette, title: "Logo and brand color", body: "Buttons, highlights, and headers pick up your color. Your logo sits at the top of every page." },
                { icon: Moon, title: "Light or dark theme", body: "Choose the portal theme that suits your work. A dark theme flatters moody wedding or film work; light suits listings." },
                { icon: Globe, title: "Subdomain or custom domain", body: "Every studio gets yourname.shootportal.app. Connect your own domain, such as portal.yourstudio.com, with DNS verification." },
                { icon: Mail, title: "Email from your domain", body: "Client notifications can be sent from your own domain." },
              ].map((it) => {
                const Icon = it.icon;
                return (
                  <li key={it.title} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#A5B4FC]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-semibold text-white">{it.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-300">{it.body}</p>
                    </div>
                  </li>
                );
              })}
              <li className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-300">
                Honest note: this is a branded client portal, not a full white-label product. Your brand leads every screen your clients use.
              </li>
            </ul>
            <figure>
              <ShowcaseImage image={MEDIA.portal.twoSided} frame="dark" />
              <figcaption className="mt-3 text-center text-xs text-slate-400">Branding settings on your side, the branded portal on your client&apos;s phone. Real ShootPortal screens.</figcaption>
            </figure>
          </div>
        </Section>

        <Section
          eyebrow="Project info & stage updates"
          title="The same stage, in words your client understands"
          intro="Your board uses working labels. The portal translates each one into a client-friendly stage, so a client always knows what's happening and what's next."
          tone="cloud"
        >
          <div className="mk-reveal mx-auto max-w-4xl overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white">
            <div className="grid grid-cols-[1fr_auto_1fr] border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              <p className="px-5 py-3">You see</p>
              <span className="px-2 py-3" aria-hidden />
              <p className="bg-emerald-50/60 px-5 py-3 text-emerald-700">Your client sees</p>
            </div>
            <ol className="mk-plain-list">
              {STAGE_LABELS.map((s) => (
                <li key={s.studio} className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-[#F1F5F9] text-sm last:border-0">
                  <span className="px-5 py-3 font-medium text-[#334155]">{s.studio}</span>
                  <ArrowRight className="h-4 w-4 text-[#CBD5E1]" aria-label="shown to the client as" />
                  <span className="bg-emerald-50/30 px-5 py-3 font-semibold text-[#0F172A]">{s.client}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-[#64748B]">
            Some stage changes happen automatically. For example, you can have a project move to Delivered as soon as the final payment
            clears.
          </p>
        </Section>

        <Section eyebrow="Talk and get paid" title="Messages and payments on the project, not in another app">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="mk-reveal flex flex-col rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8">
              <MessageSquare className="h-6 w-6 text-[#4F46E5]" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold text-[#0F172A]">Two-way messages, with email backup</h3>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-[#475569]">
                Clients message you from the project, and you reply from the studio. The conversation stays with the job, so a question about
                the second location is never separated from the estimate it refers to. Email notifications, from ten editable templates, let
                clients know when there&apos;s something to approve, confirm, review, or pay.
              </p>
              <figure className="mt-6">
                <ProductPreview view="messages" />
                <figcaption className="mt-3 text-center text-xs text-[#64748B]">Product illustration: a message thread on a project (demo data).</figcaption>
              </figure>
            </div>
            <div className="mk-reveal flex flex-col rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8">
              <CreditCard className="h-6 w-6 text-[#4F46E5]" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold text-[#0F172A]">Deposits and balances through Stripe</h3>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-[#475569]">
                Request payment from the project and clients pay by card through Stripe Checkout, straight into your own Stripe account. Take
                a deposit when the estimate is approved (a percentage or a fixed amount), then the balance later, or ask for the full amount.
                Clients get email receipts, and you can mark cash or check payments as paid.
              </p>
              <figure className="mt-6">
                <PaymentFlowDiagram />
              </figure>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Galleries & deliverables"
          title="More than a gallery: every deliverable, one place"
          intro="Photos, video, tours, and documents arrive in the same portal the client has used since the estimate."
          tone="cloud"
        >
          <div className="space-y-20">
            <FeatureSpotlight
              eyebrow="Delivery"
              title="Photos, video, 360 tours, 3D, and documents"
              body={
                <p>
                  Upload photos into folders, video files, YouTube embeds, Kuula 360 tours, 3D models from Matterport, Polycam, Sketchfab and
                  others, plus documents. Clients approve each item or send written feedback, then download Print (original full-resolution)
                  or MLS (2048px) versions, one at a time or as a ZIP. If you want, downloads unlock once the final payment clears while
                  previews stay viewable.
                </p>
              }
              bullets={[
                "You choose which media sections each client sees",
                "Share links let a client pass files to people who don't have an account",
                <>
                  Delivery in depth:{" "}
                  <Link href="/photo-video-delivery-software" className={LINK}>
                    photo and video delivery software
                  </Link>
                </>,
              ]}
              visual={<GalleryCard locked />}
              caption="Illustration of a delivery with downloads waiting on final payment."
            />
            <FeatureSpotlight
              reverse
              eyebrow="Video review"
              title="Video feedback pinned to the exact moment"
              body={
                <p>
                  For video work, clients leave time-stamped comments that can be pinned to a spot on the frame. You reply in threads, resolve
                  notes as you fix them, and upload numbered versions, so &quot;the bit near the end&quot; becomes &quot;0:38, left side of
                  frame.&quot;
                </p>
              }
              bullets={["Resolve and reopen comments", "Numbered versions keep v1 and v2 apart", "Comment notifications are batched, not one email per note"]}
              visual={<VideoReviewCard />}
            />
          </div>
        </Section>

        <DemoShowcase
          eyebrow="What your client sees"
          title="Walk through the portal as your client"
          intro="A 22-second look at the client side: the branded landing page, their projects, progress at every step, media, and downloads."
          video={MEDIA.portal.demo}
          points={["Your client opens your branded portal", "Their projects and next steps are waiting", "Photos and video ready to review and download"]}
          ctaId={cta("demo")}
          trialDays={ctx.trialDays}
          ctaLabel="Give your clients this portal"
        />

        <Section
          eyebrow="Before and after"
          title="One client, one job, two very different weeks"
          intro="Here is the same commercial headshot job, run through scattered tools and then through a client portal."
        >
          <BeforeAfter
            beforeTitle="Without a portal"
            afterTitle="With a ShootPortal client portal"
            before={[
              "Quote sent as an email attachment, approved with \"looks good!\" three replies down",
              "Four emails to settle on Thursday at 9",
              "Deposit requested through a separate invoicing app",
              "Proofs shared in a cloud folder; feedback comes back as a numbered list in an email",
              "Final files in a second folder link that expires before the marketing team asks for them",
              "\"Did you get my payment?\" on the day of delivery",
            ]}
            after={[
              "Client approves the estimate in the portal; the deposit request is right there",
              "You propose Thursday at 9; they accept with one click and it lands on your Google Calendar",
              "The project shows \"Media in Production,\" so nobody needs to ask",
              "Feedback is attached to each photo they approve or reject",
              "Final payment by card; downloads unlock and the project moves to Delivered",
              "Their colleague gets a share link instead of a forwarded zip",
            ]}
          />
          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[#64748B]">Try it with one real client and see which week you prefer.</p>
            <TrialButton ctaId={cta("mid")} trialDays={ctx.trialDays} label="Set up your client portal" />
          </div>
        </Section>

        <Section eyebrow="Who benefits" title="Better for you, better for them" tone="cloud">
          <figure className="mk-reveal mx-auto mb-12 max-w-4xl">
            <ShowcaseImage image={MEDIA.portal.phones} frame="dark" sizes="(min-width: 1024px) 896px, 100vw" />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">{REAL_CAPTURE_NOTE}</figcaption>
          </figure>
          <AudienceSplit
            items={[
              {
                label: "For photographers & videographers",
                title: "Run every client from one place",
                body: <p>Your side of the portal is the studio: a pipeline of every project with the client record attached.</p>,
                points: [
                  "Fewer status emails and payment reminders to write by hand",
                  "Payment requests tied to the job, with optional pay-before-download",
                  "Video notes you can act on, with numbered versions",
                  "A premium experience that supports premium pricing",
                ],
              },
              {
                label: "For your clients",
                title: "One link for everything about their job",
                body: <p>Clients don&apos;t need to learn your tools. They follow the steps that are theirs to take.</p>,
                points: [
                  "Approve, confirm, review, and pay without hunting through email",
                  "Always know which stage the project is in",
                  "Find and re-download files later, in the size they need",
                  "Share files with colleagues without forwarding attachments",
                ],
              },
            ]}
          />
        </Section>

        <Section
          eyebrow="How clients get in"
          title="Simple, honest access"
          intro="Here is exactly how access works, for your client and for the people they share files with."
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
            <figure>
              <ShowcaseImage image={MEDIA.portal.responsive} frame="none" />
              <figcaption className="mt-3 text-center text-xs text-[#64748B]">One portal on laptop, tablet, and phone: landing page, request form, and sign-in. Real ShootPortal screens.</figcaption>
            </figure>
            <div className="space-y-4">
              {[
                {
                  icon: LogIn,
                  title: "Clients sign in",
                  body: "Each client has their own account on your portal. New clients can create one when they send a request from your public form.",
                },
                {
                  icon: Share2,
                  title: "Share links for everyone else",
                  body: "Need a business partner, agent's assistant, or marketing team to see the files? Send an \"anyone with the link\" page or an email invite, one-time or reusable, with an expiry date. They view without an account.",
                },
                {
                  icon: UserRound,
                  title: "You stay in control",
                  body: "You decide which media sections a client sees and whether downloads wait for payment.",
                },
              ].map((it) => {
                const Icon = it.icon;
                return (
                  <div key={it.title} className="mk-reveal flex gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-semibold text-[#0F172A]">{it.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[#475569]">{it.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Fit check"
          title="Where ShootPortal fits, and where it doesn't"
          intro="ShootPortal is built around the job: quote, shoot, review, pay, deliver. Some studios need things it doesn't do."
          tone="cloud"
        >
          <ScopeCard
            title="ShootPortal's client portal"
            does={[
              "Estimates, shoot-time confirmation, messages, payments, and delivery on one project",
              "Branded portal with your logo, colors, theme, and domain",
              "Photo approvals with written feedback and time-stamped video review",
              "Print or MLS-size downloads, single files or ZIP",
            ]}
            doesNot={[
              "Print sales, gallery stores, or client favorites for album selection",
              "Contracts and e-signatures",
              "SMS text notifications",
              "Clients booking open time slots on their own",
            ]}
          />
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#64748B]">
            Weighing gallery-first tools against full business portals? Our comparison of the{" "}
            <Link href="/blog/best-photography-client-portals" className={LINK}>
              best photography client portals
            </Link>{" "}
            covers both. Shooting listings? See how the portal fits the full{" "}
            <Link href="/real-estate-photography-software" className={LINK}>
              real estate photography software
            </Link>{" "}
            workflow, and our guide on{" "}
            <Link href="/blog/how-to-deliver-real-estate-photos" className={LINK}>
              how to deliver real estate photos
            </Link>
            .
          </p>
          <div className="mt-12">
            <FounderNote />
          </div>
        </Section>

        <Section eyebrow="Pricing" title="Every client gets the full portal">
          <PricingStrip ctx={ctx} ctaId={cta("pricing")} />
        </Section>

        <Section eyebrow="FAQ" title="Photography client portal questions" tone="cloud">
          <SolutionFaq
            items={[
              {
                q: "What is a photography client portal?",
                a: (
                  <p>
                    It&apos;s a private, branded place where a client follows their project with you. In ShootPortal that covers the whole job:
                    approving the estimate, confirming the shoot time, messaging, reviewing and approving media, paying, and downloading files.
                  </p>
                ),
              },
              {
                q: "Is it only for real estate photographers?",
                a: (
                  <p>
                    No. It works for any photographer or videographer who quotes, schedules, and delivers jobs: commercial, brand, headshot,
                    events, drone, or real estate. The Print and MLS download sizes and 3D tour embeds are there when listing work needs them.
                  </p>
                ),
              },
              {
                q: "Can I use my own domain and branding?",
                a: (
                  <p>
                    Yes. Add your logo and brand color, pick a light or dark theme, and use your yourname.shootportal.app address or connect a
                    custom domain like portal.yourstudio.com. It&apos;s a branded portal rather than a full white-label product.
                  </p>
                ),
              },
              {
                q: "Do my clients need to create an account?",
                a: (
                  <p>
                    The client on the job signs in to their portal. Anyone else, such as a colleague or business partner, can view files through
                    a share link without an account.
                  </p>
                ),
              },
              {
                q: "Can clients pay inside the portal?",
                a: (
                  <p>
                    Yes. You request payment from the project and the client pays by card through Stripe Checkout, into your own Stripe account.
                    Stripe&apos;s standard processing fees apply. Deposits on approval are optional.
                  </p>
                ),
              },
              {
                q: "Can clients choose their own shoot time?",
                a: (
                  <p>
                    Clients send a preferred date with their request, then you propose a time. They accept, decline, or suggest another time in
                    the portal. They don&apos;t pick from open slots on their own.
                  </p>
                ),
              },
              {
                q: "How do I try it?",
                a: (
                  <p>
                    {ctx.trialDays > 0 ? `Start a ${ctx.trialDays}-day free trial` : "Start free"} with no credit card. Sign up with Google or a
                    five-field form, and the guided setup walks you through branding, services, and connecting Stripe. You can skip steps and
                    come back later.
                  </p>
                ),
              },
            ]}
          />
        </Section>

        <Section eyebrow="Keep reading" title="Guides to a better client experience">
          <RelatedReading slugs={PAGE.relatedArticles} />
        </Section>

        <RelatedNext heading="Free tools and templates" tools={["quote-builder"]} resources={["photography-client-questionnaire"]} />

        <FinalCta
          ctaId={cta("final")}
          ctx={ctx}
          title="Give your next client one link for everything"
          body="Set up your branded portal, send your next estimate through it, and let the client take it from approval to download."
        />
      </MarketingShell>
    </BrandProvider>
  );
}
