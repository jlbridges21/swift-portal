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

export const article: BlogArticle = {
  slug: "best-aryeo-alternatives",
  title: "7 Best Aryeo Alternatives for Real Estate Photographers in 2026",
  seoTitle: "7 Best Aryeo Alternatives for Photographers (2026)",
  description:
    "Thinking of leaving Aryeo? Compare 7 Aryeo alternatives on pricing model, delivery, payments, and Showcase trade-offs, with pricing checked on official sites.",
  excerpt:
    "Why some real estate photographers are moving off Aryeo, what you give up if you do, and seven alternatives compared on how they charge and what they do better.",
  category: "software-comparisons",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "Aryeo alternatives",
  secondaryKeywords: [
    "Aryeo alternative",
    "apps like Aryeo",
    "Aryeo competitors",
    "Aryeo pricing",
    "leave Aryeo",
  ],
  readingMinutes: 16,
  cover: { variant: "swap", label: "Switching Guide", alt: "Illustration of two software panels swapping places on a dark indigo background" },
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Agents depend on Zillow Showcase?</strong> Stay on Aryeo. Aryeo says it is the only platform that
        delivers media for Showcase listings, and none of the alternatives below claim otherwise.
      </>,
      <>
        <strong>Leaving because of listing caps?</strong> HDPhotoHub ($5–$10 per delivery) and Spiro ($5 per listing)
        charge per job with no subscription at all.
      </>,
      <>
        <strong>Running a multi-photographer team?</strong> Tonomo is the closest operations-first replacement, at a
        higher monthly price.
      </>,
      <>
        <strong>Selling tours and property sites?</strong> Rela, Tourbuzz, and RTV are built around them.
      </>,
      <>
        <strong>Want a flat price and a workflow that also fits aerial, video, and commercial jobs?</strong> That&apos;s
        where ShootPortal (our product) fits, with the caveat that it has no Showcase delivery or property websites.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Aryeo is the default choice for a lot of real estate media businesses, and for good reason: it&apos;s polished,
        agents recognize it, and its free Lite plan makes it easy to start. But &quot;default&quot; isn&apos;t the same
        as &quot;right for every business,&quot; and since Zillow bought the company in 2023, more photographers have
        been asking whether it&apos;s still the right fit for theirs.
      </p>
      <p>
        This guide is for photographers who already know Aryeo and are weighing a move. We start with the reasons
        people give for looking elsewhere (and the strong reason many stay), then cover what actually breaks when you
        switch, and only then compare seven <strong>Aryeo alternatives</strong> on how they charge and what they do
        differently.
      </p>
      <p>
        Every price below comes from the vendor&apos;s own website, checked in October 2026, with a link so you can
        confirm it. Where a vendor doesn&apos;t publish something, we say so rather than guess.
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
      title: "The case for staying on Aryeo",
      tocLabel: "Reasons to stay",
      body: () => (
        <>
          <p>
            Before you migrate anything, be honest about what Aryeo does that the alternatives don&apos;t.
          </p>
          <ul>
            <li>
              <strong>Zillow Showcase delivery.</strong> Aryeo&apos;s homepage says it is the only platform that delivers
              media for Showcase listings. That&apos;s Aryeo&apos;s own claim, but we didn&apos;t find any alternative
              in this list claiming Showcase delivery. In the anecdote above, a client asking for Showcase was the reason
              the photographer returned.
            </li>
            <li>
              <strong>A genuinely free plan.</strong> Aryeo Lite is listed at $0, &quot;Free Forever,&quot; and includes
              media delivery, branded delivery pages, an agent login portal, and Showcase delivery. If cost is your only
              complaint and you mostly need delivery, dropping from Pro to Lite may be the cheapest &quot;alternative&quot;
              of all.
            </li>
            <li>
              <strong>Zillow-specific extras.</strong> The pricing page lists Zillow 3D Home integration, branding on
              Zillow, and Virtual Staging AI. If agents in your market value those, no competitor replicates them.
            </li>
            <li>
              <strong>Agent familiarity.</strong> Many agents have used Aryeo with other photographers. Familiar order
              forms mean fewer &quot;how do I download this?&quot; messages.
            </li>
          </ul>
          <Callout tone="note" title="How long will Showcase exclusivity last?">
            <p>
              Nobody outside Zillow knows. PhotoFounder&apos;s comparison notes there&apos;s no public commitment on how
              long Showcase delivery stays Aryeo-only. If Showcase is your main reason to stay, check how many of your
              agents actually used it in the past year before deciding either way.
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
                    Re-enter your service menu, add-ons, deposit rules, and tax settings, and reconnect your payment
                    processor. Run one test order end to end before going live.
                  </>
                ),
              },
            ]}
          />
          <Figure caption="Conceptual diagram: every stage of the job workflow that has to move to a new platform, not just delivery.">
            <WorkflowDiagram />
          </Figure>
          <p>
            Pick a quiet month for the move if your market has one. Switching during peak listing season means learning
            new software while agents are waiting on deliveries.
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
            columns={["Platform", "How it charges (Oct 2026)", "What you gain vs. Aryeo", "What you give up"]}
            rows={[
              ["Aryeo (baseline)", "Free Lite; Pro $49–$179/mo with annual listing caps", "—", "—"],
              ["ShootPortal", "Flat monthly subscription, no listing caps", "Custom estimates, video review, client CRM", "Showcase, property websites"],
              ["HDPhotoHub", "$5–$10 per delivery, no subscription", "No monthly fee, unlimited team members", "Showcase"],
              ["Spiro", "$5 per listing, no subscription", "Brokerage billing, pay-at-close", "Showcase"],
              ["Tonomo", "$140 or $250/mo with listing caps", "Auto-assignment and drive-time dispatch", "Showcase; still a capped subscription"],
              ["Rela", "$49 or $99/mo plus per-site fees", "Property websites, floor plans, flyers", "Ordering and payments need a +$25/mo add-on"],
              ["Tourbuzz", "Pay per item, no monthly fee", "Unbranded MLS links, native 3D tours", "Predictable monthly cost"],
              ["RTV", "$6–$12 per project", "360° tours, pay-to-download, white-label", "Fewer team features confirmed"],
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
            ShootPortal is listed first because it&apos;s ours and we&apos;d rather say so up front. The order after that
            isn&apos;t a ranking; each tool fits a different reason for leaving Aryeo.
          </p>

          <ToolCard
            rank={1}
            id="alt-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="Flat-priced request, estimate, review, payment, and delivery workspace"
            pricing={
              ctx.studioMonthly ? (
                <>
                  Studio plan: {ctx.studioMonthly}/month{ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}.
                  No listing caps. {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Photographers leaving Aryeo who also shoot aerial, video, or commercial jobs and want one price regardless of volume."
            pros={[
              "One flat price with no annual listing cap",
              "Estimates with versions and ZIP-based travel fees for jobs that aren't a standard package",
              "Time-stamped video comments pinned to the frame, with numbered versions",
              "Payments go to your own Stripe account, with optional deposits and download unlock after payment",
            ]}
            cons={[
              "No Zillow Showcase delivery",
              "No property websites, flyers, or marketing kits",
              "You propose shoot times and clients respond; agents can't self-book an open slot",
            ]}
          >
            <p>
              Where Aryeo is built around an agent storefront, ShootPortal is built around the project. Clients submit a
              request from your branded portal, you send an estimate they approve online, then you propose a shoot time
              they can accept or counter. After the shoot, they review photos and video, pay, and download Print
              (full-resolution) or MLS (2048px) files in the same place. If you&apos;re leaving Aryeo mainly because
              your work has drifted beyond listings, that structure fits better. If your agents rely on Showcase or
              property sites, it doesn&apos;t.
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
            title="Leaving Aryeo because of listing caps?"
            body="ShootPortal is one flat price however many jobs you deliver. Run a real job through it, from request to paid and delivered, before you decide."
            trialDays={ctx.trialDays}
          />
        </>
      ),
    },
    {
      id: "shootportal-vs-aryeo",
      title: "How ShootPortal compares to Aryeo, honestly",
      tocLabel: "ShootPortal vs. Aryeo",
      body: () => (
        <>
          <p>
            Because we make ShootPortal, here&apos;s a plain account of where it&apos;s a better fit than Aryeo and where
            it isn&apos;t.
          </p>
          <h3>Where ShootPortal is the better fit</h3>
          <ul>
            <li>
              <strong>Jobs that need a quote.</strong> Aryeo&apos;s ordering is storefront-style: products, add-ons, and
              a checkout. ShootPortal starts with a request, can generate a preliminary estimate including a
              distance-based travel fee, and lets you send an official estimate with versions and a PDF. That suits
              aerial, construction, and commercial work that doesn&apos;t fit a listing package.
            </li>
            <li>
              <strong>Video revisions.</strong> Clients leave time-stamped comments pinned to a spot on the frame, you
              reply in threads, and each cut is a numbered version. Aryeo doesn&apos;t advertise an equivalent.
            </li>
            <li>
              <strong>Client history.</strong> Each client record shows notes, a message timeline, property history,
              lifetime revenue, and outstanding balance.
            </li>
            <li>
              <strong>Volume without tiers.</strong> One flat subscription, no annual listing cap.
            </li>
          </ul>
          <h3>Where Aryeo is the better fit</h3>
          <ul>
            <li>
              <strong>Showcase and Zillow extras.</strong> ShootPortal doesn&apos;t deliver to Showcase and has no Zillow
              integrations.
            </li>
            <li>
              <strong>Listing marketing.</strong> ShootPortal has no property websites, flyers, or marketing kits.
            </li>
            <li>
              <strong>Self-booking.</strong> Aryeo&apos;s order forms let agents order on their own. In ShootPortal you
              propose times and the client accepts, declines, or counter-proposes.
            </li>
            <li>
              <strong>Zero cost.</strong> Aryeo Lite is free. ShootPortal is a paid subscription after the trial.
            </li>
          </ul>
          <p>
            For a full feature-by-feature breakdown that also includes HDPhotoHub, see{" "}
            <BlogLink slug="shootportal-vs-aryeo-vs-hdphotohub">ShootPortal vs. Aryeo vs. HDPhotoHub</BlogLink>. You can
            also <SiteLink href="/how-it-works">see how ShootPortal&apos;s workflow runs</SiteLink> step by step.
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
            Match the alternative to the problem you&apos;re actually trying to solve. Swapping platforms without a clear
            reason usually just trades one set of annoyances for another.
          </p>
          <PickGrid
            items={[
              {
                who: "You only need delivery and want to cut cost",
                pick: "Aryeo Lite",
                why: "Downgrading may beat switching: Lite is free and keeps Showcase delivery.",
              },
              {
                who: "You want no monthly fee at all",
                pick: "HDPhotoHub or Spiro",
                why: "Both charge only per delivery or listing, so slow months cost almost nothing.",
              },
              {
                who: "You run several photographers",
                pick: "Tonomo",
                why: "Auto-assignment and drive-time dispatch are its core, not an add-on.",
              },
              {
                who: "Property websites are your upsell",
                pick: "Rela",
                why: "It's built around single-property sites, floor plans, and flyers.",
              },
              {
                who: "Tours and unbranded MLS links matter most",
                pick: "Tourbuzz or RTV",
                why: "Both have native tour products and per-item or per-project pricing.",
              },
              {
                who: "Your work goes beyond listings",
                pick: "ShootPortal",
                why: "Quotes, video review rounds, and delivery work the same for a listing or a commercial aerial job.",
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
            If a meaningful number of your agents list on Showcase, probably not, or at least not yet. If your
            frustration is listing caps or Zillow ownership and your agents don&apos;t care about Showcase, you have
            good options with very different pricing models, and the right one depends on your volume and the kind of
            work you shoot.
          </p>
          <p>
            Whichever way you lean, do the migration homework first: keep old delivery links alive, export your client
            list, and run one real order through the new platform before you announce it to agents. Switching is a
            weekend of setup; a botched switch is a month of support texts.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best alternative to Aryeo?",
      answerText:
        "It depends on why you're leaving. HDPhotoHub and Spiro suit photographers who want per-delivery pricing, Tonomo suits multi-photographer teams, Rela suits property-website businesses, and ShootPortal suits photographers who want a flat price and also shoot aerial, video, or commercial work.",
      answer: (
        <p>
          It depends on why you&apos;re leaving. HDPhotoHub and Spiro suit photographers who want per-delivery pricing,
          Tonomo suits multi-photographer teams, Rela suits property-website businesses, and ShootPortal suits
          photographers who want a flat price and also shoot aerial, video, or commercial work.
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
        "Aryeo states on its homepage that it is the only platform that delivers media for Zillow Showcase listings. None of the alternatives in this guide claim Showcase delivery.",
      answer: (
        <p>
          Aryeo states on its homepage that it is the only platform that delivers media for Zillow Showcase listings.
          None of the alternatives in this guide claim Showcase delivery, so if your agents need it, Aryeo (including
          the free Lite plan) is the safe choice.
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
    title: "Outgrown a listing storefront?",
    body: "ShootPortal handles requests, estimates, scheduling, video review, payments, and delivery in one branded portal, for one flat monthly price.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
