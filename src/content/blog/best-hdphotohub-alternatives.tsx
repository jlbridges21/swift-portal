import type { BlogArticle, BlogRenderContext } from "@/lib/blog/types";
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
import { ToolCategoryMap, VideoReviewDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, TrialCard } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";

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
    "Weighing HDPhotoHub alternatives? See when pay-per-delivery stops being cheapest, and compare 7 platforms on booking, payments, delivery, and client management.",
  excerpt:
    "HDPhotoHub's pay-per-delivery model is great until volume climbs or your work stops fitting a listing cart. Here's the break-even math and the platforms worth comparing.",
  category: "software-comparisons",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "HDPhotoHub alternatives",
  secondaryKeywords: [
    "HDPhotoHub alternative",
    "HDPhotoHub pricing",
    "HDPhotoHub competitors",
    "pay per delivery vs subscription",
  ],
  readingMinutes: 16,
  cover: { variant: "layers", label: "Alternatives Guide", alt: "Illustration of layered software panels on a dark indigo background" },
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Happy with pay-per-delivery?</strong> HDPhotoHub is hard to beat: no monthly fee, unlimited team
        members, pay-to-download, and MLS resizing for $5–$10 per delivery.
      </>,
      <>
        <strong>Delivering many listings every month?</strong> A flat subscription can cost less once your monthly
        deliveries pass the break-even point. We show the math below.
      </>,
      <>
        <strong>Need Zillow Showcase?</strong> Aryeo, which says it is the only Showcase delivery platform.
      </>,
      <>
        <strong>Want per-listing pricing with brokerage billing?</strong> Spiro, at $5 per listing.
      </>,
      <>
        <strong>Quoting custom jobs, running video review rounds, or delivering above the break-even?</strong>{" "}
        ShootPortal (our product) is our pick: one flat price, estimates, frame-pinned video review, and
        pay-before-download in one branded portal. It has no marketing kit or property websites.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        HDPhotoHub has a loyal following among real estate photographers, and it&apos;s easy to see why. There&apos;s no
        subscription to justify in a slow January, the team is unlimited, and agents get a clean download page that
        doesn&apos;t make them log in. For a lot of businesses, it&apos;s the right tool and there&apos;s no reason to
        switch.
      </p>
      <p>
        The photographers who do look at <strong>HDPhotoHub alternatives</strong> usually aren&apos;t unhappy with the
        software. They&apos;ve grown into a different shape: more deliveries per month than the per-delivery model
        rewards, more non-listing work that doesn&apos;t fit a shopping cart, or more video clients asking for revision
        rounds. This guide is about those situations.
      </p>
      <p>
        We cover what HDPhotoHub does well, when its pricing stops being the cheapest option (with arithmetic you can
        check), and seven platforms worth comparing. Pricing is from official vendor pages as of October 2026.
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
            listing. That&apos;s a strength until it isn&apos;t.
          </p>
          <h3>Costs scale one-for-one with volume</h3>
          <p>
            Per-delivery pricing is perfect in a slow month and gets more expensive in exactly the months you&apos;re
            busiest. Twice the listings means twice the platform bill. A flat subscription works the other way: the
            more you deliver, the less each delivery costs you.
          </p>
          <h3>The Marketing Kit doubles the per-delivery price</h3>
          <p>
            Full Delivery is $10 against $5 for Basic. If agents expect property sites and flyers with every listing,
            that&apos;s money well spent. If only some agents use them, you may be paying for a kit on listings where
            nobody opens it, or managing two delivery types.
          </p>
          <h3>Non-listing work doesn&apos;t fit a cart</h3>
          <p>
            A shopping cart is ideal for &quot;photos plus drone plus twilight&quot; on a standard listing. It&apos;s
            less natural for a construction progress series, a commercial aerial survey, or a brand video where the
            price depends on scope and travel. Photographers doing more of that work tend to want estimates they can
            adjust, version, and have approved before scheduling.
          </p>
          <h3>Video clients want revision rounds</h3>
          <p>
            HDPhotoHub delivers video files and connects to Vimeo, but its homepage doesn&apos;t describe a
            frame-accurate review workflow. If you cut brand or event videos as well as listing reels, you may be
            juggling a separate review tool and email threads for feedback on each version.
          </p>
          <Figure caption="Conceptual diagram: where delivery-first platforms and business-operations platforms overlap, and the gaps each tends to leave.">
            <ToolCategoryMap
              columns={[
                {
                  title: "Listing delivery & marketing",
                  examples: "e.g. HDPhotoHub, Rela, RTV",
                  covers: ["Cart ordering", "Pay-to-download", "MLS resizing", "Property sites & flyers"],
                  gaps: ["Adjustable estimates", "Video revision rounds"],
                },
                {
                  title: "Project-based operations",
                  examples: "e.g. ShootPortal",
                  covers: ["Requests & estimates", "Client CRM", "Video review", "Payments & delivery"],
                  gaps: ["Property sites", "Marketing kits", "Showcase"],
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
              This is the question that actually decides most switches, so here&apos;s the arithmetic. The table compares
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
                  Excludes payment processing fees, add-ons, and any listing caps a subscription might have. A flat
                  subscription that doesn&apos;t include property sites isn&apos;t a like-for-like match for Full Delivery.
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
                  At ShootPortal&apos;s current Studio price of {ctx.studioMonthly}/month, the break-even is about{" "}
                  {Math.ceil(price / 5)} Basic Deliveries a month. Below that, HDPhotoHub costs less; above it, the flat
                  plan does.
                </>
              ) : null}
            </p>
            <p>
              Two caveats keep this honest. First, seasonality matters: if you deliver 40 listings in May and 4 in
              December, per-delivery pricing follows your revenue down, which a subscription doesn&apos;t. Second, the
              platform fee is rarely your biggest cost. If switching saves $50 a month but costs agents a familiar
              download page, it may not be worth it.
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
            booking, payments, and delivery extras. &quot;Not stated&quot; means we couldn&apos;t confirm it on the
            vendor&apos;s official site.
          </p>
          <ComparisonTable
            caption="HDPhotoHub alternatives feature comparison, October 2026"
            columns={["Platform", "Pricing model", "How jobs come in", "Client records", "Pay-to-download", "Property sites / kit", "Team members"]}
            rows={[
              ["HDPhotoHub", "$5–$10 per delivery", "Shopping cart", "Profiles with order history, client pricing", <Yes key="a" />, <Yes key="b">Full Delivery</Yes>, "Unlimited, no extra cost"],
              [
                "ShootPortal",
                "Flat monthly",
                "Request + estimate",
                "Notes, message timeline, property history, lifetime revenue, balance",
                <Yes key="c">Optional</Yes>,
                <No key="d" />,
                "Staff accounts with permissions",
              ],
              ["Aryeo", "Free Lite; Pro $49–$179/mo", "Order forms", "Agent login portal with past listings and invoices", "Not stated", "Not stated", "1, 3, or 5 seats by tier"],
              ["Spiro", "$5 per listing", "Custom order pages", "Client CRM", "Not stated", <Yes key="e" />, "Not stated"],
              ["Tonomo", "$140 or $250/mo", "Booking flows", "Not stated", <Yes key="f" />, <Yes key="g">Marketing kit editor</Yes>, "1 or unlimited by plan"],
              ["Rela", "$49 or $99/mo + per-site fees", "Storefront add-on", "Not stated", <Yes key="h">With add-on</Yes>, <Yes key="i" />, "Staff accounts on Pro"],
              ["RTV", "$6–$12 per project", "Real-time booking", "Not stated", <Yes key="j" />, <Yes key="k" />, "Not stated"],
              ["PhotoFounder", "$1,495/yr or $4,495 lifetime", "Agent self-booking", "Not stated", "Not stated", <Yes key="l" />, "Unlimited"],
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
            HDPhotoHub keeps client profiles with order history and special pricing. If you want more of a CRM, with
            notes, a message timeline, and lifetime revenue per client, Spiro and ShootPortal go further. Our{" "}
            <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink> covers dedicated options.
          </p>
          <h3>Booking</h3>
          <p>
            HDPhotoHub&apos;s cart plus Smart Scheduling is strong for standard listings. Agents who want to pick a time
            slot themselves will find similar self-booking in RTV and PhotoFounder; teams that need auto-assignment
            should look at Tonomo. See the{" "}
            <BlogLink slug="best-real-estate-photography-booking-software">booking software guide</BlogLink> for more.
          </p>
          <h3>Delivery and payments</h3>
          <p>
            HDPhotoHub&apos;s login-free pages, MLS resizing, and pay-to-download are the bar to clear. Most
            alternatives match pay-to-download; fewer match its range of payment options (Square, tips, promo codes).
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
            ShootPortal is our product, so we list it first and flag it clearly. The rest are in no particular order;
            each fits a different reason for moving.
          </p>

          <ToolCard
            id="hd-alt-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="Flat-priced client portal from request and estimate to review, payment, and delivery"
            pricing={
              ctx.studioMonthly ? (
                <>
                  Studio plan: {ctx.studioMonthly}/month{ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}.
                  No per-delivery fees; Stripe&apos;s standard processing fees apply.{" "}
                  {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Our pick for photographers delivering above the break-even point, and anyone mixing listings with quoted aerial, video, or commercial jobs."
            pros={[
              "Flat price, so busy months don't raise your platform bill",
              "Adjustable estimates with versions, PDFs, expiry dates, and ZIP-based travel fees",
              "Deposits on approval, then downloads that unlock after the final Stripe payment",
              "Frame-pinned, time-stamped video comments with threaded replies and numbered versions",
              "Client CRM with notes, property history, lifetime revenue, and outstanding balance",
              "Email-invite share links with expiry for assistants or stagers who don't have an account",
            ]}
            cons={[
              "No Marketing Kit equivalent: no property sites, flyers, or social graphics",
              "No drive-time scheduling; clients respond to times you propose",
              "Stripe only; no Square, tips, or promo codes",
            ]}
          >
            <p>
              ShootPortal overlaps with HDPhotoHub on delivery: unlock downloads after payment, Print or MLS (2048px)
              downloads, ZIPs, and Matterport, Kuula, and other 3D embeds. It differs in how jobs start and how feedback
              works. Instead of a cart, a job starts as a request that becomes an estimate the client approves; instead
              of a download page, the client signs in to a portal where the estimate, shoot time, messages, review
              comments, payment, and files all sit on one project. The next section walks through it.
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

        </>
      ),
    },
    {
      id: "shootportal-for-hdphotohub-users",
      title: "What ShootPortal adds, and what it doesn't, for HDPhotoHub users",
      tocLabel: "ShootPortal for HDPhotoHub users",
      body: (ctx) => {
        const price = monthlyPrice(ctx);
        return (
        <>
          <p>
            If you&apos;re considering ShootPortal specifically, here&apos;s where it lines up with what you&apos;re used
            to and where it&apos;s genuinely different.
          </p>
          <h3>What carries over</h3>
          <ul>
            <li>Downloads can stay locked until the final payment, while clients can still view the media.</li>
            <li>Print (full-resolution) and MLS (2048px) downloads, one at a time or as a ZIP.</li>
            <li>Matterport and other 3D embeds, Kuula 360 tours, video files, YouTube embeds, and documents.</li>
            <li>
              Share links for people without an account, such as an agent&apos;s assistant or stager, including
              email-invite shares with an expiry.
            </li>
            <li>Your logo, colors, and custom domain on the client portal.</li>
          </ul>
          <h3>What&apos;s different</h3>
          <ul>
            <li>
              <strong>Jobs start with a request and an estimate.</strong> Clients pick a service, enter the address, and
              get a preliminary estimate with a distance-based travel fee; you send the official estimate for approval.
            </li>
            <li>
              <strong>Feedback is structured.</strong> Clients approve or reject each deliverable with written notes, and
              leave time-stamped video comments pinned to the frame across numbered versions.
            </li>
            <li>
              <strong>Every job moves through a pipeline.</strong> Eight stages from new request to delivered, so you can
              see what&apos;s shot, in review, or awaiting payment.
            </li>
          </ul>
          <Figure caption="Conceptual diagram: time-stamped video comments across numbered versions.">
            <VideoReviewDiagram />
          </Figure>
          <h3>Why the record behind the download page matters</h3>
          <p>
            HDPhotoHub&apos;s login-free download page is excellent for getting files to an agent quickly. What a
            download page can&apos;t show you is the business around it. In real estate that matters because the same
            agents come back week after week, the same addresses come back when listings relist, and the money and the
            files are released at the same moment.
          </p>
          <p>
            In ShootPortal, those all hang off one project and one client record. The agent&apos;s record shows every
            property you&apos;ve shot for them with revenue per address, their lifetime spend, and any outstanding
            balance. The project shows the approved estimate, the confirmed shoot time, the message thread, the review
            status of each file, and whether the deposit and balance are paid. Clients see the same project from their
            side, in your branding:
          </p>
          <Figure caption="Product illustration: a client's view of one ShootPortal project, from approved estimate to shoot, media, payment, and files (demo data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <BestFitPanel
            heading="When ShootPortal is the right HDPhotoHub alternative"
            fits={[
              {
                who: "You're past the break-even every month",
                why: (
                  <>
                    {price ? (
                      <>
                        At {ctx.studioMonthly}/month, the Studio plan equals about {Math.ceil(price / 5)} Basic
                        Deliveries. Beyond that, extra jobs add nothing to your platform bill.
                      </>
                    ) : (
                      <>One flat subscription, so extra deliveries in a busy month add nothing to your platform bill.</>
                    )}
                  </>
                ),
              },
              {
                who: "Your work doesn't all fit a cart",
                why: "Construction series, commercial aerials, and brand videos get a versioned estimate with travel fees, approved online before you schedule.",
              },
              {
                who: "Video clients ask for revisions",
                why: "Frame-pinned, time-stamped comments on numbered versions replace email threads and a separate review tool.",
              },
              {
                who: "You want to see the business, not just the deliveries",
                why: "An eight-stage pipeline plus client records with property history and outstanding balances, in one place.",
              },
            ]}
            notFor={[
              <>Your volume is low or very seasonal; per-delivery pricing will usually cost less.</>,
              <>Agents expect property sites, flyers, and social graphics with every listing.</>,
              <>You rely on Square, tips, promo codes, or drive-time Smart Scheduling.</>,
            ]}
          />
          <h3>What you&apos;d lose</h3>
          <p>
            Be clear-eyed about this. ShootPortal has no Marketing Kit (property sites, flyers, social graphics, reels,
            or traffic reports), no drive-time Smart Scheduling, no client self-booking into open slots, no Square, tips,
            or promo codes, no QuickBooks sync, and no native app-store app. If those are central to how you sell to
            agents, HDPhotoHub or another listing platform remains the better fit. You can{" "}
            <SiteLink href="/how-it-works">walk through ShootPortal&apos;s workflow</SiteLink> to judge for yourself.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Check the break-even against a real month"
            body={
              <>
                Count last month&apos;s deliveries, then run your next few jobs through ShootPortal from request to paid
                and delivered. You&apos;ll know whether a flat price and a project-based portal beat paying per
                delivery for the way you actually work.
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
          <PickGrid
            items={[
              {
                who: "Low or seasonal volume",
                pick: "Stay on HDPhotoHub",
                why: "Per-delivery pricing follows your revenue down in slow months. That's hard to beat.",
              },
              {
                who: "High, steady volume",
                pick: "A flat subscription",
                why: "Past the break-even point, every extra delivery is effectively free on the platform side.",
              },
              {
                who: "Agents ask for Showcase",
                pick: "Aryeo",
                why: "Aryeo says it is the only Showcase delivery platform; Lite is free.",
              },
              {
                who: "Marketing kits are your upsell",
                pick: "Spiro or Rela",
                why: "Spiro includes them per listing; Rela is built around property sites.",
              },
              {
                who: "Several photographers to dispatch",
                pick: "Tonomo",
                why: "Auto-assignment and drive time are core features.",
              },
              {
                who: "Quoted jobs and video revisions",
                pick: "ShootPortal (our pick)",
                why: "Estimates, approvals, frame-pinned video review, and pay-before-download in the same project as delivery.",
              },
            ]}
          />
          <KeyTakeaways
            items={[
              "HDPhotoHub is a strong platform; most people who leave do so because of volume or job mix, not quality.",
              "Divide any subscription's monthly price by $5 to find its break-even against Basic Delivery.",
              "Compare like for like: a subscription without property sites isn't the same product as Full Delivery.",
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
            HDPhotoHub&apos;s model rewards small and seasonal businesses, and its feature set is mature. The moment to
            reconsider is when your monthly deliveries sit comfortably above a subscription&apos;s break-even point, or
            when more of your work is quoted, revised, and approved rather than added to a cart.
          </p>
          <p>
            Pull your delivery count for the last twelve months, run it through the formula above, and look honestly at
            which features your agents actually use. The answer is often obvious once the numbers are on paper.
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
        "At low volume, usually yes. Divide a subscription's monthly price by $5 to find how many Basic Deliveries it equals. If you regularly deliver more than that each month, the flat subscription costs less on platform fees.",
      answer: (
        <p>
          At low volume, usually yes. Divide a subscription&apos;s monthly price by $5 to find how many Basic Deliveries
          it equals. If you regularly deliver more than that each month, the flat subscription costs less on platform
          fees.
        </p>
      ),
    },
    {
      question: "Which HDPhotoHub alternative includes property websites?",
      answerText:
        "Spiro includes property websites and marketing kits in its $5 per-listing price. Rela, RTV, and PhotoFounder also offer property sites. ShootPortal does not build property websites.",
      answer: (
        <p>
          Spiro includes property websites and marketing kits in its $5 per-listing price. Rela, RTV, and PhotoFounder
          also offer property sites. ShootPortal doesn&apos;t build property websites.
        </p>
      ),
    },
    {
      question: "Does HDPhotoHub charge for extra team members?",
      answerText:
        "No. HDPhotoHub's homepage lists unlimited team members at no extra cost, which is one of its biggest advantages over seat-limited subscription plans.",
      answer: (
        <p>
          No. HDPhotoHub&apos;s homepage lists unlimited team members at no extra cost, which is one of its biggest
          advantages over seat-limited subscription plans.
        </p>
      ),
    },
    {
      question: "Can I review video with clients in HDPhotoHub?",
      answerText:
        "HDPhotoHub delivers video and integrates with Vimeo, but its homepage doesn't describe time-stamped review rounds. If you need frame-accurate feedback across versions, a platform with built-in video review, such as ShootPortal, is worth comparing.",
      answer: (
        <p>
          HDPhotoHub delivers video and integrates with Vimeo, but its homepage doesn&apos;t describe time-stamped review
          rounds. If you need frame-accurate feedback across versions, compare platforms with built-in video review;
          our <BlogLink slug="best-photo-video-delivery-platforms">photo and video delivery guide</BlogLink> covers them.
        </p>
      ),
    },
  ],
  related: ["shootportal-vs-aryeo-vs-hdphotohub", "best-aryeo-alternatives", "best-real-estate-photography-software"],
  cta: {
    title: "One flat price, however busy the month gets.",
    body: "Requests, estimates, shoot times, video revisions, payments, and downloads on one project, in a client portal with your logo, colors, and domain. No per-delivery fees.",
    secondaryHref: "/pricing",
    secondaryLabel: "See pricing",
  },
};
