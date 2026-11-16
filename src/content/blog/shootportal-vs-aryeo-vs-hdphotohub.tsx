import type { BlogArticle, BlogRenderContext } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  InlineCta,
  No,
  PickGrid,
  SiteLink,
  Yes,
} from "@/components/blog/article-parts";
import { BookingFlowDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";
import { AllInOnePlatform, AppScreen, TwoSidedScreens } from "@/components/blog/app-screen";

/** Parses "$59" → 59 so the annual-cost row tracks live pricing. Null when unavailable. */
function monthlyPrice(ctx: BlogRenderContext): number | null {
  if (!ctx.studioMonthly) return null;
  const n = Number(ctx.studioMonthly.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const article: BlogArticle = {
  slug: "shootportal-vs-aryeo-vs-hdphotohub",
  title: "ShootPortal vs. Aryeo vs. HDPhotoHub: Which Platform Is Best for Real Estate Photographers?",
  seoTitle: "ShootPortal vs. Aryeo vs. HDPhotoHub (2026 Comparison)",
  description:
    "Aryeo vs HDPhotoHub vs ShootPortal: pricing at 100–500 listings, booking, delivery, video review, property websites, and marketing kits, side by side.",
  excerpt:
    "Three platforms, three pricing models. A side-by-side look at Aryeo, HDPhotoHub, and ShootPortal on price, booking, delivery, video review, and listing marketing, and why ShootPortal covers the most ground.",
  category: "software-comparisons",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "Aryeo vs HDPhotoHub",
  secondaryKeywords: [
    "ShootPortal vs Aryeo",
    "ShootPortal vs HDPhotoHub",
    "real estate photography software comparison",
    "HDPhotoHub vs Aryeo",
    "property website for listings",
    "real estate marketing kit",
    "Dropbox Replay alternative",
  ],
  readingMinutes: 17,
  cover: { variant: "versus", label: "Head to Head", alt: "Illustration of three software panels facing off on a dark indigo background" },
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>ShootPortal</strong> (our product) is our pick of the three. It&apos;s the only one with your own
        business website, quoted proposals, a built-in photo editor, and frame-pinned video review, alongside
        payments, delivery, and a property website and marketing kit for every listing, at one flat price with no
        listing caps.
      </>,
      <>
        <strong>Aryeo</strong> is Zillow-owned, with a free Lite plan for delivery and Showcase delivery for Zillow
        listings. Paid tiers cap annual listings and team seats.
      </>,
      <>
        <strong>HDPhotoHub</strong> charges $5–$10 per delivery with unlimited team members. Its Marketing Kit doubles
        the per-delivery price; in ShootPortal you can sell the kit to agents instead.
      </>,
      <>
        <strong>On cost:</strong> per-delivery pricing is cheapest only at low volume. A flat plan pulls ahead as you
        grow, and further when it replaces your website builder and video review tool.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        <strong>Aryeo vs HDPhotoHub</strong> is the comparison most real estate photographers start with, and adding
        ShootPortal makes it three philosophies, not three versions of the same product. Aryeo is a listing storefront
        with deep Zillow ties. HDPhotoHub is a pay-as-you-go listing platform with marketing built in. ShootPortal is
        an all-in-one business platform that runs everything from your website to the listing&apos;s marketing kit,
        for listings, aerial, and video work alike.
      </p>
      <p>
        That&apos;s why comparisons that only line up delivery checkboxes miss the point. This one goes dimension by
        dimension (pricing, booking, client management, delivery and payments, video review, marketing, team, and
        branding), then says plainly where each lands.
      </p>
      <p>
        We make ShootPortal, so we&apos;ve tried to be specific. Competitor facts come from Aryeo&apos;s and
        HDPhotoHub&apos;s official sites as of October 2026, and &quot;Not stated&quot; means the vendor doesn&apos;t
        say, not that the feature is missing.
      </p>
    </>
  ),
  sections: [
    {
      id: "at-a-glance",
      title: "The three platforms at a glance",
      tocLabel: "At a glance",
      body: () => (
        <>
          <h3>Aryeo: the Zillow-connected storefront</h3>
          <p>
            Aryeo gives agents branded order forms, handles scheduling and delivery, and connects to Zillow features
            including Zillow 3D Home, Virtual Staging AI, and Showcase. Zillow acquired Aryeo in 2023 and placed it in
            its ShowingTime+ suite. Its Lite plan is free; Pro adds advanced scheduling, payroll and invoicing,
            reporting, a marketing center, and the Aryeo Go mobile app.
          </p>
          <h3>HDPhotoHub: pay-per-delivery with a marketing kit</h3>
          <p>
            HDPhotoHub, around since 2017, covers ordering, Smart Scheduling, delivery, and payments, and charges only
            when you deliver. Its Full Delivery tier adds property sites, flyers, social graphics, video reels, and a
            weekly traffic report. Teams are unlimited at no extra cost.
          </p>
          <h3>ShootPortal: the all-in-one platform for every job type</h3>
          <p>
            ShootPortal runs the whole job under your brand. Agents find you on your ShootPortal website and request a
            shoot; they see an instant estimate, approve your proposal in one click, and accept the shoot time you
            propose. After the shoot you polish finals in the built-in editor, collect frame-pinned feedback on video,
            get paid into your own Stripe, and deliver Print or MLS files. Then ShootPortal builds a property website,
            social posts, and a print flyer for the listing, which you include or sell to the agent. It was built by a
            drone business owner, so it handles listings, aerials, and commercial video the same way.
          </p>
        </>
      ),
    },
    {
      id: "pricing",
      title: "Pricing: subscription tiers vs. per delivery vs. flat",
      tocLabel: "Pricing",
      body: (ctx) => {
        const price = monthlyPrice(ctx);
        const spAnnual = price ? usd(price * 12) : "See pricing";
        return (
          <>
            <p>
              The three pricing models behave very differently as you grow, so start with the published numbers:
            </p>
            <ul>
              <li>
                <strong>Aryeo</strong> (<Ext href="https://www.aryeo.com/pricing">official pricing</Ext>): Lite is free.
                Pro is $49/month for 100 annual listings and 1 team member, $99/month for 250 listings and 3 members, or
                $179/month for 500 listings and 5 members. Enterprise is custom. No self-serve trial is stated; Pro is
                sold through a demo.
              </li>
              <li>
                <strong>HDPhotoHub</strong> (<Ext href="https://hdphotohub.com/learn-paygpricing">official pricing</Ext>):
                $5 per Basic Delivery or $10 per Full Delivery (with the Marketing Kit), USD. No monthly subscription.
              </li>
              <li>
                <strong>ShootPortal</strong>:{" "}
                {ctx.studioMonthly ? (
                  <>
                    Studio plan at {ctx.studioMonthly}/month{ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null},
                    one plan with every feature, no listing caps or per-delivery fees, and 0% taken from client payments
                  </>
                ) : (
                  <>
                    one flat monthly plan with every feature, no listing caps or per-delivery fees (see{" "}
                    <SiteLink href="/pricing">current pricing</SiteLink>)
                  </>
                )}
                .{ctx.trialDays > 0 ? <> {ctx.trialDays}-day free trial, no credit card.</> : null}
              </li>
            </ul>
            <p>Here&apos;s what a year of platform fees looks like at three volumes:</p>
            <ComparisonTable
              caption="Illustrative annual platform cost by listings delivered per year"
              columns={["Listings per year", "Aryeo Pro (lowest tier that fits)", "HDPhotoHub Basic", "HDPhotoHub Full", "ShootPortal (monthly plan)"]}
              highlightColumn={4}
              rows={[
                ["100", "$588 ($49 tier)", "$500", "$1,000", spAnnual],
                ["250", "$1,188 ($99 tier)", "$1,250", "$2,500", spAnnual],
                ["500", "$2,148 ($179 tier)", "$2,500", "$5,000", spAnnual],
              ]}
              note={
                <>
                  Simple arithmetic from published prices, for illustration only. Excludes payment processing fees,
                  add-ons, and Aryeo&apos;s free Lite plan (which covers delivery only). Aryeo tiers also limit team
                  seats, so a larger team may need a higher tier than volume alone suggests. The closest like-for-like
                  match is HDPhotoHub Full against ShootPortal, since both include property sites and flyers.
                </>
              }
            />
            <p>
              The pattern: per-delivery pricing is cheapest only at low volume, Aryeo&apos;s tiers stay competitive as
              long as you fit the listing and seat limits, and a flat plan pulls ahead the more you deliver. The gap
              widens once you count the tools a flat ShootPortal plan replaces (a website builder and a review tool like
              Dropbox Replay or Frame.io), and the marketing kits you can sell to agents. For a monthly break-even
              formula, see our <BlogLink slug="best-hdphotohub-alternatives">HDPhotoHub alternatives guide</BlogLink>.
            </p>
          </>
        );
      },
    },
    {
      id: "feature-table",
      title: "Aryeo vs HDPhotoHub vs ShootPortal: feature comparison table",
      tocLabel: "Feature table",
      body: (ctx) => (
        <>
          <p>
            The full side-by-side. ShootPortal is highlighted because it&apos;s ours, and because it covers the most
            rows from website to listing marketing.
          </p>
          <ComparisonTable
            caption="ShootPortal vs. Aryeo vs. HDPhotoHub feature comparison, October 2026"
            columns={["Feature", "ShootPortal", "Aryeo", "HDPhotoHub"]}
            highlightColumn={1}
            rows={[
              ["Pricing model", "Flat monthly, every feature, 0% of payments", "Free Lite; Pro $49–$179/mo with listing caps", "$5–$10 per delivery"],
              [
                "Free option / trial",
                ctx.trialDays > 0 ? `${ctx.trialDays}-day trial, no card` : "Free trial",
                <Yes key="r2a">Free Lite plan</Yes>,
                "Free account; trial terms not stated",
              ],
              ["Business website builder", <Yes key="r3a">Templates, portfolio, Book a Shoot form, custom domain</Yes>, "Not stated", "Not stated"],
              ["How jobs come in", "Book a Shoot form with instant preliminary estimate", "Embeddable order forms with add-ons", "Shopping cart with dependent add-ons"],
              ["Scheduling", "You propose times; client accepts or counters; pushes to Google Calendar", "Territories, booking limits, buffers", "Smart Scheduling with drive time"],
              ["Travel fees", "ZIP-to-ZIP distance tiers or per-mile", "Percentage, flat, or by distance/time", "Not stated"],
              ["Project pipeline", "8 stages, request to delivered", "Content dashboard; reporting on Pro", "Not stated"],
              ["Automated branded emails", <Yes key="r5a">At every stage, with reminders</Yes>, "Not stated", "Not stated"],
              ["Client records", "Notes, timeline, property history, lifetime revenue", "Agent login portal", "Profiles with order history, client pricing"],
              ["Proposal approval online", <Yes key="r6a">Versioned, with PDF and expiry</Yes>, "Not stated", "Not stated"],
              ["Property history per address", <Yes key="r6b">Projects and revenue per address</Yes>, "Not stated", "Not stated"],
              ["Client messaging on the job", <Yes key="r6c">Two-way, on the project</Yes>, "Not stated", "Not stated"],
              ["Built-in photo editor", <Yes key="r7a">Auto, tone, color, HDR looks, healing, batch</Yes>, "Not stated", "Not stated"],
              ["Media delivery", "Print + MLS (2048px), ZIP, video, 3D and tour links", "Delivery center, branded delivery pages", "Login-free pages, MLS resizing, 3D embeds"],
              ["Approve / request changes per file", <Yes key="r8b">With written feedback</Yes>, "Not stated", "Not stated"],
              ["Sharing with people who have no account", <Yes key="r8c">View links; email shares with expiry</Yes>, "Not stated", <Yes key="r8d">Login-free download pages</Yes>],
              ["Pay-to-download", <Yes key="r9a">Optional, unlocks on payment</Yes>, "Not stated", <Yes key="r9c" />],
              ["Payment processors", "Stripe (your own account): card, Apple Pay, Google Pay, optional ACH", "Payment integrations (not itemized)", "Stripe or Square"],
              ["Deposits", <Yes key="r11a" />, <Yes key="r11b" />, <Yes key="r11c" />],
              ["Tips / promo codes", <No key="r12a" />, <Yes key="r12b">Promo codes</Yes>, <Yes key="r12c" />],
              ["Video review", <Yes key="r13a">Frame-pinned comments, numbered versions</Yes>, "Not stated", "Not stated"],
              ["Property websites", <Yes key="r14a">Per listing, Modern/Luxury/Coastal, MLS-safe version</Yes>, "Marketing center (Pro)", <Yes key="r14c">Full Delivery</Yes>],
              ["Social graphics and flyers", <Yes key="r14d">Posts, Stories, carousel, print flyer</Yes>, "Not stated", <Yes key="r14e">Full Delivery</Yes>],
              ["Sell marketing to agents as an add-on", <Yes key="r14f">Your price, paid to your Stripe</Yes>, "Not stated", "Not stated"],
              ["Zillow Showcase delivery", <No key="r15a" />, <Yes key="r15b">Aryeo says it&apos;s the only one</Yes>, <No key="r15c">Not offered</No>],
              ["Team", "Unlimited staff accounts, granular permissions", "1, 3, or 5 seats by Pro tier", "Unlimited, no extra cost"],
              ["Branding", "Logo, colors, custom domains for portal, website, and property sites", "Branded delivery pages; branded app add-on", "White-label mobile app (one-time fee)"],
              ["Accounting sync", <No key="r18a">Payouts in your own Stripe</No>, "Payroll and invoicing (Pro)", <Yes key="r18c">QuickBooks</Yes>],
            ]}
            note={
              <>
                Competitor details from{" "}
                <Ext href="https://www.aryeo.com/pricing">Aryeo</Ext> and{" "}
                <Ext href="https://hdphotohub.com/learn-paygpricing">HDPhotoHub</Ext> official pages, checked October 15,
                2026. &quot;Not stated&quot; means we couldn&apos;t confirm it on the official site. HDPhotoHub&apos;s
                Showcase status reflects Aryeo&apos;s claim to be the only Showcase delivery platform.
              </>
            }
          />
          <InlineCta
            trialDays={ctx.trialDays}
            title="One platform for every row in that table"
            body="Website, booking, proposals, editing, video review, payments, delivery, and listing marketing you can sell, at one flat price. Run your next listing through ShootPortal and compare."
          />
          <p>
            Pricing your own services rather than the software? See the{" "}
            <BlogLink slug="real-estate-photography-pricing-guide">real estate photography pricing guide</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "booking-and-scheduling",
      title: "Booking and scheduling",
      tocLabel: "Booking & scheduling",
      body: () => (
        <>
          <p>
            This is where the three philosophies differ most, and where your client mix shows up.
          </p>
          <h3>Aryeo and HDPhotoHub: the agent orders</h3>
          <p>
            Both are built for agents ordering standard packages. Aryeo&apos;s{" "}
            <Ext href="https://www.aryeo.com/products/orders">order forms</Ext> support a product catalog, add-ons,
            multiple appointments per order, promo codes, and payment upfront, as a deposit, or on delivery. Its{" "}
            <Ext href="https://www.aryeo.com/products/scheduling">scheduling</Ext> adds territories, per-member booking
            limits, and travel-time buffers. HDPhotoHub&apos;s shopping cart suggests add-ons based on what&apos;s
            already in the order, and Smart Scheduling factors in drive time and job duration.
          </p>
          <h3>ShootPortal: the client requests from your website, you stay in control</h3>
          <p>
            In ShootPortal, booking starts on your own website. The agent clicks Book a Shoot and fills in the
            property, services from your catalog, a preferred date, and notes, with no account needed. They see a
            preliminary estimate the moment they submit, including a travel fee by ZIP distance, and the request
            creates the client record and the project automatically. You send the official proposal; once it&apos;s
            approved, you propose a shoot time and the client accepts or counters in one click. Shoots push to your
            Google Calendar, and your Google events show read-only in ShootPortal so you can spot conflicts.
          </p>
          <Figure caption="Left: your service catalog with starting prices. Right: the Book a Shoot form agents fill in on their phone, which turns your catalog into an instant estimate.">
            <TwoSidedScreens business="services" client="phone-request-form" clientLabel="What the agent sees" />
          </Figure>
          <Figure caption="Conceptual diagram: ShootPortal's request-to-schedule flow.">
            <BookingFlowDiagram />
          </Figure>
          <p>
            Proposing times keeps your route and your day in your hands, and it works just as well for a standard
            listing as for a quoted aerial or commercial job. Our{" "}
            <BlogLink slug="best-real-estate-photography-booking-software">booking software guide</BlogLink> compares
            more scheduling approaches.
          </p>
        </>
      ),
    },
    {
      id: "clients-and-projects",
      title: "Client management and project tracking",
      tocLabel: "Clients & projects",
      body: () => (
        <>
          <p>
            Knowing where every job stands, and what every client has bought from you, is the second biggest difference.
          </p>
          <ul>
            <li>
              <strong>Aryeo</strong> gives agents a login portal and you a content dashboard; Pro adds a reporting
              dashboard and payroll. How deep its client records go isn&apos;t spelled out on the pricing page.
            </li>
            <li>
              <strong>HDPhotoHub</strong> keeps client profiles with order history and supports special pricing per
              client, which is handy for brokerage deals. Payroll visibility helps with paying team members.
            </li>
            <li>
              <strong>ShootPortal</strong> keeps a fuller CRM record: contact details, company, notes, a message
              timeline, property history with revenue per address, lifetime revenue, average project value, last
              payment, and outstanding balance. Every project moves through eight pipeline stages from new request to
              delivered, and clients message you on the project rather than by text.
            </li>
          </ul>
          <p>
            The more agents, builders, and commercial clients you serve, the more that depth pays off. The{" "}
            <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink> goes further on this.
          </p>
          <h3>Why this matters more in real estate than in most photography</h3>
          <p>
            Real estate media runs on repeat business. The same agent books you again next week, the same house comes
            back when it relists, and every delivery is waiting on a payment. That changes what &quot;management&quot;
            means:
          </p>
          <ul>
            <li>
              <strong>Repeat orders.</strong> When an agent&apos;s usual package, past jobs, notes, message history, and
              even their brokerage logo for marketing kits are on one record, the tenth booking takes less work than the
              first.
            </li>
            <li>
              <strong>Property history.</strong> Looking up an address and seeing what you shot there, and what you
              charged, keeps relist and next-phase quotes consistent.
            </li>
            <li>
              <strong>Payment-linked delivery.</strong> If the payment status and the files are on the same project, you
              don&apos;t have to cross-check an invoicing app before releasing downloads. In ShootPortal, an
              &quot;unlock downloads after payment&quot; option does that check for you, and the project can move to
              Delivered once the balance is paid.
            </li>
          </ul>
          <p>
            In practice, that&apos;s the difference between asking &quot;where are we on this job?&quot; across four
            apps and opening one pipeline:
          </p>
          <Figure caption="Real ShootPortal screen: ShootPortal's project pipeline with jobs moving from request to delivered (sample client data).">
            <ProductPreview view="projects" />
          </Figure>
          <ProductCallout title="The follow-ups run themselves">
            <p>
              Workflow automation sends branded emails at each stage (proposal, shoot time, deliverables, payment
              request, receipt), reminds clients who haven&apos;t approved or paid after 24 hours, 3 days, or 7 days,
              and moves the project forward when the payment lands.
            </p>
          </ProductCallout>
          <Figure caption="Workflow Automation settings: choose which emails, reminders, and stage changes run on their own, so you stop chasing approvals and payments by hand.">
            <AppScreen view="automation" />
          </Figure>
        </>
      ),
    },
    {
      id: "delivery-payments-review",
      title: "Delivery, payments, and video review",
      tocLabel: "Delivery & payments",
      body: (ctx) => (
        <>
          <h3>Delivery</h3>
          <p>
            All three handle photos, video, and 3D embeds. HDPhotoHub offers login-free download pages with automatic
            MLS resizing and Matterport, iGUIDE, and Zillow 3D embeds. Aryeo offers branded delivery pages and a download
            center, and is the route to Showcase. ShootPortal offers Print (full-resolution) or MLS (2048px) downloads,
            single or ZIP, resumable uploads for large files, Matterport, Kuula, Polycam, and other tour links, client
            favorites on photos, and share links for people without an account. Finals can be touched up in the
            built-in photo editor first, and saving updates the gallery instantly.
          </p>
          <h3>Payments</h3>
          <p>
            HDPhotoHub supports Pay to Download, Stripe or Square, deposits, tax, tips, and promo codes. Aryeo supports
            upfront payment, deposits, invoicing on delivery, promo codes, and automatic tax. ShootPortal uses Stripe
            Connect, so payments land in your own Stripe account with no cut taken by ShootPortal. Agents pay by card,
            Apple Pay, Google Pay, or optional ACH from a pay link that opens without logging in, deposits are created
            automatically on approval, and downloads unlock the moment the final payment clears.
          </p>
          <h3>Video review</h3>
          <p>
            This is ShootPortal&apos;s clearest advantage, and it replaces the Dropbox Replay or Frame.io subscription
            many video shooters pay for on the side. Clients leave time-stamped comments pinned to a spot on the frame,
            you reply in threads and mark notes resolved, and each cut is a numbered version (V1, V2, Latest). Clients
            approve or request changes on each deliverable, notifications are batched so nobody&apos;s inbox floods,
            and it all sits on the same project as the invoice and delivery, with no per-user add-on. Neither Aryeo nor
            HDPhotoHub describes an equivalent on its official pages; HDPhotoHub connects to Vimeo for video hosting.
          </p>
          <Figure caption="Left: a listing film on version 2 with the agent's time-stamped comments, your replies, and Resolve buttons. Right: what the agent sees on their phone, watching the cut and pinning notes to the exact moment.">
            <TwoSidedScreens business="video-review" client="phone-video-review" />
          </Figure>
          <Callout tone="tip" title="Even quick listing reels benefit">
            <p>
              A one-pass listing reel still gets a &quot;can we swap the opening shot?&quot; now and then. When that
              comment lands on the frame instead of in a text thread, the fix takes minutes. For brand, construction,
              or event videos with real revision rounds, it saves hours. See our{" "}
              <BlogLink slug="best-photo-video-delivery-platforms">photo and video delivery comparison</BlogLink>.
            </p>
          </Callout>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Test the review-to-delivery flow yourself"
            body={
              <>
                Upload a real listing video, leave a frame-pinned comment as your client would, post version 2, request
                the balance, and watch the download unlock, all in one ShootPortal project.
              </>
            }
            secondaryHref="/#product-demo"
            secondaryLabel="Watch the demo"
          />
        </>
      ),
    },
    {
      id: "marketing-team-branding",
      title: "Marketing, Showcase, team, and branding",
      tocLabel: "Marketing, team & branding",
      body: () => (
        <>
          <h3>Property websites and listing marketing</h3>
          <p>
            HDPhotoHub&apos;s Full Delivery bundles property sites, flyers, social graphics, reels, and a weekly traffic
            report for $10 per delivery, a cost you carry on every listing. Aryeo Pro lists a marketing center.
            ShootPortal&apos;s Marketing Kit builds a property website for each listing from the delivered photos
            (Modern, Luxury, or Coastal designs, with an unbranded MLS-safe version and view tracking), plus five
            square posts, three Stories, an Instagram carousel, and a print-ready flyer with a QR code to the site.
          </p>
          <p>
            The difference is who pays. In ShootPortal you set each product to Included or Paid, with your own price
            or a bundle. The agent previews it, adds it to their cart, and pays through your Stripe or on the invoice,
            and their headshot, brokerage logo, and colors are saved for the next listing. An optional &quot;Photography
            by&quot; credit on each property site advertises you to every buyer who visits.
          </p>
          <Figure caption="A ShootPortal property website for a single listing: gallery, key facts, and agent contact, built automatically from the delivered photos.">
            <AppScreen view="property-website" />
          </Figure>
          <h3>Zillow Showcase</h3>
          <p>
            Aryeo is the only one of the three with Showcase delivery; Aryeo says it&apos;s the only platform anywhere
            that offers it.
          </p>
          <h3>Team</h3>
          <p>
            HDPhotoHub and ShootPortal both include unlimited team members at no extra cost; Aryeo Pro tiers include
            one, three, or five seats. ShootPortal adds about 25 granular permissions with presets like Editor,
            Coordinator, and Full access except money, and lets you assign staff to specific projects.
          </p>
          <h3>Branding</h3>
          <p>
            All three put your brand in front of clients in different ways. Aryeo offers branded delivery pages and a
            branded mobile app add-on. HDPhotoHub offers a white-label iOS and Android app for a one-time configuration
            fee. ShootPortal brands everything the client touches: your business website, the client portal, emails
            (optionally sent from your own domain), checkout, and property websites, each on your own custom domain,
            and an installable web app for your team under your business&apos;s name and icon.
          </p>
        </>
      ),
    },
    {
      id: "strengths-and-limitations",
      title: "Strengths and limitations of each platform",
      tocLabel: "Strengths & limitations",
      body: () => (
        <>
          <h3>Aryeo</h3>
          <ul>
            <li><strong>Strengths:</strong> Showcase delivery, a free Lite plan, Zillow integrations, and agent familiarity.</li>
            <li>
              <strong>Limitations:</strong> annual listing caps and seat limits per tier; no self-serve Pro trial; Zillow
              ownership is a concern for some independent photographers (see our{" "}
              <BlogLink slug="best-aryeo-alternatives">Aryeo alternatives guide</BlogLink>).
            </li>
          </ul>
          <h3>HDPhotoHub</h3>
          <ul>
            <li>
              <strong>Strengths:</strong> no subscription, unlimited team, the Marketing Kit, Pay to Download, Square and
              Stripe, and QuickBooks.
            </li>
            <li>
              <strong>Limitations:</strong> costs rise one-for-one with volume, the Marketing Kit doubles the
              per-delivery price, trial terms aren&apos;t published, video revision rounds aren&apos;t described, and
              cart ordering suits listings more than quoted work.
            </li>
          </ul>
          <h3>ShootPortal</h3>
          <ul>
            <li>
              <strong>Strengths:</strong> the widest coverage of the three: business website, request-and-proposal
              workflow with travel fees, built-in photo editor, frame-pinned video review, a full client CRM, an
              8-stage pipeline with automation, payments to your own Stripe, and property websites and marketing kits
              you can sell, all at one flat price.
            </li>
            <li>
              <strong>Trade-offs:</strong> no Showcase delivery, and you propose shoot times rather than agents
              self-booking open slots, which keeps your schedule in your control.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "verdict",
      title: "Which platform should you choose?",
      tocLabel: "Verdict",
      body: (ctx) => (
        <>
          <p>
            For most real estate photographers, drone pilots, and videographers, ShootPortal is the strongest choice
            of the three: it does what Aryeo and HDPhotoHub do for delivery and payments, and adds the website,
            editing, video review, and sellable marketing that both leave to other tools.
          </p>
          <PickGrid
            items={[
              {
                who: "You want one platform, not five",
                pick: "ShootPortal",
                why: "Website, booking, proposals, editing, video review, payments, delivery, and listing marketing on one subscription.",
              },
              {
                who: "You sell property sites and flyers",
                pick: "ShootPortal",
                why: "Agents buy the property website and social kit in your portal at your price, instead of you paying $10 per delivery for it.",
              },
              {
                who: "High, steady volume",
                pick: "ShootPortal",
                why: "One flat price, no caps, so the cost per job keeps falling.",
              },
              {
                who: "A growing team on a budget",
                pick: "ShootPortal",
                why: "Unlimited staff accounts with permission presets, at no extra cost.",
              },
              {
                who: "Listings plus aerial, video, or commercial",
                pick: "ShootPortal",
                why: "Proposals, video revision rounds, and delivery work the same for every job type.",
              },
              {
                who: "You only want a free delivery page",
                pick: "Aryeo Lite",
                why: "It covers delivery only; you'd still need separate tools for quotes, review, your website, and marketing.",
              },
            ]}
          />
          <BestFitPanel
            heading="Choose ShootPortal over Aryeo and HDPhotoHub if you are…"
            fits={[
              {
                who: "A solo shooter with a mixed book",
                why: "Listings, aerial, video, and commercial jobs all start on your website, become an approved proposal, and end as a paid, delivered project.",
              },
              {
                who: "Ready to sell listing marketing",
                why: "Property websites, social posts, Stories, and flyers per listing, priced by you and paid straight to your Stripe.",
              },
              {
                who: "Delivering steady volume year-round",
                why: "One flat subscription without listing caps or per-delivery fees, so the cost per job falls as you grow.",
              },
              {
                who: "Running real video revision rounds",
                why: "Time-stamped comments pinned to the frame, threaded replies, and numbered versions, on the same project as payment.",
              },
            ]}
          />
          <AllInOnePlatform
            title="Everything Aryeo and HDPhotoHub split across tools, in one platform"
            intro="One ShootPortal subscription covers your website, booking, editing, video review, payments, delivery, and listing marketing."
          />
          <TrialCard
            trialDays={ctx.trialDays}
            title="Put one real listing through all three steps that matter"
            body={
              <>
                Book it from your ShootPortal website, get the proposal approved and the balance paid, deliver the
                photos and video, then offer the agent a property website and social kit. Compare that with your
                current setup.
              </>
            }
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
          <p>
            For the broader field beyond these three, read the{" "}
            <BlogLink slug="best-real-estate-photography-software">10 best real estate photography software platforms</BlogLink>.
            You can also <SiteLink href="/how-it-works">see how ShootPortal works</SiteLink>, or read how it handles
            each step of a listing job on the{" "}
            <SiteLink href="/real-estate-photography-software">real estate photography software</SiteLink> page.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "Is Aryeo or HDPhotoHub better?",
      answerText:
        "Aryeo suits photographers whose agents need Zillow Showcase or who want a free delivery plan. HDPhotoHub suits photographers who want no subscription and a per-delivery marketing kit. If you want more than either offers, ShootPortal adds a business website, proposals, a photo editor, video review, and sellable property websites and marketing kits at one flat price.",
      answer: (
        <p>
          Aryeo suits photographers whose agents need Zillow Showcase or who want a free delivery plan. HDPhotoHub suits
          photographers who want no subscription and a per-delivery marketing kit. If you want more than either offers,
          ShootPortal adds a business website, proposals, a photo editor, video review, and sellable property websites
          and marketing kits at one flat price.
        </p>
      ),
    },
    {
      question: "Which is cheaper, Aryeo or HDPhotoHub?",
      answerText:
        "At 100 listings a year, HDPhotoHub Basic costs about $500 versus $588 for Aryeo's $49 tier. At 250 listings they're close ($1,250 vs. $1,188). Aryeo Lite is free if you only need delivery. Processing fees are extra on both.",
      answer: (
        <p>
          At 100 listings a year, HDPhotoHub Basic costs about $500 versus $588 for Aryeo&apos;s $49 tier. At 250
          listings they&apos;re close ($1,250 vs. $1,188). Aryeo Lite is free if you only need delivery. Payment
          processing fees are extra on both.
        </p>
      ),
    },
    {
      question: "Which platform has property websites and a marketing kit?",
      answerText:
        "HDPhotoHub includes property sites, flyers, and social graphics in its $10 Full Delivery. ShootPortal includes a property website, social posts, Stories, an Instagram carousel, and a print flyer for every listing in its flat plan, and lets you include them free or sell them to agents as a paid add-on. Aryeo Pro lists a marketing center.",
      answer: (
        <p>
          HDPhotoHub includes property sites, flyers, and social graphics in its $10 Full Delivery. ShootPortal includes
          a property website, social posts, Stories, an Instagram carousel, and a print flyer for every listing in its
          flat plan, and lets you include them free or sell them to agents as a paid add-on. Aryeo Pro lists a
          marketing center.
        </p>
      ),
    },
    {
      question: "Does ShootPortal support Zillow Showcase?",
      answerText:
        "No. ShootPortal does not deliver to Zillow Showcase; Aryeo states that it is the only platform delivering media for Showcase listings. ShootPortal delivers MLS-size and full-resolution files and builds its own property websites with an unbranded, MLS-safe version.",
      answer: (
        <p>
          No. ShootPortal doesn&apos;t deliver to Zillow Showcase; Aryeo states that it is the only platform delivering
          media for Showcase listings. ShootPortal delivers MLS-size and full-resolution files and builds its own
          property websites with an unbranded, MLS-safe version.
        </p>
      ),
    },
    {
      question: "Can agents book a time slot themselves in ShootPortal?",
      answerText:
        "Agents request a shoot from your website's Book a Shoot form with a preferred date and see an instant estimate. You then propose a shoot time that they accept or counter in one click, which keeps your schedule in your control. Aryeo and HDPhotoHub are built around agent-driven ordering.",
      answer: (
        <p>
          Agents request a shoot from your website&apos;s Book a Shoot form with a preferred date and see an instant
          estimate. You then propose a shoot time that they accept or counter in one click, which keeps your schedule
          in your control. Aryeo and HDPhotoHub are built around agent-driven ordering.
        </p>
      ),
    },
    {
      question: "Which platform is best for a team of photographers?",
      answerText:
        "HDPhotoHub and ShootPortal both include unlimited team members at no extra cost; Aryeo Pro includes one, three, or five seats depending on tier. ShootPortal adds granular permissions with presets like Editor and Coordinator and lets you assign staff to specific projects.",
      answer: (
        <p>
          HDPhotoHub and ShootPortal both include unlimited team members at no extra cost; Aryeo Pro includes one,
          three, or five seats depending on tier. ShootPortal adds granular permissions with presets like Editor and
          Coordinator and lets you assign staff to specific projects.
        </p>
      ),
    },
    {
      question: "Do Aryeo, HDPhotoHub, or ShootPortal replace Dropbox Replay or Frame.io?",
      answerText:
        "ShootPortal does for client feedback: time-stamped comments pinned to the frame, threaded replies, resolve and reopen, numbered versions, and approve or request changes, on the same project as the invoice and delivery and included in the plan. Neither Aryeo nor HDPhotoHub describes an equivalent on its official pages.",
      answer: (
        <p>
          ShootPortal does for client feedback: time-stamped comments pinned to the frame, threaded replies, resolve and
          reopen, numbered versions, and approve or request changes, on the same project as the invoice and delivery and
          included in the plan. Neither Aryeo nor HDPhotoHub describes an equivalent on its official pages.
        </p>
      ),
    },
  ],
  related: ["best-aryeo-alternatives", "best-hdphotohub-alternatives", "best-real-estate-photography-software"],
  cta: {
    title: "Get everything Aryeo and HDPhotoHub split up, in one place.",
    body: "Your website, requests, proposals, shoot times, editing, video review, payments, downloads, and property websites agents can buy, all on one flat price under your brand.",
    secondaryHref: "/#product-demo",
    secondaryLabel: "Watch the demo",
  },
};
