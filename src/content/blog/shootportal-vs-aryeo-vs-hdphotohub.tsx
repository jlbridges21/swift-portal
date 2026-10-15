import type { BlogArticle, BlogRenderContext } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  No,
  PickGrid,
  SiteLink,
  Yes,
} from "@/components/blog/article-parts";
import { BookingFlowDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, TrialCard } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";

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
    "Aryeo vs HDPhotoHub vs ShootPortal: pricing at 100–500 listings, booking, delivery, payments, video review, Showcase, and team limits, compared side by side.",
  excerpt:
    "Three platforms, three pricing models. A side-by-side look at what Aryeo, HDPhotoHub, and ShootPortal each do best, where each falls short, and who should pick which.",
  category: "software-comparisons",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "Aryeo vs HDPhotoHub",
  secondaryKeywords: [
    "ShootPortal vs Aryeo",
    "ShootPortal vs HDPhotoHub",
    "real estate photography software comparison",
    "HDPhotoHub vs Aryeo",
  ],
  readingMinutes: 15,
  cover: { variant: "versus", label: "Head to Head", alt: "Illustration of three software panels facing off on a dark indigo background" },
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Aryeo</strong> wins on Zillow Showcase delivery and a free plan. Pick it if Showcase matters to your
        agents.
      </>,
      <>
        <strong>HDPhotoHub</strong> wins on no subscription, unlimited team members at no extra cost, and its Marketing
        Kit of property sites and flyers.
      </>,
      <>
        <strong>ShootPortal</strong> (our product) wins on custom estimates, frame-accurate video review, client CRM, and
        one flat price with no listing caps. It&apos;s our pick for solo shooters and small teams who mix listings with
        aerial, video, or commercial work.
      </>,
      <>
        <strong>Low or seasonal volume?</strong> HDPhotoHub is usually cheapest. <strong>High, steady volume?</strong> A
        flat subscription usually is.
      </>,
      <>
        <strong>None of the three wins everything.</strong> The right pick depends on Showcase, marketing kits, and how
        much of your work is quoted rather than ordered.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        If you&apos;ve narrowed your shortlist to these three, you&apos;re comparing three different philosophies, not
        three versions of the same product. Aryeo is a listing storefront with deep Zillow ties. HDPhotoHub is a
        pay-as-you-go listing platform with marketing built in. ShootPortal is a project workspace that treats a listing
        the same way it treats a commercial aerial job.
      </p>
      <p>
        That&apos;s why &quot;<strong>Aryeo vs HDPhotoHub</strong>&quot; comparisons that only line up feature
        checkboxes tend to miss the point. This one goes dimension by dimension (pricing, booking, client management,
        delivery and payments, marketing, team, and branding), then says plainly who each platform is for.
      </p>
      <p>
        We make ShootPortal, so we&apos;ve tried hard to be specific about where it loses. Competitor facts come from
        Aryeo&apos;s and HDPhotoHub&apos;s official sites as of October 2026, and &quot;Not stated&quot; means the vendor
        doesn&apos;t say, not that the feature is missing.
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
          <h3>ShootPortal: a project workspace for every job type</h3>
          <p>
            ShootPortal starts each job as a request, turns it into an estimate the client approves, schedules it by
            proposing a time, and then runs review, payment, and delivery in a client portal branded with your logo,
            colors, and domain. It was built by a drone business owner, so it assumes not every job is a listing package.
            It doesn&apos;t do property websites or Showcase.
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
                    with no listing caps or per-delivery fees
                  </>
                ) : (
                  <>
                    one flat monthly plan with no listing caps or per-delivery fees (see{" "}
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
                  seats, so a larger team may need a higher tier than volume alone suggests. Not like-for-like: HDPhotoHub
                  Full includes a marketing kit that neither of the other two includes at these prices.
                </>
              }
            />
            <p>
              The pattern: HDPhotoHub Basic is cheapest at low volume and when work is seasonal, Aryeo&apos;s tiers stay
              competitive as long as you fit the listing and seat limits, and a flat plan pulls ahead the more you deliver.
              If you only need delivery, Aryeo Lite at $0 beats all three. For a monthly break-even formula, see our{" "}
              <BlogLink slug="best-hdphotohub-alternatives">HDPhotoHub alternatives guide</BlogLink>.
            </p>
          </>
        );
      },
    },
    {
      id: "feature-table",
      title: "Feature comparison table",
      tocLabel: "Feature table",
      body: (ctx) => (
        <>
          <p>
            The full side-by-side. ShootPortal is highlighted because it&apos;s ours, not because it wins each row; it
            clearly doesn&apos;t.
          </p>
          <ComparisonTable
            caption="ShootPortal vs. Aryeo vs. HDPhotoHub feature comparison, October 2026"
            columns={["Feature", "ShootPortal", "Aryeo", "HDPhotoHub"]}
            highlightColumn={1}
            rows={[
              ["Pricing model", "Flat monthly subscription", "Free Lite; Pro $49–$179/mo with listing caps", "$5–$10 per delivery"],
              [
                "Free option / trial",
                ctx.trialDays > 0 ? `${ctx.trialDays}-day trial, no card` : "Free trial",
                <Yes key="r2a">Free Lite plan</Yes>,
                "Free account; trial terms not stated",
              ],
              ["How jobs come in", "Request form with automatic preliminary estimate", "Embeddable order forms with add-ons", "Shopping cart with dependent add-ons"],
              ["Scheduling", "You propose times; client accepts or counters", "Territories, booking limits, buffers", "Smart Scheduling with drive time"],
              ["Travel fees", "ZIP-to-ZIP distance tiers or per-mile", "Percentage, flat, or by distance/time", "Not stated"],
              ["Project pipeline", "8 stages, request to delivered", "Content dashboard; reporting on Pro", "Not stated"],
              ["Client records", "Notes, timeline, property history, lifetime revenue", "Agent login portal", "Profiles with order history, client pricing"],
              ["Estimate approval online", <Yes key="r6a">Versioned, with PDF and expiry</Yes>, "Not stated", "Not stated"],
              ["Property history per address", <Yes key="r6b">Projects and revenue per address</Yes>, "Not stated", "Not stated"],
              ["Client messaging on the job", <Yes key="r6c">Two-way, on the project</Yes>, "Not stated", "Not stated"],
              ["Media delivery", "Print + MLS (2048px), ZIP, video, 3D, Kuula", "Delivery center, branded delivery pages", "Login-free pages, MLS resizing, 3D embeds"],
              ["Approve / request changes per file", <Yes key="r8b">With written feedback</Yes>, "Not stated", "Not stated"],
              ["Sharing with people who have no account", <Yes key="r8c">View links; email invites with expiry</Yes>, "Not stated", <Yes key="r8d">Login-free download pages</Yes>],
              ["Pay-to-download", <Yes key="r9a">Optional</Yes>, "Not stated", <Yes key="r9c" />],
              ["Payment processors", "Stripe (your own account)", "Payment integrations (not itemized)", "Stripe or Square"],
              ["Deposits", <Yes key="r11a" />, <Yes key="r11b" />, <Yes key="r11c" />],
              ["Tips / promo codes", <No key="r12a" />, <Yes key="r12b">Promo codes</Yes>, <Yes key="r12c" />],
              ["Video review", <Yes key="r13a">Frame-pinned, versioned</Yes>, "Not stated", "Not stated"],
              ["Property websites / marketing kit", <No key="r14a" />, "Marketing center (Pro)", <Yes key="r14c">Full Delivery</Yes>],
              ["Zillow Showcase delivery", <No key="r15a" />, <Yes key="r15b">Aryeo says it&apos;s the only one</Yes>, <No key="r15c">Not offered</No>],
              ["Team", "Staff accounts, granular permissions", "1, 3, or 5 seats by Pro tier", "Unlimited, no extra cost"],
              ["Branding", "Logo, colors, custom domain", "Branded delivery pages; branded app add-on", "White-label mobile app (one-time fee)"],
              ["Accounting sync", <No key="r18a" />, "Payroll and invoicing (Pro)", <Yes key="r18c">QuickBooks</Yes>],
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
            This is where the three philosophies differ most, and where your client mix should drive the decision.
          </p>
          <h3>Aryeo and HDPhotoHub: the agent orders</h3>
          <p>
            Both are built for agents who know what they want. Aryeo&apos;s{" "}
            <Ext href="https://www.aryeo.com/products/orders">order forms</Ext> support a product catalog, add-ons,
            multiple appointments per order, promo codes, and payment upfront, as a deposit, or on delivery. Its{" "}
            <Ext href="https://www.aryeo.com/products/scheduling">scheduling</Ext> adds territories, per-member booking
            limits, and travel-time buffers. HDPhotoHub&apos;s shopping cart suggests add-ons based on what&apos;s
            already in the order, and Smart Scheduling factors in drive time and job duration. For repeat agents ordering
            standard packages, this is the fastest possible flow.
          </p>
          <h3>ShootPortal: the client requests, you quote</h3>
          <p>
            ShootPortal works differently. The client submits a request with the property address, a service from your
            catalog, a preferred date, and notes. ShootPortal can produce a preliminary estimate including a travel fee,
            then you send the official estimate. Once it&apos;s approved, you propose a shoot time and the client accepts,
            declines, or counter-proposes. Shoots push to your Google Calendar, and your Google events show read-only in
            ShootPortal so you can spot conflicts.
          </p>
          <Figure caption="Conceptual diagram: ShootPortal's request-to-schedule flow.">
            <BookingFlowDiagram />
          </Figure>
          <p>
            The trade-off is real. Agents can&apos;t pick an open slot themselves in ShootPortal, and there&apos;s no
            drive-time routing. That costs a little speed on routine listings and gains flexibility on anything that
            needs a quote. Our <BlogLink slug="best-real-estate-photography-booking-software">booking software guide</BlogLink>{" "}
            compares more scheduling approaches.
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
              <strong>ShootPortal</strong> keeps a fuller CRM record: contact details, referral source, timestamped notes,
              a message timeline, property history with revenue per address, lifetime revenue, outstanding balance, and
              last portal login. Every project moves through eight pipeline stages from new request to delivered, and
              clients message you on the project rather than by text.
            </li>
          </ul>
          <p>
            If you mainly serve a few dozen agents who order the same package, Aryeo or HDPhotoHub records are plenty.
            If you juggle agents, builders, and commercial clients with different histories, the CRM depth matters more.
            The <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink> goes further on this.
          </p>
          <h3>Why this matters more in real estate than in most photography</h3>
          <p>
            Real estate media runs on repeat business. The same agent books you again next week, the same house comes
            back when it relists, and every delivery is waiting on a payment. That changes what &quot;management&quot;
            means:
          </p>
          <ul>
            <li>
              <strong>Repeat orders.</strong> When an agent&apos;s usual package, past jobs, notes, and message history
              are on one record, the tenth booking takes less work than the first.
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
          <Figure caption="Product illustration: ShootPortal's project pipeline with jobs moving from request to delivered (demo data).">
            <ProductPreview view="projects" />
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
            All three handle photos, video, and 3D embeds. HDPhotoHub&apos;s login-free download pages with automatic MLS
            resizing and Matterport, iGUIDE, and Zillow 3D embeds are a high bar. Aryeo offers branded delivery pages and
            a download center, and is the route to Showcase. ShootPortal offers Print (full-resolution) or MLS (2048px)
            downloads, single or ZIP, plus Kuula tours and embeds from Matterport, Polycam, and others, along with share
            links for people without an account.
          </p>
          <h3>Payments</h3>
          <p>
            HDPhotoHub has the broadest payment options: Pay to Download, Stripe or Square, deposits, tax, tips, and promo
            codes. Aryeo supports upfront payment, deposits, invoicing on delivery, promo codes, and automatic tax.
            ShootPortal uses Stripe Connect, so payments land in your own Stripe account, with deposits on approval and an
            option to unlock downloads only after the final payment. It has no Square, tips, or promo codes.
          </p>
          <h3>Video review</h3>
          <p>
            This is ShootPortal&apos;s clearest advantage. Clients leave time-stamped comments pinned to a spot on the
            frame, you reply in threads and resolve them, and each cut is a numbered version. Photos and other
            deliverables get approve or reject with written feedback. Neither Aryeo nor HDPhotoHub describes an
            equivalent on its official pages; HDPhotoHub connects to Vimeo for video hosting.
          </p>
          <Callout tone="tip" title="Only shoot listing reels?">
            <p>
              If your video is a one-pass listing reel that agents rarely revise, video review won&apos;t move the needle.
              It matters when you cut brand, construction, or event videos with real revision rounds. See our{" "}
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
          <h3>Property marketing and Showcase</h3>
          <p>
            Aryeo is the only one of the three with Showcase delivery; Aryeo says it&apos;s the only platform anywhere that
            offers it. HDPhotoHub&apos;s Full Delivery bundles property sites, flyers, social graphics, reels, and a
            weekly traffic report for $10. ShootPortal has neither, and won&apos;t suit businesses that sell listing
            marketing as a product.
          </p>
          <h3>Team</h3>
          <p>
            HDPhotoHub wins here: unlimited team members at no extra cost. Aryeo Pro tiers include one, three, or five
            seats. ShootPortal supports staff accounts with granular permissions and project assignment, but no automatic
            photographer assignment or drive-time dispatch.
          </p>
          <h3>Branding</h3>
          <p>
            All three put your brand in front of clients in different ways. Aryeo offers branded delivery pages and a
            branded mobile app add-on. HDPhotoHub offers a white-label iOS and Android app for a one-time configuration
            fee. ShootPortal gives each business a portal with its logo, colors, light or dark theme, a custom domain,
            email from your own domain, and an editable public landing page, though it isn&apos;t full white-label.
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
              per-delivery price, trial terms aren&apos;t published, and cart ordering suits listings more than quoted work.
            </li>
          </ul>
          <h3>ShootPortal</h3>
          <ul>
            <li>
              <strong>Strengths:</strong> request-and-estimate workflow with travel fees, frame-pinned video review, a full
              client CRM, an 8-stage pipeline, and one flat price.
            </li>
            <li>
              <strong>Limitations:</strong> no Showcase, no property websites or marketing kits, no client self-booking,
              no SMS, e-signature, or QuickBooks, and Stripe is the only processor.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "verdict",
      title: "Which platform should you choose?",
      tocLabel: "Verdict",
      body: () => (
        <>
          <PickGrid
            items={[
              {
                who: "Your agents use Zillow Showcase",
                pick: "Aryeo",
                why: "Nothing else here delivers to Showcase, and Lite costs nothing.",
              },
              {
                who: "Seasonal or low volume",
                pick: "HDPhotoHub",
                why: "Pay only when you deliver; quiet months cost close to zero.",
              },
              {
                who: "You sell property sites and flyers",
                pick: "HDPhotoHub Full Delivery",
                why: "The Marketing Kit is included at $10 per delivery.",
              },
              {
                who: "A growing team on a budget",
                pick: "HDPhotoHub",
                why: "Unlimited team members at no extra cost.",
              },
              {
                who: "High, steady volume with no Showcase need",
                pick: "ShootPortal",
                why: "One flat price, no caps, so the cost per job keeps falling.",
              },
              {
                who: "Listings plus aerial, video, or commercial",
                pick: "ShootPortal",
                why: "Estimates, video revision rounds, and delivery work the same for every job type.",
              },
            ]}
          />
          <h3>Where ShootPortal fits, and where it doesn&apos;t</h3>
          <p>
            ShootPortal makes the most sense when the hard part of your business is everything between &quot;can you
            shoot this?&quot; and &quot;the files are downloaded&quot;: quoting, scheduling, feedback, getting paid. It
            makes the least sense when your value to agents is listing marketing or Showcase. In that case, Aryeo or
            HDPhotoHub is the better tool, and we&apos;d rather you pick it than switch and regret it.
          </p>
          <BestFitPanel
            heading="Choose ShootPortal over Aryeo and HDPhotoHub if you are…"
            fits={[
              {
                who: "A solo shooter with a mixed book",
                why: "Listings, aerial, video, and commercial jobs all start as a request, become an approved estimate, and end as a paid, delivered project.",
              },
              {
                who: "A small team that quotes custom work",
                why: "Versioned estimates with ZIP-based travel fees, staff permissions, and projects assigned to the right shooter or editor.",
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
            notFor={[
              <>Showcase delivery or Zillow integrations matter to your agents (Aryeo).</>,
              <>You sell property sites and flyers with most listings (HDPhotoHub Full Delivery).</>,
              <>You want agents to self-book open slots, or need Square, tips, or QuickBooks.</>,
            ]}
          />
          <p>
            For the broader field beyond these three, read the{" "}
            <BlogLink slug="best-real-estate-photography-software">10 best real estate photography software platforms</BlogLink>.
            If ShootPortal sounds like a fit, <SiteLink href="/how-it-works">see how it works</SiteLink> or run your next
            real job through the free trial.
          </p>
          <p>
            If ShootPortal sounds like the right fit, our{" "}
            <SiteLink href="/real-estate-photography-software">real estate photography software</SiteLink> page walks through each step of a listing job.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "Is Aryeo or HDPhotoHub better?",
      answerText:
        "Aryeo is better if your agents need Zillow Showcase or you want a free delivery plan. HDPhotoHub is better if you want no subscription, unlimited team members, and a marketing kit with property sites and flyers.",
      answer: (
        <p>
          Aryeo is better if your agents need Zillow Showcase or you want a free delivery plan. HDPhotoHub is better if
          you want no subscription, unlimited team members, and a marketing kit with property sites and flyers.
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
      question: "Does ShootPortal support Zillow Showcase?",
      answerText:
        "No. ShootPortal does not deliver to Zillow Showcase. Aryeo states that it is the only platform delivering media for Showcase listings.",
      answer: (
        <p>
          No. ShootPortal doesn&apos;t deliver to Zillow Showcase. Aryeo states that it is the only platform delivering
          media for Showcase listings.
        </p>
      ),
    },
    {
      question: "Can agents book a time slot themselves in ShootPortal?",
      answerText:
        "Not directly. Clients submit a request with a preferred date, and you propose a shoot time that they accept, decline, or counter-propose. Aryeo and HDPhotoHub are built around agent-driven ordering.",
      answer: (
        <p>
          Not directly. Clients submit a request with a preferred date, and you propose a shoot time that they accept,
          decline, or counter-propose. Aryeo and HDPhotoHub are built around agent-driven ordering.
        </p>
      ),
    },
    {
      question: "Which platform is best for a team of photographers?",
      answerText:
        "HDPhotoHub includes unlimited team members at no extra cost. Aryeo Pro includes one, three, or five seats depending on tier. ShootPortal supports staff accounts with granular permissions but doesn't auto-assign photographers.",
      answer: (
        <p>
          HDPhotoHub includes unlimited team members at no extra cost. Aryeo Pro includes one, three, or five seats
          depending on tier. ShootPortal supports staff accounts with granular permissions but doesn&apos;t auto-assign
          photographers.
        </p>
      ),
    },
  ],
  related: ["best-aryeo-alternatives", "best-hdphotohub-alternatives", "best-real-estate-photography-software"],
  cta: {
    title: "See if ShootPortal fits your workflow.",
    body: "Put one real job through it: estimate approved online, shoot time confirmed, video reviewed, balance paid, files downloaded, all on one project in your branded portal.",
    secondaryHref: "/#product-demo",
    secondaryLabel: "Watch the demo",
  },
};
