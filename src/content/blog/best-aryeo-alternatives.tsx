import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  InlineCta,
  PickGrid,
  SiteLink,
  Steps,
  ToolCard,
} from "@/components/blog/article-parts";
import { WorkflowDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";
import { AllInOnePlatform, AppScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "best-aryeo-alternatives",
  title: "7 Best Aryeo Alternatives for Real Estate Photographers in 2026",
  seoTitle: "7 Best Aryeo Alternatives for Photographers (2026)",
  description:
    "Compare 7 Aryeo alternatives on pricing, delivery, payments, property websites, and marketing kits, with pricing checked on official sites.",
  excerpt:
    "Why real estate photographers are moving off Aryeo, what to check before you switch, and seven Aryeo alternatives compared, led by the all-in-one option with property websites and a sellable marketing kit.",
  category: "software-comparisons",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "Aryeo alternatives",
  secondaryKeywords: [
    "Aryeo alternative",
    "apps like Aryeo",
    "Aryeo competitors",
    "Aryeo pricing",
    "leave Aryeo",
    "property website for listings",
    "real estate marketing kit",
    "real estate photography website",
  ],
  readingMinutes: 20,
  cover: { variant: "swap", label: "Switching Guide", alt: "Illustration of two software panels swapping places on a dark indigo background" },
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Best Aryeo alternative overall: ShootPortal</strong> (our product). One flat price with no listing
        caps, and it covers more of the business than Aryeo does: your own website, booking, proposals, scheduling,
        photo editing, video review, payments, and delivery.
      </>,
      <>
        <strong>Property websites and marketing are included.</strong> Every delivered listing can get a property
        website, social posts, Stories, a carousel, and a print flyer, which you include free or sell to the agent as
        a paid add-on.
      </>,
      <>
        <strong>Independent of the listing portals.</strong> Your client list, order history, and agent relationships
        live in a platform branded to you, not one owned by Zillow.
      </>,
      <>
        <strong>The other six alternatives</strong> (HDPhotoHub, Spiro, Tonomo, Rela, Tourbuzz, RTV) each replace one
        part of Aryeo with a different pricing model. They&apos;re profiled below with official pricing.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Aryeo is the default choice for a lot of real estate media businesses: it&apos;s polished, agents recognize it,
        and its free Lite plan makes it easy to start. But since Zillow bought the company in 2023, and as paid tiers
        tie your bill to annual listing counts, more photographers are looking at <strong>Aryeo alternatives</strong>.
      </p>
      <p>
        Our recommendation is <strong>ShootPortal</strong>. It replaces the ordering, delivery, and payments you use
        Aryeo for, and adds the parts most photographers still pay for elsewhere: a business website, a built-in
        photo editor, video review that replaces Dropbox Replay or Frame.io, and per-listing property websites and
        marketing kits you can sell to agents. All on one flat price, under your brand, with agents needing nothing
        but a link.
      </p>
      <p>
        This guide starts with the reasons people give for leaving, covers what to check before you switch, and then
        compares seven alternatives on how they charge and what they do differently. Every competitor price comes from
        the vendor&apos;s own website, checked in October 2026, with a link so you can confirm it.
      </p>
    </>
  ),
  sections: [
    {
      id: "why-photographers-leave",
      title: "Why photographers look for Aryeo alternatives",
      tocLabel: "Why people switch",
      body: () => (
        <>
          <p>
            Search for this topic and you&apos;ll find plenty of strong opinions, many of them published by competing
            vendors. We&apos;ve kept to reasons that are visible on official pages or are openly described as personal
            experience, and we&apos;ve labeled which is which.
          </p>
          <h3>1. Zillow owns the platform</h3>
          <p>
            Zillow announced its acquisition of Aryeo on August 2, 2023, and placed it inside its ShowingTime+ software
            suite (<Ext href="https://www.inman.com/2023/08/02/empowered-with-great-products-zillow-acquires-aryeo/">Inman coverage</Ext>).
            For some photographers that&apos;s a non-issue. For others, it&apos;s uncomfortable to run their client
            relationships, order history, and delivery through software owned by the largest listing portal, a company
            whose business interests won&apos;t always line up with an independent media business. That concern
            appears in several vendor-written comparison pages, such as{" "}
            <Ext href="https://pfretour.com/resources/aryeo-alternatives-for-real-estate-photographers">PFRE Tour&apos;s</Ext>,
            which you should read knowing they sell a competing product.
          </p>
          <h3>2. Paid tiers cap your annual listings</h3>
          <p>
            Aryeo Pro is priced in tiers by annual listing volume and team seats: $49/month for 100 listings a year and
            one team member, $99/month for 250 listings and three members, and $179/month for 500 listings and five
            members (<Ext href="https://www.aryeo.com/pricing">Aryeo pricing</Ext>). That&apos;s a reasonable structure,
            but it means a good year pushes you up a tier, and adding a second shooter can too.
          </p>
          <h3>3. Per-listing tools look cheaper at some volumes</h3>
          <p>
            Several competitors charge only when you deliver. PhotoFounder (another vendor, so read it critically)
            published a <Ext href="https://www.photofounder.com/blog/aryeo-vs-spiro">break-even comparison</Ext> of
            Aryeo&apos;s tiers against Spiro&apos;s $5-per-listing model. The math is simple and worth doing for your
            own volume: a seasonal business that shoots heavily in spring may pay less per job on a per-listing plan,
            while a steady, high-volume business may not.
          </p>
          <h3>4. Individual photographers&apos; experiences (anecdotal)</h3>
          <p>
            One photographer&apos;s{" "}
            <Ext href="https://coleconnor.com/aryeo-vs-spiro-real-estate-photo-delivery/">public write-up</Ext>{" "}
            describes leaving over the jump to a higher tier, discomfort with Zillow ownership, and clients not being
            able to see pricing without entering an address first. Treat that as one person&apos;s account, not a
            survey. It&apos;s also a useful counterexample, because the same photographer later went back to Aryeo,
            which brings us to the other side of the argument.
          </p>
        </>
      ),
    },
    {
      id: "reasons-to-stay",
      title: "What Aryeo does well, and what that's worth to your business",
      tocLabel: "What Aryeo does well",
      body: () => (
        <>
          <p>
            A fair comparison starts with what Aryeo is good at, so you can decide how much each piece matters to your
            own agents.
          </p>
          <ul>
            <li>
              <strong>Zillow Showcase delivery.</strong> Aryeo&apos;s homepage says it is the only platform that delivers
              media for Showcase listings. Before that decides anything, check how many of your agents actually used
              Showcase in the past year. For many independent photographers the answer is a handful of listings.
            </li>
            <li>
              <strong>A free entry plan.</strong> Aryeo Lite is listed at $0 and covers media delivery, branded delivery
              pages, and an agent login portal. It doesn&apos;t give you proposals, video review, a business website, or
              listing marketing you can charge for, so most growing businesses outgrow it.
            </li>
            <li>
              <strong>Zillow-specific extras.</strong> The pricing page lists Zillow 3D Home integration, branding on
              Zillow, and Virtual Staging AI.
            </li>
            <li>
              <strong>Agent familiarity.</strong> Many agents have used Aryeo with other photographers. That matters
              less when the replacement needs no account and no app: in ShootPortal, agents click a link from their
              email and see one page to approve, pay, and download.
            </li>
          </ul>
          <Callout tone="note" title="How long will Showcase exclusivity last?">
            <p>
              Nobody outside Zillow knows. PhotoFounder&apos;s comparison notes there&apos;s no public commitment on how
              long Showcase delivery stays Aryeo-only. Count how many of your agents used it last year, and weigh that
              against what listing caps and a portal-owned vendor cost you the rest of the time.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "before-you-switch",
      title: "What to check before you switch platforms",
      tocLabel: "Before you switch",
      body: () => (
        <>
          <p>
            The software comparison is the easy part. The disruption is in everything that already points at your
            current platform. Work through this list before you cancel anything:
          </p>
          <Steps
            items={[
              {
                title: "Find every delivery link you've already sent",
                body: (
                  <>
                    Agents bookmark galleries, paste them into MLS remarks, and forward them to stagers months later. Ask
                    what happens to existing Aryeo delivery pages if you downgrade to Lite or close the account, and keep
                    Lite running during the transition if you can.
                  </>
                ),
              },
              {
                title: "Export clients and order history",
                body: (
                  <>
                    Get agent names, emails, brokerages, and past orders out in a format you can import. Your client list
                    is the asset; don&apos;t let it stay behind.
                  </>
                ),
              },
              {
                title: "Replace your order form everywhere it lives",
                body: (
                  <>
                    Embedded order forms on your website, links in email signatures, and saved bookmarks on agents&apos;
                    phones all need updating on the same day you switch.
                  </>
                ),
              },
              {
                title: "Plan the agent retraining",
                body: (
                  <>
                    A short email with a screenshot of the new ordering and download steps saves dozens of support texts.
                    Walk your top five agents through their first order personally.
                  </>
                ),
              },
              {
                title: "Rebuild packages, travel fees, and payment rules",
                body: (
                  <>
                    Re-enter your service menu, add-ons, travel fees, and deposit rules, and reconnect your payment
                    processor. Run one test order end to end before going live.
                  </>
                ),
              },
            ]}
          />
          <Figure caption="Conceptual diagram: every stage of the job workflow that has to move to a new platform, not just delivery.">
            <WorkflowDiagram />
          </Figure>
          <ProductCallout title="Switching to ShootPortal takes an afternoon, not a season">
            <p>
              Import your agents from a CSV, start your service menu from a template with &quot;starting at&quot;
              prices, connect Stripe, and set your ZIP-distance travel fees. The guided setup walks you through
              branding and payments, and your new website&apos;s Book a Shoot form replaces the old order-form embed
              in one step.
            </p>
          </ProductCallout>
          <Figure caption="A real estate media business website built in ShootPortal: portfolio, services, and a Book a Shoot button that feeds requests straight into your projects.">
            <AppScreen view="business-website" />
          </Figure>
          <p>
            Pick a quiet month for the move if your market has one. Switching during peak listing season means learning
            new software while agents are waiting on deliveries.
          </p>
          <p>
            Switching is also a good moment to tighten your process. Our guide to{" "}
            <BlogLink slug="real-estate-photography-client-management">managing multiple real estate photography clients</BlogLink>{" "}
            covers agent preferences, property history, and pipeline stages.
          </p>
        </>
      ),
    },
    {
      id: "comparison-table",
      title: "Aryeo alternatives at a glance",
      tocLabel: "Comparison table",
      body: () => (
        <>
          <p>
            Here&apos;s how each alternative compares to Aryeo on the two things most switchers care about: how you pay,
            and what you gain or give up. &quot;Not stated&quot; means the vendor doesn&apos;t say on its official site.
          </p>
          <ComparisonTable
            caption="Aryeo alternatives compared, October 2026"
            columns={["Platform", "How it charges (Oct 2026)", "How jobs come in", "What you gain vs. Aryeo", "What you give up"]}
            rows={[
              ["Aryeo (baseline)", "Free Lite; Pro $49–$179/mo with annual listing caps", "Embeddable order forms with add-ons", "—", "—"],
              [
                "ShootPortal",
                "Flat monthly subscription, no listing caps",
                "Your website and request form, then a proposal the client approves in one click",
                "Property websites and a social kit you can sell; business website; built-in photo editor; frame-pinned video review; client CRM with property history",
                "Showcase delivery; agent self-booking of open slots",
              ],
              ["HDPhotoHub", "$5–$10 per delivery, no subscription", "Shopping cart with add-ons", "No monthly fee, unlimited team members", "Showcase"],
              ["Spiro", "$5 per listing, no subscription", "Custom order pages", "Brokerage billing, pay-at-close", "Showcase"],
              ["Tonomo", "$140 or $250/mo with listing caps", "Branded booking flows", "Auto-assignment and drive-time dispatch", "Showcase; still a capped subscription"],
              ["Rela", "$49 or $99/mo plus per-site fees", "Order form (Storefront add-on)", "Property websites, floor plans, flyers", "Ordering and payments need a +$25/mo add-on"],
              ["Tourbuzz", "Pay per item, no monthly fee", "Online ordering ($0.15/order)", "Unbranded MLS links, native 3D tours", "Predictable monthly cost"],
              ["RTV", "$6–$12 per project", "Booking with real-time availability", "360° tours, pay-to-download, white-label", "Fewer team features confirmed"],
            ]}
            note={
              <>
                Prices from each vendor&apos;s official site, checked October 15, 2026. Showcase availability is based on
                Aryeo&apos;s own statement that it is the only Showcase delivery platform. Confirm current terms through
                the links in each profile below.
              </>
            }
          />
        </>
      ),
    },
    {
      id: "alternatives",
      title: "The 7 best Aryeo alternatives, compared",
      tocLabel: "The 7 alternatives",
      body: (ctx) => (
        <>
          <p>
            ShootPortal is listed first because it&apos;s ours and our recommendation, and we&apos;d rather say so up
            front. The order after that isn&apos;t a ranking; each tool replaces a different slice of Aryeo.
          </p>

          <ToolCard
            rank={1}
            id="alt-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="The all-in-one Aryeo alternative: website, booking, editing, video review, payments, delivery, and listing marketing"
            pricing={
              ctx.studioMonthly ? (
                <>
                  Studio plan: {ctx.studioMonthly}/month{ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}.
                  One plan with every feature. No listing caps or per-listing fees, and 0% taken from client payments
                  (Stripe&apos;s standard processing fees apply).{" "}
                  {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Our pick for real estate photographers, drone pilots, and videographers leaving Aryeo who want one flat price, their own brand, and property websites and marketing kits they can sell."
            pros={[
              "One flat price with no annual listing cap, so a busy spring doesn't push you up a tier",
              "Property website per listing (Modern, Luxury, or Coastal), with an unbranded MLS-safe version and view tracking",
              "Marketing Kit with Just Listed and Open House posts, Stories, an Instagram carousel, and a print flyer, included free or sold as an add-on",
              "Business website builder with portfolio, services, and a Book a Shoot form that creates the project and an instant estimate",
              "Built-in photo editor that saves finals straight to the gallery, plus frame-pinned video review with numbered versions",
              "Deposits on approval, payments into your own Stripe, and Print or MLS downloads that unlock automatically once paid",
            ]}
            cons={[
              "You propose shoot times and agents accept or counter, which keeps your route in your hands rather than open self-booking",
            ]}
          >
            <p>
              Where Aryeo is built around an agent storefront, ShootPortal is built around the whole business. An
              agent finds you on your ShootPortal website, requests a shoot with no account needed, and sees a
              preliminary estimate right away. You send the proposal, they approve it in one click, and you propose a
              shoot time they can accept or counter. After the shoot they review photos and video, pay, and download
              Print (full-resolution) or MLS (2048px) files in the same place.
            </p>
            <p>
              Then comes the part that pays for the subscription. ShootPortal builds a property website for the listing
              from the photos you delivered, with gallery, video, floor plans, virtual tour, open house details, and the
              agent&apos;s contact card, plus a full social media kit and a print flyer with a QR code to the site.
              The agent&apos;s headshot, brokerage logo, and colors are saved on their client record, so the next
              listing&apos;s kit is ready with no extra setup.
            </p>
            <Figure caption="Left: the property website editor, built automatically from the delivered listing photos. Right: the finished property site as buyers see it on their phone.">
              <TwoSidedScreens business="property-website-editor" client="phone-property-website" clientLabel="What buyers see" />
            </Figure>
            <p>
              It also handles the jobs a listing storefront struggles with. A builder asks for twilight photos of a
              model home plus a drone progress video of the subdivision. In ShootPortal it&apos;s one project: the
              estimate (with a ZIP-distance travel fee) is approved online, a deposit is collected on approval, the
              builder comments on the video at the exact second they want changed, and the final files unlock when the
              balance is paid.
            </p>
          </ToolCard>

          <ToolCard
            rank={2}
            id="alt-hdphotohub"
            name="HDPhotoHub"
            url="https://hdphotohub.com/learn-paygpricing"
            tagline="Pay-per-delivery listing platform with ordering, scheduling, and a marketing kit"
            pricing={
              <>
                $5 per Basic Delivery or $10 per Full Delivery (adds the Marketing Kit), USD. No monthly subscription.{" "}
                <Ext href="https://hdphotohub.com/learn-paygpricing">Official pricing</Ext>
              </>
            }
            bestFor="Aryeo users who want to keep a full listing workflow but stop paying a monthly fee."
            pros={[
              "No subscription and no listing tiers",
              "Unlimited team members at no extra cost",
              "Pay to Download, Stripe or Square, deposits, tips, and promo codes",
              "Smart Scheduling with drive time and automatic MLS resizing",
            ]}
            cons={[
              "Cost grows one-for-one with volume",
              "Free trial terms aren't published",
              "No Showcase delivery mentioned",
            ]}
          >
            <p>
              HDPhotoHub is the most direct like-for-like swap: shopping-cart ordering, scheduling, login-free download
              pages, Matterport, iGUIDE, and Zillow 3D embeds, and property sites and flyers in the Full Delivery tier.
              The difference is how you pay. Our{" "}
              <BlogLink slug="best-hdphotohub-alternatives">HDPhotoHub alternatives guide</BlogLink> covers where its
              per-delivery model starts to cost more than a subscription.
            </p>
          </ToolCard>

          <ToolCard
            rank={3}
            id="alt-spiro"
            name="Spiro"
            url="https://www.spiro.media"
            tagline="Per-listing platform with CRM, property websites, and brokerage billing"
            pricing={
              <>
                $5 per listing, &quot;everything included,&quot; no subscription.{" "}
                <Ext href="https://www.spiro.media">Official site</Ext>
              </>
            }
            bestFor="Businesses that bill brokerages or offer pay-at-close and want per-listing pricing."
            pros={[
              "Property websites and marketing kits included in the per-listing price",
              "Brokerage billing and pay-at-close options",
              "Photographer assignment by skill and service area; QuickBooks and Xero sync",
            ]}
            cons={[
              "No Showcase delivery, according to third-party comparisons",
              "\"Start Free\" terms aren't spelled out on the site",
              "Search results mix it up with Spiro.ai, an unrelated sales CRM",
            ]}
          >
            <p>
              Spiro is the alternative photographers most often weigh against Aryeo head to head. It was built by a media
              company for its own use, and its pay-at-close and brokerage billing options are things Aryeo&apos;s pricing
              page doesn&apos;t list.
            </p>
          </ToolCard>

          <ToolCard
            rank={4}
            id="alt-tonomo"
            name="Tonomo"
            url="https://www.tonomo.io/pricing"
            tagline="Operations platform for multi-photographer teams"
            pricing={
              <>
                $140/month (200 listings a year, 1 photographer) or $250/month (425 listings, unlimited photographers,
                white-label), billed annually. <Ext href="https://www.tonomo.io/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Teams where dispatch, drive time, and photographer assignment are the daily headache."
            pros={[
              "Auto-assignment by skills and service area, with drive-time and travel-fee calculation",
              "Two-way Google Calendar sync and per-photographer booking windows",
              "Pay-to-unlock files, watermarking, and MLS auto-resize",
            ]}
            cons={[
              "Still a subscription with annual listing caps, like Aryeo",
              "Demo only, no free trial",
              "Highest entry price in this list",
            ]}
          >
            <p>
              Tonomo doesn&apos;t solve the &quot;subscription with caps&quot; complaint. It solves a different one: if
              your team has outgrown Aryeo&apos;s scheduling, it&apos;s the most operations-focused option here.
            </p>
          </ToolCard>

          <ToolCard
            rank={5}
            id="alt-rela"
            name="Rela"
            url="https://www.relahq.com/pricing/photographers"
            tagline="Property websites and delivery, with an optional storefront"
            pricing={
              <>
                Starter $49/month, Pro $99/month, plus per-property-site fees; Storefront add-on +$25/month for ordering,
                booking, and payments. <Ext href="https://www.relahq.com/pricing/photographers">Official pricing</Ext>
              </>
            }
            bestFor="Photographers whose main upsell to agents is a single-property website."
            pros={["14-day free trial, no credit card", "Property websites, interactive floor plans, and flyers", "White-labeled customer portal"]}
            cons={["Ordering, payments, and lock-until-paid require the Storefront add-on", "Per-site fees on top of the subscription"]}
          />

          <ToolCard
            rank={6}
            id="alt-tourbuzz"
            name="Tourbuzz"
            url="https://www.tourbuzz.com/pricing"
            tagline="Pay-per-item tours, property websites, and delivery"
            pricing={
              <>
                No monthly platform fee. Examples: media delivery $2.50 per order, single-property website $8, online
                orders $0.15 each. <Ext href="https://www.tourbuzz.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Tour-heavy businesses that need branded and unbranded MLS links."
            pros={["Branded and unbranded (MLS-friendly) links", "Native 3D tour and floor plan product", "Full access from day one with no credit card"]}
            cons={["Many small line-item fees make monthly cost harder to forecast", "Hosting fees apply after the first 12 months"]}
          />

          <ToolCard
            rank={7}
            id="alt-rtv"
            name="RTV (Real Tour Vision)"
            url="https://realtourvision.com/real-estate-photography-system/"
            tagline="Per-project delivery, 360° tours, and property sites"
            pricing={
              <>
                $6 per project (media only) or $12 per project with marketing, plus a one-time $99 setup fee for the
                marketing plan. <Ext href="https://realtourvision.com/real-estate-photography-system/">Official site</Ext>
              </>
            }
            bestFor="360° tour photographers who want low per-project pricing and full white-label."
            pros={["Client booking with real-time availability", "Pay-to-download with Stripe, PayPal, or Square", "Custom domain and full white-label; free trial with no card"]}
            cons={["Its FAQ lists credit pricing that differs from the plan prices, so confirm before buying", "Team and dispatch features not confirmed"]}
          />

          <InlineCta
            trialDays={ctx.trialDays}
            title="Want the listing marketing without the listing caps?"
            body="ShootPortal gives you property websites, social kits, and flyers you can sell to agents, plus your website, video review, payments, and delivery, at one flat price."
          />
        </>
      ),
    },
    {
      id: "shootportal-vs-aryeo",
      title: "How ShootPortal compares to Aryeo",
      tocLabel: "ShootPortal vs. Aryeo",
      body: (ctx) => (
        <>
          <p>
            Because we make ShootPortal, here&apos;s a plain account of what changes when you move from Aryeo, for you
            and for your agents.
          </p>
          <h3>What you gain</h3>
          <ul>
            <li>
              <strong>Listing marketing you can charge for.</strong> Property websites and a social media kit (posts,
              Stories, carousel, print flyer) for every delivered listing. You set each product to Included or Paid,
              with your own price, and the agent buys it in their portal through your Stripe or adds it to the invoice.
              An optional &quot;Photography by&quot; credit on each site advertises you to every buyer who visits.
            </li>
            <li>
              <strong>Your own business website.</strong> Modern, Luxury, or Minimal templates with portfolio, services,
              testimonials, and a Book a Shoot form, on your own domain. No separate Squarespace or Wix bill.
            </li>
            <li>
              <strong>Jobs that need a quote.</strong> ShootPortal starts with a request, generates a preliminary
              estimate including a distance-based travel fee, and lets you send a versioned proposal with a PDF. That
              suits aerial, construction, and commercial work that doesn&apos;t fit a listing package.
            </li>
            <li>
              <strong>Video revisions without Dropbox Replay or Frame.io.</strong> Clients leave time-stamped comments
              pinned to a spot on the frame, you reply in threads and resolve notes, and each cut is a numbered
              version, on the same project as the invoice.
            </li>
            <li>
              <strong>Editing without the round-trip.</strong> The built-in photo editor fixes exposure, color, and
              geometry on finals and saves straight back to the gallery.
            </li>
            <li>
              <strong>Volume without tiers.</strong> One flat subscription, no annual listing cap, no seat limits on
              staff accounts.
            </li>
          </ul>
          <Figure caption="The Marketing Kit tab on a listing project: turn on the property website and social kit, choose Included or Paid, and the agent can order it from their portal.">
            <AppScreen view="marketing-kit-tab" />
          </Figure>
          <h3>What your agents get</h3>
          <p>
            One branded link per listing. From it they approve the proposal, accept the shoot time, comment on the
            video, pay by card, Apple Pay, or Google Pay, download MLS or Print sizes, and order the marketing kit.
            There&apos;s no app to install and no account to create before they can see their media.
          </p>
          <Figure caption="Left: the project's payments tab with the deposit and balance. Right: what the agent sees on their phone, one Pay Now button, after which downloads unlock automatically.">
            <TwoSidedScreens business="payments" client="phone-portal-pay" />
          </Figure>
          <h3>Why the business side matters as much as the delivery page</h3>
          <p>
            Aryeo&apos;s agent login portal is useful: agents can find past listings, media, and invoices in one place.
            The difference with ShootPortal is also on <em>your</em> side of the business. Real estate work is repeat
            work, so the questions you ask every week are about the relationship, not the gallery:
          </p>
          <ul>
            <li>
              <strong>&quot;What did we shoot at this address last time?&quot;</strong> Each client record keeps a
              property history with the projects and revenue per address, which helps when a listing relists or a
              builder sends the next phase.
            </li>
            <li>
              <strong>&quot;Does this agent owe us anything?&quot;</strong> Lifetime revenue, outstanding balance, last
              payment, and average project value sit on the client record, next to notes and the message timeline.
            </li>
            <li>
              <strong>&quot;Can I release the files yet?&quot;</strong> Payment status lives on the same project as the
              files, and with download unlock turned on, the agent can preview the media but downloads open after the
              final payment, with no manual check needed.
            </li>
          </ul>
          <Figure caption="Real ShootPortal screen: a ShootPortal client list with project counts, lifetime revenue, and outstanding balance per client (sample client data).">
            <ProductPreview view="clients" />
          </Figure>
          <BestFitPanel
            heading="Leaving Aryeo? ShootPortal is our pick if…"
            fits={[
              {
                who: "Listing caps are the reason you're leaving",
                why: "One flat subscription with no annual listing cap or per-listing fee, so volume growth doesn't change your platform bill.",
              },
              {
                who: "You want to sell listing marketing",
                why: "Property websites, social posts, Stories, and flyers for every listing, at the price you set, paid straight to your Stripe.",
              },
              {
                who: "You shoot listings plus aerial or video",
                why: "Quoted jobs, travel fees, and video revision rounds run through the same project flow as a standard listing.",
              },
              {
                who: "You want clients in your brand, not a portal's",
                why: "Your logo, colors, website, custom domain, and branded emails, in a platform no listing portal owns.",
              },
            ]}
          />
          <AllInOnePlatform
            title="What one ShootPortal subscription replaces"
            intro="Aryeo covers ordering and delivery. ShootPortal also covers the website, editing, video review, and listing marketing you'd otherwise pay for separately."
          />
          <TrialCard
            trialDays={ctx.trialDays}
            title="Send your next listing through ShootPortal"
            body={
              <>
                Keep your old Aryeo delivery links alive while you switch, and run your next new job through
                ShootPortal: proposal, shoot time, review, payment, delivery, and a property website the agent can
                buy. You&apos;ll see it work on real listings before you move a single agent over.
              </>
            }
          />
          <p>
            For a full feature-by-feature breakdown that also includes HDPhotoHub, see{" "}
            <BlogLink slug="shootportal-vs-aryeo-vs-hdphotohub">ShootPortal vs. Aryeo vs. HDPhotoHub</BlogLink>. You can
            also <SiteLink href="/how-it-works">see how ShootPortal&apos;s workflow runs</SiteLink> step by step.
          </p>
          <p>
            See every stage of a listing job in ShootPortal on the{" "}
            <SiteLink href="/real-estate-photography-software">real estate photography software</SiteLink> page.
          </p>
        </>
      ),
    },
    {
      id: "which-alternative",
      title: "Which Aryeo alternative fits your reason for leaving?",
      tocLabel: "Which one fits",
      body: () => (
        <>
          <p>
            Match the alternative to the problem you&apos;re actually trying to solve. Here&apos;s how ShootPortal
            answers the reasons photographers give most often.
          </p>
          <PickGrid
            items={[
              {
                who: "Listing caps keep pushing you up a tier",
                pick: "ShootPortal",
                why: "One flat price with no listing cap, no per-listing fee, and 0% taken from client payments.",
              },
              {
                who: "You don't want Zillow owning your client list",
                pick: "ShootPortal",
                why: "Your agents, order history, and payments live in a platform branded to you, independent of the listing portals.",
              },
              {
                who: "Property websites are your upsell",
                pick: "ShootPortal Marketing Kit",
                why: "Per-listing property sites, social posts, and flyers that agents buy in your portal at your price.",
              },
              {
                who: "You also need a website",
                pick: "ShootPortal Sites",
                why: "Templates, portfolio, services, and a Book a Shoot form on your own domain, in the same plan.",
              },
              {
                who: "Video revisions live in email",
                pick: "ShootPortal video review",
                why: "Frame-pinned comments and numbered versions replace Dropbox Replay or Frame.io.",
              },
              {
                who: "Your work goes beyond listings",
                pick: "ShootPortal",
                why: "Quotes, video review rounds, payments, and delivery work the same for a listing or a commercial aerial job.",
              },
            ]}
          />
          <p>
            Still deciding which category of tool you need at all? Our{" "}
            <BlogLink slug="best-real-estate-photography-software">real estate photography software roundup</BlogLink>{" "}
            covers ten platforms, and the{" "}
            <BlogLink slug="best-real-estate-photography-delivery-software">delivery software comparison</BlogLink> goes
            deeper on download pages and pay-to-download.
          </p>
        </>
      ),
    },
    {
      id: "conclusion",
      title: "Should you leave Aryeo?",
      body: () => (
        <>
          <p>
            If listing caps, Zillow ownership, or paying for a website and review tool on top of Aryeo are wearing on
            you, there&apos;s a better setup. ShootPortal gives you the ordering, delivery, and payments you use Aryeo
            for, plus your own website, a photo editor, video review, and property websites and marketing kits you
            can sell, at one flat price.
          </p>
          <p>
            Do the migration homework first: keep old delivery links alive, export your client list, and run one real
            order through ShootPortal before you announce it to agents. Switching is a weekend of setup; a botched
            switch is a month of support texts.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best alternative to Aryeo?",
      answerText:
        "For most real estate photographers, ShootPortal is the best Aryeo alternative: one flat price with no listing caps, plus a business website, proposals, scheduling, a photo editor, video review, payments, delivery, and per-listing property websites and marketing kits you can sell. HDPhotoHub and Spiro charge per delivery, Tonomo targets multi-photographer dispatch, and Rela centers on property websites.",
      answer: (
        <p>
          For most real estate photographers, ShootPortal is the best Aryeo alternative: one flat price with no
          listing caps, plus a business website, proposals, scheduling, a photo editor, video review, payments,
          delivery, and per-listing property websites and marketing kits you can sell. HDPhotoHub and Spiro charge per
          delivery, Tonomo targets multi-photographer dispatch, and Rela centers on property websites.
        </p>
      ),
    },
    {
      question: "Is Aryeo owned by Zillow?",
      answerText:
        "Yes. Zillow announced its acquisition of Aryeo on August 2, 2023 and placed it in its ShowingTime+ software suite. Aryeo is still sold under its own brand.",
      answer: (
        <p>
          Yes. Zillow announced its acquisition of Aryeo on August 2, 2023 and placed it in its ShowingTime+ software
          suite. Aryeo is still sold under its own brand.
        </p>
      ),
    },
    {
      question: "Can I deliver to Zillow Showcase without Aryeo?",
      answerText:
        "Aryeo states on its homepage that it is the only platform that delivers media for Zillow Showcase listings, and none of the alternatives in this guide claim Showcase delivery. Check how many of your agents actually used Showcase last year before letting it decide your platform.",
      answer: (
        <p>
          Aryeo states on its homepage that it is the only platform that delivers media for Zillow Showcase listings,
          and none of the alternatives in this guide claim Showcase delivery. Check how many of your agents actually
          used Showcase last year before letting it decide your platform.
        </p>
      ),
    },
    {
      question: "Is there an Aryeo alternative with property websites?",
      answerText:
        "Yes. ShootPortal builds a property website for each listing from the delivered photos, in Modern, Luxury, or Coastal designs, with an unbranded MLS-safe version. Its Marketing Kit adds social posts, Stories, an Instagram carousel, and a print flyer. You can include them free or sell them to agents as a paid add-on.",
      answer: (
        <p>
          Yes. ShootPortal builds a property website for each listing from the delivered photos, in Modern, Luxury, or
          Coastal designs, with an unbranded MLS-safe version. Its Marketing Kit adds social posts, Stories, an
          Instagram carousel, and a print flyer. You can include them free or sell them to agents as a paid add-on.
        </p>
      ),
    },
    {
      question: "How much does Aryeo cost in 2026?",
      answerText:
        "Aryeo Lite is free. Aryeo Pro is $49 per month for 100 annual listings and one team member, $99 for 250 listings and three members, and $179 for 500 listings and five members. Enterprise pricing is custom.",
      answer: (
        <p>
          Aryeo Lite is free. Aryeo Pro is $49 per month for 100 annual listings and one team member, $99 for 250
          listings and three members, and $179 for 500 listings and five members. Enterprise pricing is custom. See{" "}
          <Ext href="https://www.aryeo.com/pricing">Aryeo&apos;s pricing page</Ext> for current terms.
        </p>
      ),
    },
    {
      question: "What happens to my old delivery links if I leave Aryeo?",
      answerText:
        "Ask Aryeo before you cancel. Agents often reuse old gallery links for months, so the safest approach is to keep the free Lite plan active during the transition and send new jobs through the new platform.",
      answer: (
        <p>
          Ask Aryeo before you cancel. Agents often reuse old gallery links for months, so the safest approach is to
          keep the free Lite plan active during the transition and send new jobs through the new platform.
        </p>
      ),
    },
  ],
  related: ["shootportal-vs-aryeo-vs-hdphotohub", "best-hdphotohub-alternatives", "best-real-estate-photography-software"],
  cta: {
    title: "Leave the listing caps behind, keep the listing marketing.",
    body: "Your website, agent requests, proposals, shoot times, video revisions, payments, downloads, and sellable property websites, all on one flat price under your brand.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
