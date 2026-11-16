import type { BlogArticle, BlogRenderContext } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  InlineCta,
  KeyTakeaways,
  PickGrid,
  SiteLink,
  ToolCard,
  Yes,
} from "@/components/blog/article-parts";
import { ToolCategoryMap, VideoReviewDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";
import { AllInOnePlatform, AppScreen, TwoSidedScreens } from "@/components/blog/app-screen";

/** Parses "$59" → 59 so break-even math tracks live pricing. Null when unavailable. */
function monthlyPrice(ctx: BlogRenderContext): number | null {
  if (!ctx.studioMonthly) return null;
  const n = Number(ctx.studioMonthly.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const article: BlogArticle = {
  slug: "best-hdphotohub-alternatives",
  title: "Best HDPhotoHub Alternatives for Real Estate Photographers in 2026",
  seoTitle: "Best HDPhotoHub Alternatives for Photographers (2026)",
  description:
    "Compare HDPhotoHub alternatives on price, property websites, marketing kits, video review, and delivery, with break-even math for pay-per-delivery.",
  excerpt:
    "HDPhotoHub's pay-per-delivery model gets expensive as volume climbs, and its Marketing Kit doubles the price. Here's the break-even math and the HDPhotoHub alternatives worth comparing, led by a flat-priced all-in-one.",
  category: "software-comparisons",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "HDPhotoHub alternatives",
  secondaryKeywords: [
    "HDPhotoHub alternative",
    "HDPhotoHub pricing",
    "HDPhotoHub competitors",
    "pay per delivery vs subscription",
    "property website for listings",
    "real estate marketing kit",
    "Dropbox Replay alternative",
    "photo editing for real estate",
  ],
  readingMinutes: 18,
  cover: { variant: "layers", label: "Alternatives Guide", alt: "Illustration of layered software panels on a dark indigo background" },
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Best HDPhotoHub alternative overall: ShootPortal</strong> (our product). One flat monthly price instead
        of $5–$10 per delivery, so your busiest months cost the same as your slowest.
      </>,
      <>
        <strong>It matches HDPhotoHub&apos;s Marketing Kit, and lets you charge for it.</strong> Property websites,
        social posts, Stories, a carousel, and print flyers for every listing, included free or sold to agents as an
        add-on at your price.
      </>,
      <>
        <strong>It adds what HDPhotoHub doesn&apos;t advertise:</strong> your own business website, quoted proposals,
        a built-in photo editor, and frame-pinned video review that replaces Dropbox Replay or Frame.io.
      </>,
      <>
        <strong>Other options</strong> include Aryeo (Zillow-owned, Showcase delivery), Spiro ($5 per listing), Tonomo
        (team dispatch), Rela, RTV, and PhotoFounder, each profiled below with official pricing.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        HDPhotoHub has a loyal following among real estate photographers, and it&apos;s easy to see why: no
        subscription to justify in a slow January, an unlimited team, and a clean download page that doesn&apos;t make
        agents log in. So why are so many growing businesses comparing HDPhotoHub alternatives?
      </p>
      <p>
        The photographers who look at <strong>HDPhotoHub alternatives</strong> have usually grown into a different
        shape: more deliveries per month than the per-delivery model rewards, a Marketing Kit that doubles every
        delivery fee, more non-listing work that doesn&apos;t fit a shopping cart, or video clients asking for revision
        rounds.
      </p>
      <p>
        For those businesses, our pick is <strong>ShootPortal</strong>. It covers what you use HDPhotoHub for
        (pay-to-download, MLS-size files, property websites, flyers, social graphics) at one flat price, and adds your
        own website, proposals, photo editing, and video review on the same project. Agents get one branded link to
        approve, pay, download, and order marketing, with nothing to install.
      </p>
      <p>
        Below we cover what HDPhotoHub does well, when its pricing stops being the cheapest option (with arithmetic you
        can check), and seven platforms worth comparing. Competitor pricing is from official vendor pages as of October
        2026.
      </p>
    </>
  ),
  sections: [
    {
      id: "what-hdphotohub-does-well",
      title: "What HDPhotoHub does well",
      tocLabel: "HDPhotoHub's strengths",
      body: () => (
        <>
          <p>
            Any fair comparison starts with what you&apos;d be giving up. According to HDPhotoHub&apos;s homepage and{" "}
            <Ext href="https://hdphotohub.com/learn-paygpricing">pricing page</Ext>, the platform covers:
          </p>
          <ul>
            <li>
              <strong>Pricing with no fixed cost.</strong> $5 per Basic Delivery or $10 per Full Delivery in USD, with
              &quot;no monthly subscriptions or hidden fees.&quot; Enterprise accounts get custom pricing.
            </li>
            <li>
              <strong>Ordering and scheduling.</strong> An online shopping cart with add-ons that depend on what&apos;s
              already in the order, plus Smart Scheduling with drive-time optimization and service areas per team
              member.
            </li>
            <li>
              <strong>Delivery.</strong> Photos, video, PDFs, and Matterport, iGUIDE, Zillow 3D, or any embed URL, on
              login-free download pages with automatic MLS resizing.
            </li>
            <li>
              <strong>Payments.</strong> Pay to Download (media stays locked until paid), Stripe or Square, deposits,
              tax, tips, promo codes, and special client pricing.
            </li>
            <li>
              <strong>Team.</strong> Unlimited team members at no extra cost, with payroll visibility.
            </li>
            <li>
              <strong>Marketing.</strong> Full Delivery adds the Marketing Kit: property sites, flyers, social graphics,
              video reels, and a weekly traffic report.
            </li>
            <li>
              <strong>Integrations.</strong> Dropbox, Google Calendar, Vimeo, QuickBooks, Mailchimp, an API, and
              webhooks, plus an optional white-label iOS and Android app for a one-time configuration fee.
            </li>
          </ul>
          <Callout tone="warning" title="Ignore old credit-based pricing pages">
            <p>
              Some older HDPhotoHub help pages still describe a credit system. The current{" "}
              <Ext href="https://hdphotohub.com/learn-paygpricing">pay-as-you-go pricing page</Ext> lists the $5 and $10
              per-delivery prices, so use that when you compare.
            </p>
          </Callout>
          <ProductCallout title="What carries over to ShootPortal, at a flat price">
            <p>
              Pay-to-download, Print and MLS-size downloads, login-free share links, unlimited staff accounts, tour and
              3D embeds, and a listing marketing kit with property websites, social graphics, and print flyers. You
              keep the core of what agents like about HDPhotoHub, without a fee on every delivery.
            </p>
          </ProductCallout>
        </>
      ),
    },
    {
      id: "why-look-elsewhere",
      title: "Why photographers look for HDPhotoHub alternatives",
      tocLabel: "Why people look elsewhere",
      body: () => (
        <>
          <p>
            Almost every reason comes back to one design choice: HDPhotoHub charges per delivery and is built around the
            listing. That&apos;s a strength until your business outgrows it.
          </p>
          <h3>Costs scale one-for-one with volume</h3>
          <p>
            Per-delivery pricing gets more expensive in exactly the months you&apos;re busiest. Twice the listings means
            twice the platform bill. A flat subscription works the other way: the more you deliver, the less each
            delivery costs you.
          </p>
          <h3>The Marketing Kit doubles the per-delivery price</h3>
          <p>
            Full Delivery is $10 against $5 for Basic. If only some agents use property sites and flyers, you may be
            paying for a kit on listings where nobody opens it, or managing two delivery types. The bigger question is
            who pays: on a per-delivery model, the kit is a cost you absorb. In ShootPortal it can be a product you sell.
            You set the property website and social kit to Included or Paid per listing, and the agent buys it in their
            portal.
          </p>
          <h3>Non-listing work doesn&apos;t fit a cart</h3>
          <p>
            A shopping cart is ideal for &quot;photos plus drone plus twilight&quot; on a standard listing. It&apos;s
            less natural for a construction progress series, a commercial aerial survey, or a brand video where the
            price depends on scope and travel. Photographers doing more of that work want proposals they can adjust,
            version, and have approved before scheduling.
          </p>
          <h3>Video clients want revision rounds</h3>
          <p>
            HDPhotoHub delivers video files and connects to Vimeo, but its homepage doesn&apos;t describe a
            frame-accurate review workflow. If you cut listing films, brand videos, or aerial reels, you may be paying
            for Dropbox Replay or Frame.io on the side and chasing feedback across email threads on each version.
          </p>
          <Figure caption="Where delivery-first platforms and an all-in-one business platform overlap, and the gaps each tends to leave.">
            <ToolCategoryMap
              columns={[
                {
                  title: "Listing delivery & marketing",
                  examples: "e.g. HDPhotoHub, Rela, RTV",
                  covers: ["Cart ordering", "Pay-to-download", "MLS resizing", "Property sites & flyers"],
                  gaps: ["Adjustable proposals", "Video revision rounds", "Your business website"],
                },
                {
                  title: "All-in-one business platform",
                  examples: "e.g. ShootPortal",
                  covers: [
                    "Website, requests & proposals",
                    "Client CRM",
                    "Photo editor & video review",
                    "Payments & delivery",
                    "Property sites, social kit, flyers",
                  ],
                  gaps: ["Bookkeeping (payouts land in your own Stripe)"],
                  accent: true,
                },
                {
                  title: "Listing operations at scale",
                  examples: "e.g. Aryeo Pro, Tonomo, Spiro",
                  covers: ["Order forms", "Team dispatch", "Payments", "Delivery"],
                  gaps: ["Varies: check caps, add-ons, and video review"],
                },
              ]}
            />
          </Figure>
        </>
      ),
    },
    {
      id: "break-even-math",
      title: "When does pay-per-delivery cost more than a subscription?",
      tocLabel: "Break-even math",
      body: (ctx) => {
        const price = monthlyPrice(ctx);
        return (
          <>
            <p>
              This is the question that decides most switches, so here&apos;s the arithmetic. The table compares
              HDPhotoHub&apos;s published per-delivery prices with two hypothetical flat subscriptions at $50 and $100 a
              month. Those two figures are round numbers chosen for illustration, not any specific vendor&apos;s price.
            </p>
            <ComparisonTable
              caption="Illustrative monthly platform cost: per-delivery vs. flat subscription"
              columns={["Deliveries per month", "Basic Delivery ($5)", "Full Delivery ($10)", "Flat $50/mo", "Flat $100/mo"]}
              rows={[
                ["5", "$25", "$50", "$50", "$100"],
                ["10", "$50", "$100", "$50", "$100"],
                ["20", "$100", "$200", "$50", "$100"],
                ["40", "$200", "$400", "$50", "$100"],
                ["80", "$400", "$800", "$50", "$100"],
              ]}
              note={
                <>
                  Simple multiplication for illustration only, using HDPhotoHub&apos;s USD prices from its{" "}
                  <Ext href="https://hdphotohub.com/learn-paygpricing">official pricing page</Ext> (October 2026).
                  Excludes payment processing fees, add-ons, and any listing caps a subscription might have. Compare
                  Full Delivery against a subscription that also includes property sites and flyers.
                </>
              }
            />
            <p>
              The break-even rule is easy to remember: divide a subscription&apos;s monthly price by $5 to find how many
              Basic Deliveries it equals, or by $10 for Full Deliveries. A $50 plan breaks even at 10 Basic Deliveries a
              month; a $100 plan at 20.
              {price ? (
                <>
                  {" "}
                  ShootPortal&apos;s Studio plan is {ctx.studioMonthly}/month and includes property websites and the
                  social kit, so the fair comparison is Full Delivery: it breaks even at about {Math.ceil(price / 10)}{" "}
                  Full Deliveries a month (or {Math.ceil(price / 5)} Basic Deliveries). Every listing beyond that adds
                  nothing to your platform bill.
                </>
              ) : null}
            </p>
            <p>
              Two more things belong in the math. First, the stack around the platform: if you also pay for a website
              builder and a video review tool, a subscription that includes both pulls the break-even down further.
              Second, the revenue side: if you sell property websites or social kits to agents as an add-on, a few
              sales a month can cover the subscription on their own.
            </p>
          </>
        );
      },
    },
    {
      id: "feature-comparison",
      title: "HDPhotoHub vs. the alternatives: features compared",
      tocLabel: "Feature comparison",
      body: () => (
        <>
          <p>
            Here&apos;s how the alternatives stack up on the areas HDPhotoHub users ask about most: client management,
            booking, payments, video review, and listing marketing. &quot;Not stated&quot; means we couldn&apos;t confirm
            it on the vendor&apos;s official site.
          </p>
          <ComparisonTable
            caption="HDPhotoHub alternatives feature comparison, October 2026"
            columns={["Platform", "Pricing model", "How jobs come in", "Client records", "Pay-to-download", "Property sites / kit", "Video review rounds", "Team members"]}
            rows={[
              ["HDPhotoHub", "$5–$10 per delivery", "Shopping cart", "Profiles with order history, client pricing", <Yes key="a" />, <Yes key="b">Full Delivery</Yes>, "Not stated (Vimeo integration)", "Unlimited, no extra cost"],
              [
                "ShootPortal",
                "Flat monthly, every feature",
                "Your website + request form, then a proposal",
                "Notes, message timeline, property history, lifetime revenue, balance",
                <Yes key="c">Optional, automatic on payment</Yes>,
                <Yes key="d">Property site, social kit, flyer; include or sell</Yes>,
                <Yes key="d2">Frame-pinned comments, numbered versions</Yes>,
                "Unlimited staff accounts with permissions",
              ],
              ["Aryeo", "Free Lite; Pro $49–$179/mo", "Order forms", "Agent login portal with past listings and invoices", "Not stated", "Not stated", "Not stated", "1, 3, or 5 seats by tier"],
              ["Spiro", "$5 per listing", "Custom order pages", "Client CRM", "Not stated", <Yes key="e" />, "Not stated", "Not stated"],
              ["Tonomo", "$140 or $250/mo", "Booking flows", "Not stated", <Yes key="f" />, <Yes key="g">Marketing kit editor</Yes>, "Not stated", "1 or unlimited by plan"],
              ["Rela", "$49 or $99/mo + per-site fees", "Storefront add-on", "Not stated", <Yes key="h">With add-on</Yes>, <Yes key="i" />, "Not stated", "Staff accounts on Pro"],
              ["RTV", "$6–$12 per project", "Real-time booking", "Not stated", <Yes key="j" />, <Yes key="k" />, "Not stated", "Not stated"],
              ["PhotoFounder", "$1,495/yr or $4,495 lifetime", "Agent self-booking", "Not stated", "Not stated", <Yes key="l" />, "Not stated", "Unlimited"],
            ]}
            note={
              <>
                From each vendor&apos;s official site, checked October 15, 2026. Feature availability can depend on plan
                tier; confirm on the vendor&apos;s pricing page.
              </>
            }
          />
          <h3>Client management</h3>
          <p>
            HDPhotoHub keeps client profiles with order history and special pricing. ShootPortal goes further: each
            agent&apos;s record holds notes, the message timeline, every property you&apos;ve shot for them, lifetime
            revenue, average project value, and any outstanding balance. Our{" "}
            <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink> covers the category.
          </p>
          <h3>Booking</h3>
          <p>
            HDPhotoHub&apos;s cart plus Smart Scheduling is built for standard listings, RTV and PhotoFounder offer agent
            self-booking, and Tonomo auto-assigns teams. ShootPortal starts with your website&apos;s Book a Shoot form:
            the agent picks services and a preferred date, sees an instant estimate with travel fees, and you propose
            the shoot time, which they accept or counter in one click. See the{" "}
            <BlogLink slug="best-real-estate-photography-booking-software">booking software guide</BlogLink> for more.
          </p>
          <h3>Delivery and payments</h3>
          <p>
            HDPhotoHub&apos;s login-free pages, MLS resizing, and pay-to-download are the bar to clear. ShootPortal
            clears it with Print and MLS-size downloads, ZIPs, share links, and downloads that unlock automatically the
            moment the agent pays by card, Apple Pay, Google Pay, or ACH bank payment, straight into your own Stripe.
          </p>
          <p>
            Rethinking your own package prices at the same time? Our{" "}
            <BlogLink slug="real-estate-photography-pricing-guide">real estate photography pricing guide</BlogLink> walks
            through cost-plus pricing and add-ons.
          </p>
        </>
      ),
    },
    {
      id: "alternatives",
      title: "7 HDPhotoHub alternatives worth comparing",
      tocLabel: "The alternatives",
      body: (ctx) => (
        <>
          <p>
            ShootPortal is our product and our recommendation, so we list it first and flag it clearly. The rest are in
            no particular order.
          </p>

          <ToolCard
            id="hd-alt-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="The flat-priced all-in-one: website, booking, editing, video review, payments, delivery, and listing marketing"
            pricing={
              ctx.studioMonthly ? (
                <>
                  Studio plan: {ctx.studioMonthly}/month{ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}.
                  One plan with every feature. No per-delivery fees, and 0% taken from client payments (Stripe&apos;s
                  standard processing fees apply).{" "}
                  {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Our pick for real estate photographers, drone pilots, and videographers who want HDPhotoHub's delivery and marketing kit at a flat price, plus a website, editing, and video review."
            pros={[
              "Flat price, so busy months don't raise your platform bill",
              "Property website, social posts, Stories, carousel, and print flyer per listing, included free or sold to agents as an add-on",
              "Business website with portfolio, services, and a Book a Shoot form on your own domain",
              "Built-in photo editor with Auto, tone, color, HDR looks, healing, and batch adjustments, saved straight to the gallery",
              "Frame-pinned video comments, threaded replies, and numbered versions, replacing Dropbox Replay or Frame.io",
              "Deposits on approval, then downloads that unlock automatically after the final Stripe payment",
            ]}
            cons={[
              "You propose shoot times and agents accept or counter, which keeps your route in your hands rather than open self-booking",
              "Payments run through Stripe (card, wallets, and optional bank payments) rather than Square",
            ]}
          >
            <p>
              ShootPortal overlaps with HDPhotoHub on delivery and marketing: downloads that unlock after payment, Print
              or MLS (2048px) files, ZIPs, Matterport and Kuula links, and a property website and social kit for every
              listing. It differs in how jobs start, how feedback works, and who pays for the marketing. A job starts on
              your website as a request that becomes a proposal the client approves; the estimate, shoot time,
              messages, review comments, payment, files, and marketing kit all sit on one project; and you decide
              whether the kit is free or a paid add-on. The next section walks through it.
            </p>
          </ToolCard>

          <ToolCard
            id="hd-alt-aryeo"
            name="Aryeo"
            url="https://www.aryeo.com/pricing"
            tagline="Zillow-owned ordering, scheduling, and delivery platform"
            pricing={
              <>
                Lite: free. Pro: $49/mo (100 listings/yr, 1 seat), $99/mo (250, 3 seats), $179/mo (500, 5 seats).{" "}
                <Ext href="https://www.aryeo.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Photographers whose agents use Zillow Showcase."
            pros={["Aryeo says it is the only platform delivering media for Showcase listings", "Free Lite plan with branded delivery pages", "Territories, buffers, and travel fees in scheduling"]}
            cons={["Seats are limited by tier, unlike HDPhotoHub's unlimited team", "Annual listing caps per tier", "Zillow ownership gives some photographers pause"]}
          >
            <p>
              Leaving HDPhotoHub for Aryeo is usually about Showcase, not price. If you&apos;re weighing that move, read{" "}
              <BlogLink slug="best-aryeo-alternatives">our Aryeo alternatives guide</BlogLink> first so you know the
              trade-offs in both directions.
            </p>
          </ToolCard>

          <ToolCard
            id="hd-alt-spiro"
            name="Spiro"
            url="https://www.spiro.media"
            tagline="Per-listing platform with CRM and brokerage billing"
            pricing={
              <>
                $5 per listing, everything included, no subscription.{" "}
                <Ext href="https://www.spiro.media">Official site</Ext>
              </>
            }
            bestFor="Photographers who like per-listing pricing but want marketing included at one price."
            pros={["Property websites and marketing kits included at $5", "Brokerage billing and pay-at-close", "QuickBooks and Xero sync"]}
            cons={["Still scales with volume, like HDPhotoHub", "Trial terms not stated"]}
          />

          <ToolCard
            id="hd-alt-tonomo"
            name="Tonomo"
            url="https://www.tonomo.io/pricing"
            tagline="Operations and dispatch for multi-photographer teams"
            pricing={
              <>
                $140/mo (200 listings/yr) or $250/mo (425 listings, unlimited photographers), billed annually.{" "}
                <Ext href="https://www.tonomo.io/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Growing teams that want auto-assignment and are ready for a fixed monthly cost."
            pros={["Auto-assignment by skill and service area", "Drive-time and travel-fee calculation", "Pay-to-unlock, watermarking, MLS auto-resize"]}
            cons={["Highest entry price here", "Listing caps per plan", "Demo only, no free trial"]}
          />

          <ToolCard
            id="hd-alt-rela"
            name="Rela"
            url="https://www.relahq.com/pricing/photographers"
            tagline="Property websites first, with optional ordering and payments"
            pricing={
              <>
                Starter $49/mo, Pro $99/mo, plus per-site fees; Storefront +$25/mo.{" "}
                <Ext href="https://www.relahq.com/pricing/photographers">Official pricing</Ext>
              </>
            }
            bestFor="Photographers who'd miss HDPhotoHub's Marketing Kit more than its cart."
            pros={["14-day free trial, no card", "Property websites, floor plans, flyers", "White-labeled portal"]}
            cons={["Ordering and payments are an add-on", "Subscription plus per-site fees"]}
          />

          <ToolCard
            id="hd-alt-rtv"
            name="RTV (Real Tour Vision)"
            url="https://realtourvision.com/real-estate-photography-system/"
            tagline="Per-project delivery, 360° tours, and property sites"
            pricing={
              <>
                $6 per project (media only) or $12 with marketing, plus a one-time $99 setup fee.{" "}
                <Ext href="https://realtourvision.com/real-estate-photography-system/">Official site</Ext>
              </>
            }
            bestFor="Tour-focused photographers who want to stay on per-project pricing."
            pros={["360° tour builder and floor plans with hotspots", "Pay-to-download; Stripe, PayPal, Square, QuickBooks", "Free trial, no card"]}
            cons={["Slightly higher per-project price than HDPhotoHub", "FAQ credit pricing differs from plan prices; confirm before buying"]}
          />

          <ToolCard
            id="hd-alt-photofounder"
            name="PhotoFounder"
            url="https://www.photofounder.com"
            tagline="Annual or lifetime license with booking, delivery, and property sites"
            pricing={
              <>
                $1,495/year or $4,495 lifetime (installments available); AI edits billed separately.{" "}
                <Ext href="https://www.photofounder.com">Official site</Ext>
              </>
            }
            bestFor="Established, high-volume businesses that want to stop paying per listing entirely."
            pros={["Agent self-booking with drive-time padding", "Unlimited team, full white-label, net terms", "Property websites and flyers"]}
            cons={["Large upfront commitment", "No free trial (14-day money-back instead)"]}
          />

          <InlineCta
            trialDays={ctx.trialDays}
            title="Get the marketing kit without the per-delivery fee"
            body="Property websites, social kits, and flyers you can sell to agents, plus your website, video review, payments, and delivery, all on one flat ShootPortal plan."
          />
        </>
      ),
    },
    {
      id: "shootportal-for-hdphotohub-users",
      title: "What ShootPortal gives HDPhotoHub users",
      tocLabel: "ShootPortal for HDPhotoHub users",
      body: (ctx) => {
        const price = monthlyPrice(ctx);
        return (
        <>
          <p>
            If you&apos;re considering ShootPortal specifically, here&apos;s what carries over from HDPhotoHub, and what
            you get that a per-delivery listing platform doesn&apos;t give you.
          </p>
          <h3>What carries over</h3>
          <ul>
            <li>Downloads can stay locked until the final payment, while clients can still view the media.</li>
            <li>Print (full-resolution) and MLS (2048px) downloads, one at a time or as a ZIP.</li>
            <li>Matterport, Kuula, and other tour and 3D links, video files, and documents on the same delivery page.</li>
            <li>
              Share links for people without an account, such as an agent&apos;s assistant or stager, including
              email shares with an expiry.
            </li>
            <li>Property websites, social graphics, and print flyers for each listing.</li>
            <li>Unlimited staff accounts, plus your logo, colors, and custom domain on the client portal.</li>
          </ul>
          <Figure caption="Left: the listing photos on the project's Media tab. Right: the finished gallery the agent sees in your branded portal, ready to download in Print or MLS size.">
            <TwoSidedScreens business="project-media" client="portal-gallery" />
          </Figure>
          <h3>What you gain</h3>
          <ul>
            <li>
              <strong>Marketing you can sell.</strong> Set the property website (Modern, Luxury, or Coastal designs, with
              an unbranded MLS-safe version) and the social kit to Included or Paid, with your own price or a bundle.
              The agent previews it, adds it to their cart, and pays through your Stripe. Their headshot, brokerage
              logo, and colors are saved for next time.
            </li>
            <li>
              <strong>Your own website.</strong> Templates, portfolio, services, testimonials, and a Book a Shoot form
              on your domain, with a leads inbox for inquiries.
            </li>
            <li>
              <strong>Jobs start with a request and an estimate.</strong> Clients pick services, enter the address, and
              see a preliminary estimate with a distance-based travel fee right away; you send the official proposal for
              one-click approval.
            </li>
            <li>
              <strong>Feedback is structured.</strong> Clients approve or flag each deliverable with notes, and leave
              time-stamped video comments pinned to the frame across numbered versions. You reply in threads and
              resolve each note, and email notifications are batched so nobody&apos;s inbox floods.
            </li>
            <li>
              <strong>Finals fixed in place.</strong> The built-in photo editor handles exposure, color, crop, HDR looks,
              and spot healing, and Save to Project updates the gallery and downloads instantly.
            </li>
            <li>
              <strong>Every job moves through a pipeline.</strong> Eight stages from new request to delivered, with
              automated branded emails and reminders at each step.
            </li>
          </ul>
          <Figure caption="The Social Media Kit for one listing: a Just Listed post generated from the delivered photos, ready to download or sell to the agent.">
            <AppScreen view="social-kit" />
          </Figure>
          <Figure caption="Conceptual diagram: time-stamped video comments across numbered versions.">
            <VideoReviewDiagram />
          </Figure>
          <h3>Why the record behind the download page matters</h3>
          <p>
            HDPhotoHub&apos;s login-free download page is good at getting files to an agent quickly. What a download page
            can&apos;t show you is the business around it. In real estate that matters because the same agents come back
            week after week, the same addresses come back when listings relist, and the money and the files are
            released at the same moment.
          </p>
          <p>
            In ShootPortal, those all hang off one project and one client record. The agent&apos;s record shows every
            property you&apos;ve shot for them with revenue per address, their lifetime spend, and any outstanding
            balance. The project shows the approved estimate, the confirmed shoot time, the message thread, the review
            status of each file, the marketing kit, and whether the deposit and balance are paid. Clients see the same
            project from their side, in your branding:
          </p>
          <Figure caption="Real ShootPortal screen: a client's view of one ShootPortal project, from approved estimate to shoot, media, payment, and files (sample client data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <BestFitPanel
            heading="When ShootPortal is the right HDPhotoHub alternative"
            fits={[
              {
                who: "Your volume is growing",
                why: (
                  <>
                    {price ? (
                      <>
                        At {ctx.studioMonthly}/month, the Studio plan equals about {Math.ceil(price / 10)} Full
                        Deliveries. Beyond that, extra listings add nothing to your platform bill.
                      </>
                    ) : (
                      <>One flat subscription, so extra deliveries in a busy month add nothing to your platform bill.</>
                    )}
                  </>
                ),
              },
              {
                who: "You want the marketing kit to earn money",
                why: "Property websites and social kits become a paid add-on agents buy in your portal, instead of a per-delivery fee you absorb.",
              },
              {
                who: "Your work doesn't all fit a cart",
                why: "Construction series, commercial aerials, and brand videos get a versioned proposal with travel fees, approved online before you schedule.",
              },
              {
                who: "Video clients ask for revisions",
                why: "Frame-pinned, time-stamped comments on numbered versions replace email threads and a separate review tool.",
              },
            ]}
          />
          <AllInOnePlatform
            title="What one flat ShootPortal plan covers"
            intro="HDPhotoHub charges per delivery for ordering, delivery, and marketing. ShootPortal covers those plus your website, editing, video review, and automation in one subscription."
          />
          <TrialCard
            trialDays={ctx.trialDays}
            title="Run a real month through ShootPortal and compare the bill"
            body={
              <>
                Count last month&apos;s deliveries, then send your next few listings through ShootPortal from request to
                paid and delivered. Turn on the Marketing Kit as a paid add-on and see what agents buy. You&apos;ll know
                quickly whether a flat price beats paying per delivery.
              </>
            }
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
        </>
        );
      },
    },
    {
      id: "how-to-choose",
      title: "Choosing the right HDPhotoHub alternative",
      tocLabel: "How to choose",
      body: () => (
        <>
          <p>
            Start with the reason you&apos;re looking. Here&apos;s how ShootPortal answers the ones HDPhotoHub users
            bring up most.
          </p>
          <PickGrid
            items={[
              {
                who: "High or growing volume",
                pick: "ShootPortal",
                why: "Past the break-even point, every extra delivery is effectively free on the platform side.",
              },
              {
                who: "Marketing kits are your upsell",
                pick: "ShootPortal Marketing Kit",
                why: "Property sites, social posts, and flyers per listing, sold to agents at your price or included free.",
              },
              {
                who: "Seasonal business",
                pick: "ShootPortal, billed monthly",
                why: "One predictable price you can cancel anytime, with marketing add-on sales that rise in your busy season.",
              },
              {
                who: "You also pay for a website builder",
                pick: "ShootPortal Sites",
                why: "Your website, portfolio, and Book a Shoot form are in the same plan.",
              },
              {
                who: "Video clients want revisions",
                pick: "ShootPortal video review",
                why: "Frame-pinned comments, numbered versions, and approvals on the same project as payment.",
              },
              {
                who: "Quoted, non-listing jobs",
                pick: "ShootPortal",
                why: "Proposals, approvals, and pay-before-download work the same for any job type.",
              },
            ]}
          />
          <KeyTakeaways
            items={[
              "Most people who leave HDPhotoHub do so because of volume, job mix, or video revisions, not delivery quality.",
              "Divide any subscription's monthly price by $10 to find its break-even against Full Delivery.",
              "A marketing kit you can sell turns a per-delivery cost into add-on revenue.",
              <>
                For a head-to-head with Aryeo, read{" "}
                <BlogLink slug="shootportal-vs-aryeo-vs-hdphotohub">ShootPortal vs. Aryeo vs. HDPhotoHub</BlogLink>.
              </>,
              <>
                Broader shortlist? See the{" "}
                <BlogLink slug="best-real-estate-photography-software">10 best real estate photography software platforms</BlogLink>.
              </>,
            ]}
          />
          <p>
            The{" "}
            <SiteLink href="/real-estate-photography-software">real estate photography software</SiteLink> page shows the whole request-to-delivery workflow in one place.
          </p>
        </>
      ),
    },
    {
      id: "conclusion",
      title: "Final thoughts",
      body: () => (
        <>
          <p>
            HDPhotoHub&apos;s per-delivery model is easy to start on. The moment to move is when your monthly
            deliveries sit above a subscription&apos;s break-even point, when the Marketing Kit is a cost instead of a
            product, or when more of your work is quoted, revised, and approved rather than added to a cart.
          </p>
          <p>
            Pull your delivery count for the last twelve months, run it through the formula above, and add what you
            spend on a website builder and a review tool. Then run one real listing through ShootPortal. The answer is
            usually obvious once the numbers are on paper.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "How much does HDPhotoHub cost?",
      answerText:
        "HDPhotoHub's pay-as-you-go pricing page lists $5 per Basic Delivery and $10 per Full Delivery in USD, with no monthly subscription. Full Delivery adds the Marketing Kit. Enterprise pricing is custom.",
      answer: (
        <p>
          HDPhotoHub&apos;s <Ext href="https://hdphotohub.com/learn-paygpricing">pay-as-you-go pricing page</Ext> lists $5
          per Basic Delivery and $10 per Full Delivery in USD, with no monthly subscription. Full Delivery adds the
          Marketing Kit. Enterprise pricing is custom.
        </p>
      ),
    },
    {
      question: "Is HDPhotoHub cheaper than a subscription platform?",
      answerText:
        "Only at low volume. Divide a subscription's monthly price by $10 to find how many Full Deliveries it equals, or by $5 for Basic Deliveries. If you regularly deliver more than that each month, the flat subscription costs less on platform fees, before counting any website or review tools it also replaces.",
      answer: (
        <p>
          Only at low volume. Divide a subscription&apos;s monthly price by $10 to find how many Full Deliveries it
          equals, or by $5 for Basic Deliveries. If you regularly deliver more than that each month, the flat
          subscription costs less on platform fees, before counting any website or review tools it also replaces.
        </p>
      ),
    },
    {
      question: "Which HDPhotoHub alternative includes property websites and a marketing kit?",
      answerText:
        "ShootPortal includes a property website for each listing (Modern, Luxury, or Coastal designs), plus social posts, Stories, an Instagram carousel, and a print flyer, in its flat plan. You can include them free or sell them to agents as an add-on. Spiro, Rela, RTV, and PhotoFounder also offer property sites.",
      answer: (
        <p>
          ShootPortal includes a property website for each listing (Modern, Luxury, or Coastal designs), plus social
          posts, Stories, an Instagram carousel, and a print flyer, in its flat plan. You can include them free or sell
          them to agents as an add-on. Spiro, Rela, RTV, and PhotoFounder also offer property sites.
        </p>
      ),
    },
    {
      question: "Does HDPhotoHub charge for extra team members?",
      answerText:
        "No. HDPhotoHub's homepage lists unlimited team members at no extra cost. ShootPortal also includes unlimited staff accounts, with granular permissions, in its flat plan.",
      answer: (
        <p>
          No. HDPhotoHub&apos;s homepage lists unlimited team members at no extra cost. ShootPortal also includes
          unlimited staff accounts, with granular permissions, in its flat plan.
        </p>
      ),
    },
    {
      question: "Can I review video with clients in HDPhotoHub?",
      answerText:
        "HDPhotoHub delivers video and integrates with Vimeo, but its homepage doesn't describe time-stamped review rounds. ShootPortal has built-in video review: clients leave comments pinned to a timestamp and a point on the frame, you reply and resolve them, and each cut is a numbered version, replacing Dropbox Replay or Frame.io.",
      answer: (
        <p>
          HDPhotoHub delivers video and integrates with Vimeo, but its homepage doesn&apos;t describe time-stamped
          review rounds. ShootPortal has built-in video review: clients leave comments pinned to a timestamp and a
          point on the frame, you reply and resolve them, and each cut is a numbered version, replacing Dropbox Replay
          or Frame.io. Our <BlogLink slug="best-photo-video-delivery-platforms">photo and video delivery guide</BlogLink>{" "}
          covers the category.
        </p>
      ),
    },
  ],
  related: ["shootportal-vs-aryeo-vs-hdphotohub", "best-aryeo-alternatives", "best-real-estate-photography-software"],
  cta: {
    title: "Stop paying per delivery. Start selling the marketing kit.",
    body: "Your website, requests, proposals, editing, video review, payments, downloads, and property websites agents can buy, on one flat price under your brand.",
    secondaryHref: "/pricing",
    secondaryLabel: "See pricing",
  },
};
