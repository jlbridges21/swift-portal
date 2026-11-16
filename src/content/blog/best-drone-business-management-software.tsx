import { FreeResourceCallout } from "@/components/blog/free-resource-callout";
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
import { DeliveryPathDiagram, ToolCategoryMap, WorkflowDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, ProductCallout, TrialCard, WorkflowCoverageMap } from "@/components/blog/conversion-parts";
import { AllInOnePlatform, AppScreen, PhoneScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "best-drone-business-management-software",
  title: "Best Drone Photography Business Management Software in 2026: Complete Comparison",
  seoTitle: "Best Drone Business Management Software in 2026",
  description:
    "Compare drone business management software for quotes, scheduling, video review, payments, and delivery, and see how it works alongside flight-log apps.",
  excerpt:
    "Flight apps keep you legal and mapping tools process your data, but neither sends a quote, collects video feedback, or gets you paid. Here is the software that runs the business side of a drone operation.",
  category: "drone-business",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "drone business management software",
  secondaryKeywords: [
    "drone photography business software",
    "drone business software",
    "software for drone pilots",
    "drone CRM",
    "drone invoicing software",
    "Dropbox Replay alternative",
    "Frame.io alternative for drone video",
    "drone photography website",
  ],
  readingMinutes: 16,
  cover: {
    variant: "drone",
    label: "2026 Comparison",
    alt: "Illustration of a drone above a project dashboard with quotes, calendar, and delivery cards",
  },
  disclosure: true,
  quickAnswer: {
    heading: "If you only read one section",
    points: [
      <>
        <strong>Best drone business management software: ShootPortal</strong> (our product). Your website, custom
        quotes with travel fees, weather reschedules, video review, deposits, and delivery of photos, video, and map
        embeds run on one project, under your brand, at one flat price.
      </>,
      <>
        <strong>It replaces Dropbox Replay or Frame.io.</strong> Clients pin comments to the exact second and spot on
        the frame, you post numbered versions, and the approval sits next to the invoice.
      </>,
      <>
        <strong>Keep your flight app alongside it.</strong> Aloft, AirData, and DroneLogbook handle airspace, logs,
        and compliance; ShootPortal handles the client, the money, and the files.
      </>,
      <>
        <strong>Real estate aerial clients get more, too:</strong> a property website, social posts, and a print flyer
        for every listing, which you can sell to the agent as an add-on.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Nobody gets into drone work because they love chasing invoices. You get into it for the shot: the roofline at
        golden hour, the construction site from 200 feet, the reveal that makes a listing video. Then the business
        shows up. A roofing company wants a quote for a 40-acre progress series. A realtor needs aerials before the
        Friday open house, and the wind forecast says Thursday is a no-go. A developer wants the orthomosaic, the
        flyover video, and the stills, and their project manager asks for a third round of edits after the invoice is
        already overdue. That&apos;s the work drone business management software exists to take off your plate.
      </p>
      <p>
        <strong>Drone business management software</strong> is the layer that handles all of that: clients, quotes,
        scheduling, revisions, payment, and getting very large files to people who aren&apos;t technical. It&apos;s
        a different category from the flight apps on your controller, and a lot of pilots don&apos;t realize that
        until they&apos;ve been paying for the wrong tool for a year.
      </p>
      <p>
        Our pick for that layer is <strong>ShootPortal</strong>, and we&apos;re open about why: ShootPortal&apos;s
        founder runs a Part 107 drone photography business, and the product grew out of running those jobs. It covers
        the client side end to end, from the website a new client finds you on to the paid download, so the client
        only ever needs one branded link and you stop juggling a website builder, a review tool, an invoicing app, and
        a cloud drive.
      </p>
      <p>
        Below we separate the three kinds of drone software, compare the business tools pilots actually use, and
        recommend a setup for a side hustle, a full-time solo operator, and a multi-pilot team. Competitor pricing
        links to each vendor&apos;s official page.
      </p>
    </>
  ),
  sections: [
    {
      id: "business-behind-the-footage",
      title: "The business problems drone pilots actually have",
      tocLabel: "Drone business challenges",
      body: () => (
        <>
          <p>
            Drone work looks like photography from the outside, but the business mechanics are closer to a field
            service company with a post-production department attached. These are the friction points that tend to
            push pilots toward software.
          </p>
          <h3>Almost every job is a custom quote</h3>
          <p>
            A three-photo real estate aerial and a monthly construction progress series aren&apos;t priced the same
            way. Acreage, flight time, deliverable type (stills, edited video, orthomosaic, 3D model), and how far you
            have to drive all move the number. A fixed price list on a website rarely covers it, so you end up writing
            estimates by hand and re-sending them when the scope changes.
          </p>
          <h3>Travel is a real cost</h3>
          <p>
            Drone pilots cover wide service areas. A job 70 miles out eats half a day before the props spin. If your
            quoting process doesn&apos;t add a travel fee consistently, you either forget it or apply it unevenly
            across clients.
          </p>
          <FreeResourceCallout tool="drone-pricing" note="Price a drone photo or video job, travel included, in three steps and download a branded quote." />
          <h3>Weather moves the calendar</h3>
          <p>
            Wind, rain, and low ceilings reschedule drone shoots far more often than they reschedule a headshot
            session. Every reschedule means re-confirming with the client, sometimes with a site contact too, and
            keeping your own calendar honest so a postponed job doesn&apos;t collide with the next one.
          </p>
          <h3>The files are huge, and the clients aren&apos;t technical</h3>
          <p>
            A 4K edit, a folder of RAW stills, and a link to a processed map aren&apos;t things you can attach to an
            email. Pilots often end up stitching together a cloud drive, a video host, and a separate link to the
            mapping platform, then explaining all three to the client.
          </p>
          <h3>Revisions and payment get tangled</h3>
          <p>
            Video clients ask for changes. If feedback arrives as a paragraph in an email (&quot;around the middle,
            the part with the trees&quot;), you burn time decoding it. And if you deliver final files before
            you&apos;re paid, collections become a second job.
          </p>
          <p>
            None of those problems are solved by a flight log or a photogrammetry engine. That&apos;s the first thing
            to get clear before comparing products.
          </p>
        </>
      ),
    },
    {
      id: "three-kinds-of-drone-software",
      title: "Business software vs. flight-ops vs. mapping: three different jobs",
      tocLabel: "Three kinds of drone software",
      body: () => (
        <>
          <p>
            Search for &quot;drone software&quot; and you get a mix of products that solve completely different
            problems. A commercial drone operation usually needs something from more than one category, and the
            categories complement each other rather than compete.
          </p>
          <Figure caption="Conceptual diagram: the three categories of drone software and what each one leaves to the others.">
            <ToolCategoryMap
              columns={[
                {
                  title: "Flight ops & compliance",
                  examples: "e.g. Aloft, AirData, DroneLogbook",
                  covers: ["Airspace & LAANC requests", "Flight logs & telemetry", "Battery & maintenance records", "Checklists & risk assessments"],
                  gaps: ["Quotes & invoices", "Client communication", "Delivering media"],
                },
                {
                  title: "Business management",
                  examples: "e.g. ShootPortal, Dronedesk, Jobber, HoneyBook",
                  covers: ["Website & booking (ShootPortal)", "Client records", "Quotes & estimates", "Scheduling", "Video review (ShootPortal)", "Payments", "Delivery (varies)"],
                  gaps: ["Flight logging (except Dronedesk)", "Data processing"],
                  accent: true,
                },
                {
                  title: "Mapping & processing",
                  examples: "e.g. DroneDeploy, Pix4D",
                  covers: ["Automated mapping flights", "Orthomosaics & 3D models", "Measurements & inspection reports"],
                  gaps: ["Pricing & quoting", "Billing clients", "Non-mapping deliverables"],
                },
              ]}
            />
          </Figure>
          <h3>Flight operations and compliance</h3>
          <p>
            <Ext href="https://help.aloft.ai/en/articles/10058474-aloft-faa-approved-laanc-b4ufly-services">Aloft</Ext>{" "}
            is an FAA-approved LAANC service supplier, and Aloft says its Air Control app is free for individual pilots
            for LAANC authorizations, advisories, weather, checklists, and flight logging.{" "}
            <Ext href="https://airdata.com/pricing">AirData</Ext> focuses on flight logs, battery health, and
            maintenance, with a free plan and paid plans from $2.99/month up to Pro at $14.99/month.{" "}
            <Ext href="https://www.dronelogbook.com">DroneLogbook</Ext> is commonly used for logging and compliance
            records. None of them manage clients or invoices.
          </p>
          <h3>Mapping and processing</h3>
          <p>
            <Ext href="https://www.dronedeploy.com/pricing">DroneDeploy</Ext> (Flight &amp; Analysis listed at
            $4,188/year for individuals) and <Ext href="https://www.pix4d.com/pricing">Pix4D</Ext> (PIX4Dmatic from
            $125/month) turn your captures into orthomosaics, 3D models, and measurements. They&apos;re where the
            deliverable gets made, not where the client relationship lives.
          </p>
          <h3>Business management</h3>
          <p>
            This is the category this guide compares: the tools that hold your client list, send quotes, put shoots
            on a calendar, collect payment, and (in some cases) deliver the finished work. The rest of this article
            is about choosing one of these, assuming you keep using whatever flight and processing tools you already
            trust. The best business tools go further than a CRM: they also give you a website clients can book from,
            collect video feedback, and deliver the files, so the client only ever deals with one link.
          </p>
        </>
      ),
    },
    {
      id: "part-107-records",
      title: "A quick Part 107 reality check for the business side",
      tocLabel: "Part 107 context",
      body: () => (
        <>
          <p>
            Software doesn&apos;t make you compliant, but compliance shapes how you run the business. Per the{" "}
            <Ext href="https://www.faa.gov/uas/commercial_operators/become_a_drone_pilot">FAA</Ext>, anyone flying a
            drone under 55 pounds for work or business operates under Part 107 and needs a Remote Pilot Certificate.
            Getting one means passing the initial knowledge exam, completing FAA Form 8710-13 in IACRA, and clearing a
            TSA security background check. The FAA also requires recurrent online training every 24 calendar months.
          </p>
          <p>
            On the aircraft side, the FAA says Part 107 registration costs $5 and is valid for three years, the
            registration number must be marked on the drone, and drones that require registration must broadcast
            Remote ID (unless flown within a FRIA). For controlled airspace near airports,{" "}
            <Ext href="https://www.faa.gov/uas/getting_started/laanc">LAANC</Ext> provides near-real-time
            authorizations through FAA-approved suppliers, but the FAA is explicit that LAANC covers airspace
            authorizations only. You still check NOTAMs and weather.
          </p>
          <Callout tone="note" title="Where each record belongs">
            <p>
              Keep flight logs, airspace authorizations, and maintenance in your flight-ops app. Keep the client, the
              quote, the shoot date, the files, and the payment in your business software. Mixing the two in one
              spreadsheet is how things go missing at tax time or when a client asks for proof of when a site was
              flown.
            </p>
          </Callout>
          <p>
            This is general information from the FAA&apos;s public pages, not legal advice. Check{" "}
            <Ext href="https://www.faa.gov/uas/commercial_operators">faa.gov</Ext> for current requirements before
            you rely on any of it.
          </p>
        </>
      ),
    },
    {
      id: "what-to-look-for",
      title: "What drone business software needs to handle",
      tocLabel: "Features that matter",
      body: () => (
        <>
          <p>
            Generic &quot;small business software&quot; checklists miss the parts of drone work that hurt the most.
            Weigh these when you compare.
          </p>
          <h3>Quotes that handle custom scope and travel</h3>
          <p>
            Look for line-item estimates you can version when the client changes scope, a PDF they can forward to
            whoever approves spending, and some way to add travel fees without doing math by hand on every job.
          </p>
          <h3>Rescheduling without a phone tag marathon</h3>
          <p>
            Weather means you&apos;ll move shoots. The useful question isn&apos;t &quot;does it have a calendar?&quot;
            but &quot;how many messages does a reschedule take?&quot; A flow where you propose a new time and the
            client confirms or counters in one place saves real time over texting.
          </p>
          <h3>Deposits and payment tied to delivery</h3>
          <p>
            Deposits protect you from cancellations on jobs that block a whole day. Holding downloads until the final
            balance is paid protects you from the long tail of unpaid invoices.
          </p>
          <h3>Delivery built for drone deliverables</h3>
          <p>
            Big video files, stills in two sizes, and links to processed maps or 3D models. If the platform can embed
            your DroneDeploy, Pix4D, or Matterport output next to the video and photos, the client gets one link
            instead of three. Our{" "}
            <BlogLink slug="best-photo-video-delivery-platforms">guide to photo and video delivery platforms</BlogLink>{" "}
            goes deeper on this part.
          </p>
          <Figure caption="Conceptual diagram: a delivery path where review and payment sit between upload and download.">
            <DeliveryPathDiagram />
          </Figure>
          <h3>Structured revision feedback</h3>
          <p>
            For video, time-stamped comments are the difference between one revision round and three. Many pilots pay
            for Dropbox Replay or Frame.io just for this, then still send the invoice and the final files from
            somewhere else. For stills and maps, per-item approve-or-request-changes beats a long email.
          </p>
          <ProductCallout title="Video review on the same project as the invoice">
            <p>
              Clients pin comments to the exact second and spot on the frame, you reply in threads and mark notes
              resolved, and each cut is a numbered version. Approvals, payment, and the final download all happen on
              the same project, with no extra seat to pay for.
            </p>
          </ProductCallout>
          <h3>A website that books the work</h3>
          <p>
            Commercial clients and agents check your website before they call. If the site and the booking form are
            part of your business software, every inquiry lands as a client record and a project with an estimate
            attached, instead of an email you retype.
          </p>
          <Figure caption="A media business website built in ShootPortal, with portfolio, services, and a Book a Shoot button that turns visitors into projects with an instant estimate.">
            <AppScreen view="business-website" />
          </Figure>
          <h3>Room to add pilots</h3>
          <p>
            Even if you&apos;re solo today, check how the tool handles a second pilot or an editor: seat pricing,
            permissions, and whether you can assign someone to a single job without exposing your whole client list.
          </p>
        </>
      ),
    },
    {
      id: "comparison-table",
      title: "Drone business management software comparison table",
      tocLabel: "Comparison table",
      body: () => (
        <>
          <p>
            The table compares the tools drone pilots most often consider for the business side. &quot;Not
            stated&quot; means we couldn&apos;t confirm it on the vendor&apos;s official site, not that it&apos;s
            missing.
          </p>
          <ComparisonTable
            caption="Drone business management software comparison, October 2026"
            columns={[
              "Tool",
              "Type",
              "Entry price (Oct 2026)",
              "Client portal",
              "Media delivery",
              "Distance-based travel fees",
              "Time-stamped video review",
              "Downloads locked until paid",
              "Flight logging",
            ]}
            rows={[
              [
                "ShootPortal",
                "All-in-one: website, workflow, review, delivery",
                "Flat monthly subscription",
                <Yes key="a" />,
                <Yes key="b">Photos, video, 3D/map embeds</Yes>,
                <Yes key="b1">ZIP-to-ZIP rules</Yes>,
                <Yes key="b2">Pinned to the frame</Yes>,
                <Yes key="b3">Optional</Yes>,
                <No key="c" />,
              ],
              ["Dronedesk", "Drone ops + business", "See official pricing", "Not stated", "Not stated", "Not stated", "Not stated", "Not stated", <Yes key="d" />],
              ["HoneyBook", "Creative CRM", "$29/mo billed yearly", <Yes key="e" />, <No key="f">Via Pic-Time integration</No>, "Not stated", <No key="f1" />, <No key="f2">No native delivery</No>, <No key="g" />],
              ["Dubsado", "Creative CRM", "$335/yr", <Yes key="h" />, <No key="i" />, "Not stated", <No key="i1" />, <No key="i2">No native delivery</No>, <No key="j" />],
              ["Studio Ninja", "Photography CRM", "$16/mo", <Yes key="k" />, <No key="l">Via integrations</No>, "Not stated", <No key="l1" />, <No key="l2">No native delivery</No>, <No key="m" />],
              ["Jobber", "Field service", "$29/mo billed annually", <Yes key="n">Client Hub</Yes>, <No key="o" />, "Not stated", <No key="o1" />, <No key="o2">No media delivery</No>, <No key="p" />],
              ["Housecall Pro", "Field service", "$59/mo billed annually", "Not stated", <No key="q" />, "Not stated", <No key="q1" />, <No key="q2">No media delivery</No>, <No key="r" />],
              ["Aryeo", "Real estate media", "Free Lite; Pro from $49/mo", <Yes key="s">Agent portal</Yes>, <Yes key="t" />, <Yes key="t1">Distance or time</Yes>, "Not stated", "Not stated", <No key="u" />],
              ["HDPhotoHub", "Real estate media", "$5–$10 per delivery", "Not stated", <Yes key="v" />, "Not stated", "Not stated", <Yes key="v1">Pay to Download</Yes>, <No key="w" />],
            ]}
            note={
              <>
                Prices from each vendor&apos;s official pricing page, checked October 15, 2026, and linked in the
                reviews below. Card processing fees are charged separately by each payment provider. The three middle
                columns are the drone-specific client workflow: pricing a job by distance, collecting video feedback,
                and holding finals until the balance is paid. No tool in this table covers both those and flight
                logging, which is why most operators keep a flight app alongside their business platform.
              </>
            }
          />
        </>
      ),
    },
    {
      id: "tools-reviewed",
      title: "The drone business tools, reviewed",
      tocLabel: "Tools reviewed",
      body: (ctx) => (
        <>
          <p>
            ShootPortal is our product and our recommendation, so it&apos;s listed first and labeled. The order after
            that reflects how directly each tool addresses drone work, not a score.
          </p>

          <ToolCard
            id="tool-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="The all-in-one client side of a drone business, from your website to paid delivery, built by a working Part 107 operator"
            pricing={
              ctx.studioMonthly ? (
                <>
                  Studio plan: {ctx.studioMonthly}/month{ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}.
                  One plan with every feature. No per-job fees, and 0% taken from client payments (Stripe&apos;s
                  standard processing fees apply).{" "}
                  {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Our pick for solo pilots and small teams doing aerial photo, video, mapping, and real estate work who want their website, quoting, rescheduling, video review, payment, and delivery in one place."
            pros={[
              "Business website with portfolio, services, and a Book a Shoot form on your own domain; every request creates the client, the project, and an instant estimate",
              "Versioned proposals with expiry dates and PDFs, plus travel fees from ZIP-to-ZIP distance (mileage tiers, or a free radius plus a per-mile rate with a cap)",
              "Weather moves handled in the portal: propose a new shoot time and the client accepts or counters; confirmed shoots push to your Google Calendar",
              "Video review that replaces Dropbox Replay or Frame.io: comments pinned to the second and the spot on the frame, threaded replies, resolve and reopen, numbered versions",
              "Deliver photos, video, Kuula tours, and 3D or map embeds from DroneDeploy, Pix4D, Agisoft, Matterport, Polycam, ArcGIS, Cesium, and others, with resumable uploads for large files",
              "Deposits on approval and optional download unlock after final payment, paid into your own Stripe account",
              "Property website, social posts, and print flyer for real estate aerial jobs, included free or sold to the agent as an add-on",
            ]}
            cons={[
              "Built for the client side of the business; keep your flight-ops app (Aloft, AirData, or similar) alongside it for logs and airspace",
            ]}
          >
            <p>
              ShootPortal&apos;s founder holds a Part 107 certificate and runs a drone photography business, and the
              product is organized the way those jobs actually run: around the project, not around a storefront or a
              flight. A new client finds you on your ShootPortal website and clicks Book a Shoot, with no account
              needed. They enter the site address, pick services from your catalog, and add a preferred date, and they
              see a preliminary estimate with the travel fee already calculated from the job&apos;s ZIP code. You
              send the official, versioned proposal.
            </p>
            <p>
              Here&apos;s how a typical commercial job moves. The client approves the proposal in one click, and a
              deposit request can go out automatically. You propose a shoot time; when the wind forecast kills it, you
              propose a new one and the client accepts or counters, with the exchange kept on the project instead of in
              a text thread. After the flight, you upload the edit, the stills, and the DroneDeploy or Pix4D link, and
              touch up any stills in the built-in photo editor without leaving the project.
            </p>
            <p>
              The client approves each deliverable or sends written feedback, and pins video comments to the exact
              second and spot on the frame. You reply, resolve, and upload version 2; they see it as V2 · Latest and
              approve. They pay the balance by card, Apple Pay, or Google Pay, and the originals, a ZIP, or MLS-size
              copies unlock automatically.
            </p>
            <Figure caption="Left: a flyover film on version 2 with the client's time-stamped comments, your replies, and Resolve buttons. Right: what the client sees on their phone, no app to install and no Dropbox Replay or Frame.io seat to pay for.">
              <TwoSidedScreens business="video-review" client="phone-video-review" />
            </Figure>
            <p>
              The point is that the estimate, shoot time, messages, files, feedback, and payment status sit on the same
              project. When a client asks &quot;where are we?&quot;, you open one page instead of searching email, a
              calendar, a drive folder, a review tool, and Stripe.
            </p>
          </ToolCard>

          <ToolCard
            id="tool-dronedesk"
            name="Dronedesk"
            url="https://dronedesk.io/pricing"
            tagline="UK-based drone operations platform that adds clients, quotes, and invoices"
            pricing={
              <>
                Startup, Pro, Unlimited, and Specialist plans, billed monthly or annually. Prices load dynamically and
                we couldn&apos;t verify them; see <Ext href="https://dronedesk.io/pricing">Dronedesk&apos;s official
                pricing</Ext>. Free trial offered.
              </>
            }
            bestFor="Pilots who want flight planning, risk assessments, and logging in the same tool as their client list and invoices."
            pros={[
              "Flight and task planning, NOTAM/airspace data, weather, and flight logging with DJI sync",
              "Configurable risk assessments and PDF/Excel reports",
              "Unlimited client records, leads, branded quotes and invoices, and a jobs calendar with Google Calendar",
            ]}
            cons={[
              "Its features page doesn't describe a client portal or media delivery",
              "Invoices link to payment pages; native payment processing isn't described",
              "Entry Startup plan is limited to 3 jobs per month",
            ]}
          >
            <p>
              Dronedesk is the most drone-native option here: it was built for pilots, and the operational side (risk
              assessments, airspace, logs) is a real strength. The business side covers quoting and invoicing. What you
              won&apos;t find described is the client-facing half: a portal where clients review and download work. Many
              Dronedesk users pair it with a separate delivery tool.
            </p>
          </ToolCard>

          <ToolCard
            id="tool-honeybook"
            name="HoneyBook"
            url="https://www.honeybook.com/pricing"
            tagline="All-in-one CRM for creative service businesses"
            pricing={
              <>
                List prices: Starter $29, Essentials $49, Premium $109 per month billed yearly ($36, $59, $129 billed
                monthly). 30-day free trial. <Ext href="https://www.honeybook.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Pilots whose work is client-relationship heavy (events, brand content) and who want contracts and proposals handled well."
            pros={[
              "Proposals, contracts with e-signature, invoices, and payments in one flow",
              "Client portal on all plans",
              "Automations, SMS reminders, and QuickBooks Online from Essentials up",
            ]}
            cons={[
              "No native galleries or media delivery (Pic-Time integration instead)",
              "Starter has no automations and limits the scheduler",
              "Nothing drone- or location-specific, such as travel fees by distance",
            ]}
          />

          <ToolCard
            id="tool-dubsado"
            name="Dubsado"
            url="https://www.dubsado.com/pricing"
            tagline="Highly customizable forms, workflows, and client portal"
            pricing={
              <>
                Starter $335/year, Premier $525/year (annual prices shown on the official page). 21-day trial with
                Premier access, no card. <Ext href="https://www.dubsado.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Pilots who like to build their own intake forms and automated workflows."
            pros={["Client portal and invoicing with payment plans on both plans", "Contracts and lead capture forms", "Extra users priced in bands; first 3 extra users free"]}
            cons={["Automated workflows and advanced scheduling are Premier-only", "No gallery or media delivery", "Setup takes time to get right"]}
          />

          <ToolCard
            id="tool-jobber"
            name="Jobber"
            url="https://www.getjobber.com/pricing/"
            tagline="Field-service management: quotes, scheduling, invoicing, and a client hub"
            pricing={
              <>
                Core $29/mo billed annually ($49 month to month); Connect from $99; Grow from $149; Plus from $399 (5
                users). 14-day trial, no card. <Ext href="https://www.getjobber.com/pricing/">Official pricing</Ext>
              </>
            }
            bestFor="Pilots doing recurring inspection, roof, or site work who think of themselves as a field-service company."
            pros={["Client Hub lets clients approve quotes, see appointments, and pay", "Automated reminders and follow-ups from Connect", "Two-way SMS and job costing on Grow"]}
            cons={["No media or gallery delivery for clients", "Built around home-service trades, not creative deliverables", "Seat costs add up past one user"]}
          />

          <ToolCard
            id="tool-housecall-pro"
            name="Housecall Pro"
            url="https://www.housecallpro.com/pricing/"
            tagline="Home-service scheduling, dispatch, and invoicing"
            pricing={
              <>
                Basic $59/mo billed annually ($79 monthly), Essentials $149 ($189), Max $299 ($329). 14-day trial of
                Max, no card. <Ext href="https://www.housecallpro.com/pricing/">Official pricing</Ext>
              </>
            }
            bestFor="Multi-pilot teams running high volumes of short, repeatable jobs with dispatch needs."
            pros={["Online booking, estimates, invoicing, and dispatch", "Consumer financing and review management", "QuickBooks Online from Essentials"]}
            cons={["No client portal mentioned on the pricing page", "No media delivery", "Priced for multi-user crews"]}
          />

          <ToolCard
            id="tool-studio-ninja"
            name="Studio Ninja"
            url="https://www.studioninja.co/pricing/"
            tagline="Budget-friendly photography CRM with workflows on every tier"
            pricing={
              <>
                Starter $16/mo (5 active jobs), Pro $27/mo, Master $40/mo; save 17% yearly. 7-day trial, no card.{" "}
                <Ext href="https://www.studioninja.co/pricing/">Official pricing</Ext>
              </>
            }
            bestFor="Side-hustle pilots who mostly shoot photo work and want inexpensive CRM and booking."
            pros={["Workflow automation on all tiers", "Stripe, QuickBooks, Xero, and Google Calendar integrations", "Galleries via Pic-Time or ShootProof"]}
            cons={["Starter capped at 5 active jobs", "No native media delivery", "Built around photo sessions, not site-based jobs"]}
          />

          <ToolCard
            id="tool-aryeo"
            name="Aryeo"
            url="https://www.aryeo.com/pricing"
            tagline="Real estate media ordering and delivery platform owned by Zillow"
            pricing={
              <>
                Lite free; Pro $49/$99/$179 per month with annual listing caps; Enterprise custom.{" "}
                <Ext href="https://www.aryeo.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Drone pilots whose work is mostly listing aerials for agents, especially in Zillow Showcase markets."
            pros={["Agent ordering and an agent login portal", "Aryeo says it's the only platform delivering media for Zillow Showcase listings", "Free Lite tier for delivery"]}
            cons={["Built around listings, not acreage, inspection, or commercial jobs", "Pro tiers cap annual listings"]}
          >
            <p>
              If you&apos;re a drone pilot whose calendar is mostly real estate, read our{" "}
              <BlogLink slug="best-real-estate-photography-software">real estate photography software comparison</BlogLink>{" "}
              for the full field of listing-focused platforms.
            </p>
          </ToolCard>

          <ToolCard
            id="tool-hdphotohub"
            name="HDPhotoHub"
            url="https://hdphotohub.com/learn-paygpricing"
            tagline="Pay-per-delivery listing media platform"
            pricing={
              <>
                $5 per Basic Delivery, $10 per Full Delivery with the Marketing Kit, no monthly fee.{" "}
                <Ext href="https://hdphotohub.com/learn-paygpricing">Official pricing</Ext>
              </>
            }
            bestFor="Seasonal real estate aerial work where a subscription would sit idle in slow months."
            pros={["Pay to Download with Stripe or Square", "Matterport, iGUIDE, Zillow 3D, and any embed URL", "Unlimited team members"]}
            cons={["Per-delivery pricing grows with volume", "Listing-centric; less suited to custom commercial quotes"]}
          />

          <InlineCta
            trialDays={ctx.trialDays}
            title="Cancel the review tool, the website builder, and the cloud drive"
            body="ShootPortal runs your website, proposals with travel fees, weather reschedules, frame-pinned video review, payments, and delivery in one branded portal. Keep your flight app; replace the rest."
          />
        </>
      ),
    },
    {
      id: "right-fit",
      title: "Why ShootPortal is the right fit for a drone business",
      tocLabel: "Why ShootPortal fits",
      body: (ctx) => (
        <>
          <p>
            Great aerials are only half of a drone business. The other half is everything that happens between
            &quot;can you fly our site?&quot; and the paid download: the quote, the travel fee, the weather delays, the
            revision rounds, the deposit, and getting a multi-gigabyte edit and a processed map to a client who isn&apos;t
            technical. That half is what ShootPortal is built to run.
          </p>
          <BestFitPanel
            heading="Who should choose ShootPortal for drone work"
            fits={[
              {
                who: "Solo pilots selling custom jobs",
                why: "Acreage, deliverables, and distance change every quote. Proposals are versioned with PDFs, and travel fees come from rules you set instead of mental math.",
              },
              {
                who: "Pilots who deliver video",
                why: "Clients leave time-stamped comments pinned to the frame, you upload numbered versions, and each round stays attached to the job, so you can cancel the separate review tool.",
              },
              {
                who: "Mapping and inspection operators",
                why: "Embed the DroneDeploy, Pix4D, ArcGIS, or Cesium output next to the flyover video and stills, so the client gets one portal link instead of three.",
              },
              {
                who: "Real estate aerial specialists",
                why: "MLS-size and Print downloads for agents, plus a property website, Just Listed posts, and a flyer for each listing that you can sell as an add-on.",
              },
              {
                who: "Pilots who need a professional web presence",
                why: "A website with your portfolio, services, testimonials, and a Book a Shoot form on your own domain, feeding requests straight into projects.",
              },
              {
                who: "Small teams of two or three",
                why: "Unlimited staff accounts with granular permissions and per-project assignment, so a second pilot or editor sees their jobs without your whole client list.",
              },
            ]}
          />
          <Figure caption="Left: a scheduled shoot on the project page. Right: what the client sees when weather forces a move, the new time with Approve Time and Request a Different Time buttons.">
            <TwoSidedScreens business="project-scheduled" client="portal-shoot-time" />
          </Figure>
          <p>
            In practice, the stack we recommend for most commercial pilots is simple: your flight-ops app for airspace
            and logs, your processing software for maps and models, and ShootPortal for everything client-facing, from
            the website to the paid delivery. Here is what that covers at each stage.
          </p>
          <Figure caption="ShootPortal's features at each stage of a drone job, from the first request to marketing a listing you flew.">
            <WorkflowCoverageMap />
          </Figure>
          <p>
            What&apos;s automated versus what you still do: preliminary estimates and travel fees are calculated for
            you, branded emails go out at each stage, projects can advance on their own when a payment lands, and
            reminders go out for proposals, scheduling, review, and payment. You still decide when to fly, upload the
            files, and choose whether downloads unlock only after payment.
          </p>
          <AllInOnePlatform
            title="Everything the business side of a drone operation runs on"
            intro="One ShootPortal subscription replaces the website builder, review tool, invoicing app, and cloud drive most pilots stitch together. Keep your flight app for the airspace."
          />
          <TrialCard
            trialDays={ctx.trialDays}
            title="Put your next aerial job through ShootPortal"
            body="Add your services and travel-fee rule, connect your own Stripe account, publish your website, then send one real proposal, propose the shoot time, and deliver the edit and map embed with frame-pinned review, all through your branded portal."
          />
          <p>
            See how the client side of drone work runs in ShootPortal on our{" "}
            <SiteLink href="/drone-business-management-software">drone business management software</SiteLink> page.
          </p>
        </>
      ),
    },
    {
      id: "by-business-size",
      title: "Which setup fits your drone business size?",
      tocLabel: "Recommendations by size",
      body: () => (
        <>
          <p>
            The right setup depends less on how good a pilot you are and more on how many jobs you juggle and who you
            sell to. Here&apos;s how we&apos;d think about it at three stages.
          </p>
          <h3>Side hustle: a few jobs a month</h3>
          <p>
            Keep fixed costs low and look professional from day one. Use a free flight-ops app for airspace and logs,
            and ShootPortal billed monthly for the business side: one flat price you can cancel anytime, with your
            website, quotes, payments, and delivery included, so you don&apos;t pay for a website builder and a
            delivery tool separately. If you&apos;re just getting set up, our{" "}
            <BlogLink slug="how-to-start-drone-photography-business">guide to starting a drone photography business</BlogLink>{" "}
            covers certification and insurance, and the{" "}
            <BlogLink slug="drone-photography-pricing-guide">drone photography pricing guide</BlogLink> helps you set rates.
          </p>
          <h3>Full-time solo operator</h3>
          <p>
            This is where a single system pays for itself. You&apos;re quoting custom work, rescheduling around
            weather, delivering large files, running video revisions, and chasing payment, all alone. You want one
            record per job that carries the proposal, the shoot time, the files, the feedback, and the payment, with
            automated emails and reminders doing the follow-up. That&apos;s exactly what ShootPortal is built for.
          </p>
          <h3>Multi-pilot team</h3>
          <p>
            Now permissions, job assignment, and consistency matter. ShootPortal includes unlimited staff accounts with
            about 25 granular permissions and presets (Editor, Coordinator, Full access except money), so you can
            assign a pilot or editor to specific projects, keep pricing and payouts private, and give every client the
            same branded experience no matter who flew the job.
          </p>
          <PickGrid
            items={[
              {
                who: "Custom aerial video, photo, and mapping jobs",
                pick: "ShootPortal",
                why: "Travel-fee estimates, frame-accurate video review, payments, and map or 3D embeds in one client portal.",
              },
              {
                who: "Mostly real estate aerials",
                pick: "ShootPortal",
                why: "MLS-size downloads, pay-to-download, and a property website and marketing kit you can sell to the agent.",
              },
              {
                who: "Paying for Dropbox Replay or Frame.io",
                pick: "ShootPortal video review",
                why: "Frame-pinned comments and numbered versions, included in the plan with no per-user add-on.",
              },
              {
                who: "Flight logs, LAANC, and maintenance",
                pick: "Keep your flight app",
                why: "Aloft, AirData, or DroneLogbook alongside ShootPortal; each does its own job well.",
              },
            ]}
          />
        </>
      ),
    },
    {
      id: "sample-stacks",
      title: "Three drone software stacks that work together",
      tocLabel: "Sample stacks",
      body: () => (
        <>
          <p>
            Because the categories complement each other, most working pilots run a small stack: one flight app, one
            processing tool if they map, and one business platform. These combinations cover the full job without
            overlap.
          </p>
          <ul>
            <li>
              <strong>Real estate aerial specialist:</strong> a LAANC/flight app such as Aloft, plus ShootPortal for
              agent requests, pay-to-download delivery in Print and MLS sizes, and a property website and social kit for
              each listing.
            </li>
            <li>
              <strong>Construction and mapping:</strong> AirData or DroneLogbook for logs, DroneDeploy or Pix4D for
              processing, and ShootPortal to quote the series, deliver the processed output next to the flyover video
              and stills, and get paid. ShootPortal supports DroneDeploy, Pix4D, ArcGIS, Cesium, and other model embeds.
            </li>
            <li>
              <strong>Brand and event video:</strong> a flight app for compliance, and ShootPortal for the proposal,
              frame-pinned review rounds on numbered versions, payment, and delivery, with a public watch page or
              embeddable player when the client wants to share the final cut.
            </li>
          </ul>
          <Figure caption="The finished project on the client's phone: every file ready, with Download All, once the balance is paid.">
            <PhoneScreen view="phone-portal-finished" />
          </Figure>
          <Figure caption="Conceptual diagram: the client-facing workflow business software should cover, from request to delivery.">
            <WorkflowDiagram highlight={["estimate", "schedule", "review", "pay", "deliver"]} />
          </Figure>
          <KeyTakeaways
            items={[
              "Flight-ops and mapping tools complement business software; they don't replace it.",
              "Custom quoting with travel fees and painless rescheduling matter more for drone work than for most photography.",
              "If you deliver video, insist on time-stamped feedback and versioning on the same project as the invoice.",
              "A website and booking form that feed straight into your projects save you a separate builder and a lot of copy-paste.",
              <>
                Clients judge you on the delivery experience. See our{" "}
                <BlogLink slug="best-photography-client-portals">client portal comparison</BlogLink> for what good looks
                like.
              </>,
              <>
                If client records are your priority, compare options in our{" "}
                <BlogLink slug="best-photography-crm-software">photography CRM guide</BlogLink>.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "final-word",
      title: "Final word: pick the tool that runs the work you sell",
      tocLabel: "Final word",
      body: () => (
        <>
          <p>
            The drone itself is the easy purchase decision. The business software is harder because there&apos;s no
            single category called &quot;drone business software&quot;. There&apos;s flight-ops software that keeps you
            legal, processing software that turns data into maps, and business software that turns all of it into paid
            work.
          </p>
          <p>
            For the business layer, ShootPortal covers the most ground: your website, proposals with travel fees,
            weather reschedules, video review, payments, delivery of video, stills, and map embeds, and listing
            marketing for real estate clients, all under your brand at one flat price. Try it on a real job. You can{" "}
            <SiteLink href="/how-it-works">see how the workflow fits together</SiteLink> first, or read how it compares
            on listing work in <BlogLink slug="shootportal-vs-aryeo-vs-hdphotohub">ShootPortal vs. Aryeo vs. HDPhotoHub</BlogLink>.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is drone business management software?",
      answerText:
        "It's software that runs the client side of a drone business: client records, quotes, scheduling, payments, and often media delivery. It's different from flight-ops apps like Aloft or AirData, which handle airspace, logs, and compliance, and from processing tools like DroneDeploy or Pix4D.",
      answer: (
        <p>
          It&apos;s software that runs the client side of a drone business: client records, quotes, scheduling,
          payments, and often media delivery. It&apos;s different from flight-ops apps like Aloft or AirData, which
          handle airspace, logs, and compliance, and from processing tools like DroneDeploy or Pix4D.
        </p>
      ),
    },
    {
      question: "Can DroneDeploy or Pix4D replace business management software?",
      answerText:
        "No. DroneDeploy and Pix4D process captures into maps, models, and reports. They don't quote jobs, schedule clients, or collect payment, so most operators run them alongside a business tool. ShootPortal can embed the processed output in the client's delivery.",
      answer: (
        <p>
          No. DroneDeploy and Pix4D process captures into maps, models, and reports. They don&apos;t quote jobs,
          schedule clients, or collect payment, so most operators run them alongside a business tool. ShootPortal can
          embed the processed output in the client&apos;s delivery.
        </p>
      ),
    },
    {
      question: "Is Dronedesk or ShootPortal better for drone pilots?",
      answerText:
        "They focus on different halves of the job. Dronedesk centers on flight operations (planning, risk assessments, logging) with quotes and invoices added. ShootPortal covers the client-facing business end to end: a website, proposals with travel fees, scheduling, video review, payments, and media delivery in a branded portal. Many pilots keep a flight-ops app for logs and run the business in ShootPortal.",
      answer: (
        <p>
          They focus on different halves of the job. Dronedesk centers on flight operations (planning, risk
          assessments, logging) with quotes and invoices added. ShootPortal covers the client-facing business end to
          end: a website, proposals with travel fees, scheduling, video review, payments, and media delivery in a
          branded portal. Many pilots keep a flight-ops app for logs and run the business in ShootPortal.
        </p>
      ),
    },
    {
      question: "What can drone pilots use instead of Dropbox Replay or Frame.io for client feedback?",
      answerText:
        "ShootPortal includes video review in its plan: clients leave comments pinned to a timestamp and a point on the frame, you reply in threads, resolve or reopen notes, and upload numbered versions, and the client approves or requests changes on the same project as the invoice and delivery, with no per-user add-on.",
      answer: (
        <p>
          ShootPortal includes video review in its plan: clients leave comments pinned to a timestamp and a point on the
          frame, you reply in threads, resolve or reopen notes, and upload numbered versions, and the client approves or
          requests changes on the same project as the invoice and delivery, with no per-user add-on.
        </p>
      ),
    },
    {
      question: "Does ShootPortal include a website for my drone business?",
      answerText:
        "Yes. The Sites builder includes Modern, Luxury, and Minimal templates with a hero photo or video, portfolio, services, testimonials, and a Book a Shoot form, on your own domain or a free yourstudio.shootportal.app address. Requests from the site become client records and projects automatically.",
      answer: (
        <p>
          Yes. The Sites builder includes Modern, Luxury, and Minimal templates with a hero photo or video, portfolio,
          services, testimonials, and a Book a Shoot form, on your own domain or a free yourstudio.shootportal.app
          address. Requests from the site become client records and projects automatically.
        </p>
      ),
    },
    {
      question: "Do I need a Part 107 certificate to run a drone photography business?",
      answerText:
        "According to the FAA, flying a drone under 55 pounds for work or business falls under Part 107 and requires an FAA Remote Pilot Certificate. Check faa.gov for current requirements.",
      answer: (
        <p>
          According to the{" "}
          <Ext href="https://www.faa.gov/uas/commercial_operators/become_a_drone_pilot">FAA</Ext>, flying a drone under
          55 pounds for work or business falls under Part 107 and requires an FAA Remote Pilot Certificate. Check
          faa.gov for current requirements.
        </p>
      ),
    },
    {
      question: "How should drone pilots charge for travel?",
      answerText:
        "Use a consistent rule, such as a free radius plus a per-mile rate, or mileage tiers, and put it on every estimate. Software that calculates the fee from the job address keeps it consistent across clients.",
      answer: (
        <p>
          Use a consistent rule, such as a free radius plus a per-mile rate or mileage tiers, and put it on every
          estimate. Software that calculates the fee from the job address keeps it consistent across clients.
          ShootPortal calculates travel fees from ZIP-to-ZIP distance using rules you set.
        </p>
      ),
    },
  ],
  related: ["best-photography-crm-software", "best-photo-video-delivery-platforms", "best-real-estate-photography-software"],
  cta: {
    title: "Run the whole business behind the footage.",
    body: "Keep your flight app for the airspace. Use ShootPortal for everything client-facing: your website, proposals with travel fees, weather reschedules, frame-pinned video review, deposits, and delivery of photos, video, and map embeds under your brand.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
