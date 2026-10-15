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

export const article: BlogArticle = {
  slug: "best-real-estate-photography-booking-software",
  title: "Best Real Estate Photography Booking and Scheduling Software in 2026",
  seoTitle: "Real Estate Photography Booking Software (2026)",
  description:
    "Generic schedulers vs. real estate ordering platforms vs. request-and-estimate workflows: compare booking, add-ons, travel fees, deposits, and calendar sync.",
  excerpt:
    "Acuity, Calendly, Square Appointments, Setmore, Aryeo, HDPhotoHub, Spiro, Tonomo and ShootPortal, compared on how agents book, how you price, and how shoots land on your calendar.",
  category: "business-automation",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "real estate photography booking software",
  secondaryKeywords: [
    "real estate photography scheduling software",
    "real estate photography ordering system",
    "photography booking deposits",
    "real estate photographer travel fees",
  ],
  readingMinutes: 12,
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
        <strong>Agents order standard packages and want an instant time slot?</strong> A real estate ordering platform:
        Aryeo, HDPhotoHub, Spiro, or Tonomo.
      </>,
      <>
        <strong>Several photographers to dispatch?</strong> Tonomo and Spiro assign by skill and service area; Tonomo
        and HDPhotoHub calculate drive time.
      </>,
      <>
        <strong>Just need a booking page on a budget?</strong> Calendly, Acuity, Setmore, or Square Appointments work,
        but don&apos;t understand property addresses, packages, or travel fees.
      </>,
      <>
        <strong>Custom quotes, aerials, and weather-dependent shoots?</strong> ShootPortal (our product) uses a request,
        estimate, and proposed-time flow instead of self-booking, with ZIP-based travel fees and deposits.
      </>,
      <>Whatever you pick, deposits and a calendar that shows conflicts prevent most scheduling pain.</>,
    ],
  },
  intro: () => (
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
        Each fits a different kind of business.
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
            Some systems let clients pick an open slot. Others let you propose a time and the client confirms. Teams
            also need assignment rules so the right photographer gets the job.
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
            you confirm the price (often with an estimate), and you propose a time the client accepts or counters. It
            adds a step, but you never get boxed into a slot that doesn&apos;t work: a windy afternoon for an aerial, a
            twilight booked at noon, or a shoot 90 minutes from your last one.
          </p>
          <Callout tone="tip" title="Many businesses need both">
            <p>
              Listing-only businesses with fixed packages tend to prefer self-booking. Businesses that mix listings with
              commercial, construction, or inspection work usually want to review requests first. Choose based on where
              most of your revenue comes from.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "comparison-table",
      title: "Real estate photography booking software comparison",
      tocLabel: "Comparison table",
      body: () => (
        <>
          <p>
            The three groups side by side. &quot;Not stated&quot; means we couldn&apos;t confirm it on the vendor&apos;s
            official site.
          </p>
          <ComparisonTable
            caption="Real estate photography booking and scheduling software comparison, October 2026"
            columns={["Tool", "Type", "Client picks a slot", "Packages / add-ons", "Travel fees", "Deposits", "Starting price"]}
            rows={[
              ["ShootPortal", "Request + estimate", <No key="a">You propose; client accepts or counters</No>, <Yes key="b">Service catalog</Yes>, <Yes key="c">ZIP-to-ZIP distance</Yes>, <Yes key="d">% or flat</Yes>, <SiteLink key="e" href="/pricing">See pricing</SiteLink>],
              ["Aryeo", "RE ordering", <Yes key="f" />, <Yes key="g" />, <Yes key="h">%, flat, or metered</Yes>, <Yes key="i" />, "Free Lite; Pro $49/mo"],
              ["HDPhotoHub", "RE ordering", <Yes key="j">Smart Scheduling</Yes>, <Yes key="k">Cart + add-ons</Yes>, "Not stated", <Yes key="l" />, "$5–$10 per delivery"],
              ["Spiro", "RE ordering", <Yes key="m">Automated scheduling</Yes>, <Yes key="n" />, <Yes key="o">Optional trip fees</Yes>, "Not stated", "$5 per job"],
              ["Tonomo", "RE ordering", <Yes key="p" />, <Yes key="q">Plus sq-ft pricing rules</Yes>, <Yes key="r">Calculated</Yes>, <Yes key="s">Partial upfront</Yes>, "$140/mo"],
              ["Acuity Scheduling", "Generic scheduler", <Yes key="t" />, <Yes key="u">Packages on Standard+</Yes>, "Not stated", "Not stated", "$16/mo (annual)"],
              ["Calendly", "Generic scheduler", <Yes key="v" />, <No key="w">Meeting types</No>, <No key="x" />, "Not stated", "Free; $10/seat/mo"],
              ["Square Appointments", "Generic scheduler", <Yes key="y" />, "Not stated", "Not stated", <Yes key="z">Partial deposits</Yes>, "Free tier; paid not verified"],
              ["Setmore", "Generic scheduler", <Yes key="aa" />, "Not stated", "Not stated", <Yes key="ab">Pro</Yes>, "Free; Pro from $5/user/mo"],
            ]}
            note={
              <>
                From official pricing and product pages, October 15, 2026. Square Appointments&apos; paid prices could
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

          <h3>Request-and-estimate workflow</h3>
          <ToolCard
            id="booking-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="Requests, estimates, proposed shoot times, and deposits in one client portal"
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
            bestFor="Solo operators and small teams whose jobs vary in scope, including aerial and commercial work."
            pros={[
              "Request form with your service catalog, property address, preferred date, and notes",
              "Automatic preliminary estimates with travel fees from ZIP-to-ZIP distance",
              "Client accepts, declines, or counter-proposes the time you suggest",
              "Deposits on approval, as a percentage or flat amount, into your own Stripe account",
            ]}
            cons={[
              "Clients can't instantly book an open slot themselves",
              "No auto-assignment or drive-time routing for teams",
              "Google Calendar shows your events read-only; it isn't full two-way sync",
              "No SMS reminders",
            ]}
          />
          <InlineCta
            title="Stop confirming shoots by text"
            body="Put your service catalog on a branded request form, send estimates with travel fees built in, and propose shoot times clients can accept in one tap."
            trialDays={ctx.trialDays}
          />
        </>
      ),
    },
    {
      id: "shootportal-booking",
      title: "How booking works in ShootPortal",
      tocLabel: "ShootPortal booking flow",
      body: () => (
        <>
          <p>
            ShootPortal was built by a drone business owner, and its booking flow reflects that: most jobs need a price
            confirmation and a weather-aware time before anyone commits. Here&apos;s the path from first contact to a
            confirmed shoot.
          </p>
          <Figure caption="Conceptual diagram: ShootPortal's request, estimate, and proposed-time booking flow.">
            <BookingFlowDiagram />
          </Figure>
          <ol>
            <li>
              <strong>Request.</strong> From your branded portal, the client enters contact details and the property
              address, picks a service from your catalog, adds a preferred date and notes (lockbox, occupancy, gate
              codes), and creates an account. If you&apos;d rather not show automatic pricing, the form can work as a
              simple inquiry.
            </li>
            <li>
              <strong>Preliminary estimate.</strong> ShootPortal can generate one automatically, adding a travel fee
              based on straight-line distance between ZIP codes, using mileage tiers or a free radius plus a per-mile
              rate with a cap.
            </li>
            <li>
              <strong>Official estimate.</strong> You adjust line items and send it. The client approves or requests
              changes in the portal, and can download a PDF. Estimates are versioned and can expire.
            </li>
            <li>
              <strong>Proposed time.</strong> You propose a shoot time; the client accepts, declines, or suggests
              another. Your own Google Calendar events appear read-only on the ShootPortal calendar, so you can spot
              conflicts before proposing.
            </li>
            <li>
              <strong>Deposit and calendar.</strong> Optionally collect a deposit on approval. Confirmed shoots push to
              the Google calendar you choose.
            </li>
          </ol>
          <h3>When proposed times are a strength, and when they aren&apos;t</h3>
          <p>
            Proposing times works well for custom jobs, aerials, twilights, and anything weather-dependent, because you
            only commit to slots you can actually deliver. It suits clients who order a few times a month and value a
            confirmed price.
          </p>
          <p>
            It&apos;s a real drawback for high-volume agents who book several listings a week and expect to grab a slot
            at midnight without waiting for you. If that describes most of your client base, a self-booking platform
            like HDPhotoHub, Aryeo, or Tonomo will feel faster to them.
          </p>
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
            Every real estate ordering platform above links booking to delivery to some degree. Generic schedulers
            don&apos;t, which is usually why photographers move off them.
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
                who: "Brand new, a few fixed packages",
                pick: "Acuity or Setmore",
                why: "Cheap self-booking with payments; outgrow it when travel fees and delivery matter.",
              },
              {
                who: "High-volume agents, standard packages",
                pick: "HDPhotoHub or Aryeo",
                why: "Self-booking storefronts with add-ons, and scheduling that accounts for travel.",
              },
              {
                who: "Three or more photographers",
                pick: "Tonomo or Spiro",
                why: "Assignment by skill and service area; Tonomo adds drive-time calculation.",
              },
              {
                who: "Already on Square",
                pick: "Square Appointments",
                why: "Deposits and booking in the same system as your payments.",
              },
              {
                who: "Custom quotes, aerials, mixed work",
                pick: "ShootPortal",
                why: "Request, estimate with travel fees, proposed time, and deposit in one portal.",
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
              "Decide self-booking vs. request-and-propose first; it narrows the field more than any feature.",
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
            The right real estate photography booking software depends on who your clients are and how predictable
            your work is. Fixed packages and high-volume agents point to a self-booking ordering platform. Teams point
            to dispatch tools like Tonomo or Spiro. A tight budget points to Acuity or Setmore for now.
          </p>
          <p>
            If your jobs vary, your aerials depend on the weather, and you&apos;d rather confirm a price and a time than
            discover the details on site, <SiteLink href="/how-it-works">see ShootPortal&apos;s booking flow</SiteLink>{" "}
            and run your next request through it.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best booking software for real estate photographers?",
      answerText:
        "For self-booking with packages and add-ons, HDPhotoHub, Aryeo, Spiro, and Tonomo are built for real estate media. For custom quotes and weather-dependent work, ShootPortal's request-and-estimate flow fits better. Generic tools like Acuity work for very simple setups.",
      answer: (
        <p>
          For self-booking with packages and add-ons, HDPhotoHub, Aryeo, Spiro, and Tonomo are built for real estate
          media. For custom quotes and weather-dependent work, ShootPortal&apos;s request-and-estimate flow fits better.
          Generic tools like Acuity work for very simple setups.
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
      question: "Can clients book a time slot themselves in ShootPortal?",
      answerText:
        "No. Clients submit a request with a preferred date, and you propose a shoot time they can accept, decline, or counter. Confirmed shoots push to your Google Calendar, and your Google events display read-only in ShootPortal.",
      answer: (
        <p>
          No. Clients submit a request with a preferred date, and you propose a shoot time they can accept, decline, or
          counter. Confirmed shoots push to your Google Calendar, and your Google events display read-only in
          ShootPortal so you can see conflicts.
        </p>
      ),
    },
  ],
  related: ["best-real-estate-photography-software", "best-real-estate-photography-delivery-software", "best-photography-crm-software"],
  cta: {
    title: "From request to confirmed shoot, without the text thread.",
    body: "A branded request form with your services, automatic estimates with travel fees, proposed shoot times clients can accept, and deposits through your own Stripe account.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
