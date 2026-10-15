import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  KeyTakeaways,
  No,
  PickGrid,
  SiteLink,
  ToolCard,
  Yes,
} from "@/components/blog/article-parts";
import { ToolCategoryMap, ToolSprawlDiagram, WorkflowDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, TrialCard, WorkflowCoverageMap } from "@/components/blog/conversion-parts";

export const article: BlogArticle = {
  slug: "best-real-estate-photography-software",
  title: "10 Best Real Estate Photography Business Management Software Platforms in 2026",
  seoTitle: "10 Best Real Estate Photography Software Platforms (2026)",
  description:
    "Compare 10 real estate photography software platforms for ordering, scheduling, payments, client portals, and media delivery, with verified 2026 pricing.",
  excerpt:
    "Aryeo, HDPhotoHub, Spiro, Tonomo, Rela, ShootPortal and more, compared on booking, payments, delivery, and how each one charges you, with pricing checked against official sites.",
  category: "software-comparisons",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "real estate photography software",
  secondaryKeywords: [
    "real estate photography business software",
    "real estate media software",
    "real estate photography management software",
    "real estate photography software comparison",
  ],
  readingMinutes: 19,
  cover: { variant: "ranking", label: "2026 Buyer's Guide", alt: "Illustration of ranked software cards on a dark indigo background" },
  featured: true,
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Need Zillow Showcase delivery?</strong> Aryeo is the platform Aryeo itself says delivers media for
        Showcase listings, and its Lite plan is free.
      </>,
      <>
        <strong>Want to pay only when you deliver?</strong> HDPhotoHub ($5–$10 per delivery) and Spiro ($5 per
        listing) have no monthly subscription.
      </>,
      <>
        <strong>Running several photographers?</strong> Tonomo is built around auto-assignment, drive time, and
        operations, at a higher monthly price.
      </>,
      <>
        <strong>Selling property websites to agents?</strong> Rela, Tourbuzz, and HDPhotoHub&apos;s marketing kit are
        built around them.
      </>,
      <>
        <strong>Shoot listings plus aerial, video, or commercial work?</strong> ShootPortal (our product) is our pick
        for solo operators and small teams: estimates, scheduling, client messages, video review, payments, and
        delivery on one project, for one flat monthly price with no per-listing fees.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Real estate photography is a volume business with thin margins on time. A typical week means dozens of
        listings, each with its own agent, address, access instructions, package, add-ons, deadline, invoice, and
        download link. The photography itself is the part most of us are good at. The admin around it is where
        evenings go.
      </p>
      <p>
        That&apos;s what <strong>real estate photography software</strong> is supposed to fix. But &quot;real estate
        photography software&quot; covers very different products: some are delivery pages with payments bolted on,
        some are ordering and dispatch systems for multi-photographer teams, and some are mostly property-website
        builders. Pick the wrong category and you&apos;ll end up paying for the platform <em>and</em> keeping the
        spreadsheet.
      </p>
      <p>
        This guide compares ten platforms that are actively sold to real estate media businesses in 2026. For each one
        we cover how it charges you, what the workflow looks like, and who it fits. Pricing comes from each
        vendor&apos;s official site, and we link to it so you can check the current numbers yourself.
      </p>
    </>
  ),
  sections: [
    {
      id: "why-software",
      title: "Why real estate photographers outgrow email, texts, and Dropbox",
      tocLabel: "Why you need software",
      body: () => (
        <>
          <p>
            Most real estate photography businesses start the same way: agents text you to book, you put the shoot in
            your phone&apos;s calendar, upload to Dropbox or Google Drive, and send a payment link from Square or
            PayPal. It works at five listings a week. At twenty, the cracks show:
          </p>
          <ul>
            <li>
              <strong>Booking details live in message threads.</strong> Lockbox codes, occupied-home notes, and add-on
              requests get lost between texts and email.
            </li>
            <li>
              <strong>Payment and delivery aren&apos;t connected.</strong> You send the gallery, then chase the
              invoice. Or you hold the files and field &quot;are they ready yet?&quot; messages.
            </li>
            <li>
              <strong>Nothing tells you where every job stands.</strong> Which listings are shot but not edited? Which
              are delivered but unpaid? Answering that means checking four apps.
            </li>
            <li>
              <strong>The client experience looks improvised.</strong> A shared folder link and a separate payment
              link don&apos;t look like the premium service you&apos;re charging for.
            </li>
          </ul>
          <Figure caption="Conceptual diagram: the same listing tracked across disconnected tools versus one project record.">
            <ToolSprawlDiagram />
          </Figure>
          <p>
            Business management software replaces those handoffs with one record per job. The agent orders or
            requests, you schedule, upload, and get paid, and the agent downloads, all attached to the same listing.
          </p>
        </>
      ),
    },
    {
      id: "features",
      title: "Features that matter when you compare platforms",
      tocLabel: "Features to compare",
      body: () => (
        <>
          <p>
            Feature lists all look alike on pricing pages. These are the questions that actually separate platforms
            once you&apos;re using them every day.
          </p>
          <h3>1. How work comes in: ordering vs. requests</h3>
          <p>
            Some platforms give agents a storefront-style order form where they choose a package, add-ons, and
            sometimes a time slot. Others take a request, then you send an estimate and propose a time. Storefronts
            are faster for repeat agents ordering standard packages. A request-and-estimate flow suits custom aerial,
            commercial, or video work where pricing depends on the job. See our{" "}
            <BlogLink slug="best-real-estate-photography-booking-software">guide to booking and scheduling software</BlogLink>{" "}
            for a deeper look.
          </p>
          <h3>2. Scheduling and team dispatch</h3>
          <p>
            If you&apos;re solo, you need a calendar that won&apos;t double-book you. If you run a team, look for
            photographer assignment by skill and service area, drive-time awareness, and travel fees.
          </p>
          <h3>3. Payments and pay-to-download</h3>
          <p>
            &quot;Lock media until paid&quot; is the single feature that most reduces collections work. Also check
            which payment processor is supported, whether you can take deposits, and whether brokerages can be billed
            separately from agents.
            For policy wording and deposits, see{" "}
            <BlogLink slug="get-paid-before-delivering-real-estate-photos">how to get paid before delivering photos</BlogLink>.
          </p>
          <h3>4. Delivery quality</h3>
          <p>
            Agents need MLS-sized photos and full-resolution files, videos, 3D tours, and floor plans in one place.
            Check whether the platform resizes for MLS automatically, how it handles large video files, and whether
            agents need an account to download. Our{" "}
            <BlogLink slug="best-real-estate-photography-delivery-software">delivery software comparison</BlogLink>{" "}
            covers this in detail.
          </p>
          <h3>5. Marketing extras</h3>
          <p>
            Property websites, flyers, social graphics, and branded/unbranded tour links are a real revenue line for
            some businesses and irrelevant to others. Don&apos;t pay a premium for them unless agents ask.
          </p>
          <h3>6. The pricing model</h3>
          <p>
            This matters more than most features. Platforms charge per delivery, per listing, as a monthly subscription
            with listing caps, as a flat subscription, or as a yearly license. Your volume and seasonality decide which
            model is cheapest.
          </p>
          <Figure caption="How the main categories of software overlap. Most businesses need the middle column covered.">
            <ToolCategoryMap
              columns={[
                {
                  title: "Delivery & marketing platforms",
                  examples: "e.g. HDPhotoHub, Rela, Tourbuzz",
                  covers: ["Branded delivery pages", "Property websites", "MLS resizing", "Pay-to-download"],
                  gaps: ["Custom estimates", "Detailed client CRM", "Video revision rounds"],
                },
                {
                  title: "Business operations platforms",
                  examples: "e.g. Aryeo, Spiro, Tonomo, ShootPortal",
                  covers: ["Orders or requests", "Scheduling", "Payments", "Delivery", "Client records"],
                  gaps: ["Varies: check marketing kits, editing, accounting sync"],
                  accent: true,
                },
                {
                  title: "General CRMs & schedulers",
                  examples: "e.g. HoneyBook, Dubsado, Acuity",
                  covers: ["Contracts & invoices", "Booking pages", "Email automation"],
                  gaps: ["Media delivery", "MLS sizes", "Tours & listing media"],
                },
              ]}
            />
          </Figure>
        </>
      ),
    },
    {
      id: "comparison-table",
      title: "Real estate photography software comparison table",
      tocLabel: "Comparison table",
      body: () => (
        <>
          <p>
            Here&apos;s how the ten platforms compare on pricing model and the features photographers ask about most.
            &quot;Not stated&quot; means we couldn&apos;t confirm it on the vendor&apos;s official site, not that the
            feature is missing.
          </p>
          <ComparisonTable
            caption="Real estate photography software comparison, October 2026"
            columns={[
              "Platform",
              "Pricing model (Oct 2026)",
              "Free trial / plan",
              "How jobs come in",
              "Pay-to-download",
              "Video review rounds",
              "Property websites",
            ]}
            highlightColumn={undefined}
            rows={[
              ["ShootPortal", "Flat monthly subscription, no per-listing fees", "Free trial, no card", "Request, then estimate the client approves online", <Yes key="a">Optional</Yes>, <Yes key="a2">Frame-pinned comments, numbered versions</Yes>, <No key="b" />],
              ["Aryeo", "Free Lite; Pro from $49/mo with annual listing caps", "Free Lite plan", "Embeddable order forms with add-ons", "Not stated", "Not stated", "Not stated"],
              ["HDPhotoHub", "$5–$10 per delivery, no subscription", "Free account", "Shopping cart with add-ons", <Yes key="c" />, "Not stated (Vimeo integration)", <Yes key="d">Marketing Kit</Yes>],
              ["Spiro", "$5 per listing, no subscription", "“Start Free” (terms not stated)", "Custom order pages", "Not stated", "Not stated", <Yes key="e" />],
              ["Tonomo", "$140 or $250/mo with listing caps", "Demo only", "Branded booking flows", <Yes key="f" />, "Not stated", "Not stated"],
              ["Rela", "$49 or $99/mo + per-site fees", "14 days, no card", "Order form (Storefront add-on)", <Yes key="g">With add-on</Yes>, "Not stated", <Yes key="h" />],
              ["Fotello", "Free tier; paid priced per listing (editing)", "Free tier", "Bookings on the free tier", "Not stated", "Not stated", <Yes key="i" />],
              ["Tourbuzz", "Pay per item, no monthly fee", "Full access, no card", "Online ordering ($0.15/order)", "Not stated", "Not stated", <Yes key="j" />],
              ["RTV", "$6–$12 per project", "Free trial, no card", "Booking with real-time availability", <Yes key="k" />, "Not stated", <Yes key="l" />],
              ["PhotoFounder", "$1,495/yr or $4,495 lifetime", "14-day money-back", "Agent self-booking", "Not stated", "Not stated", <Yes key="m" />],
            ]}
            note={
              <>
                Prices from each vendor&apos;s official pricing page, checked October 15, 2026. Vendors change pricing
                often; follow the links in each section below to confirm. &quot;Video review rounds&quot; means clients
                can leave time-stamped feedback on successive cuts inside the platform; delivering a video file alone
                doesn&apos;t count.
              </>
            }
          />
        </>
      ),
    },
    {
      id: "platforms",
      title: "The 10 best real estate photography software platforms, reviewed",
      tocLabel: "The 10 platforms",
      body: (ctx) => (
        <>
          <p>
            We list ShootPortal first because it&apos;s our product and we want that to be obvious, not because we
            think it wins every category. The rest are grouped roughly by how established they are in the real estate
            media market.
          </p>

          <ToolCard
            rank={1}
            id="tool-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="One branded portal for estimate → schedule → review → pay → deliver, at one flat price"
            pricing={
              ctx.studioMonthly ? (
                <>
                  {ctx.studioMonthly}/month{ctx.studioAnnual ? <>, or {ctx.studioAnnual}/month billed annually</> : null}.
                  No per-listing fees or listing caps; Stripe&apos;s standard processing fees apply.{" "}
                  {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Our pick for solo operators and small teams who shoot listings plus aerial, video, or commercial work, quote custom jobs, and want flat pricing without per-listing fees."
            pros={[
              "Request form with automatic preliminary estimates, then versioned official estimates (with PDF and expiry) the client approves online",
              "Travel fees calculated from ZIP-to-ZIP distance, using mileage tiers or a free radius plus a per-mile rate",
              "Clients accept, decline, or counter-propose the shoot time you send; confirmed shoots push to your Google Calendar",
              "Time-stamped video comments pinned to the frame, threaded replies, and numbered versions",
              "Deposits on approval, payment through your own Stripe account, and optional download unlock after the final payment",
              "Print (full-res) and MLS (2048px) downloads, single files or ZIP, plus Kuula 360 tours and 3D embeds (Matterport, Polycam, and others)",
              "Client records with notes, message timeline, property history, lifetime revenue, and outstanding balance",
            ]}
            cons={[
              "No property websites, flyers, or marketing kits",
              "No Zillow Showcase delivery",
              "Clients respond to times you propose rather than self-booking an open slot; no drive-time routing or auto-assignment",
              "No contracts/e-signature, QuickBooks sync, or SMS notifications",
              "Stripe is the only payment processor; no tips or promo codes",
            ]}
          >
            <p>
              ShootPortal was built by the owner of a drone photography business to run his own jobs, so it&apos;s
              organized around the project rather than the listing storefront. Every job, whether it&apos;s a
              25-photo listing or a commercial aerial shoot, gets one project record that holds the estimate, the shoot
              time, the messages, the files, and the payment status. When an agent asks &quot;where are we on Maple
              Street?&quot;, you open one page instead of searching texts, your calendar, and Dropbox.
            </p>
            <p>
              Here&apos;s how a typical listing with an aerial add-on runs. The agent submits a request from your
              branded portal (your logo, colors, and optionally your own domain), picks a service from your catalog, and
              enters the property address. ShootPortal drafts a preliminary estimate, including a travel fee from the
              distance between ZIP codes, and you send the official estimate. The agent approves it online, which can
              trigger a deposit request. You propose Thursday at 4 p.m.; the agent counter-proposes Friday morning; you
              accept, and the shoot lands on your Google Calendar.
            </p>
            <p>
              After the shoot you upload photos, the listing video, a Kuula tour, or a Matterport embed to the same
              project. The agent approves each item or requests changes with written notes, and leaves a comment at
              0:42 of the video pinned to the spot on the frame they mean. You upload version 2, request the balance,
              and downloads unlock once it&apos;s paid if you&apos;ve turned that on. The agent grabs MLS-size files
              for the listing and Print files for the brochure, and can email their assistant a share link that
              expires, no account needed. Next time that agent books, their client record already shows every past
              property, what they&apos;ve spent, and whether anything is outstanding.
            </p>
            <p>
              Staff accounts with granular permissions let you assign editors or second shooters to specific projects,
              and the eight-stage pipeline (New Request through Delivered) shows what&apos;s shot, in review, or
              awaiting payment across every job at once.
            </p>
            <p>
              Where it&apos;s weaker: it doesn&apos;t try to be a listing-marketing platform. If agents expect a
              single-property website and flyer with every order, you&apos;d pair ShootPortal with a tool like Rela or
              choose a platform built around marketing kits.
            </p>
          </ToolCard>

          <ToolCard
            rank={2}
            id="tool-aryeo"
            name="Aryeo"
            url="https://www.aryeo.com/pricing"
            tagline="Zillow-owned ordering, scheduling, and delivery platform for real estate media"
            pricing={
              <>
                Lite: free. Pro: $49/mo (100 listings/yr, 1 seat), $99/mo (250, 3 seats), $179/mo (500, 5 seats).
                Enterprise: custom. <Ext href="https://www.aryeo.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Photographers whose agents want Zillow Showcase, and established businesses that want a widely used, polished ordering flow."
            pros={[
              "Free Lite plan with branded delivery pages and an agent login portal",
              "Aryeo says it is the only platform that delivers media for Zillow Showcase listings",
              "Pro adds advanced scheduling, payroll and invoicing, reporting, and the Aryeo Go mobile app",
            ]}
            cons={[
              "Paid tiers cap annual listings, so cost rises with volume",
              "Pro is sold via demo; no self-serve free trial stated",
              "Some photographers are uneasy depending on a portal-owned vendor (Zillow acquired Aryeo in 2023)",
            ]}
          >
            <p>
              Aryeo is the best-known name in the category. Zillow acquired it in 2023 and folded it into its
              ShowingTime+ suite, and the product leans into that relationship: Zillow 3D Home integration, Virtual
              Staging AI, and Showcase delivery are all on the pricing page. If a meaningful share of your agents list
              with Showcase, that alone can decide the question.
            </p>
            <p>
              For a deeper look at why some photographers are evaluating other options, read our{" "}
              <BlogLink slug="best-aryeo-alternatives">Aryeo alternatives guide</BlogLink>.
            </p>
          </ToolCard>

          <ToolCard
            rank={3}
            id="tool-hdphotohub"
            name="HDPhotoHub"
            url="https://hdphotohub.com/learn-paygpricing"
            tagline="Pay-per-delivery ordering, scheduling, and delivery with an optional marketing kit"
            pricing={
              <>
                No monthly subscription. $5 per Basic Delivery, $10 per Full Delivery (adds the Marketing Kit), USD.{" "}
                <Ext href="https://hdphotohub.com/learn-paygpricing">Official pricing</Ext>
              </>
            }
            bestFor="Seasonal or variable-volume businesses that want strong pay-to-download and no fixed monthly cost."
            pros={[
              "Online shopping cart with add-ons and Smart Scheduling with drive time",
              "Pay to Download, Stripe and Square, deposits, tips, and promo codes",
              "Unlimited team members, MLS resizing, and Matterport, iGUIDE, and Zillow 3D embeds",
            ]}
            cons={[
              "Per-delivery fees scale directly with volume",
              "Free trial terms aren't published",
              "Marketing Kit doubles the per-delivery price",
            ]}
          >
            <p>
              HDPhotoHub has been around since 2017 and covers the full listing workflow: ordering, scheduling,
              delivery, and payment. Basic Delivery includes a white-label, login-free delivery page; Full Delivery
              adds property sites, flyers, social graphics, video reels, and a weekly traffic report. We compare it in
              depth in <BlogLink slug="best-hdphotohub-alternatives">HDPhotoHub alternatives</BlogLink>.
            </p>
          </ToolCard>

          <ToolCard
            rank={4}
            id="tool-spiro"
            name="Spiro"
            url="https://www.spiro.media"
            tagline="Per-listing platform with CRM, property websites, and brokerage billing"
            pricing={
              <>
                $5 per listing, everything included, no subscription.{" "}
                <Ext href="https://www.spiro.media">Official site</Ext>
              </>
            }
            bestFor="Businesses that want per-listing pricing and need brokerage billing or pay-at-close options."
            pros={[
              "Photographer assignment by skill and service area",
              "Property websites and marketing kits included in the per-listing price",
              "Brokerage billing, pay-at-close, and QuickBooks/Xero sync",
            ]}
            cons={[
              "No Zillow Showcase delivery",
              "Trial terms not stated on the site",
              "Don't confuse it with Spiro.ai, an unrelated sales CRM, when reading reviews",
            ]}
          >
            <p>
              Spiro (spiro.media) says it was built by a media company for its own use and now sells the platform to
              other photographers. The flat $5-per-listing model is simple to forecast if your volume is steady.
            </p>
          </ToolCard>

          <ToolCard
            rank={5}
            id="tool-tonomo"
            name="Tonomo"
            url="https://www.tonomo.io/pricing"
            tagline="Operations platform for multi-photographer real estate media teams"
            pricing={
              <>
                $140/mo (200 listings/yr, 1 photographer, &quot;Powered by Tonomo&quot;) or $250/mo (425 listings,
                unlimited photographers, white-label). <Ext href="https://www.tonomo.io/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Teams with several photographers where dispatch and drive time are the bottleneck."
            pros={[
              "Auto-assignment by skills and service area, with drive-time and travel-fee calculation",
              "Pay-to-unlock files, partial upfront payments, Stripe and Square",
              "Xero, QuickBooks, Zapier, and editing-vendor integrations",
            ]}
            cons={["Highest entry price in this list", "Demo only, no free trial", "Property websites and tours aren't mentioned"]}
          />

          <ToolCard
            rank={6}
            id="tool-rela"
            name="Rela"
            url="https://www.relahq.com/pricing/photographers"
            tagline="Property websites and media delivery, with an optional storefront for orders and payments"
            pricing={
              <>
                Starter $49/mo, Pro $99/mo, plus per-property-site fees. Ordering, booking, and payments need the
                Storefront add-on (+$25/mo). <Ext href="https://www.relahq.com/pricing/photographers">Official pricing</Ext>
              </>
            }
            bestFor="Photographers whose main upsell is property websites and tours."
            pros={["14-day free trial, no credit card", "Strong property websites, floor plans, and flyers", "White-labeled customer portal"]}
            cons={["Ordering and payments are a paid add-on", "Per-site fees on top of the subscription"]}
          />

          <ToolCard
            rank={7}
            id="tool-fotello"
            name="Fotello"
            url="https://www.fotello.co/pricing"
            tagline="AI editing bundled with a free booking and delivery platform"
            pricing={
              <>
                Free tier ($0/listing with Fotello branding and limited AI edits); paid plans priced per listing based
                on editing volume. Pricing changed during our research, so check the{" "}
                <Ext href="https://www.fotello.co/pricing">official page</Ext>.
              </>
            }
            bestFor="Photographers who want editing and delivery from the same vendor."
            pros={["Booking, delivery, property websites, and payments on the free tier", "Unlimited team members"]}
            cons={["Primarily an editing product; paid tiers are priced around editing volume", "Free tier carries Fotello branding"]}
          />

          <ToolCard
            rank={8}
            id="tool-tourbuzz"
            name="Tourbuzz"
            url="https://www.tourbuzz.com/pricing"
            tagline="Long-running tour, website, and delivery platform with pay-per-item pricing"
            pricing={
              <>
                No monthly platform fee; you pay per item (e.g. media delivery $2.50/order, property website $8, online
                orders $0.15 each). <Ext href="https://www.tourbuzz.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Tour-centric businesses that want pure pay-as-you-go."
            pros={["Branded and unbranded (MLS-friendly) links", "Native 3D tour and floor plan product", "Google Calendar sync and team assignment"]}
            cons={["Many small line-item fees make monthly cost harder to predict", "Hosting fees apply after the first 12 months"]}
          />

          <ToolCard
            rank={9}
            id="tool-rtv"
            name="RTV (Real Tour Vision)"
            url="https://realtourvision.com/real-estate-photography-system/"
            tagline="Per-project delivery, 360° tours, and property sites"
            pricing={
              <>
                $6 per project (media only) or $12 per project with marketing, plus a one-time $99 setup fee.{" "}
                <Ext href="https://realtourvision.com/real-estate-photography-system/">Official site</Ext>
              </>
            }
            bestFor="360° tour photographers who want low per-project pricing."
            pros={["Free trial, no card", "Pay-to-download with Stripe, PayPal, or Square", "Custom domain and white-label"]}
            cons={["Its FAQ also lists credit pricing that differs from the plan prices, so confirm before buying", "Fewer team and dispatch features confirmed"]}
          />

          <ToolCard
            rank={10}
            id="tool-photofounder"
            name="PhotoFounder"
            url="https://www.photofounder.com"
            tagline="Annual or lifetime license with booking, delivery, and property sites"
            pricing={
              <>
                $1,495/year or $4,495 lifetime (installments available); AI edits billed separately.{" "}
                <Ext href="https://www.photofounder.com">Official site</Ext>
              </>
            }
            bestFor="Established businesses that would rather pay up front than pay per listing for years."
            pros={["Agent self-booking with drive-time padding", "Net terms, property sites, and full white-label", "Unlimited team members"]}
            cons={["Large upfront commitment and no free trial (14-day money-back instead)", "Newer vendor with fewer independent reviews"]}
          />

        </>
      ),
    },
    {
      id: "pricing-math",
      title: "Per-listing vs. subscription: which pricing model costs less?",
      tocLabel: "Pricing models compared",
      body: (ctx) => (
        <>
          <p>
            The cheapest platform depends on your volume. A quick way to compare: multiply your expected listings for
            the year by any per-listing fee, add twelve months of subscription, and add any add-ons you&apos;d need.
          </p>
          <ComparisonTable
            caption="Illustrative annual platform cost at different volumes"
            columns={["Listings per year", "$5 per listing", "$10 per listing", "$49/mo subscription", "$99/mo subscription"]}
            rows={[
              ["100", "$500", "$1,000", "$588", "$1,188"],
              ["250", "$1,250", "$2,500", "$588*", "$1,188"],
              ["500", "$2,500", "$5,000", "$588*", "$1,188*"],
            ]}
            note={
              <>
                Simple arithmetic for comparison only, before payment processing fees. *Some subscriptions cap annual
                listings by tier (Aryeo&apos;s $49 tier covers 100 listings a year), so higher volume may require a
                higher tier. Check each vendor&apos;s limits.
              </>
            }
          />
          <p>
            Two patterns fall out of this. Per-listing pricing is hard to beat when you&apos;re small or seasonal,
            because slow months cost almost nothing. Flat subscriptions get cheaper per job as you grow, as long as the
            plan doesn&apos;t cap listings. And regardless of platform, your payment processor (Stripe, Square, etc.)
            charges its own fees on every card payment.
            If you&apos;re still working out what to charge per listing, start with our{" "}
            <BlogLink slug="real-estate-photography-pricing-guide">real estate photography pricing guide</BlogLink>.
          </p>
          <Callout tone="note" title="Don't forget the stack around the platform">
            <p>
              A $5-per-listing platform plus a separate CRM, scheduler, and video review tool can cost more than one
              subscription that covers all four. Price out the whole workflow, not just the delivery line item.
            </p>
          </Callout>
          <p>
            For reference, ShootPortal is a flat subscription with no per-listing fees and no annual listing cap:{" "}
            {ctx.studioMonthly ? (
              <>
                the Studio plan is {ctx.studioMonthly}/month{ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}
              </>
            ) : (
              <>
                see <SiteLink href="/pricing">current pricing</SiteLink>
              </>
            )}
            . Card payments run through your own Stripe account, so Stripe&apos;s standard processing fees apply on top,
            as they would on any platform.
          </p>
        </>
      ),
    },
    {
      id: "why-one-system",
      title: "Why real estate media businesses need management and delivery in one system",
      tocLabel: "Why one system matters",
      body: () => (
        <>
          <p>
            Great listing media is only half of a real estate photography business. The other half is everything around
            it: the request, the quote, the shoot time, the reschedule, the revision, the invoice, and the download.
            Real estate makes that half unusually heavy, for three reasons.
          </p>
          <h3>Agents are repeat clients, not one-off bookings</h3>
          <p>
            A wedding client books you once. A productive listing agent might book you every few weeks for years. That
            makes the client record more valuable than any single gallery: their usual package, their brokerage, who
            on their team needs the files, and whether last month&apos;s invoice is still open. When that lives in a
            CRM that isn&apos;t connected to delivery, someone has to copy it across on every job.
          </p>
          <h3>Properties come back</h3>
          <p>
            Listings expire and relist, homes sell again, and builders send you the same subdivision phase after phase.
            Being able to pull up an address and see what you shot there before, and what you charged, makes the next
            quote faster and more consistent. That only works if jobs are stored against the property and the client,
            not just as a folder of JPEGs.
          </p>
          <h3>Payment and delivery should be the same step</h3>
          <p>
            In real estate the files are time-sensitive and the agent wants them before the listing goes live. If
            delivery and invoicing are separate tools, you either release files and chase payment, or hold files and
            field &quot;are they ready?&quot; messages. Tying the download to the payment (deposit on booking, balance
            before the download unlocks) removes that standoff without slowing a paying client down.
          </p>
          <p>
            Most platforms in this guide connect some of these pieces. When you compare them, check whether the client
            record, the property history, the payment, and the delivery are actually the same record, or four screens
            that happen to share a login. Here&apos;s what that looks like in ShootPortal, stage by stage:
          </p>
          <Figure caption="ShootPortal's verified features at each stage of a job.">
            <WorkflowCoverageMap />
          </Figure>
        </>
      ),
    },
    {
      id: "who-should-choose-shootportal",
      title: "Who should choose ShootPortal?",
      tocLabel: "Who ShootPortal fits",
      body: (ctx) => (
        <>
          <p>
            We built ShootPortal, so weigh this accordingly. Based on what it does and doesn&apos;t do, it&apos;s our
            recommendation for three kinds of real estate media business, and the wrong choice for a few others.
          </p>
          <BestFitPanel
            heading="Where ShootPortal is our pick"
            fits={[
              {
                who: "Solo shooters who do more than listings",
                why: "Listings, aerials, construction progress, and commercial video all run through the same request, estimate, review, and payment steps, so you don't need a second system for non-listing work.",
              },
              {
                who: "Small teams quoting custom work",
                why: "Versioned estimates with ZIP-based travel fees, staff accounts with granular permissions, and projects assigned to specific team members.",
              },
              {
                who: "Video-heavy media businesses",
                why: "Clients leave time-stamped comments pinned to the frame on numbered versions, so revision rounds stay on the project instead of in email.",
              },
              {
                who: "Businesses that want one branded front door",
                why: "Clients request, approve estimates, answer proposed shoot times, review, pay, and download in one portal with your logo, colors, and domain, at one flat price with no per-listing fees.",
              },
            ]}
            notFor={[
              <>Your agents need Zillow Showcase delivery (Aryeo says it&apos;s the only platform that offers it).</>,
              <>Property websites, flyers, or marketing kits are a core product (look at Rela or HDPhotoHub Full Delivery).</>,
              <>You dispatch several photographers by drive time and service area every day (Tonomo is built for that).</>,
              <>You&apos;d rather pay per delivery with no subscription at all (HDPhotoHub or Spiro).</>,
            ]}
          />
          <TrialCard
            trialDays={ctx.trialDays}
            title="Put your next listing through ShootPortal"
            body={
              <>
                Add your logo and services, connect Stripe, and run one real job from request to paid and delivered.
                Then open the portal as your agent would and compare it with what you use today.
              </>
            }
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
        </>
      ),
    },
    {
      id: "who-should-choose",
      title: "Which real estate photography software should you choose?",
      tocLabel: "Recommendations",
      body: () => (
        <>
          <PickGrid
            items={[
              {
                who: "Agents ask for Zillow Showcase",
                pick: "Aryeo",
                why: "Aryeo states it's the only platform delivering media for Showcase listings, and Lite is free.",
              },
              {
                who: "Low or seasonal volume",
                pick: "HDPhotoHub or Spiro",
                why: "No subscription means quiet months cost close to nothing.",
              },
              {
                who: "Three or more photographers",
                pick: "Tonomo or Aryeo Pro",
                why: "Auto-assignment, drive time, and team calendars matter more than price at this size.",
              },
              {
                who: "Property websites are your upsell",
                pick: "Rela or HDPhotoHub Full Delivery",
                why: "Both are built around listing-marketing assets.",
              },
              {
                who: "Listings plus aerial, video, or commercial work",
                pick: "ShootPortal (our pick)",
                why: "Custom estimates, travel fees, video review, payments, and delivery work the same for any job type, at one flat price.",
              },
              {
                who: "You want to own a license",
                pick: "PhotoFounder",
                why: "Annual or lifetime pricing instead of per-listing fees, if you're comfortable paying up front.",
              },
            ]}
          />
          <Figure caption="The core workflow any platform you choose should cover end to end.">
            <WorkflowDiagram />
          </Figure>
          <KeyTakeaways
            items={[
              "Decide on the pricing model first; it narrows the list faster than features.",
              "Pay-to-download and MLS resizing save more time than almost any other feature.",
              <>
                If you also do non-listing work, check how the platform handles custom estimates and video revisions
                (see our <BlogLink slug="best-photo-video-delivery-platforms">photo and video delivery guide</BlogLink>).
              </>,
              <>
                Need a head-to-head? Read <BlogLink slug="shootportal-vs-aryeo-vs-hdphotohub">ShootPortal vs. Aryeo vs. HDPhotoHub</BlogLink>.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "how-to-trial",
      title: "How to test a platform before you switch",
      tocLabel: "How to test",
      body: () => (
        <>
          <p>
            A demo shows you the happy path. A real listing shows you everything else. Before you commit, run one
            actual job through each finalist:
          </p>
          <ol>
            <li>Have an agent you trust place the order or request the way they would in real life.</li>
            <li>Reschedule it once. Rescheduling is where clunky systems show themselves.</li>
            <li>Upload the full set: photos, a video, and a tour embed if you sell them.</li>
            <li>Take payment and confirm how and when the money reaches your account.</li>
            <li>Ask the agent how the delivery page felt on their phone.</li>
          </ol>
          <p>
            Also check the exit: can you export your client list? How long does delivered media stay hosted? Switching
            platforms later is much easier if you know the answers up front. If client records are a priority, our{" "}
            <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink> is worth reading
            alongside this one.
          </p>
        </>
      ),
    },
    {
      id: "conclusion",
      title: "The bottom line",
      body: () => (
        <>
          <p>
            There isn&apos;t one best real estate photography software platform, but there is usually a best fit.
            Showcase-heavy markets pull toward Aryeo. Variable volume favors HDPhotoHub or Spiro. Multi-photographer
            dispatch favors Tonomo. Marketing-kit businesses lean toward Rela or HDPhotoHub&apos;s Full Delivery.
          </p>
          <p>
            If your week is a mix of listings, aerials, and video, and what you want is one place where every job
            moves from request to estimate to payment and delivery, try <SiteLink href="/how-it-works">ShootPortal&apos;s workflow</SiteLink>{" "}
            on your next real job.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best software for real estate photographers?",
      answerText:
        "It depends on your volume and market. Aryeo suits Zillow Showcase markets, HDPhotoHub and Spiro suit per-listing pricing, Tonomo suits multi-photographer teams, and ShootPortal suits businesses that want one flat-priced workflow for estimates, scheduling, payments, and delivery.",
      answer: (
        <p>
          It depends on your volume and market. Aryeo suits Zillow Showcase markets, HDPhotoHub and Spiro suit
          per-listing pricing, Tonomo suits multi-photographer teams, and ShootPortal suits businesses that want one
          flat-priced workflow for estimates, scheduling, payments, and delivery.
        </p>
      ),
    },
    {
      question: "Is Aryeo free?",
      answerText:
        "Aryeo Lite is listed as free on Aryeo's pricing page and includes media delivery, branded delivery pages, and an agent login portal. Aryeo Pro starts at $49 per month.",
      answer: (
        <p>
          Aryeo Lite is listed as free on Aryeo&apos;s pricing page and includes media delivery, branded delivery
          pages, and an agent login portal. Aryeo Pro starts at $49 per month, with higher tiers at $99 and $179 based
          on annual listings and team size.
        </p>
      ),
    },
    {
      question: "Do I need industry-specific software, or will a general CRM work?",
      answerText:
        "General CRMs like HoneyBook or Dubsado handle contracts, invoices, and email well but don't deliver listing media, resize for MLS, or lock downloads until payment. Most real estate photographers end up needing a platform that handles delivery.",
      answer: (
        <p>
          General CRMs like HoneyBook or Dubsado handle contracts, invoices, and email well, but they don&apos;t
          deliver listing media, resize photos for MLS, or lock downloads until payment. Most real estate photographers
          need a platform that handles delivery, either alone or alongside a CRM. Our{" "}
          <BlogLink slug="best-photography-crm-software">photography CRM guide</BlogLink> covers the trade-offs.
        </p>
      ),
    },
    {
      question: "Is per-listing pricing cheaper than a subscription?",
      answerText:
        "At low volume, usually yes. As volume grows, a flat subscription without listing caps typically becomes cheaper per job. Add up a full year at your expected volume to compare.",
      answer: (
        <p>
          At low volume, usually yes. As volume grows, a flat subscription without listing caps typically becomes
          cheaper per job. Add up a full year at your expected volume, including any add-ons, to compare fairly.
        </p>
      ),
    },
    {
      question: "Does ShootPortal deliver to Zillow Showcase or build property websites?",
      answerText:
        "No. ShootPortal focuses on requests, estimates, scheduling, client communication, video review, payments, and media delivery. It does not deliver to Zillow Showcase or create property websites.",
      answer: (
        <p>
          No. ShootPortal focuses on requests, estimates, scheduling, client communication, video review, payments, and
          media delivery. It doesn&apos;t deliver to Zillow Showcase or create property websites, so if those are
          central to your business, weigh Aryeo, HDPhotoHub, or Rela.
        </p>
      ),
    },
  ],
  related: ["best-aryeo-alternatives", "shootportal-vs-aryeo-vs-hdphotohub", "best-real-estate-photography-delivery-software"],
  cta: {
    title: "Run your real estate media business in one place.",
    body: "Agent requests, estimates, shoot times, revisions, payments, and downloads on one project record, in a client portal with your logo, colors, and domain. No per-listing fees.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
