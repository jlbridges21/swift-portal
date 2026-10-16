import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarX2,
  ClipboardList,
  FileQuestion,
  Inbox,
  MessagesSquare,
  Repeat,
  UserPlus,
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
  ApproachCompare,
  DemoShowcase,
  FeatureSpotlight,
  FinalCta,
  FounderNote,
  GradientText,
  PricingStrip,
  ProblemGrid,
  REAL_CAPTURE_NOTE,
  RelatedReading,
  RelatedSolutions,
  Section,
  SolutionFaq,
  SolutionHero,
  StepTimeline,
  ToolsVsPlatform,
  TrialButton,
} from "@/components/solutions/solution-sections";
import { FloatingChip } from "@/components/solutions/solution-visuals";
import { LoopVideo, ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA } from "@/lib/solution-media";
import { WorkflowCoverageMap } from "@/components/blog/conversion-parts";
import { BookingFlowDiagram } from "@/components/blog/diagrams";
import { SampleEstimate, ServiceMenu } from "@/components/blog/business-diagrams";

const PAGE = getSolutionPage("booking");
const cta = (p: CtaPlacement) => solutionCtaId(PAGE.key, p);
const A = "font-medium text-[#4F46E5] underline underline-offset-2";

export const revalidate = 300;
export const metadata: Metadata = solutionMetadata(PAGE);

export default async function PhotographyBookingSoftwarePage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(solutionJsonLd(PAGE, ctx)) }} />

        <SolutionHero
          eyebrow="Request-based booking"
          title={
            <>
              Photography booking software, from inquiry to <GradientText>confirmed shoot</GradientText>
            </>
          }
          subtitle={
            <>
              ShootPortal is photography booking software for client-commissioned work. Clients request a service from your menu on a
              branded form, get an estimate, and accept the shoot time you propose, all on one project that carries straight through to
              payment and delivery.
            </>
          }
          ctaId={cta("hero")}
          ctx={ctx}
          secondary={{ href: "#how-booking-works", label: "See the booking flow" }}
          visual={
            <div className="relative pb-12 pt-4">
              <ShowcaseImage image={MEDIA.booking.hero} frame="none" priority sizes="(min-width: 1024px) 50vw, 100vw" />
              <FloatingChip icon={Inbox} title="New request" detail="Project created" tone="sky" className="-left-1 top-[8%] hidden sm:-left-6 sm:flex" />
              <FloatingChip icon={CalendarCheck} title="Time accepted" detail="Pushed to Google Calendar" tone="emerald" className="-right-1 bottom-0 sm:right-2" delayMs={900} />
            </div>
          }
        />

        <Section
          eyebrow="Why booking takes so long"
          title="The shoot takes an hour. Booking it takes a week of messages."
          intro="Most of the friction in booking photography isn't the calendar. It's the details, the price, and the back-and-forth around the date."
          tone="cloud"
        >
          <ProblemGrid
            items={[
              { icon: FileQuestion, title: "Missing details", body: "The request arrives as a text with no address, no service, and no idea what the client expects to pay." },
              { icon: ClipboardList, title: "Quoting from scratch", body: "Every inquiry means retyping packages and prices into an email, and remembering the travel fee." },
              { icon: MessagesSquare, title: "Date ping-pong", body: "Three messages to agree on a time, then two more when the weather or the client's plans change." },
              { icon: CalendarX2, title: "Double booking risk", body: "Your personal calendar and your shoot calendar live in different places, so conflicts slip through." },
              { icon: UserPlus, title: "Retyping client info", body: "Name, email, company, and address get copied by hand into a spreadsheet, an invoice app, and a folder name." },
              { icon: Repeat, title: "Repeat clients start over", body: "Your best clients have to explain everything again because nothing remembers the last job." },
            ]}
          />
        </Section>

        <Section
          id="how-booking-works"
          eyebrow="How booking works in ShootPortal"
          title="Four steps from inquiry to scheduled"
          intro="This is request-based booking: the client tells you what they need, and you confirm the time. Here is exactly what happens."
        >
          <StepTimeline
            steps={[
              {
                tag: "Client",
                title: "Request from your menu",
                body: "On your branded form, the client enters contact details, the address, one service from your catalog, a preferred date, and notes. Submitting creates their client account.",
              },
              {
                tag: "Automatic",
                title: "Project and estimate created",
                body: "The request becomes a project with the client attached, and ShootPortal can send a preliminary estimate from your catalog right away. The client gets a confirmation email.",
              },
              {
                tag: "You",
                title: "Send the official proposal",
                body: "Review the details, adjust line items, and send the proposal. The client approves it or asks for changes in the portal.",
              },
              {
                tag: "Client",
                title: "Accept the shoot time",
                body: "Propose a date and time. The client accepts, declines, or suggests another. Accepting sets the shoot date, declines the other pending times, and updates your Google Calendar.",
              },
            ]}
          />
        </Section>

        <DemoShowcase
          title="A booking that starts the whole workflow"
          intro="A 31-second walkthrough of real ShootPortal screens: the client picks a service and a preferred date, gets an instant preliminary estimate, the project appears, and they respond to the time you propose."
          video={MEDIA.booking.demo}
          points={["Clients choose the service and a preferred date", "An instant preliminary estimate and a new project, automatically", "You propose the shoot time; the client responds in their portal"]}
          ctaId={cta("demo")}
          trialDays={ctx.trialDays}
          ctaLabel="Book your next shoot through ShootPortal"
        />

        <Section eyebrow="Booking features" title="Everything the booking needs, on the project" tone="cloud">
          <div className="space-y-20 lg:space-y-28">
            <FeatureSpotlight
              eyebrow="Service catalog"
              title="Clients choose from your packages, not a blank text box"
              body={
                <p>
                  Build your services once, with descriptions, what&apos;s included, and &quot;starting at&quot; prices. Mark one as recommended or hide
                  prices for custom work. The request form shows the catalog, so every inquiry arrives tied to a real service.
                </p>
              }
              bullets={["Starter service templates during setup", "Line items carry through to the estimate", "Inquiry-only mode if you'd rather quote everything by hand"]}
              visual={
                <ServiceMenu
                  packages={[
                    { name: "Essentials", price: "from $175", blurb: "Up to 25 photos", includes: ["HDR interiors", "Exteriors", "MLS-size files"] },
                    { name: "Signature", price: "from $325", blurb: "Photos + aerials", includes: ["Up to 35 photos", "5 drone stills", "Twilight exterior"], highlight: true },
                    { name: "Cinematic", price: "from $575", blurb: "Photos + video", includes: ["Up to 40 photos", "60–90s walkthrough film", "Aerial clips"] },
                  ]}
                />
              }
              caption="Example service menu with illustrative prices. Your catalog sets the real ones."
            />
            <FeatureSpotlight
              reverse
              eyebrow="Estimates"
              title="A price in the client's inbox before you've opened the email"
              body={
                <p>
                  With automatic estimates on, a preliminary estimate is created and sent as soon as the request comes in, with an optional travel
                  fee based on ZIP-to-ZIP distance. When you&apos;re ready, convert it to an official proposal with versions, an expiry date, and a
                  PDF. The client approves the proposal or requests changes in the portal.
                </p>
              }
              bullets={["Travel fees by distance tiers, or a free radius plus a per-mile rate with a cap", "Optional deposit requested when the proposal is approved"]}
              visual={
                <SampleEstimate
                  title="Signature package · 214 Oak Street"
                  client="Avery Chen, Northside Realty"
                  lines={[
                    { label: "Signature: photos + aerials", amount: 325 },
                    { label: "Twilight exterior", amount: 75 },
                    { label: "Travel fee", detail: "26–50 miles from base ZIP", amount: 40 },
                  ]}
                />
              }
              caption="Example estimate with illustrative prices."
            />
            <FeatureSpotlight
              eyebrow="Scheduling"
              title="Confirm the time in one tap, not five texts"
              body={
                <p>
                  Propose a shoot date and time from the project. The client accepts, declines, or counters with another time, and either side can
                  propose. If several times are pending, accepting one declines the rest. Reschedules happen on the same project, so the history
                  stays with the job.
                </p>
              }
              bullets={[
                "Shoots push to the Google Calendar you choose, including pending times",
                "Your Google events show read-only on the ShootPortal calendar",
                "Month, week, day, and agenda views",
              ]}
              visual={<BookingFlowDiagram />}
            />
            <FeatureSpotlight
              reverse
              eyebrow="Calendar"
              title="See every booked shoot next to the rest of your life"
              body={
                <p>
                  The ShootPortal calendar shows confirmed shoots with their project, client, and address. Connect Google and your own events appear
                  alongside them, so you can spot a conflict before you propose a time.
                </p>
              }
              visual={<ShowcaseImage image={MEDIA.booking.calendar} />}
              caption={REAL_CAPTURE_NOTE}
            />
          </div>
        </Section>

        <Section
          eyebrow="Choose the right kind of booking"
          title="Request-based booking or self-scheduling?"
          intro="Both are valid. They suit different businesses, and it's better to know which one you need before you start a trial."
        >
          <ShowcaseImage image={MEDIA.booking.comparison} className="mk-reveal mx-auto mb-10 max-w-4xl" sizes="(min-width: 1024px) 896px, 100vw" />
          <ApproachCompare
            left={{
              label: "Self-scheduling tools",
              title: "Clients pick an open slot",
              points: [
                "Availability rules and bookable time slots",
                "Instant confirmation with no review",
                "Usually separate from quoting, delivery, and payment for the finished work",
              ],
              fit: "Fixed-length sessions at a known price, like headshots or mini-sessions.",
            }}
            right={{
              label: "ShootPortal",
              title: "Clients request, you confirm",
              points: [
                "You see the address, service, and notes before committing a time",
                "Price is set by your catalog, travel distance, and the official proposal",
                "The booking becomes the project that carries review, payment, and delivery",
              ],
              fit: "Commissioned shoots where location, scope, and price vary: real estate, drone, commercial, and video work.",
            }}
          />
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-[#64748B]">
            ShootPortal does not offer self-booking into open time slots or availability rules. If that&apos;s essential, compare options in our{" "}
            <Link href="/blog/best-real-estate-photography-booking-software" className={A}>
              real estate photography booking software comparison
            </Link>
            .
          </p>
        </Section>

        <Section eyebrow="Before and after" title="What booking looks like with one system" tone="cloud">
          <figure className="mk-reveal mx-auto mb-10 max-w-4xl">
            <ShowcaseImage image={MEDIA.booking.twoViews} sizes="(min-width: 1024px) 896px, 100vw" />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">The client requests on their phone; the shoot lands in your calendar workflow. Real ShootPortal screens.</figcaption>
          </figure>
          <ToolsVsPlatform
            leftTitle="Texts, email, and a calendar app"
            rows={[
              { task: "Inquiry", before: "A text with half the details", after: "A request form with address, service, preferred date, and notes" },
              { task: "Client record", before: "Typed into a spreadsheet later", after: "Created from the request; returning clients request from their portal" },
              { task: "Price", before: "Quoted by email from memory", after: "Preliminary estimate from your catalog, then an official proposal" },
              { task: "Time", before: "Back-and-forth until someone agrees", after: "Proposed time with accept, decline, or counter" },
              { task: "Calendar", before: "Entered by hand, sometimes twice", after: "Pushed to Google Calendar from the project" },
              { task: "After the shoot", before: "A new thread for files and invoices", after: "The same project handles review, payment, and delivery" },
            ]}
          />
          <div className="mt-10 flex justify-center">
            <TrialButton ctaId={cta("mid")} trialDays={ctx.trialDays} label="Book your next shoot through ShootPortal" />
          </div>
        </Section>

        <Section
          eyebrow="Booking is step one"
          title="The booking turns into the whole job"
          intro="Because the booking is a project, nothing is re-entered when the shoot is done. These are the verified features at every stage."
        >
          <LoopVideo video={MEDIA.booking.workflowLoop} frame="dark" className="mk-reveal mx-auto mb-10 max-w-4xl" />
          <figure>
            <WorkflowCoverageMap highlight={["request", "estimate", "schedule"]} />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">Booking stages highlighted; the rest of the job continues on the same project.</figcaption>
          </figure>
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-[#475569]">
            Taking payment after the booking is covered on our{" "}
            <Link href="/photography-invoicing-software" className={A}>
              photography invoicing software
            </Link>{" "}
            page, and what runs automatically from request to delivery is on the{" "}
            <Link href="/real-estate-photography-workflow-software" className={A}>
              workflow software
            </Link>{" "}
            page.
          </p>
        </Section>

        <Section tone="cloud" title="Built around real booking headaches">
          <FounderNote detail="Weather reschedules, occupied homes, and last-minute add-ons shaped how requests, proposals, and counter-offers work." />
        </Section>

        <Section eyebrow="Pricing" title="Booking is included in the one plan">
          <PricingStrip ctx={ctx} ctaId={cta("pricing")} />
        </Section>

        <Section eyebrow="FAQ" title="Photography booking software questions" tone="cloud">
          <SolutionFaq
            items={[
              {
                q: "Can clients book an open time slot themselves?",
                a: (
                  <p>
                    No. Clients submit a request with a preferred date, and you or the client propose a specific time. The other side accepts, declines,
                    or counters. If you need instant self-booking into available slots, a dedicated scheduling tool will fit better.
                  </p>
                ),
              },
              {
                q: "What does the request form ask for?",
                a: (
                  <p>
                    Name, email, phone, company, the property or location address, one service from your catalog, an optional preferred date, notes,
                    and a password for the client&apos;s account. You can switch it to an inquiry form with no service picker if you quote everything by
                    hand.
                  </p>
                ),
              },
              {
                q: "Does it send an estimate automatically?",
                a: (
                  <p>
                    It can. With automatic estimates on, a preliminary estimate is created from the chosen service and sent when the request arrives.
                    The client approves the official proposal you send afterwards, so you always review the final price.
                  </p>
                ),
              },
              {
                q: "Does it sync with Google Calendar?",
                a: (
                  <p>
                    Shoots push to the Google Calendar you choose when they&apos;re proposed, accepted, or rescheduled, and your Google events show
                    read-only on the ShootPortal calendar. It isn&apos;t a full two-way sync: editing an event in Google doesn&apos;t change the shoot.
                  </p>
                ),
              },
              {
                q: "Can I take a deposit when the client books?",
                a: (
                  <p>
                    You can require a deposit, as a percentage or a fixed amount, when the client approves the proposal. Clients pay by card through
                    Stripe Checkout into your own Stripe account.
                  </p>
                ),
              },
              {
                q: "Is there a free trial?",
                a: (
                  <p>
                    Yes. {ctx.trialDays > 0 ? `${ctx.trialDays} days free, ` : ""}no credit card required. Sign up with Google or a five-field form, add
                    your services in the guided setup, and send your request link to a client.
                  </p>
                ),
              },
            ]}
          />
        </Section>

        <Section eyebrow="Keep reading" title="Guides on booking and scheduling">
          <RelatedReading slugs={PAGE.relatedArticles} />
        </Section>

        <Section eyebrow="More of ShootPortal" title="What happens after the booking" tone="cloud">
          <RelatedSolutions keys={["invoicing", "workflow", "client-portal"]} />
        </Section>

        <FinalCta
          ctaId={cta("final")}
          ctx={ctx}
          title="Turn your next inquiry into a confirmed shoot"
          body="Set up your services, share your request link, and watch the request, estimate, and shoot time land on one project."
        />
      </MarketingShell>
    </BrandProvider>
  );
}

