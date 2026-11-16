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
import { ToolCategoryMap, ToolSprawlDiagram, WorkflowDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, ProductCallout, TrialCard, WorkflowCoverageMap } from "@/components/blog/conversion-parts";
import { AllInOnePlatform, AppScreen, ScreenTrio, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "best-real-estate-photography-software",
  title: "10 Best Real Estate Photography Business Management Software Platforms in 2026",
  seoTitle: "10 Best Real Estate Photography Software Platforms (2026)",
  description:
    "Compare 10 real estate photography software platforms for booking, payments, delivery, video review, and listing marketing, with verified 2026 pricing.",
  excerpt:
    "ShootPortal, Aryeo, HDPhotoHub, Spiro, Tonomo, Rela and more, compared on booking, payments, delivery, listing marketing, and how each one charges you, with pricing checked against official sites.",
  category: "software-comparisons",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "real estate photography software",
  secondaryKeywords: [
    "real estate photography business software",
    "real estate media software",
    "real estate photography management software",
    "real estate photography software comparison",
    "real estate photography website",
    "property website for listings",
    "real estate marketing kit",
    "photo editing for real estate",
    "Dropbox Replay alternative",
  ],
  readingMinutes: 22,
  cover: { variant: "ranking", label: "2026 Buyer's Guide", alt: "Illustration of ranked software cards on a dark indigo background" },
  featured: true,
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Best all-in-one real estate photography software: ShootPortal</strong> (our product). Your business
        website, booking, estimates, scheduling, photo editing, video review, payments, delivery, and listing
        marketing run on one project record, under your brand, for one flat monthly price.
      </>,
      <>
        <strong>It replaces the stack, not just one app.</strong> The website builder, the Dropbox or Frame.io review
        link, the separate invoicing app, and the Canva flyer templates all live in the same subscription.
      </>,
      <>
        <strong>It adds revenue, too.</strong> Each delivered listing can get a property website and a social media
        kit with print flyers that you include free or sell to the agent as an add-on, paid through your own Stripe.
      </>,
      <>
        <strong>The rest of the field is more specialized.</strong> Aryeo is Zillow-owned and tied to Showcase,
        HDPhotoHub and Spiro charge per delivery or listing, Tonomo is built around multi-photographer dispatch, and
        Rela centers on property websites. Each is profiled below with official pricing.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Real estate photography is a volume business with thin margins on time. A typical week means dozens of
        listings, each with its own agent, address, access instructions, package, add-ons, deadline, invoice, and
        download link. The photography itself is the part most of us are good at. The admin around it is where
        evenings go, and it&apos;s the reason to choose your real estate photography software carefully.
      </p>
      <p>
        That&apos;s what <strong>real estate photography software</strong> is supposed to fix. But the category
        covers very different products: some are delivery pages with payments bolted on, some are ordering and
        dispatch systems for multi-photographer teams, and some are mostly property-website builders. Pick a partial
        tool and you end up paying for it <em>and</em> keeping the website builder, the review links, and the
        spreadsheet.
      </p>
      <p>
        Our pick is <strong>ShootPortal</strong>, because it covers the whole job in one place: an agent finds you on
        your website, requests a shoot, approves the estimate, accepts the shoot time, reviews and comments on the
        media, pays, downloads, and can buy a property website and marketing kit for the listing, all from one
        branded link with nothing to install. You get fewer apps, fewer follow-ups, and faster payment.
      </p>
      <p>
        This guide compares ShootPortal with nine other platforms actively sold to real estate media businesses in
        2026. For each one we cover how it charges you, what the workflow looks like, and who it fits. Competitor
        pricing comes from each vendor&apos;s official site, and we link to it so you can check the numbers yourself.
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
          <ProductCallout title="One project holds the whole listing, from request to Just Listed post">
            <p>
              The agent&apos;s request creates the client record and the project automatically. The estimate, shoot
              time, messages, edited photos, video comments, payment, downloads, and the listing&apos;s property
              website all hang off that one project, so &quot;where are we on Maple Street?&quot; is a single page.
            </p>
          </ProductCallout>
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
          <h3>5. Video review and revisions</h3>
          <p>
            If you sell listing films or aerial video, revision rounds are where time disappears. Many businesses pay
            for Dropbox Replay or Frame.io on top of their delivery platform just so agents can comment on a cut. Look
            for time-stamped comments on the frame, numbered versions, and approvals on the same project as the
            invoice.
          </p>
          <h3>6. Editing and finishing</h3>
          <p>
            Small fixes (a dark bathroom, a crooked horizon, a missed spot on the window) usually mean opening a
            desktop editor, exporting, and re-uploading. A built-in editor that saves straight back to the gallery
            turns a ten-minute round-trip into a one-minute fix.
          </p>
          <h3>7. Listing marketing, and whether you can sell it</h3>
          <p>
            Property websites, flyers, and social graphics are a real revenue line when agents will pay for them.
            The question is whether the platform lets you charge for them, or simply bundles them into a higher
            per-delivery fee you absorb.
          </p>
          <h3>8. Your own website</h3>
          <p>
            Agents check your website before they book. If your platform doesn&apos;t include one, you&apos;re
            paying Squarespace or Wix separately and wiring a booking form into it by hand.
          </p>
          <h3>9. The pricing model</h3>
          <p>
            This matters more than most features. Platforms charge per delivery, per listing, as a monthly subscription
            with listing caps, as a flat subscription, or as a yearly license. Your volume and seasonality decide which
            model is cheapest.
          </p>
          <Figure caption="How the main categories of real estate photography software overlap. An all-in-one platform covers what the other two split across several tools.">
            <ToolCategoryMap
              columns={[
                {
                  title: "Delivery & marketing platforms",
                  examples: "e.g. HDPhotoHub, Rela, Tourbuzz",
                  covers: ["Branded delivery pages", "Property websites", "MLS resizing", "Pay-to-download"],
                  gaps: ["Custom estimates", "Detailed client CRM", "Video revision rounds"],
                },
                {
                  title: "Ordering & operations platforms",
                  examples: "e.g. Aryeo, Spiro, Tonomo",
                  covers: ["Orders", "Scheduling", "Payments", "Delivery", "Client records"],
                  gaps: ["Varies: video revision rounds, built-in editing, your business website"],
                },
                {
                  title: "All-in-one business platform",
                  examples: "e.g. ShootPortal",
                  covers: [
                    "Business website + booking form",
                    "Estimates, scheduling, CRM",
                    "Built-in photo editor",
                    "Video review with versions",
                    "Payments + delivery",
                    "Property websites + marketing kit",
                  ],
                  gaps: ["Bookkeeping (payouts land in your own Stripe)"],
                  accent: true,
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
              "Built-in photo editing",
            ]}
            highlightColumn={undefined}
            rows={[
              ["ShootPortal", "Flat monthly subscription, no per-listing fees", "Free trial, no card", "Your website and request form, then an estimate the client approves online", <Yes key="a">Optional</Yes>, <Yes key="a2">Frame-pinned comments, numbered versions</Yes>, <Yes key="b">Per listing, plus social kit and flyers; include or sell</Yes>, <Yes key="b2">Built-in editor</Yes>],
              ["Aryeo", "Free Lite; Pro from $49/mo with annual listing caps", "Free Lite plan", "Embeddable order forms with add-ons", "Not stated", "Not stated", "Not stated", "Not stated"],
              ["HDPhotoHub", "$5–$10 per delivery, no subscription", "Free account", "Shopping cart with add-ons", <Yes key="c" />, "Not stated (Vimeo integration)", <Yes key="d">Marketing Kit</Yes>, "Not stated"],
              ["Spiro", "$5 per listing, no subscription", "“Start Free” (terms not stated)", "Custom order pages", "Not stated", "Not stated", <Yes key="e" />, "Not stated"],
              ["Tonomo", "$140 or $250/mo with listing caps", "Demo only", "Branded booking flows", <Yes key="f" />, "Not stated", "Not stated", "Not stated"],
              ["Rela", "$49 or $99/mo + per-site fees", "14 days, no card", "Order form (Storefront add-on)", <Yes key="g">With add-on</Yes>, "Not stated", <Yes key="h" />, "Not stated"],
              ["Fotello", "Free tier; paid priced per listing (editing)", "Free tier", "Bookings on the free tier", "Not stated", "Not stated", <Yes key="i" />, "AI editing, priced per listing"],
              ["Tourbuzz", "Pay per item, no monthly fee", "Full access, no card", "Online ordering ($0.15/order)", "Not stated", "Not stated", <Yes key="j" />, "Not stated"],
              ["RTV", "$6–$12 per project", "Free trial, no card", "Booking with real-time availability", <Yes key="k" />, "Not stated", <Yes key="l" />, "Not stated"],
              ["PhotoFounder", "$1,495/yr or $4,495 lifetime", "14-day money-back", "Agent self-booking", "Not stated", "Not stated", <Yes key="m" />, "AI edits billed separately"],
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
            We list ShootPortal first because it&apos;s our product and our recommendation, and we want that to be
            obvious. It&apos;s the only platform in this guide that runs the whole business, from your own website to
            the listing&apos;s marketing kit, on one subscription. The other nine are grouped roughly by how
            established they are in the real estate media market.
          </p>

          <ToolCard
            rank={1}
            id="tool-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="The all-in-one pick: website, booking, editing, video review, payments, delivery, and listing marketing at one flat price"
            pricing={
              ctx.studioMonthly ? (
                <>
                  {ctx.studioMonthly}/month{ctx.studioAnnual ? <>, or {ctx.studioAnnual}/month billed annually</> : null}.
                  One plan with every feature. No per-listing fees or listing caps, and ShootPortal takes 0% of client
                  payments (Stripe&apos;s standard processing fees apply).{" "}
                  {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Our overall pick for real estate photographers, drone pilots, and videographers, solo or with a small team, who want one branded platform for every job and flat pricing without per-listing fees."
            pros={[
              "Business website builder (Modern, Luxury, or Minimal templates) with portfolio, services, and a Book a Shoot form, on your own domain",
              "Request form that creates the client and project and shows an instant preliminary estimate, with ZIP-distance travel fees",
              "Versioned proposals (with PDF and expiry) the client approves in one click, with deposits created automatically",
              "Built-in photo editor: one-click Auto, exposure, color, curves, HDR and B&W looks, healing, and batch adjustments, saved straight to the gallery",
              "Video review that replaces Dropbox Replay or Frame.io: time-stamped comments pinned to the frame, threaded replies, and numbered versions",
              "Property website and social media kit (posts, Stories, carousel, print flyer) per listing, included free or sold to the agent as a paid add-on",
              "Payments straight to your own Stripe, plus Print and MLS-size downloads that can unlock automatically once the invoice is paid",
            ]}
            cons={[
              "You propose shoot times and clients accept or counter, which keeps your route in your hands rather than open self-booking",
              "Built for client-facing work rather than editor plugins: the editor handles JPEG, PNG, and WebP finals, not RAW files",
            ]}
          >
            <p>
              ShootPortal was built by the owner of a drone photography business to run his own jobs, so it&apos;s
              organized around the project rather than the listing storefront. Every job, whether it&apos;s a
              25-photo listing or a commercial aerial shoot, gets one project record that holds the estimate, the shoot
              time, the messages, the files, the video comments, the payment status, and the listing&apos;s marketing.
              When an agent asks &quot;where are we on Maple Street?&quot;, you open one page instead of searching
              texts, your calendar, and Dropbox.
            </p>
            <p>
              Here&apos;s how a typical listing with an aerial add-on runs. The agent finds you on your ShootPortal
              website (your templates, portfolio, and services on your own domain) and clicks Book a Shoot. They pick
              services from your catalog and enter the address, no account needed, and see a preliminary estimate
              right away, including a travel fee from the distance between ZIP codes. You send the official proposal;
              the agent approves it in one click, which can create the deposit request automatically. You propose
              Thursday at 4 p.m.; the agent counters with Friday morning; you accept, and the shoot lands on your
              Google Calendar.
            </p>
            <Figure caption="Left: the proposal you build, with line items and deposit terms. Right: what the agent sees, one Approve Proposal button and no account to create.">
              <TwoSidedScreens business="proposals" client="portal-proposal" />
            </Figure>
            <p>
              After the shoot you upload the photos, fix the one dark bathroom in the built-in editor without leaving
              the project, and add the listing video and a Matterport or Kuula link. The agent approves each item or
              requests changes, and leaves a comment at 0:42 of the video pinned to the spot on the frame they mean.
              You upload version 2, request the balance, and downloads unlock the moment it&apos;s paid if you&apos;ve
              turned that on. The agent grabs MLS-size files for the listing and Print files for the brochure.
            </p>
            <p>
              Then the part most platforms charge extra for, or don&apos;t do at all: ShootPortal can build a property
              website for the listing from the photos you just delivered, plus Just Listed and Open House posts,
              Stories, an Instagram carousel, and a print-ready flyer with a QR code to the site. Include it free as a
              perk, or sell it to the agent as an add-on they buy in the portal and pay through your Stripe. Either way,
              an optional &quot;Photography by&quot; credit on the site puts your name in front of every buyer who
              visits.
            </p>
            <p>
              Staff accounts with granular permissions let you assign editors or second shooters to specific projects,
              and the eight-stage pipeline (New Request through Delivered) shows what&apos;s shot, in review, or
              awaiting payment across every job at once. For the agent, the whole thing is one branded link: approve,
              pick a time, comment, pay, download, and order marketing, with nothing to install.
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
              Staging AI, and Showcase delivery are all on the pricing page, so it fits best when your business is
              built around Zillow&apos;s ecosystem. The trade-off is listing caps on every paid tier.
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

          <InlineCta
            trialDays={ctx.trialDays}
            title="Replace five apps with one link your agents will actually use"
            body="Website, booking, proposals, editing, video review, payments, delivery, and listing marketing in one branded platform. Run your next listing through it and see how much admin disappears."
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
              A $5-per-listing platform plus a website builder, a separate CRM, a scheduler, and a video review tool
              like Dropbox Replay or Frame.io can cost more than one subscription that covers all of them. Price out the
              whole workflow, not just the delivery line item.
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
            . That one plan includes the business website, video review, photo editor, property websites, and
            marketing kit, so there&apos;s no second or third subscription to add. ShootPortal takes 0% of client
            payments; card payments run through your own Stripe account, so Stripe&apos;s standard processing fees
            apply, as they would on any platform.
          </p>
          <p>
            The marketing kit can also flip the math. If you sell property websites or social kits as an add-on (you
            set the price per product, or include them free), a handful of upsells a month can cover the subscription
            on their own.
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
          <Figure caption="ShootPortal's features at each stage of a job, from the first request to the listing's marketing.">
            <WorkflowCoverageMap />
          </Figure>
        </>
      ),
    },
    {
      id: "website-editing-marketing",
      title: "The real estate photography software features most platforms leave out",
      tocLabel: "Website, editing, marketing",
      body: () => (
        <>
          <p>
            Ordering, scheduling, and delivery are table stakes. The tools that actually change your week, and your
            revenue, sit on either side of the shoot: the website that wins the booking, the editing that finishes
            the set, and the marketing that sells the listing. ShootPortal includes all three in the same plan.
          </p>
          <h3>Listing marketing you can sell, not just give away</h3>
          <p>
            For every delivered listing, ShootPortal can build a property website from the photos and project
            details (Modern, Luxury, or Coastal designs, with gallery, video, floor plans, virtual tour, open house,
            and agent contact), plus a social media kit: five square posts like Just Listed and Open House, three
            Stories, an Instagram carousel, and a print-ready flyer with a QR code to the property site. There&apos;s
            an unbranded, MLS-safe version of the site too.
          </p>
          <p>
            You decide whether each product is included free or sold as a paid add-on, with your own price. The agent
            sees a preview in their portal, adds it to their cart, and pays through your Stripe or on the invoice.
            Their headshot, brokerage logo, and colors are saved to their client record and reused on the next
            listing, so repeat orders take no extra setup on your side.
          </p>
          <Figure caption="The Marketing Kit for one listing: square social posts, a print-ready flyer, and the property website, all built from the photos you delivered.">
            <ScreenTrio views={["social-kit", "listing-flyer", "property-website"]} />
          </Figure>
          <h3>A photo editor that saves straight to the gallery</h3>
          <p>
            The built-in editor handles the last-mile fixes on finals without a round-trip: one-click Auto, exposure,
            highlights and shadows, white balance, curves, crop, HDR and black-and-white looks, spot healing, and lens
            corrections. Copy one photo&apos;s adjustments across a whole batch, compare before and after, and click
            Save to Project. The gallery, downloads, and share links update instantly, and the original is never
            overwritten.
          </p>
          <Figure caption="The built-in photo editor: adjust exposure, highlights, and shadows on a finished interior, then save it back to the client's gallery in one click.">
            <AppScreen view="photo-editor" />
          </Figure>
          <h3>Your business website, connected to your booking form</h3>
          <p>
            Agents look you up before they book. ShootPortal&apos;s website builder gives you Modern, Luxury, or
            Minimal templates with a hero photo or video, a portfolio, your featured services, testimonials, and a
            Book a Shoot form, on your own domain. Every inquiry lands in your leads inbox, and every request becomes
            a client record and a project with an estimate already attached.
          </p>
          <Figure caption="The website editor: pick a template, add your logo and accent color, and see the live site update beside it. The Book a Shoot button feeds straight into your projects.">
            <AppScreen view="website-editor" />
          </Figure>
          <AllInOnePlatform
            title="Everything a real estate media business runs on, in one platform"
            intro="One ShootPortal subscription replaces the website builder, review links, invoicing app, delivery folders, and flyer templates most photographers pay for separately."
          />
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
            We built ShootPortal, so weigh this accordingly. It&apos;s our recommendation for any real estate media
            business that wants to look premium to agents, spend less time on admin, and get paid faster, without
            stitching five apps together.
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
                why: "Versioned proposals with ZIP-based travel fees, unlimited staff accounts with granular permissions, and projects assigned to specific team members.",
              },
              {
                who: "Video-heavy media businesses",
                why: "Clients leave time-stamped comments pinned to the frame on numbered versions, so you can drop Dropbox Replay or Frame.io and keep revisions on the same project as the invoice.",
              },
              {
                who: "Photographers who want to sell listing marketing",
                why: "Property websites, social posts, Stories, and print flyers for every listing, sold to agents as an add-on at your price or included as a perk.",
              },
              {
                who: "Businesses that want one branded front door",
                why: "From your website to the final download, agents request, approve, pick a time, comment, pay, and download in one portal with your logo, colors, and domain. Nothing to install.",
              },
              {
                who: "Anyone tired of per-listing fees",
                why: "One flat plan with every feature, no listing caps, and 0% taken from client payments, so a busy month doesn't cost you more.",
              },
            ]}
          />
          <TrialCard
            trialDays={ctx.trialDays}
            title="Put your next listing through ShootPortal, start to finish"
            body={
              <>
                Add your logo and services, connect Stripe, and run one real job from request to paid and delivered,
                then turn on the Marketing Kit and see what the agent can buy. Open the portal as your agent would and
                compare it with the stack you use today.
              </>
            }
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
          <p>
            For the full tour of how ShootPortal handles listing work, see our{" "}
            <SiteLink href="/real-estate-photography-software">real estate photography software</SiteLink> page.
          </p>
        </>
      ),
    },
    {
      id: "who-should-choose",
      title: "Which real estate photography software should you choose?",
      tocLabel: "Recommendations",
      body: () => (
        <>
          <p>
            Start with the problem you most want to stop dealing with. Here&apos;s how ShootPortal handles the
            situations photographers bring up most often when they compare platforms.
          </p>
          <PickGrid
            items={[
              {
                who: "You're paying for five separate apps",
                pick: "ShootPortal",
                why: "Website, booking, proposals, editing, video review, payments, delivery, and listing marketing on one subscription.",
              },
              {
                who: "Low or seasonal volume",
                pick: "ShootPortal, billed monthly",
                why: "One flat price with no per-listing fees, and you can cancel anytime. Busy months cost the same as slow ones.",
              },
              {
                who: "You run a small team",
                pick: "ShootPortal",
                why: "Unlimited staff accounts, permission presets like Editor and Coordinator, and projects assigned to specific shooters.",
              },
              {
                who: "Property websites are your upsell",
                pick: "ShootPortal Marketing Kit",
                why: "Per-listing property sites, social posts, and flyers that agents buy in your portal at the price you set.",
              },
              {
                who: "Listings plus aerial, video, or commercial work",
                pick: "ShootPortal",
                why: "Custom estimates, travel fees, video review, payments, and delivery work the same for any job type.",
              },
              {
                who: "Agents complain about chasing files",
                pick: "ShootPortal",
                why: "One branded link to approve, pay, and download Print or MLS sizes, with no app to install.",
              },
            ]}
          />
          <Figure caption="The core workflow any platform you choose should cover end to end.">
            <WorkflowDiagram />
          </Figure>
          <KeyTakeaways
            items={[
              "Price the whole stack (website, review tool, invoicing, delivery, marketing), not just the per-listing line item.",
              "Pay-to-download and MLS resizing save more time than almost any other feature.",
              "Listing marketing you can sell turns your software from a cost into a revenue line.",
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
            <li>Upload the full set: photos, a video, and a tour link if you sell them.</li>
            <li>Ask the agent to leave a comment on the video and see how the revision round feels.</li>
            <li>Take payment and confirm how and when the money reaches your account.</li>
            <li>Ask the agent how the delivery page and marketing materials felt on their phone.</li>
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
            Most real estate photography software covers one slice of the job: ordering, delivery, dispatch, or
            property websites. That&apos;s why so many photographers end up with a platform plus a website builder, a
            review tool, an invoicing app, and a folder of flyer templates.
          </p>
          <p>
            ShootPortal is the one platform in this guide that covers the whole job: your website, booking,
            proposals, scheduling, editing, video review, payments, delivery, and listing marketing you can sell, at
            one flat price. Your agents get one simple branded link; you get fewer follow-ups and faster payment. Try{" "}
            <SiteLink href="/how-it-works">ShootPortal&apos;s workflow</SiteLink> on your next real job.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best software for real estate photographers?",
      answerText:
        "For most real estate photographers, ShootPortal is the best all-in-one pick: a business website, booking, proposals, scheduling, a built-in photo editor, video review, payments, delivery, and sellable property websites and marketing kits in one platform at one flat price. Aryeo, HDPhotoHub, Spiro, and Tonomo each cover parts of that workflow with different pricing models.",
      answer: (
        <p>
          For most real estate photographers, ShootPortal is the best all-in-one pick: a business website, booking,
          proposals, scheduling, a built-in photo editor, video review, payments, delivery, and sellable property
          websites and marketing kits in one platform at one flat price. Aryeo, HDPhotoHub, Spiro, and Tonomo each
          cover parts of that workflow with different pricing models, compared above.
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
        "General CRMs like HoneyBook or Dubsado handle contracts, invoices, and email well but don't deliver listing media, resize for MLS, or lock downloads until payment. Most real estate photographers are better served by a platform built for listing media that includes its own client records.",
      answer: (
        <p>
          General CRMs like HoneyBook or Dubsado handle contracts, invoices, and email well, but they don&apos;t
          deliver listing media, resize photos for MLS, or lock downloads until payment. Most real estate photographers
          are better served by a platform built for listing media that includes its own client records, so the CRM
          and the delivery are the same thing. Our{" "}
          <BlogLink slug="best-photography-crm-software">photography CRM guide</BlogLink> covers the trade-offs.
        </p>
      ),
    },
    {
      question: "Is per-listing pricing cheaper than a subscription?",
      answerText:
        "At low volume, sometimes. As volume grows, a flat subscription without listing caps typically becomes cheaper per job, especially when it replaces a website builder, a review tool, and an invoicing app. Add up a full year at your expected volume, including every tool in your stack, to compare.",
      answer: (
        <p>
          At low volume, sometimes. As volume grows, a flat subscription without listing caps typically becomes
          cheaper per job, especially when it replaces a website builder, a review tool, and an invoicing app. Add up
          a full year at your expected volume, including every tool in your stack, to compare fairly.
        </p>
      ),
    },
    {
      question: "Does ShootPortal build property websites and marketing materials?",
      answerText:
        "Yes. ShootPortal's Marketing Kit builds a property website for each listing from the delivered photos (Modern, Luxury, or Coastal designs, with an unbranded MLS-safe version), plus social posts, Stories, an Instagram carousel, and a print-ready flyer with a QR code. You can include it free or sell it to the agent as a paid add-on through your own Stripe.",
      answer: (
        <p>
          Yes. ShootPortal&apos;s Marketing Kit builds a property website for each listing from the delivered photos
          (Modern, Luxury, or Coastal designs, with an unbranded MLS-safe version), plus social posts, Stories, an
          Instagram carousel, and a print-ready flyer with a QR code. You can include it free or sell it to the agent
          as a paid add-on through your own Stripe.
        </p>
      ),
    },
    {
      question: "Can real estate photography software replace Dropbox Replay or Frame.io?",
      answerText:
        "ShootPortal can for client feedback. Agents leave time-stamped comments pinned to a point on the frame, you reply in threads and resolve notes, upload numbered versions, and the client approves or requests changes, all on the same project as the invoice and delivery, included in the plan with no per-user add-on.",
      answer: (
        <p>
          ShootPortal can for client feedback. Agents leave time-stamped comments pinned to a point on the frame, you
          reply in threads and resolve notes, upload numbered versions, and the client approves or requests changes,
          all on the same project as the invoice and delivery, included in the plan with no per-user add-on.
        </p>
      ),
    },
    {
      question: "Does ShootPortal include a website for my photography business?",
      answerText:
        "Yes. The Sites builder includes Modern, Luxury, and Minimal templates with a portfolio, services, testimonials, and a Book a Shoot form, on your own domain or a free yourstudio.shootportal.app address. Inquiries land in a leads inbox and requests become projects automatically.",
      answer: (
        <p>
          Yes. The Sites builder includes Modern, Luxury, and Minimal templates with a portfolio, services,
          testimonials, and a Book a Shoot form, on your own domain or a free yourstudio.shootportal.app address.
          Inquiries land in a leads inbox and requests become projects automatically.
        </p>
      ),
    },
  ],
  related: ["best-aryeo-alternatives", "shootportal-vs-aryeo-vs-hdphotohub", "best-real-estate-photography-delivery-software"],
  cta: {
    title: "Run your whole real estate media business from one link.",
    body: "Your website, agent requests, proposals, shoot times, editing, video review, payments, downloads, and sellable listing marketing, all under your brand. One flat price, no per-listing fees.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
