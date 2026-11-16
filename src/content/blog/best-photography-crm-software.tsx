import { FreeResourceCallout } from "@/components/blog/free-resource-callout";
import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  ComparisonTable,
  Ext,
  Figure,
  InlineCta,
  KeyTakeaways,
  No,
  PickGrid,
  SiteLink,
  Steps,
  ToolCard,
  Yes,
} from "@/components/blog/article-parts";
import { CrmRecordDiagram, ToolCategoryMap } from "@/components/blog/diagrams";
import { BestFitPanel, ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";
import { AllInOnePlatform, AppScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "best-photography-crm-software",
  title: "Best Photography CRM Software in 2026: 10 Tools Compared",
  seoTitle: "Best Photography CRM Software in 2026: 10 Tools",
  description:
    "Compare 10 photography CRM software tools, from ShootPortal to HoneyBook and Dubsado, on client records, payments, delivery, video review, and price.",
  excerpt:
    "A photography CRM should remember every client, job, and payment so you don't have to. We compare 10 options and show why real estate, drone, and video businesses get more from a CRM that's connected to booking, delivery, and payment.",
  category: "client-management",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "photography CRM software",
  secondaryKeywords: [
    "photography CRM",
    "best CRM for photographers",
    "photographer client management software",
    "photography studio management software",
    "CRM for videographers",
    "real estate photography CRM",
    "CRM for drone photographers",
    "photography CRM with client portal",
    "Dropbox Replay alternative",
  ],
  readingMinutes: 14,
  cover: {
    variant: "crm",
    label: "10 Tools Compared",
    alt: "Illustration of a client record card linked to projects, notes, and payments",
  },
  disclosure: true,
  quickAnswer: {
    heading: "Quick answer",
    points: [
      <>
        <strong>Best photography CRM for real estate, drone, and video businesses:</strong> ShootPortal (our product).
        The client record is connected to everything the job touches: your website and Book a Shoot form, proposals,
        scheduling, video review, payment, delivery, and listing marketing.
      </>,
      <>
        <strong>Why connected matters:</strong> when an agent books again, their past properties, lifetime revenue, and
        open balance are already on the record, and the new job runs through the same system end to end.
      </>,
      <>
        <strong>One flat plan:</strong> every feature, unlimited clients and staff, and 0% of your client payments. Try
        it free with no card.
      </>,
      <>
        <strong>Also compared below:</strong> HoneyBook, Dubsado, Studio Ninja, Sprout Studio, Pixieset Studio Manager,
        VSCO Workspace, 17hats, Iris Works, and Bloom, with prices from each official page.
      </>,
    ],
  },
  intro: (ctx) => (
    <>
      <p>
        Ask a photographer where their client list lives and you&apos;ll hear some version of &quot;my inbox, my phone,
        a spreadsheet I stopped updating, and my memory.&quot; That works right up until a past client calls to book
        again and you can&apos;t remember what you charged them, or a lead slips through because the inquiry landed
        on a weekend.
      </p>
      <p>
        <strong>Photography CRM software</strong> exists to fix that. A good one remembers every client, every job,
        every conversation, and every payment, and it nudges the next step along so leads become bookings and
        bookings become paid work. The catch is that most photography CRMs stop at the paperwork. The client record
        knows about the inquiry and the invoice, and everything in between (the shoot, the edit, the video feedback,
        the files, the listing marketing) happens in other apps.
      </p>
      <p>
        ShootPortal, our product, takes the opposite approach. It&apos;s a CRM built for real estate photographers,
        drone pilots, and videographers where the client record is connected to your website, your booking form,
        proposals, scheduling, the built-in photo editor, video review, payment, delivery, and property marketing. Your
        clients get one branded portal and nothing to install. Below we compare it with nine other CRMs, with pricing
        from each vendor&apos;s official page{ctx.trialDays > 0 ? <>, and you can test it yourself with a {ctx.trialDays}-day free trial</> : null}.
      </p>
    </>
  ),
  sections: [
    {
      id: "what-is-a-photography-crm",
      title: "What a photography CRM does (and doesn't do)",
      tocLabel: "What a photography CRM is",
      body: () => (
        <>
          <p>
            CRM stands for customer relationship management. In practice, for a photographer, it means one place that
            answers four questions without digging: who is this client, what have we done together, what&apos;s
            happening right now, and who owes whom money.
          </p>
          <p>
            Most photography CRMs extend that core with the paperwork of a booking: inquiry forms, proposals,
            contracts, questionnaires, invoices, payment schedules, and automated emails. A few go further and handle
            the work itself: galleries, video review, and file delivery.
          </p>
          <p>What a CRM usually <em>doesn&apos;t</em> do is worth knowing up front:</p>
          <ul>
            <li>
              <strong>Editing.</strong> Most CRMs won&apos;t touch your images, so every quick fix means a round-trip
              through another app. ShootPortal is the exception: its built-in photo editor handles one-click Auto,
              exposure, white balance, HDR looks, and spot removal, and saves straight back to the client&apos;s gallery.
            </li>
            <li>
              <strong>Accounting.</strong> Most CRMs send invoices and record payments, but bookkeeping still belongs
              in QuickBooks, Xero, or your accountant&apos;s tool. Several CRMs sync to those.
            </li>
            <li>
              <strong>Delivery, often.</strong> HoneyBook, Dubsado, Studio Ninja, 17hats, and Iris Works don&apos;t
              deliver galleries natively; they integrate with gallery tools or leave it to you.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "features-that-matter",
      title: "The features that make a photography CRM worth paying for",
      tocLabel: "Important features",
      body: () => (
        <>
          <p>
            Every vendor lists dozens of features. These are the ones that change how much time you spend on admin.
          </p>
          <h3>Client records that hold history</h3>
          <p>
            A contact card with a name and email isn&apos;t a CRM. Look for records that show every project with this
            client, the notes you&apos;ve taken, the messages exchanged, and the money: lifetime revenue, outstanding
            balance, last payment. For real estate and drone work, the history by property address matters too,
            because agents and builders send you back to the same sites.
          </p>
          <Figure caption="Conceptual diagram: the layers a useful client record should connect for a media business.">
            <CrmRecordDiagram />
          </Figure>
          <h3>Project tracking with clear stages</h3>
          <p>
            A pipeline view (inquiry, quoted, booked, shot, in review, paid, delivered) lets you see at a glance which
            jobs are stuck. Check whether you can customize stages or whether they&apos;re fixed, and whether stages
            change automatically when something happens.
          </p>
          <h3>Scheduling</h3>
          <p>
            Some CRMs let clients self-book into open slots; others have you propose times. Self-booking suits
            mini-sessions and portraits. Proposing times suits location work where you need to check the site, the
            weather, or the drive first. Our{" "}
            <BlogLink slug="best-real-estate-photography-booking-software">booking software guide</BlogLink> compares
            both approaches.
          </p>
          <h3>Communication in context</h3>
          <p>
            Messages tied to the project beat a separate inbox thread you have to search for. Email templates and
            automated reminders keep follow-ups from depending on your memory.
          </p>
          <h3>Payments, deposits, and contracts</h3>
          <p>
            Online card payments, deposits or retainers, and payment schedules are table stakes. Contracts with
            e-signature are essential for weddings and events and less central for listing or commercial work, where an
            approved estimate often serves as the agreement.
          </p>
          <FreeResourceCallout tool="quote-builder" note="Not ready for a CRM yet? Build a client quote with your services, add-ons, deposit, and terms, and download it as a PDF." />
          <h3>Automations</h3>
          <p>
            Automations send the questionnaire after booking, the reminder before the session, and the thank-you after
            delivery. On several CRMs, automations are limited to higher tiers, so check before you buy the entry plan.
          </p>
          <h3>Galleries and delivery</h3>
          <p>
            If the CRM doesn&apos;t deliver, you&apos;ll pay for a gallery tool on top. That&apos;s fine if you love your
            gallery platform, but price the pair, not just the CRM.
          </p>
          <p>
            If payments are the part that hurts most, compare dedicated options in our{" "}
            <BlogLink slug="best-photography-invoicing-software">photography invoicing and payment software guide</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "general-vs-photography-crm",
      title: "General CRMs like HubSpot vs. photography-specific CRMs",
      tocLabel: "General vs. photography CRMs",
      body: () => (
        <>
          <p>
            A general-purpose CRM is tempting because some of them are free.{" "}
            <Ext href="https://www.hubspot.com/products/crm">HubSpot&apos;s free CRM</Ext> covers up to 2 users and
            1,000 contacts and includes a form builder, meeting scheduler, quotes, and email tracking. Its Starter
            tier is listed from $15 per seat per month as a new-customer discount.
          </p>
          <p>
            The problem is the shape of the data. General CRMs think in deals and sales pipelines. Photographers think
            in shoots, sessions, deliverables, and revisions. HubSpot has no galleries, no photography contract or
            session templates, and no concept of a shoot or a deliverable, so you&apos;d be assembling contracts,
            delivery, and booking from other tools.
          </p>
          <Figure caption="Conceptual diagram: what each type of CRM covers, and what it typically leaves to another tool.">
            <ToolCategoryMap
              columns={[
                {
                  title: "General CRMs",
                  examples: "e.g. HubSpot",
                  covers: ["Contacts & companies", "Sales pipeline", "Email tracking", "Forms & meetings"],
                  gaps: ["Contracts built for shoots", "Galleries & delivery", "Session types"],
                },
                {
                  title: "Session-based photography CRMs",
                  examples: "e.g. HoneyBook, Dubsado, Studio Ninja",
                  covers: ["Inquiries & proposals", "Contracts & questionnaires", "Invoices & payment plans", "Automations"],
                  gaps: ["Media delivery (most)", "Video review", "Property history"],
                },
                {
                  title: "All-in-one media business platforms",
                  examples: "e.g. ShootPortal",
                  covers: ["Website, booking & instant estimates", "Client records & property history", "Photo editing & video review", "Payment, delivery & listing marketing"],
                  gaps: ["Bookkeeping (your accountant's tool)"],
                  accent: true,
                },
              ]}
            />
          </Figure>
          <p>
            Rule of thumb: if you already run HubSpot for a larger agency or production company, keep it for sales and
            add a photography tool for the job itself. If you&apos;re a photographer choosing your first CRM, start with
            one built for photographers, and ideally one that runs the job too, not just the sale.
          </p>
        </>
      ),
    },
    {
      id: "session-vs-project-work",
      title: "Session-based vs. delivery-based photography: which CRM shape fits you",
      tocLabel: "Which CRM shape fits",
      body: () => (
        <>
          <p>
            This is the most useful distinction we can offer, and most CRM roundups skip it.
          </p>
          <h3>Session-based work: weddings, portraits, families, events</h3>
          <p>
            The relationship starts months before the shoot. The critical documents are the proposal, the contract,
            the retainer, and the questionnaire. Delivery is usually a gallery, often with print sales. HoneyBook,
            Dubsado, Studio Ninja, Iris Works, 17hats, and VSCO Workspace are built around this lifecycle.
          </p>
          <h3>Delivery-based work: real estate, commercial, drone, video</h3>
          <p>
            The relationship is repeat and transactional. An agent or marketing manager sends job after job. Each one
            needs a quote (often with travel), a scheduled time, a round of feedback, payment, and fast access to
            files in the right sizes. Contracts matter less; the approved estimate and the delivery experience matter
            more. Here, a CRM that doesn&apos;t deliver media leaves the most painful part of the job outside the
            system.
          </p>
          <p>
            Delivery-based clients also judge you on what happens after the files land. Agents want a listing website
            and social posts the same day. Marketing teams want to leave notes on a video without emailing timestamps.
            A CRM that ends at the invoice can&apos;t help with either.
          </p>
          <ProductCallout title="A CRM that follows the job all the way to the listing">
            <p>
              In ShootPortal, a request from your website creates the client and the project, the proposal and deposit
              live on that project, and so do the edited photos, the video review thread, the payment, and the
              delivery. When the agent wants marketing, the Marketing Kit builds a property website, social posts,
              Stories, and a print flyer from the same photos, and you can include it or sell it as an add-on.
            </p>
          </ProductCallout>
          <Figure caption="Real ShootPortal screens: the proposal you send from the project (left) and the same proposal in your client's portal, where they approve it in one click (right).">
            <TwoSidedScreens business="proposals" client="portal-proposal" />
          </Figure>
          <p>
            For a real estate-specific playbook, see{" "}
            <BlogLink slug="real-estate-photography-client-management">how to manage multiple real estate photography clients</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "comparison-table",
      title: "Photography CRM comparison table",
      tocLabel: "Comparison table",
      body: (ctx) => (
        <>
          <p>
            Entry prices are the lowest paid or free tier listed on each official page. &quot;Not stated&quot; means
            we couldn&apos;t confirm it on the vendor&apos;s site.
          </p>
          <ComparisonTable
            caption="Photography CRM software comparison, October 2026"
            columns={[
              "CRM",
              "Entry price (Oct 2026)",
              "Free trial / plan",
              "Contracts & e-sign",
              "Client portal",
              "History by property address",
              "Native galleries / delivery",
            ]}
            highlightColumn={undefined}
            rows={[
              ["ShootPortal", ctx.studioMonthly ? `${ctx.studioMonthly}/mo, every feature` : "Flat monthly subscription", "Free trial, no card", "Proposals approved online", <Yes key="a2">Approve, pay, review, download</Yes>, <Yes key="a3">Projects + revenue per address</Yes>, <Yes key="b">Photos, video review, tours, 3D</Yes>],
              ["HoneyBook", "$29/mo billed yearly", "30-day trial", <Yes key="c" />, <Yes key="c2" />, "Not stated", <No key="d">Pic-Time integration</No>],
              ["Dubsado", "$335/yr", "21-day trial", <Yes key="e" />, <Yes key="e2" />, "Not stated", <No key="f" />],
              ["Studio Ninja", "$16/mo", "7-day trial", <Yes key="g" />, "Not stated", "Not stated", <No key="h">Via Pic-Time / ShootProof</No>],
              ["Sprout Studio", "Lite from $19–$24/mo", "30-day trial", <Yes key="i" />, "Not stated", "Not stated", <Yes key="j">Galleries + store</Yes>],
              ["Pixieset Studio Manager", "Free; Plus $12–$15/mo", "Free plan", <Yes key="k">3 on Free</Yes>, "Not stated", "Not stated", <Yes key="l">Separate Client Gallery plan</Yes>],
              ["VSCO Workspace", "VSCO One $499.99/yr", "30-day refund window", <Yes key="m" />, <Yes key="m2" />, "Not stated", "Not stated"],
              ["17hats", "$60/mo; free CRM plan", "7-day trial", <Yes key="n" />, <Yes key="n2" />, "Not stated", <No key="o" />],
              ["Iris Works", "$14.95/mo", "14-day trial", <Yes key="p" />, "Not stated", "Not stated", <No key="q">Via Pic-Time / ShootProof</No>],
              ["Bloom", "Starter $7–$14/mo", "7-day trial", <Yes key="r" />, "Not stated", "Not stated", <Yes key="s" />],
            ]}
            note={
              <>
                Prices from official vendor pages, checked October 15, 2026; links in each review below. Sprout
                Studio and Bloom show two prices per plan without clearly labeling monthly vs. annual billing, so we
                show the range. &quot;History by property address&quot; means a client record that groups past jobs and
                revenue by the address shot; we only mark it where the vendor documents it. We left Light Blue (no client portal mentioned) and ShootProof (a gallery platform
                with light studio tools) off the main list.
              </>
            }
          />
        </>
      ),
    },
    {
      id: "crms-reviewed",
      title: "The 10 best photography CRMs, reviewed",
      tocLabel: "The 10 CRMs",
      body: (ctx) => (
        <>
          <p>
            ShootPortal is first because it&apos;s our product and our pick for real estate photographers, drone
            pilots, and videographers. The other nine are listed with prices and features from their official pages.
          </p>

          <ToolCard
            rank={1}
            id="tool-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="The CRM built for real estate, drone, and video businesses, connected to your website, booking, proposals, delivery, video review, payment, and listing marketing"
            pricing={
              ctx.studioMonthly ? (
                <>
                  Studio plan: {ctx.studioMonthly}/month{ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}.
                  Stripe&apos;s standard processing fees apply.{" "}
                  {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Real estate photographers, drone pilots, and videographers with repeat clients who want one system from first inquiry to listing marketing."
            pros={[
              "Client records with property history, lifetime revenue, outstanding balance, average project value, last payment, last portal login, and notes",
              "Business website and Book a Shoot form that create the client and the project, with an instant estimate for the client",
              "Proposals with deposits, proposed shoot times the client approves, and an 8-stage pipeline with workflow automation",
              "Built-in photo editor plus video review with time-stamped comments, threaded replies, and numbered versions (no Frame.io or Dropbox Replay needed)",
              "Stripe payments straight to your account (ShootPortal takes 0%), downloads that unlock on payment, and a Marketing Kit you can sell to agents",
              "Unlimited staff accounts with granular permissions, all on one plan",
            ]}
            cons={[
              "One plan with every feature, so there's no cheaper stripped-down tier",
              "Built around client-facing jobs (proposals, delivery, payment) rather than wedding-style questionnaires",
            ]}
          >
            <p>
              ShootPortal approaches the CRM from the job outward. Each client record shows the projects and revenue
              tied to every property address you&apos;ve shot for them, alongside lifetime revenue, what they still
              owe, their last payment, and when they last logged into the portal. Notes and messages land on a timeline,
              so the context for a repeat booking is in one place.
            </p>
            <p>
              Here&apos;s what that looks like on an ordinary Tuesday. An agent you&apos;ve shot for a dozen times sends
              a request for a house you photographed two years ago. Open their record and the earlier project at that
              address is right there, with what you charged. You send a versioned estimate, the agent approves it in
              the portal (a deposit can be collected on approval), you propose a shoot time, and the project moves
              along the pipeline. When the finals are uploaded, the payment status, the messages, and the files all
              sit on the same project and roll up to the same client record, so lifetime revenue and outstanding
              balance reflect the job without a spreadsheet on the side.
            </p>
            <p>
              Where it differs from every other CRM on this list is that the whole job happens in the same system. The
              lead comes in through your own business website. You touch up a photo in the built-in editor and it
              updates the gallery. The client leaves time-stamped notes on the video, approves the final cut, pays, and
              downloads from one branded portal on their phone, opened from a link in their email, with no app to install. Then
              you hand the agent a property website and Just Listed posts built from the same photos.
            </p>
          </ToolCard>

          <Figure caption="Real ShootPortal screen: ShootPortal's client list, showing project counts, lifetime revenue, and outstanding balance per client (sample client data).">
            <ProductPreview view="clients" />
          </Figure>

          <Figure caption="Real ShootPortal screen: video review on the same project as the invoice and delivery. Client comments are pinned to the timestamp, with replies, Resolve buttons, and numbered versions, so you don't need a separate Frame.io or Dropbox Replay seat.">
            <AppScreen view="video-review" />
          </Figure>

          <InlineCta
            trialDays={ctx.trialDays}
            title="Stop paying for a CRM that ends at the invoice"
            body="Run one real client through ShootPortal: request, proposal, shoot time, edit, video review, payment, delivery, and a listing website. Every feature is on one plan."
          />

          <ToolCard
            rank={2}
            id="tool-honeybook"
            name="HoneyBook"
            url="https://www.honeybook.com/pricing"
            tagline="The best-known all-in-one CRM for creative businesses"
            pricing={
              <>
                List prices: Starter $29, Essentials $49, Premium $109 per month billed yearly ($36, $59, $129
                monthly). 30-day free trial, no card. <Ext href="https://www.honeybook.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="US wedding, portrait, and event photographers who want proposals, contracts, and payments in one smooth flow."
            pros={[
              "Proposals, contracts with e-signature, invoices, and payments built in",
              "Client portal, unlimited clients and projects, and HoneyBook AI on all plans",
              "Automations, SMS reminders, and QuickBooks Online from Essentials",
            ]}
            cons={[
              "No native galleries; Pic-Time integration instead",
              "Starter has no automations and a limited scheduler",
              "The pricing page lists card fees two different ways (from 2.7% + 10¢ and from 2.9% + 25¢), so confirm before you rely on either",
            ]}
          />

          <ToolCard
            rank={3}
            id="tool-dubsado"
            name="Dubsado"
            url="https://www.dubsado.com/pricing"
            tagline="Deeply customizable forms, workflows, and client portal"
            pricing={
              <>
                Starter $335/year, Premier $525/year (annual prices shown officially). 21-day trial with full Premier
                access, no card. <Ext href="https://www.dubsado.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Photographers who want to design every form and automated step themselves."
            pros={["Client portal and payment plans on both plans", "Legally binding contracts and lead capture forms", "3 extra users free; additional brands $10/mo"]}
            cons={["Workflows, advanced scheduling, and Zapier are Premier-only", "No gallery delivery", "A steeper setup curve than most"]}
          />

          <ToolCard
            rank={4}
            id="tool-studio-ninja"
            name="Studio Ninja"
            url="https://www.studioninja.co/pricing/"
            tagline="Affordable photography CRM with workflows on every tier"
            pricing={
              <>
                Starter $16/mo or $160/yr (5 active jobs), Pro $27/mo or $270/yr, Master $40/mo or $400/yr. 7-day trial,
                no card. <Ext href="https://www.studioninja.co/pricing/">Official pricing</Ext>
              </>
            }
            bestFor="Solo and small-team photographers who want automation without paying premium-tier prices."
            pros={["Workflow automation included on all tiers", "Stripe, Xero, QuickBooks, Google Calendar, Pic-Time, and ShootProof integrations", "Online booking forms from Pro"]}
            cons={["Starter limited to 5 active jobs", "Galleries come from integrations, not natively"]}
          />

          <ToolCard
            rank={5}
            id="tool-sprout-studio"
            name="Sprout Studio"
            url="https://getsproutstudio.com/pricing/"
            tagline="CRM, galleries, and proofing in one photography platform"
            pricing={
              <>
                Lite $19–$24/mo, Basic $36–$46, Pro $51–$66, Unlimited $69–$89 (lower figures appear to reflect yearly
                billing). <Ext href="https://getsproutstudio.com/pricing/">Official pricing</Ext>
              </>
            }
            bestFor="Portrait and wedding photographers who want the CRM and client galleries from one vendor."
            pros={["Client galleries with a store, plus design proofs", "Contracts, invoices, online scheduling, and workflows", "Commission-free"]}
            cons={["Lite caps active shoots and galleries at 10", "Trial length is shown as both 30 and 14 days on the site", "Payment processor isn't stated on the pricing page"]}
          />

          <ToolCard
            rank={6}
            id="tool-pixieset"
            name="Pixieset Studio Manager"
            url="https://pixieset.com/pricing-studio-manager/"
            tagline="Lightweight CRM from a popular gallery company, with a real free plan"
            pricing={
              <>
                Free; Plus $12/mo annual ($15 monthly); Pro $18/mo annual ($24 monthly). Suite bundles start at $28/mo
                annual. <Ext href="https://pixieset.com/pricing-studio-manager/">Official pricing</Ext>
              </>
            }
            bestFor="Gallery-first photographers who want light booking and invoicing without a big monthly bill."
            pros={["Free tier with unlimited invoices, basic booking, and online payments", "Pairs with Pixieset Client Gallery and Website in the Suite", "Retainers at booking and manual approval on Pro"]}
            cons={["Free tier limited to 3 contracts and 1 session type", "Workflow automations and team seats aren't mentioned on the pricing page", "Galleries are a separate plan unless you buy the Suite"]}
          />

          <ToolCard
            rank={7}
            id="tool-vsco-workspace"
            name="VSCO Workspace (formerly Táve)"
            url="https://www.vsco.co/workspace/pricing-plans"
            tagline="Long-standing studio management system, now part of VSCO One"
            pricing={
              <>
                Full Workspace is included with VSCO One at $499.99/year, billed annually; VSCO&apos;s Free, Plus, and
                Pro memberships get a simplified version. <Ext href="https://www.vsco.co/workspace/pricing-plans">Official pricing</Ext>
              </>
            }
            bestFor="Established studios that want deep automations and already use VSCO's editing tools."
            pros={["Contracts, quotes, invoices, questionnaires, and custom workflows", "Client portal, client text messaging, and calendar sync", "Includes 6 users and 4 brands"]}
            cons={[
              "No standalone Workspace subscription is listed; PetaPixel reports it is being phased out",
              "Annual-only billing with a 30-day refund window rather than a free trial",
            ]}
          >
            <p>
              Táve users will recognize the depth here. The pricing change is the story: according to{" "}
              <Ext href="https://petapixel.com/2026/06/23/why-vsco-believes-its-new-500-subscription-is-worth-it-for-pros/">PetaPixel</Ext>,
              standalone Workspace is ending, and existing subscribers can keep it for now. Budget for VSCO One if
              you&apos;re evaluating it fresh.
            </p>
          </ToolCard>

          <ToolCard
            rank={8}
            id="tool-17hats"
            name="17hats"
            url="https://17hats.com/pricing"
            tagline="All-in-one small business CRM with a free tier"
            pricing={
              <>
                One all-inclusive plan at $60/mo or $600/yr (first-year sale pricing shown); a free CRM plan with 4
                invoices per quarter. 7-day trial. <Ext href="https://17hats.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Photographers who want broad business tools (quotes, contracts, bookkeeping hooks) in one place."
            pros={["Quotes, contracts, questionnaires, and lead forms with auto-responses", "Client portal, QuickBooks Online, and Zapier", "Stripe and Square payments"]}
            cons={["Online scheduling is a paid add-on", "No galleries", "The FAQ mentions tiers that the pricing page doesn't price separately"]}
          />

          <ToolCard
            rank={9}
            id="tool-iris-works"
            name="Iris Works"
            url="https://www.iris-works.com/pricing"
            tagline="Booking-centric photography CRM"
            pricing={
              <>
                Starter $14.95/mo, Basic $29.95, Pro $39.95, Pro Plus $49.95 (annual options available). 14-day trial,
                no card. <Ext href="https://www.iris-works.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Portrait photographers who book a lot of sessions online."
            pros={["Online booking website and e-contracts", "Workflows from Basic", "Email marketing on higher tiers"]}
            cons={["Gallery delivery not included (Pic-Time / ShootProof integrations)", "Pro makes you choose booking or email marketing; Pro Plus has both"]}
          />

          <ToolCard
            rank={10}
            id="tool-bloom"
            name="Bloom"
            url="https://bloom.io/pricing"
            tagline="Budget all-in-one with galleries, websites, and contracts"
            pricing={
              <>
                Starter $7–$14/mo, Standard $17–$34, Plus $33–$66 (yearly vs. monthly). Starter carries a 1.5% payment
                fee. 7-day trial. <Ext href="https://bloom.io/pricing">Official pricing</Ext>
              </>
            }
            bestFor="New photographers who want galleries, a website, and invoicing for a low monthly price."
            pros={["Galleries, contracts, invoices, scheduling, and websites in one tool", "Unlimited automations on Standard and Plus", "No Bloom processing fee on Standard and Plus"]}
            cons={["Starter limited to 3 active projects and 1 automation", "Team access requires Plus", "The page's discount claims don't match the plan cards"]}
          />
        </>
      ),
    },
    {
      id: "who-should-choose-shootportal",
      title: "Why ShootPortal is the photography CRM software for real estate, drone, and video",
      tocLabel: "Why ShootPortal",
      body: (ctx) => (
        <>
          <p>
            A CRM for repeat, delivery-based clients has a different job than one for weddings. The question isn&apos;t
            &quot;did they sign and return the questionnaire?&quot; but &quot;what did we shoot for this agent last
            time, what did they pay, is anything still owed, and where are this week&apos;s files?&quot; When the
            client record, the projects, the messages, the files, and the payments live in one system, that answer is
            one page instead of four tabs.
          </p>
          <p>
            That&apos;s why ShootPortal is our pick for solo operators and small teams whose clients send work again
            and again: listing agents, builders, property managers, marketing teams, and companies that hire for aerial
            or video.
          </p>
          <p>
            It also helps you earn more from the clients you already have. Turn on the Marketing Kit and every
            delivered listing can come with a property website, social posts, Stories, and a print flyer that the agent
            can buy as an add-on and pay for through your Stripe. Their headshot, brokerage logo, and colors are saved on
            their client record, so the next listing&apos;s kit is ready with almost no work.
          </p>
          <BestFitPanel
            heading="Who ShootPortal fits as a CRM"
            fits={[
              {
                who: "Real estate photographers with repeat agents",
                why: "Property history shows every job and the revenue at each address, so a re-list starts with context, not a search through old emails.",
              },
              {
                who: "Drone and aerial operators",
                why: "Quote with ZIP-distance travel fees, propose the flight time, and deliver photos, video, and 3D or mapping embeds on the same client record.",
              },
              {
                who: "Commercial and video studios",
                why: "Time-stamped video comments, numbered versions, and the payment request sit on the same project as the client conversation.",
              },
              {
                who: "Small teams sharing the load",
                why: "Unlimited staff accounts with granular permissions can be assigned to specific projects, while balances and client history stay in one place.",
              },
            ]}
          />
          <Figure caption="Real ShootPortal screen: the Marketing Kit tab on a delivered project, where you offer the agent a property website and social media kit, free or as a paid add-on.">
            <AppScreen view="marketing-kit-tab" />
          </Figure>
          <AllInOnePlatform intro="The CRM is one part. The same subscription covers the website that brings the lead in and every step until the listing is marketed." />
          <p>
            If you need more than a CRM, our{" "}
            <SiteLink href="/photography-business-management-software">photography business management software</SiteLink> page
            covers how client records connect to scheduling, payments, and delivery.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Bring your best repeat client over and watch the record fill in"
            body={
              <>
                Add an agent you shoot for often, run their next listing through a proposal, a proposed time, video
                review, payment, and delivery, then offer them a property website. You&apos;ll see the client history,
                revenue, and balance build on their own. The guided setup covers your logo and colors, starter services,
                and connecting your own Stripe account.
              </>
            }
          />
          <p>
            For real estate work specifically, see our{" "}
            <SiteLink href="/real-estate-photography-crm">real estate photography CRM</SiteLink> page, built around agents and properties.
          </p>
        </>
      ),
    },
    {
      id: "how-to-choose",
      title: "How to choose the right photography CRM",
      tocLabel: "How to choose",
      body: () => (
        <>
          <PickGrid
            items={[
              {
                who: "Real estate, drone, or video",
                pick: "ShootPortal",
                why: "Property history, lifetime revenue, and balances on the client record, with your website, proposals, video review, payment, delivery, and listing marketing on the same projects.",
              },
              {
                who: "You want CRM, galleries, and automation in one",
                pick: "ShootPortal",
                why: "Client records, branded delivery, video review, reminders, and automated emails on one flat plan, with no per-tier upsell.",
              },
              {
                who: "Weddings and events",
                pick: "HoneyBook or Dubsado",
                why: "Proposals, contracts with e-signature, questionnaires, and payment plans are their core strength.",
              },
              {
                who: "Established VSCO studio",
                pick: "VSCO Workspace",
                why: "Deep workflows and multiple brands, now through VSCO One.",
              },
            ]}
          />
          <KeyTakeaways
            items={[
              "Decide whether your work is session-based or delivery-based before comparing features.",
              "Check which tier unlocks automations; it's often not the entry plan.",
              "Price the whole stack: CRM, gallery, video review seats, website, and listing marketing tools. An all-in-one plan often costs less than the CRM plus its add-ons.",
              <>
                If your clients interact with you mainly through deliveries, read our{" "}
                <BlogLink slug="best-photography-client-portals">client portal comparison</BlogLink>.
              </>,
              <>
                Shooting listings? Our <BlogLink slug="best-real-estate-photography-software">real estate photography software guide</BlogLink>{" "}
                covers platforms built for agents.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "switching-crms",
      title: "How to switch photography CRMs without losing clients",
      tocLabel: "Switching CRMs",
      body: () => (
        <>
          <p>
            The best time to switch is between busy seasons, and the safest way is to run both tools briefly instead
            of cutting over in one day.
          </p>
          <Steps
            items={[
              {
                title: "Export everything first",
                body: "Pull your contact list, past invoices, and any templates you'll want to recreate. Check how long the old tool keeps your data after you cancel.",
              },
              {
                title: "Rebuild your services and templates",
                body: "Set up packages, email templates, and any contract or estimate templates before importing clients, so new jobs start clean.",
              },
              {
                title: "Start new inquiries in the new system",
                body: "Let in-progress jobs finish in the old tool. Route every new lead to the new one from a specific date.",
              },
              {
                title: "Test the client side yourself",
                body: "Book, approve, pay, and download as if you were a client, on your phone. That's what your clients will judge you on.",
              },
              {
                title: "Cancel once the last old job is paid",
                body: "Keep the old account until every open invoice is settled and delivered.",
              },
            ]}
          />
        </>
      ),
    },
    {
      id: "verdict",
      title: "Our verdict",
      body: () => (
        <>
          <p>
            If your clients are agents, builders, marketing teams, or businesses that hire you for aerial and video
            work, ShootPortal is the photography CRM software we recommend. It&apos;s the only tool here where the
            client record is connected to your website, booking form, proposals, scheduling, photo editing, video
            review, payment, delivery, and listing marketing, so you stop stitching five apps together and your
            clients get one simple, branded place to approve, pay, comment, and download.
          </p>
          <p>
            HoneyBook, Dubsado, Studio Ninja, Iris Works, Pixieset Studio Manager, Sprout Studio, and Bloom are built
            around session paperwork for weddings and portraits. <SiteLink href="/how-it-works">See how the ShootPortal workflow fits together</SiteLink>, or
            compare drone-specific options in our{" "}
            <BlogLink slug="best-drone-business-management-software">drone business software guide</BlogLink>.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best CRM for photographers?",
      answerText:
        "For real estate photographers, drone pilots, and videographers, ShootPortal is the strongest choice because the client record is connected to your website, booking, proposals, video review, payment, delivery, and listing marketing. HoneyBook and Dubsado are built around wedding and portrait paperwork, Pixieset Studio Manager has a free plan, and Sprout Studio and Bloom include galleries.",
      answer: (
        <p>
          For real estate photographers, drone pilots, and videographers, ShootPortal is the strongest choice because
          the client record is connected to your website, booking, proposals, video review, payment, delivery, and
          listing marketing. HoneyBook and Dubsado are built around wedding and portrait paperwork, Pixieset Studio
          Manager has a free plan, and Sprout Studio and Bloom include galleries.
        </p>
      ),
    },
    {
      question: "Is there a free CRM for photographers?",
      answerText:
        "Yes. Pixieset Studio Manager has a free plan with unlimited invoices and limited contracts, 17hats has a free CRM plan with 4 invoices per quarter, and HubSpot offers a free general-purpose CRM for up to 2 users and 1,000 contacts.",
      answer: (
        <p>
          Yes. Pixieset Studio Manager has a free plan with unlimited invoices and limited contracts, 17hats has a free
          CRM plan with 4 invoices per quarter, and HubSpot offers a free general-purpose CRM for up to 2 users and
          1,000 contacts, though it isn&apos;t built for photography.
        </p>
      ),
    },
    {
      question: "How do clients approve work in ShootPortal?",
      answerText:
        "Clients approve official proposals online with one click, which can collect a deposit automatically. They also approve or request a different shoot time, approve or flag each deliverable, leave time-stamped video comments, pay, and download, all from the same branded portal with no app to install.",
      answer: (
        <p>
          Clients approve official proposals online with one click, which can collect a deposit automatically. They also
          approve or request a different shoot time, approve or flag each deliverable, leave time-stamped video
          comments, pay, and download, all from the same branded portal with no app to install.
        </p>
      ),
    },
    {
      question: "Does ShootPortal edit photos?",
      answerText:
        "Yes. ShootPortal has a built-in photo editor with one-click Auto, exposure, highlights and shadows, white balance, curves, crop, HDR and black-and-white looks, spot removal, masks, and lens corrections. You can copy adjustments across a batch, originals are never overwritten, and Save to Project updates the client's gallery and downloads instantly.",
      answer: (
        <p>
          Yes. ShootPortal has a built-in photo editor with one-click Auto, exposure, highlights and shadows, white
          balance, curves, crop, HDR and black-and-white looks, spot removal, masks, and lens corrections. You can copy
          adjustments across a batch, originals are never overwritten, and Save to Project updates the client&apos;s
          gallery and downloads instantly.
        </p>
      ),
    },
    {
      question: "Can a photography CRM replace Dropbox Replay or Frame.io?",
      answerText:
        "ShootPortal can for client feedback. Its video review pins client comments to a timestamp and a point on the frame, supports threaded replies, resolve and reopen, numbered versions, and approve or request changes, on the same project as the invoice and delivery. It is included in the plan with no per-user add-on.",
      answer: (
        <p>
          ShootPortal can for client feedback. Its video review pins client comments to a timestamp and a point on the
          frame, supports threaded replies, resolve and reopen, numbered versions, and approve or request changes, on
          the same project as the invoice and delivery. It is included in the plan with no per-user add-on.
        </p>
      ),
    },
    {
      question: "What happened to Táve?",
      answerText:
        "Táve became VSCO Workspace. VSCO's pricing page now includes full Workspace with VSCO One at $499.99 per year, and PetaPixel reported in June 2026 that standalone Workspace is ending, with existing subscribers able to keep it for now.",
      answer: (
        <p>
          Táve became VSCO Workspace. VSCO&apos;s pricing page now includes full Workspace with VSCO One at $499.99 per
          year, and PetaPixel reported in June 2026 that standalone Workspace is ending, with existing subscribers able
          to keep it for now.
        </p>
      ),
    },
    {
      question: "Do I need a separate gallery tool with my CRM?",
      answerText:
        "With HoneyBook, Dubsado, Studio Ninja, 17hats, and Iris Works, usually yes, since they don't deliver galleries natively. Sprout Studio, Bloom, and Pixieset (with its gallery plan) include galleries, and ShootPortal delivers photos, video, tours, and 3D embeds itself.",
      answer: (
        <p>
          With HoneyBook, Dubsado, Studio Ninja, 17hats, and Iris Works, usually yes, since they don&apos;t deliver
          galleries natively. Sprout Studio, Bloom, and Pixieset (with its gallery plan) include galleries, and
          ShootPortal delivers photos, video, tours, and 3D embeds itself. See our{" "}
          <BlogLink slug="best-photo-video-delivery-platforms">delivery platform comparison</BlogLink>.
        </p>
      ),
    },
  ],
  related: ["best-photography-client-portals", "best-drone-business-management-software", "best-photo-video-delivery-platforms"],
  cta: {
    title: "The CRM that runs the whole job, not just the paperwork.",
    body: "Client history, revenue, and balances on one record, connected to your website, proposals, scheduling, photo editing, video review, payment, delivery, and listing marketing. One plan, 0% of your payments.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
