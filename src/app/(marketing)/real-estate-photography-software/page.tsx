import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CalendarX2,
  Check,
  ClipboardList,
  CreditCard,
  FolderSearch,
  Images,
  MailQuestion,
  MessagesSquare,
  Palette,
  Receipt,
  Users,
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
  GradientText,
  PricingStrip,
  ProblemGrid,
  RelatedReading,
  Section,
  SolutionFaq,
  SolutionHero,
  ToolsVsPlatform,
  TrialButton,
} from "@/components/solutions/solution-sections";
import { FloatingChip, GalleryCard, PropertyArt, StageRibbon } from "@/components/solutions/solution-visuals";
import { WorkflowCoverageMap } from "@/components/blog/conversion-parts";
import { BookingFlowDiagram, CrmRecordDiagram, PortalAnatomyDiagram } from "@/components/blog/diagrams";
import { PaymentFlowDiagram, SampleEstimate } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";

const PAGE = getSolutionPage("real-estate-software");
const cta = (p: "hero" | "mid" | "final" | "pricing") => solutionCtaId(PAGE.key, p);

export const revalidate = 300;
export const metadata: Metadata = solutionMetadata(PAGE);

export default async function RealEstatePhotographySoftwarePage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(solutionJsonLd(PAGE, ctx)) }} />

        <SolutionHero
          eyebrow="Real estate photography software"
          title={
            <>
              The all-in-one software built for <GradientText>real estate photographers</GradientText>
            </>
          }
          subtitle={
            <>
              From the agent&apos;s request to the final MLS download, ShootPortal keeps your estimates, shoot times, client
              messages, payments, and photo and video delivery on one project, in a portal branded to your business. It runs the
              business; keep using your favorite editor for the images.
            </>
          }
          ctaId={cta("hero")}
          ctx={ctx}
          visual={
            <div className="relative px-2 pb-10 pt-6 sm:px-6">
              <div className="overflow-hidden rounded-3xl border border-white shadow-[0_50px_100px_-50px_rgba(49,46,129,0.8)] ring-1 ring-[#E2E8F0]">
                <PropertyArt idPrefix="re-hero" />
                <div className="bg-white px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">214 Oak Street</p>
                      <p className="text-xs text-[#64748B]">Listing photos + aerials + walkthrough video</p>
                    </div>
                    <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#4F46E5]">Review</span>
                  </div>
                  <StageRibbon active={4} className="mt-3" />
                </div>
              </div>
              <FloatingChip icon={Check} title="Estimate approved" detail="Listing package + aerials" tone="emerald" className="-left-2 top-0 sm:-left-6" />
              <FloatingChip icon={CalendarClock} title="Shoot confirmed" detail="Agent accepted Sat 10:00 AM" tone="indigo" className="-right-1 top-1/3 sm:-right-6" delayMs={600} />
              <FloatingChip icon={CreditCard} title="Paid · downloads unlocked" detail="Straight to your Stripe" tone="amber" className="bottom-0 left-6" delayMs={1200} />
            </div>
          }
        />

        <Section
          eyebrow="Sound familiar?"
          title="Great listing photos. Messy business around them."
          intro="Most real estate photography businesses run on texts, a calendar app, a folder link, and a separate payment tool. It works at five listings a week. At twenty, these are the cracks."
          tone="cloud"
        >
          <ProblemGrid
            items={[
              { icon: MailQuestion, title: "Booking details scattered", body: "Lockbox codes, occupied-home notes, and add-on requests live in text threads you have to dig through on shoot day." },
              { icon: CalendarX2, title: "Rescheduling by text", body: "Every weather delay or seller conflict turns into a back-and-forth with the agent, and the calendar drifts." },
              { icon: Receipt, title: "Chasing payment after delivery", body: "The files go out, the invoice sits, and you send another polite reminder a week later." },
              { icon: FolderSearch, title: "Lost download links", body: "Agents can't find last month's folder when the listing relaunches or their assistant asks for MLS sizes." },
              { icon: ClipboardList, title: "No view of every job", body: "Which listings are shot but not delivered? Delivered but unpaid? Answering takes four apps." },
              { icon: Palette, title: "An improvised client experience", body: "A shared folder plus a payment link doesn't look like the premium service you're charging for." },
            ]}
          />
        </Section>

        <Section
          eyebrow="One system instead of five"
          title="What changes when every listing lives on one project"
          intro="Each job gets one record that you and the agent both work from. Here is how the everyday tasks compare."
        >
          <ToolsVsPlatform
            rows={[
              { task: "New request", before: "Text or email; you retype the address and services", after: "Agent submits your branded request form: service, address, preferred date, notes" },
              { task: "Pricing", before: "Quote from memory, forget the travel fee", after: "Preliminary estimate from your service catalog, with a ZIP-distance travel fee" },
              { task: "Scheduling", before: "Texting times back and forth", after: "Propose a time; the agent accepts or counters; it pushes to your Google Calendar" },
              { task: "Updates", before: "\"Any update on Oak Street?\"", after: "The agent sees the project stage in the portal" },
              { task: "Payment", before: "Separate invoice app, manual reminders", after: "Card payment through your own Stripe account, deposit on approval if you want one" },
              { task: "Delivery", before: "Folder links that expire or get lost", after: "One link per property: photos, video, tours, Print or MLS sizes, ZIP download" },
            ]}
          />
        </Section>

        <Section
          id="workflow"
          eyebrow="The complete workflow"
          title="Request → Estimate → Schedule → Shoot → Review → Pay → Deliver"
          intro="These are the stages every listing moves through in ShootPortal, and the real features at each step."
          tone="cloud"
        >
          <figure>
            <WorkflowCoverageMap />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">ShootPortal&apos;s verified features at each stage of a job.</figcaption>
          </figure>
        </Section>

        <Section eyebrow="Built for listing work" title="Every part of the job, connected" intro="Concrete features, not a wish list. Each one is something you can try on your next listing.">
          <div className="space-y-20 lg:space-y-28">
            <FeatureSpotlight
              eyebrow="Requests & service packages"
              title="Agents request from your menu, not your text messages"
              body={
                <p>
                  Publish your packages and add-ons in a service catalog with descriptions, &quot;starting at&quot; prices, and
                  what&apos;s included. Agents submit a request from your branded form with the property address, the service, a
                  preferred date, and access notes. The request lands as a new project with the client record attached.
                </p>
              }
              bullets={[
                "Service catalog with includes lists, line items, and a recommended package",
                "Option to hide prices for custom or commercial work",
                <>A &quot;we received your request&quot; email goes out automatically</>,
              ]}
              visual={<ProductPreview view="projects" />}
              caption="Product illustration: new requests arriving in the project pipeline (demo data)."
            />
            <FeatureSpotlight
              reverse
              eyebrow="Estimates"
              title="Accurate quotes, including the drive"
              body={
                <p>
                  ShootPortal can build a preliminary estimate the moment a request arrives, adding a travel fee calculated from the
                  distance between ZIP codes, using your tiers or a per-mile rate with a cap. Adjust the line items, send the
                  official estimate, and the agent approves or asks for changes in the portal. Versions and expiry dates are
                  tracked, with a PDF if the brokerage needs one.
                </p>
              }
              visual={
                <SampleEstimate
                  title="214 Oak Street · Listing package"
                  client="Avery Chen, Northside Realty"
                  depositPercent={30}
                  lines={[
                    { label: "Listing photos (up to 35)", amount: 225 },
                    { label: "Drone aerials (5 stills)", amount: 95 },
                    { label: "Walkthrough video", amount: 150 },
                    { label: "Travel fee", detail: "26–50 miles from base ZIP", amount: 40 },
                  ]}
                />
              }
              caption="Example estimate with illustrative prices. Your catalog sets the real ones."
            />
            <FeatureSpotlight
              eyebrow="Booking & scheduling"
              title="Confirm shoot times without the text-message ping-pong"
              body={
                <p>
                  Propose a shoot time from the project. The agent accepts, declines, or suggests another time in the portal, and
                  confirmed shoots push to your Google Calendar. Your Google events also show inside the ShootPortal calendar, so
                  you can spot conflicts before you propose.
                </p>
              }
              bullets={[
                "Weather reschedules happen on the same project, so nothing gets lost",
                "Collect a deposit when the estimate is approved, if you want one",
                <>
                  Agents respond to times you propose rather than booking open slots themselves. See how that compares in our{" "}
                  <Link href="/blog/best-real-estate-photography-booking-software" className="font-medium text-[#4F46E5] underline underline-offset-2">
                    booking software guide
                  </Link>
                  .
                </>,
              ]}
              visual={<BookingFlowDiagram />}
            />
            <FeatureSpotlight
              reverse
              eyebrow="Projects & clients"
              title="Every agent, property, and listing in one place"
              body={
                <p>
                  Each agent has a client record with contact details, notes, a timeline of messages and activity, and property
                  history: every address you&apos;ve shot for them, with revenue and outstanding balance. Projects move through
                  clear stages from new request to delivered, so you can see at a glance what&apos;s scheduled, in review, or
                  awaiting payment.
                </p>
              }
              bullets={[
                <>
                  Want the relationship side in depth? See our{" "}
                  <Link href="/real-estate-photography-crm" className="font-medium text-[#4F46E5] underline underline-offset-2">
                    real estate photography CRM
                  </Link>{" "}
                  page.
                </>,
                "Staff accounts with granular permissions, assigned to specific projects",
              ]}
              visual={<CrmRecordDiagram />}
            />
            <FeatureSpotlight
              eyebrow="Payments"
              title="Get paid before the files leave your hands"
              body={
                <p>
                  Request payment from the project and the agent pays by card through Stripe Checkout, straight to your own Stripe
                  account. Take a deposit on approval and the balance later, or the full amount. Turn on &quot;unlock downloads
                  after payment&quot; and agents can preview everything immediately while downloads open once the final payment
                  clears.
                </p>
              }
              bullets={["Email receipts", "Mark offline payments as paid", "Payment status visible on every project"]}
              visual={<PaymentFlowDiagram />}
            />
            <FeatureSpotlight
              reverse
              eyebrow="Photo & video delivery"
              title="One link per property, ready for the MLS"
              body={
                <p>
                  Upload photos, video, Kuula 360 tours, and 3D embeds such as Matterport to the project. Agents approve each item or
                  request changes with written feedback, comment on videos at exact timestamps, then download Print (original) or
                  MLS-sized (2048px) files, one at a time or as a ZIP. Share links let an assistant or co-listing agent view files
                  without an account.
                </p>
              }
              bullets={[
                <>
                  More on delivery:{" "}
                  <Link href="/photo-video-delivery-software" className="font-medium text-[#4F46E5] underline underline-offset-2">
                    photo and video delivery software
                  </Link>
                </>,
              ]}
              visual={<GalleryCard locked />}
              caption="Illustration of a delivery with downloads locked until payment."
            />
          </div>
        </Section>

        <Section
          eyebrow="Your brand, not ours"
          title="A client experience that matches your photos"
          intro="Agents get one professional portal at your subdomain or your own domain, with your logo and brand colors."
          tone="cloud"
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <figure>
              <PortalAnatomyDiagram />
              <figcaption className="mt-3 text-center text-xs text-[#64748B]">What an agent can do inside the portal.</figcaption>
            </figure>
            <FeatureCards
              columns={2}
              items={[
                { icon: Palette, title: "Logo, colors, light or dark theme", body: "Set once in the guided setup; every project inherits it." },
                { icon: Users, title: "Your domain", body: "Use yourname.shootportal.app or connect portal.yourstudio.com with DNS verification." },
                { icon: MessagesSquare, title: "Messages on the job", body: "Conversations stay attached to the listing, not buried in your phone." },
                { icon: Images, title: "Everything for the listing", body: "Estimate, shoot time, media, payment, and downloads behind one login." },
              ]}
            />
          </div>
          <p className="mt-8 text-center text-sm text-[#64748B]">
            ShootPortal is a branded portal, not fully white-label. Learn more on the{" "}
            <Link href="/photography-client-portal" className="font-medium text-[#4F46E5] underline underline-offset-2">
              photography client portal
            </Link>{" "}
            page.
          </p>
        </Section>

        <Section eyebrow="Who it's for" title="From your first agent to a busy listing team">
          <AudienceSplit
            items={[
              {
                label: "Solo photographers",
                title: "Look established from day one",
                body: <p>One flat plan covers every feature, so you can give agents a polished experience without paying per listing.</p>,
                points: [
                  "Quote, schedule, deliver, and get paid without five subscriptions",
                  "Payment-linked delivery protects your time on small jobs",
                  "Aerials, video, and commercial work run through the same system",
                ],
              },
              {
                label: "Growing media teams",
                title: "See every listing and every photographer",
                body: <p>Add staff with the permissions they need and assign them to the jobs they&apos;re shooting or editing.</p>,
                points: [
                  "Pipeline view of every listing by stage",
                  "Client history by agent and property for repeat orders",
                  "Your brand on every portal, no matter who shot the job",
                ],
              },
            ]}
          />
          <div className="mt-10 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-sm leading-relaxed text-[#475569]">
            <p className="font-semibold text-[#0F172A]">Where another tool fits better</p>
            <p className="mt-1.5">
              ShootPortal doesn&apos;t build single-property websites or flyers, deliver to Zillow Showcase, auto-dispatch photographers by drive
              time, or handle e-signatures. If those are central to your business, compare options in our{" "}
              <Link href="/blog/best-real-estate-photography-software" className="font-medium text-[#4F46E5] underline underline-offset-2">
                guide to the best real estate photography software
              </Link>{" "}
              and{" "}
              <Link href="/blog/shootportal-vs-aryeo-vs-hdphotohub" className="font-medium text-[#4F46E5] underline underline-offset-2">
                ShootPortal vs. Aryeo vs. HDPhotoHub
              </Link>
              .
            </p>
          </div>
          <div className="mt-10 flex justify-center">
            <TrialButton ctaId={cta("mid")} trialDays={ctx.trialDays} label="Try it on your next listing" />
          </div>
        </Section>

        <Section tone="cloud" title="Made by someone who shoots for a living">
          <FounderNote />
        </Section>

        <Section eyebrow="Pricing" title="One plan. Every feature.">
          <PricingStrip ctx={ctx} ctaId={cta("pricing")} />
        </Section>

        <Section eyebrow="FAQ" title="Real estate photography software questions" tone="cloud">
          <SolutionFaq
            items={[
              {
                q: "What does real estate photography software do?",
                a: (
                  <p>
                    It runs the business around the shoot: taking requests, quoting, scheduling, talking to agents, collecting payment, and
                    delivering files. ShootPortal keeps all of that on one project per listing, in a portal branded to you.
                  </p>
                ),
              },
              {
                q: "Does ShootPortal edit photos?",
                a: <p>No. Keep your editor (Lightroom, an AI editing service, or an outsourced editor). ShootPortal handles everything before and after editing.</p>,
              },
              {
                q: "Can agents book a time slot on their own?",
                a: (
                  <p>
                    Agents submit a request with a preferred date, and you propose the shoot time. They accept, decline, or suggest another time in the
                    portal. If instant self-booking is essential, a self-booking platform may suit you better.
                  </p>
                ),
              },
              {
                q: "How do I get paid?",
                a: (
                  <p>
                    You connect your own Stripe account during setup. Agents pay by card through Stripe Checkout and the money goes to your account.
                    Stripe&apos;s standard processing fees apply. You can require a deposit on approval and lock downloads until the final payment.
                  </p>
                ),
              },
              {
                q: "Do agents need an account?",
                a: (
                  <p>
                    The agent who orders signs in to their portal. You can also send share links so an assistant or co-listing agent can view the files
                    without an account.
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

        <Section eyebrow="Keep reading" title="Guides for real estate photographers">
          <RelatedReading slugs={PAGE.relatedArticles} />
        </Section>

        <FinalCta
          ctaId={cta("final")}
          ctx={ctx}
          title="Ready to run your real estate photography business in one place?"
          body="Put your next listing through ShootPortal, from the agent's request to paid and delivered, and see how much of the back-and-forth disappears."
        />
      </MarketingShell>
    </BrandProvider>
  );
}
