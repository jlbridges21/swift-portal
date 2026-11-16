import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  InlineCta,
  KeyTakeaways,
  No,
  PickGrid,
  SiteLink,
  ToolCard,
  Yes,
} from "@/components/blog/article-parts";
import { BookingFlowDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, ProductCallout, TrialCard, WorkflowCoverageMap } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";
import { AllInOnePlatform, AppScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "best-real-estate-photography-booking-software",
  title: "Best Real Estate Photography Booking and Scheduling Software in 2026",
  seoTitle: "Real Estate Photography Booking Software (2026)",
  description:
    "Compare real estate photography booking software: ShootPortal, Aryeo, HDPhotoHub, Tonomo, Acuity, and more on booking, travel fees, deposits, and calendar.",
  excerpt:
    "ShootPortal, Aryeo, HDPhotoHub, Spiro, Tonomo, Acuity, Calendly, Square Appointments, and Setmore, compared on how agents book, how you price, and how shoots land on your calendar.",
  category: "business-automation",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "real estate photography booking software",
  secondaryKeywords: [
    "real estate photography scheduling software",
    "real estate photography ordering system",
    "photography booking deposits",
    "real estate photographer travel fees",
    "real estate photography website",
    "photography booking form",
    "instant photography estimate",
  ],
  readingMinutes: 13,
  cover: {
    variant: "calendar",
    label: "2026 Guide",
    alt: "Illustration of a weekly calendar with shoot appointments and a booking form",
  },
  disclosure: true,
  quickAnswer: {
    heading: "Quick answer",
    points: [
      <>
        <strong>Best real estate photography booking software for most solo operators and small teams:</strong>{" "}
        ShootPortal (our product). Booking starts on your own business website with a Book a Shoot form, and the client
        sees an instant estimate, including travel fees by ZIP distance, the moment they submit.
      </>,
      <>
        <strong>You stay in control of the calendar.</strong> Instead of letting agents grab any open slot, you propose
        a time that fits your route, the weather, and the sun, and the client approves it in one tap.
      </>,
      <>
        <strong>The booking becomes the whole job.</strong> The same project carries the proposal, deposit, shoot,
        edit, video review, payment, delivery, and listing marketing, with nothing re-entered.
      </>,
      <>
        <strong>Also compared:</strong> real estate ordering platforms (Aryeo, HDPhotoHub, Spiro, Tonomo) and generic
        schedulers (Acuity, Calendly, Square Appointments, Setmore), with prices from official pages.
      </>,
      <>Whatever you pick, deposits and a calendar that shows conflicts prevent most scheduling pain.</>,
    ],
  },
  intro: (ctx) => (
    <>
      <p>
        Ask a real estate photographer what eats their day and the answer is rarely the shooting. It&apos;s the six
        messages it takes to confirm one appointment: which package, which add-ons, is the home occupied, where&apos;s
        the lockbox, can we move it to Thursday, can the drone go up if it&apos;s windy. Each of those is small. Across
        twenty listings a week, they become a part-time job.
      </p>
      <p>
        <strong>Real estate photography booking software</strong> is meant to absorb that. But the market splits into
        three very different approaches: general-purpose appointment schedulers, real estate ordering platforms with
        self-booking storefronts, and request-and-estimate workflows where you confirm the price and propose the time.
      </p>
      <p>
        ShootPortal, our product, takes the third approach and starts it earlier: on your own business website. An
        agent clicks Book a Shoot, picks services from your catalog, and sees a preliminary estimate immediately. You
        send the official proposal, propose a time that fits your day, and the agent approves both from one branded
        portal{ctx.trialDays > 0 ? <>. You can try it free for {ctx.trialDays} days</> : null}.
      </p>
      <p>
        This guide is about the front half of the job, from the first request to a confirmed shoot on your calendar.
        For what happens after the shoot, see our{" "}
        <BlogLink slug="best-real-estate-photography-delivery-software">delivery software comparison</BlogLink>. Prices
        below were checked on official vendor pages on October 15, 2026.
      </p>
    </>
  ),
  sections: [
    {
      id: "scheduling-problems",
      title: "The scheduling problems booking software should solve",
      tocLabel: "Common scheduling problems",
      body: () => (
        <>
          <p>
            It helps to name the actual problems before comparing tools, because different software solves different
            ones.
          </p>
          <h3>The back-and-forth</h3>
          <p>
            &quot;Are you free Tuesday?&quot; &quot;Morning or afternoon?&quot; &quot;Can you do 10:30?&quot; Every
            round trip delays the listing and lives in a text thread nobody else can see. Software should collect the
            property, package, and preferred timing in one structured request.
          </p>
          <h3>Reschedules and cancellations</h3>
          <p>
            Sellers aren&apos;t ready, stagers run late, and listing dates slip. A reschedule should update one record,
            not three apps, and ideally a deposit or cancellation policy should discourage last-minute moves.
          </p>
          <h3>Occupied homes, lockboxes, and access notes</h3>
          <p>
            Gate codes, lockbox locations, pets, and &quot;seller works from home until noon&quot; are critical on the
            day and easy to lose. Booking forms need a notes field that travels with the job.
          </p>
          <h3>Weather for aerials and twilights</h3>
          <p>
            Drone shoots depend on wind, rain, and sometimes airspace authorization. Twilights depend on sunset. Instant
            self-booking can promise a slot that the weather later cancels, so aerial-heavy businesses often prefer to
            confirm times themselves.
          </p>
          <h3>Leads that never reach a booking form</h3>
          <p>
            Many agents find you through your website. If the site is a separate builder with a contact form, every
            inquiry becomes an email you retype into your booking tool, and the agent waits hours to learn the price.
          </p>
          <h3>Drive time between shoots</h3>
          <p>
            Two listings 40 minutes apart can&apos;t be booked back to back. Dedicated platforms handle this with drive-
            time calculation or travel buffers; generic schedulers generally don&apos;t know where the appointment is.
          </p>
        </>
      ),
    },
    {
      id: "what-to-look-for",
      title: "What good booking software handles",
      tocLabel: "What to look for",
      body: () => (
        <>
          <h3>Client booking and service selection</h3>
          <p>
            Agents should pick from your real catalog: packages, add-ons like drone, twilight, video, or floor plans,
            and the property address. Platforms built for real estate media use storefront-style carts with upsells.
            Generic schedulers offer appointment types, which work for &quot;45-minute photo shoot&quot; but struggle with
            &quot;photos plus drone plus floor plan for a 3,800 sq ft home.&quot;
          </p>
          <h3>Pricing and estimates</h3>
          <p>
            Fixed packages can show a price at checkout. Custom jobs, such as commercial properties, land, or multi-day
            aerial work, need an estimate first. Travel fees are the most common gap: look for fees based on distance,
            service area, or zones.
          </p>
          <h3>Appointment coordination</h3>
          <p>
            Some systems let clients pick an open slot. Others let you propose a time and the client confirms. Either
            way, the confirmation should be one tap for the client and land on your calendar automatically.
          </p>
          <h3>Calendar management</h3>
          <p>
            Most photographers live in Google Calendar. Check whether booked shoots appear there, whether your personal
            events block availability, and whether the sync is one-way or two-way.
          </p>
          <h3>Deposits and payment timing</h3>
          <p>
            A deposit at booking cuts no-shows and last-minute cancellations. Check whether deposits can be a percentage
            or flat amount, which processors are supported, and whether the balance is collected later automatically.
            For the payment-on-delivery side, see{" "}
            <BlogLink slug="best-real-estate-photography-software">our full real estate photography software comparison</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "self-booking-vs-request",
      title: "Self-booking vs. request and propose: which model fits?",
      tocLabel: "Self-booking vs. request",
      body: () => (
        <>
          <p>This is the most important choice in this guide, and it isn&apos;t about features.</p>
          <p>
            <strong>Self-booking</strong> lets an agent choose a package and an open slot and get an instant
            confirmation. High-volume agents love it, and it removes you from the loop entirely. It works best when your
            packages are standard, prices are fixed, and nothing about the weather or site will change the plan.
          </p>
          <p>
            <strong>Request and propose</strong> means the client submits what they need and when they&apos;d like it,
            sees the price, and you propose a time the client approves or counters. You never get boxed into a slot
            that doesn&apos;t work: a windy afternoon for an aerial, a twilight booked at noon, or a shoot 90 minutes
            from your last one. You plan your own route, cluster shoots by area, and protect your drive time.
          </p>
          <Callout tone="tip" title="Speed comes from the estimate, not the slot">
            <p>
              What agents really want at midnight is to know the job is in and what it costs. With an instant estimate
              on submit, the agent gets that answer right away, and you still decide when and where your day goes.
            </p>
          </Callout>
          <ProductCallout title="Request and propose, without the back-and-forth">
            <p>
              In ShootPortal, the agent&apos;s request creates the client and the project, and they see a preliminary
              estimate built from your catalog and ZIP-distance travel fees as soon as they submit. You propose a time
              with your Google events visible for conflicts; they tap Approve Time or request a different one, and the
              shoot pushes to your Google Calendar.
            </p>
          </ProductCallout>
        </>
      ),
    },
    {
      id: "comparison-table",
      title: "Real estate photography booking software comparison",
      tocLabel: "Comparison table",
      body: (ctx) => (
        <>
          <p>
            The three groups side by side. &quot;Not stated&quot; means we couldn&apos;t confirm it on the vendor&apos;s
            official site.
          </p>
          <ComparisonTable
            caption="Real estate photography booking and scheduling software comparison, October 2026"
            columns={[
              "Tool",
              "Type",
              "Client picks a slot",
              "Packages / add-ons",
              "Travel fees",
              "Price before the shoot",
              "Deposits",
              "Booking carries into delivery",
              "Starting price",
            ]}
            rows={[
              ["ShootPortal", "Website + request + estimate", "You propose; client approves in one tap", <Yes key="b">Service catalog</Yes>, <Yes key="c">ZIP-to-ZIP distance</Yes>, <Yes key="c1">Instant estimate + official proposal</Yes>, <Yes key="d">% or flat</Yes>, <Yes key="d1">Same project: review, pay, download, marketing</Yes>, ctx.studioMonthly ? `${ctx.studioMonthly}/mo, every feature` : <SiteLink key="e" href="/pricing">See pricing</SiteLink>],
              ["Aryeo", "RE ordering", <Yes key="f" />, <Yes key="g" />, <Yes key="h">%, flat, or metered</Yes>, "Price at checkout", <Yes key="i" />, <Yes key="i1">Delivery platform</Yes>, "Free Lite; Pro $49/mo"],
              ["HDPhotoHub", "RE ordering", <Yes key="j">Smart Scheduling</Yes>, <Yes key="k">Cart + add-ons</Yes>, "Not stated", "Price at checkout", <Yes key="l" />, <Yes key="l1">Pay to Download</Yes>, "$5–$10 per delivery"],
              ["Spiro", "RE ordering", <Yes key="m">Automated scheduling</Yes>, <Yes key="n" />, <Yes key="o">Optional trip fees</Yes>, "Price at checkout", "Not stated", <Yes key="o1">Delivery included</Yes>, "$5 per job"],
              ["Tonomo", "RE ordering", <Yes key="p" />, <Yes key="q">Plus sq-ft pricing rules</Yes>, <Yes key="r">Calculated</Yes>, "Price at checkout", <Yes key="s">Partial upfront</Yes>, <Yes key="s1">Pay-to-unlock delivery</Yes>, "$140/mo"],
              ["Acuity Scheduling", "Generic scheduler", <Yes key="t" />, <Yes key="u">Packages on Standard+</Yes>, "Not stated", "Not stated", "Not stated", <No key="u1" />, "$16/mo (annual)"],
              ["Calendly", "Generic scheduler", <Yes key="v" />, <No key="w">Meeting types</No>, <No key="x" />, "Not stated", "Not stated", <No key="x1" />, "Free; $10/seat/mo"],
              ["Square Appointments", "Generic scheduler", <Yes key="y" />, "Not stated", "Not stated", "Not stated", <Yes key="z">Partial deposits</Yes>, <No key="z1" />, "Free tier; paid not verified"],
              ["Setmore", "Generic scheduler", <Yes key="aa" />, "Not stated", "Not stated", "Not stated", <Yes key="ab">Pro</Yes>, <No key="ab1" />, "Free; Pro from $5/user/mo"],
            ]}
            note={
              <>
                From official pricing and product pages, October 15, 2026. &quot;Price at checkout&quot; means the
                agent sees a package price while ordering rather than receiving a custom estimate; that&apos;s an
                advantage for standard listings and a limitation for custom jobs. Square Appointments&apos; paid prices could
                not be verified; see{" "}
                <Ext href="https://squareup.com/us/en/appointments/pricing">Square&apos;s pricing page</Ext>.
              </>
            }
          />
        </>
      ),
    },
    {
      id: "tools",
      title: "Booking tools reviewed",
      tocLabel: "Tools reviewed",
      body: (ctx) => (
        <>
          <h3>Our pick: website-to-delivery booking</h3>
          <ToolCard
            id="booking-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="Booking that starts on your own website and carries one project through to payment, delivery, and listing marketing"
            pricing={
              ctx.studioMonthly ? (
                <>
                  Studio plan: {ctx.studioMonthly}/month
                  {ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}. Stripe&apos;s standard
                  processing fees apply. {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Real estate photographers, drone pilots, and videographers, solo or with a small team, who want bookings, pricing, and the rest of the job in one system."
            pros={[
              "Business website builder with a Book a Shoot form: services, brokerage, preferred date, and notes, with no account needed",
              "Instant preliminary estimate on submit, with travel fees from ZIP distance (tiers or free radius plus per-mile)",
              "Official proposals with line items, versions, PDF, expiry, reminders, and one-click Approve Proposal",
              "You propose the time with your Google events visible; the client taps Approve Time, and the shoot pushes to Google Calendar",
              "Deposits on approval (percentage or fixed) into your own Stripe; ShootPortal takes 0%",
              "The same project then handles editing, video review, payment, Print or MLS downloads, and the Marketing Kit",
            ]}
            cons={[
              "Times are proposed by you rather than picked from open slots, which keeps your route and drive time in your hands",
              "Calendar sync is one-way to Google, with your Google events shown read-only for conflict checks",
            ]}
          />

          <h3>Generic appointment schedulers</h3>
          <p>
            These are inexpensive and polished, and agents already know them. They were built for haircuts, meetings,
            and consultations, so they think in time slots rather than properties.
          </p>
          <ToolCard
            id="booking-acuity"
            name="Acuity Scheduling"
            url="https://acuityscheduling.com/signup.php"
            tagline="Flexible appointment scheduler with payments and intake forms"
            pricing={
              <>
                Starter $16/mo, Standard $27/mo, Premium $55/mo billed annually ($20 / $34 / $69 monthly); 7-day trial,
                no card. <Ext href="https://acuityscheduling.com/signup.php">Official pricing</Ext>
              </>
            }
            bestFor="Solo photographers with a few fixed packages who want a cheap self-booking page."
            pros={["Stripe, Square, PayPal, and Venmo payments", "Intake forms for access notes", "Packages and SMS from Standard"]}
            cons={["No property-aware travel fees or service areas confirmed", "Hiding Acuity branding needs Premium"]}
          />
          <ToolCard
            id="booking-calendly"
            name="Calendly"
            url="https://calendly.com/pricing"
            tagline="Meeting scheduler that agents already recognize"
            pricing={
              <>
                Free (1 event type); Standard $10/seat/mo; Teams $16/seat/mo; Enterprise from $15k/yr.{" "}
                <Ext href="https://calendly.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Consult calls or pre-shoot walkthroughs, rather than ordering shoots."
            pros={["Stripe and PayPal from Standard", "Round robin and routing on Teams"]}
            cons={["Built for meetings: no service menu or address-based pricing", "Payments need a paid seat"]}
          />
          <ToolCard
            id="booking-square"
            name="Square Appointments"
            url="https://squareup.com/us/en/appointments/pricing"
            tagline="Booking tied to Square payments, with prepayment and deposits"
            pricing={
              <>
                Free, Plus, and Premium tiers; we couldn&apos;t verify current paid prices or processing rates. See{" "}
                <Ext href="https://squareup.com/us/en/appointments/pricing">official pricing</Ext>.
              </>
            }
            bestFor="Photographers already taking payments through Square."
            pros={["Free tier includes a booking site, reminders, and staff calendars", "Prepayment and partial deposits", "No-show and cancellation fees on Plus"]}
            cons={["Designed for in-location services, not property shoots", "Travel fees and add-on packages not confirmed"]}
          />
          <ToolCard
            id="booking-setmore"
            name="Setmore"
            url="https://www.setmore.com/pricing"
            tagline="Low-cost scheduler with a capable free plan"
            pricing={
              <>
                Free for up to 4 users; Pro from $5/user/mo billed annually. The page shows conflicting figures, so
                confirm on the <Ext href="https://www.setmore.com/pricing">official pricing page</Ext>.
              </>
            }
            bestFor="Very small teams on a tight budget."
            pros={["Payments via Square, Stripe, or PayPal on the free plan", "Deposits, SMS, and branding removal on Pro"]}
            cons={["No real estate concepts like listings, packages by square footage, or travel fees"]}
          />

          <h3>Real estate ordering platforms</h3>
          <p>
            These were designed around the agent ordering a listing package. Most combine a branded storefront, self-
            booking, and delivery, and several handle multi-photographer dispatch. For a full look at these platforms
            beyond booking, read our <BlogLink slug="best-aryeo-alternatives">Aryeo alternatives guide</BlogLink>.
          </p>
          <ToolCard
            id="booking-aryeo"
            name="Aryeo"
            url="https://www.aryeo.com/pricing"
            tagline="Ordering, scheduling, and delivery with territories and travel fees"
            pricing={
              <>
                Lite free; Pro $49, $99, or $179/mo by annual listings and team size; Enterprise custom.{" "}
                <Ext href="https://www.aryeo.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Established listing businesses that want a polished, embeddable order form."
            pros={[
              "Embeddable order forms with add-ons and multiple appointments per order",
              "Territories, booking limits, buffers, and travel-time buffers",
              "Upfront payment, deposit, or invoice on delivery",
            ]}
            cons={["Advanced scheduling is on Pro, which caps annual listings", "Demo required for Pro; no trial stated"]}
          />
          <ToolCard
            id="booking-hdphotohub"
            name="HDPhotoHub"
            url="https://hdphotohub.com/learn-paygpricing"
            tagline="Shopping-cart ordering with drive-time-aware Smart Scheduling"
            pricing={
              <>
                $5 per Basic Delivery, $10 per Full Delivery; no subscription.{" "}
                <Ext href="https://hdphotohub.com/learn-paygpricing">Official pricing</Ext>
              </>
            }
            bestFor="Listing businesses that want self-booking with drive time and no monthly fee."
            pros={["Smart Scheduling accounts for drive time, durations, and traffic", "Add-on suggestions in the cart", "Deposits via Stripe or Square; Google Calendar integration"]}
            cons={["Travel fees not described on the site", "Per-delivery cost scales with volume"]}
          />
          <ToolCard
            id="booking-spiro"
            name="Spiro"
            url="https://www.spiro.media"
            tagline="Per-job ordering with photographer assignment and trip fees"
            pricing={
              <>
                $5 per completed job, invoiced monthly; no subscription.{" "}
                <Ext href="https://www.spiro.media">Official site</Ext>
              </>
            }
            bestFor="Teams that bill brokerages or want pay-at-close."
            pros={["Custom order pages with packages and upsells", "Assignment by skill and service area; optional trip fees", "Pay-at-close through Titus"]}
            cons={["Photographer availability calendar details not published", "Pay-at-close carries its own fee"]}
          />
          <ToolCard
            id="booking-tonomo"
            name="Tonomo"
            url="https://www.tonomo.io/pricing"
            tagline="Automated booking and dispatch for multi-photographer teams"
            pricing={
              <>
                $140/mo (200 listings/yr, 1 photographer) or $250/mo (425 listings, unlimited photographers).{" "}
                <Ext href="https://www.tonomo.io/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Teams of three or more where dispatch is the bottleneck."
            pros={["Auto-assignment, drive-time, and travel-fee calculation", "Pricing rules by square footage and VIP pricing", "Google Calendar two-way sync"]}
            cons={["Highest entry price here", "No free trial, demo only"]}
          />
        </>
      ),
    },
    {
      id: "shootportal-booking",
      title: "How booking works in ShootPortal's real estate photography booking software",
      tocLabel: "ShootPortal booking flow",
      body: (ctx) => (
        <>
          <p>
            ShootPortal was built by a drone business owner, and its booking flow reflects that: most jobs need a price
            confirmation and a weather-aware time before anyone commits. Here&apos;s the path from first contact to a
            confirmed shoot.
          </p>
          <Figure caption="Conceptual diagram: ShootPortal's request, estimate, and proposed-time booking flow.">
            <BookingFlowDiagram />
          </Figure>
          <Figure caption="Real ShootPortal screens: your business website with its Book a Shoot button (left), and the branded request form on an agent's phone (right). No app and no account needed to book.">
            <TwoSidedScreens business="business-website" client="phone-request-form" businessLabel="What the public sees" clientLabel="What your client sees" />
          </Figure>
          <ol>
            <li>
              <strong>Book a Shoot on your website.</strong> The agent lands on your ShootPortal business website (on
              your own domain or yourstudio.shootportal.app) and clicks Book a Shoot. The branded form asks for name,
              email, phone, brokerage, services from your catalog, preferred date, and notes (lockbox, occupancy, gate
              codes). No account needed: submitting it creates their client account and the project.
            </li>
            <li>
              <strong>Instant estimate.</strong> The moment they submit, the agent sees a preliminary estimate built from
              your catalog prices plus a travel fee based on ZIP-code distance, using mileage tiers or a free radius plus
              a per-mile rate.
            </li>
            <li>
              <strong>Official proposal.</strong> You adjust line items and send it. The agent clicks Approve Proposal
              or requests changes in the portal, and can download a PDF. Proposals are versioned, can expire, and send
              reminders on their own.
            </li>
            <li>
              <strong>Proposed time.</strong> You propose a shoot time that fits your route; the agent taps Approve Time
              or requests a different one. Your own Google Calendar events appear read-only on the ShootPortal calendar,
              so you can spot conflicts before proposing.
            </li>
            <li>
              <strong>Deposit and calendar.</strong> Optionally collect a deposit on approval. Confirmed shoots push to
              the Google calendar you choose.
            </li>
          </ol>
          <h3>What a weather reschedule looks like</h3>
          <p>
            Say an agent requests photos plus aerials for Thursday. You approve the estimate, the deposit is paid, and
            you propose Thursday at 10 a.m. On Wednesday night the forecast shows sustained wind. Instead of a text
            thread, you propose Friday morning from the same project; the agent accepts or counters with a time that
            suits the seller, and the confirmed time pushes to your Google Calendar. The estimate, deposit, access
            notes, and every message stay on the one record, so nothing has to be re-entered.
          </p>
          <Figure caption="Real ShootPortal client screen: the instant preliminary estimate an agent sees right after requesting a shoot, built from your prices and travel fees.">
            <AppScreen view="portal-estimate" />
          </Figure>
          <Figure caption="Real ShootPortal client screen: a proposed shoot time with Approve Time and Request a Different Time. One tap confirms it, and the shoot lands on your Google Calendar.">
            <AppScreen view="portal-shoot-time" />
          </Figure>
          <Figure caption="Real ShootPortal screen, the calendar: a month view with a confirmed shoot (sample client data).">
            <ProductPreview view="calendar" />
          </Figure>
          <p>
            What&apos;s automated: the client account and project, the instant estimate, the travel fee, the branded
            emails, the deposit on approval, and reminders at 24 hours, 3 days, or 7 days for pending proposals and
            scheduling. What stays yours: choosing the time, and when to move it.
          </p>
          <h3>Why proposed times work better for location shoots</h3>
          <p>
            Proposing times means you only commit to slots you can actually deliver. You can group Tuesday&apos;s
            listings on the north side of town, put the twilight at sunset, and hold the aerial for the calm morning.
            Agents get the price instantly and a confirmed time with one tap, and you never wake up to a calendar
            someone else filled with back-to-back shoots 40 minutes apart.
          </p>
          <InlineCta
            trialDays={ctx.trialDays}
            title="Let your website take the booking"
            body="Publish your ShootPortal website, turn on Book a Shoot with your services and travel fees, and send one test request. You'll see the instant estimate, the proposal, and the one-tap time approval from your client's side."
          />
        </>
      ),
    },
    {
      id: "request-and-propose-fit",
      title: "Who ShootPortal's booking is built for",
      tocLabel: "Who it's built for",
      body: (ctx) => (
        <>
          <p>
            ShootPortal is built for real estate photographers, drone pilots, and videographers who want the booking to
            keep going after the calendar entry: into the shoot, the edit, the video review, the payment, the delivery,
            and the listing&apos;s marketing. Agents get a fast, simple way to book from your website and see the price
            right away; you get a calendar you actually planned.
          </p>
          <BestFitPanel
            heading="When ShootPortal is the right booking fit"
            fits={[
              {
                who: "Listing shooters who also fly drones",
                why: "Aerials depend on wind and rain. Proposing the time, and re-proposing it when the forecast turns, means you never commit to a slot the weather will cancel.",
              },
              {
                who: "Commercial, land, and custom jobs",
                why: "Scope and distance change the price. A preliminary estimate with a ZIP-based travel fee, then a versioned official estimate, comes before anyone picks a date.",
              },
              {
                who: "Solo operators who want one record",
                why: "The request becomes the project: address, notes, estimate, deposit, shoot time, files, and final payment all live on it.",
              },
              {
                who: "Businesses losing money to cancellations",
                why: "Request a deposit when the proposal is approved, as a percentage or flat amount, paid into your own Stripe account.",
              },
              {
                who: "Photographers who want more per listing",
                why: "After delivery, offer the agent a property website and social media kit from the same project, included free or sold as a paid add-on.",
              },
              {
                who: "Businesses tired of a separate website",
                why: "Your business website, portfolio, services, and Book a Shoot form live in the same platform as the bookings they create.",
              },
            ]}
          />
          <p>
            Want to see request-based booking in action, from the request form to an accepted shoot time? Our{" "}
            <SiteLink href="/photography-booking-software">photography booking software</SiteLink> page walks through each step.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Run your next booking through it"
            body="Add your services and travel-fee rule, publish your website's Book a Shoot form, connect Stripe for deposits, then send one real proposal and propose the shoot time. See whether one record beats the text thread."
          />
        </>
      ),
    },
    {
      id: "integrate-with-projects",
      title: "Why bookings should live with the rest of the project",
      tocLabel: "Booking + project management",
      body: () => (
        <>
          <p>
            A standalone scheduler gets the appointment on the calendar, then hands you a disconnected record. The
            estimate is in one app, the access notes in an email, the deposit in Stripe, and the shoot in Google
            Calendar. When the listing date slips, you update all four.
          </p>
          <p>Connecting booking to project management pays off in a few specific ways:</p>
          <ul>
            <li>
              <strong>The request becomes the job.</strong> Address, package, notes, and preferred date carry straight
              through to the shoot day and delivery.
            </li>
            <li>
              <strong>The deposit is already applied.</strong> When you request the balance, the system knows what was
              paid.
            </li>
            <li>
              <strong>Status is visible.</strong> You can see which requests are waiting on an estimate, which estimates
              are approved but unscheduled, and which shoots are confirmed.
            </li>
            <li>
              <strong>Client history accumulates.</strong> Repeat agents and addresses build a record you can reference,
              which also matters if you&apos;re choosing a{" "}
              <BlogLink slug="best-photography-crm-software">photography CRM</BlogLink>.
            </li>
          </ul>
          <p>
            Generic schedulers don&apos;t connect booking to anything after it, which is usually why photographers move
            off them. In ShootPortal, the booking is the first few stages of a project that runs all the way from your
            website to the listing&apos;s marketing:
          </p>
          <Figure caption="ShootPortal's verified features at each stage of a job.">
            <WorkflowCoverageMap highlight={["request", "estimate", "schedule", "pay"]} />
          </Figure>
          <p>
            That includes the parts most booking tools hand off: fixing a photo in the built-in editor, collecting
            time-stamped feedback on the listing video (no Dropbox Replay or Frame.io needed), and offering the agent a
            property website and Just Listed posts once the photos are delivered.
          </p>
          <AllInOnePlatform intro="Booking is where the job starts. One subscription covers the website that brings the agent in and every step until the listing is marketed." />
          <p>
            Booking is usually the first thing people automate. Our guide to{" "}
            <BlogLink slug="real-estate-photography-automation">automating a real estate photography business</BlogLink>{" "}
            covers payments and delivery too.
          </p>
        </>
      ),
    },
    {
      id: "how-to-choose",
      title: "Which booking software should you choose?",
      tocLabel: "Recommendations",
      body: () => (
        <>
          <PickGrid
            items={[
              {
                who: "Real estate, drone, and video businesses",
                pick: "ShootPortal",
                why: "Website booking with an instant estimate and travel fees, proposed times you control, deposits, and the same project through delivery and listing marketing.",
              },
              {
                who: "Brand new, a few fixed packages",
                pick: "ShootPortal",
                why: "Start your service catalog from a template, publish your website with Book a Shoot, and take deposits from your first job.",
              },
              {
                who: "Discovery calls before big jobs",
                pick: "Calendly",
                why: "Great for meetings, alongside whatever handles the actual shoot booking.",
              },
            ]}
          />
          <KeyTakeaways
            items={[
              "Decide self-booking vs. request-and-propose first; proposing times keeps your route, the weather, and your drive time under your control.",
              "Start the booking on your own website, with an instant estimate, so leads don't wait for a reply to learn the price.",
              "Generic schedulers are cheap but don't understand properties, add-ons, or travel fees.",
              "Collect access notes in the booking form so they travel with the job.",
              "Deposits at booking prevent more headaches than reminder emails.",
              <>
                Head-to-head on the leading platforms:{" "}
                <BlogLink slug="shootportal-vs-aryeo-vs-hdphotohub">ShootPortal vs. Aryeo vs. HDPhotoHub</BlogLink>.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "bottom-line",
      title: "The bottom line",
      body: () => (
        <>
          <p>
            The best real estate photography booking software doesn&apos;t stop at the calendar. Generic schedulers book
            a time slot and nothing else. Ordering platforms add a storefront. ShootPortal starts with your own business
            website, gives agents an instant price, lets you set a schedule you can actually keep, and then runs the
            same job through editing, video review, payment, delivery, and listing marketing.
          </p>
          <p>
            For real estate photographers, drone pilots, and videographers, that&apos;s the setup we recommend.{" "}
            <SiteLink href="/how-it-works">See ShootPortal&apos;s booking flow</SiteLink> and run your next request
            through it.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best booking software for real estate photographers?",
      answerText:
        "For most solo real estate photographers and small teams, ShootPortal: booking starts on your own business website with an instant estimate and travel fees, you propose times that fit your route, and the same project runs through payment, delivery, and listing marketing. HDPhotoHub, Aryeo, Spiro, and Tonomo are self-booking ordering platforms, and generic tools like Acuity work for very simple setups.",
      answer: (
        <p>
          For most solo real estate photographers and small teams, ShootPortal: booking starts on your own business
          website with an instant estimate and travel fees, you propose times that fit your route, and the same project
          runs through payment, delivery, and listing marketing. HDPhotoHub, Aryeo, Spiro, and Tonomo are self-booking
          ordering platforms, and generic tools like Acuity work for very simple setups.
        </p>
      ),
    },
    {
      question: "Can I use Calendly or Acuity for real estate photography?",
      answerText:
        "Yes, for simple setups. They take payments and collect intake details, but they don't understand property addresses, square-footage pricing, travel fees, or listing delivery, so most growing businesses move to a dedicated platform.",
      answer: (
        <p>
          Yes, for simple setups. They take payments and collect intake details, but they don&apos;t understand property
          addresses, square-footage pricing, travel fees, or listing delivery, so most growing businesses move to a
          dedicated platform.
        </p>
      ),
    },
    {
      question: "How should real estate photographers charge travel fees?",
      answerText:
        "Common approaches are a free radius plus a per-mile rate, mileage tiers, flat zone fees, or a percentage. Aryeo, Spiro, Tonomo, and ShootPortal can add travel fees during booking or estimating.",
      answer: (
        <p>
          Common approaches are a free radius plus a per-mile rate, mileage tiers, flat zone fees, or a percentage.
          Aryeo, Spiro, Tonomo, and ShootPortal can add travel fees during booking or estimating.
        </p>
      ),
    },
    {
      question: "Should I require a deposit when agents book?",
      answerText:
        "For new clients and large or custom jobs, a deposit reduces cancellations and no-shows. Many photographers waive it for trusted repeat agents. Aryeo, HDPhotoHub, Tonomo, Square Appointments, Setmore Pro, and ShootPortal support deposits.",
      answer: (
        <p>
          For new clients and large or custom jobs, a deposit reduces cancellations and no-shows. Many photographers
          waive it for trusted repeat agents. Aryeo, HDPhotoHub, Tonomo, Square Appointments, Setmore Pro, and
          ShootPortal support deposits.
        </p>
      ),
    },
    {
      question: "How do clients schedule a shoot in ShootPortal?",
      answerText:
        "Clients submit a Book a Shoot request with a preferred date and see an instant estimate. You then propose a shoot time that fits your route and the weather, and they approve it in one tap or request a different time. Confirmed shoots push to your Google Calendar, and your Google events display read-only in ShootPortal so you can see conflicts.",
      answer: (
        <p>
          Clients submit a Book a Shoot request with a preferred date and see an instant estimate. You then propose a
          shoot time that fits your route and the weather, and they approve it in one tap or request a different time.
          Confirmed shoots push to your Google Calendar, and your Google events display read-only in ShootPortal so you
          can see conflicts.
        </p>
      ),
    },
    {
      question: "Can agents book a real estate photography shoot from my website?",
      answerText:
        "Yes, with ShootPortal. Its business website builder includes a Book a Shoot form where agents pick services from your catalog, add the date and notes, and submit without creating an account. The request creates the client and project automatically and shows the agent a preliminary estimate with travel fees right away.",
      answer: (
        <p>
          Yes, with ShootPortal. Its business website builder includes a Book a Shoot form where agents pick services
          from your catalog, add the date and notes, and submit without creating an account. The request creates the
          client and project automatically and shows the agent a preliminary estimate with travel fees right away.
        </p>
      ),
    },
  ],
  related: ["best-real-estate-photography-software", "best-real-estate-photography-delivery-software", "best-photography-crm-software"],
  cta: {
    title: "Book from your website. Schedule on your terms.",
    body: "A Book a Shoot form on your own website, instant estimates with travel fees, proposed times agents approve in one tap, deposits to your own Stripe, and one project that runs through delivery and listing marketing.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
