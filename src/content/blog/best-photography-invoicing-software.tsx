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
import { ToolCategoryMap } from "@/components/blog/diagrams";
import { PaymentFlowDiagram } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { BestFitPanel, ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { AllInOnePlatform, AppScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "best-photography-invoicing-software",
  title: "Best Photography Invoicing and Payment Software in 2026",
  seoTitle: "Best Photography Invoicing Software & Payment Tools (2026)",
  description:
    "Photography invoicing software compared on deposits, card and ACH fees, and pay links: ShootPortal, QuickBooks, FreshBooks, Wave, Stripe, HoneyBook, more.",
  excerpt:
    "Ten invoicing and payment tools photographers use, compared on published card and ACH fees, deposits, and estimates, and on whether payment is tied to the approved proposal and the delivery.",
  category: "pricing-payments",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "photography invoicing software",
  secondaryKeywords: [
    "invoicing software for photographers",
    "photography payment software",
    "photographer deposit invoice",
    "best invoicing app for photographers",
    "photography invoice fees",
    "real estate photography invoicing",
    "photography pay link",
    "ACH payments for photographers",
  ],
  readingMinutes: 18,
  cover: {
    variant: "invoice",
    tint: "emerald",
    label: "2026 Comparison",
    alt: "Illustration of an invoice card with a paid status on an emerald background",
  },
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Best overall for real estate photographers, drone pilots, and videographers: ShootPortal</strong> (our
        product). The invoice is created when the client approves your proposal, the deposit is collected right there,
        and the final downloads unlock on their own when the balance is paid.
      </>,
      <>
        <strong>No platform cut.</strong> ShootPortal takes 0% of client payments. Money goes straight to your own Stripe
        account at Stripe&apos;s standard rates, with optional ACH bank payments and optional card-fee pass-through.
      </>,
      <>
        <strong>Clients don&apos;t need an account.</strong> Pay links open without a login, and wallets like Apple Pay
        and Google Pay work at checkout.
      </>,
      <>
        <strong>One subscription, not a stack.</strong> The same plan covers your website, booking, proposals, video
        review, delivery, and listing marketing, so invoicing isn&apos;t another app to pay for.
      </>,
      <>
        <strong>Comparing general tools?</strong> QuickBooks, FreshBooks, Wave, Square, Stripe Invoicing, PayPal,
        HoneyBook, Dubsado, and Studio Ninja are all reviewed below with their published fees.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Sending a photography invoice looks simple: a line item, a total, a pay button. The work is everything around
        it. Was the deposit paid before you booked the date? Did the balance come in before the gallery went out? Which
        client still owes you from last month, and was that the job where you added a twilight session?
      </p>
      <p>
        Most <strong>photography invoicing software</strong> answers one of those questions. Accounting apps track every
        dollar but know nothing about your shoot. Payment processors move money cheaply but don&apos;t know what the
        money is for. ShootPortal answers all of them on the same project: the client approves your proposal, pays the
        deposit, books the shoot, reviews the media, pays the balance from a link that needs no login, and downloads the
        files the moment the payment lands.
      </p>
      <p>
        Below, we compare ShootPortal with nine other tools photographers use to bill clients, using each vendor&apos;s
        published card and ACH rates and a worked fee example on a $500 job. Every competitor price links to the
        official page so you can check it yourself.
      </p>
    </>
  ),
  sections: [
    {
      id: "why-dedicated-invoicing",
      title: "Why photographers need more than a generic invoice",
      tocLabel: "Why it matters",
      body: () => (
        <>
          <p>
            A plumber invoices after the work is done. A photographer usually needs money at two or three points in the
            job, and the timing of each one protects you from a different risk.
          </p>
          <ul>
            <li>
              <strong>The deposit protects the date.</strong> Once you&apos;ve held a Saturday morning or a golden-hour
              slot, a cancellation costs you a booking you turned down. A deposit at approval makes the commitment
              mutual.
            </li>
            <li>
              <strong>The balance protects the files.</strong> If full-resolution images go out before the balance is
              paid, you&apos;ve handed over your leverage. Most collection problems start here.
            </li>
            <li>
              <strong>Add-ons change the total.</strong> Extra rooms, a drone add-on, a rush edit, or travel to a
              farther address all change the final number. The invoice needs to match what was actually delivered.
            </li>
          </ul>
          <p>
            That&apos;s why the best setup ties the invoice to the job record: what the client approved, when you shot
            it, what you delivered, and what&apos;s still owed. If you want the policy side of this, including deposit
            percentages and how to word payment terms, read our guide on{" "}
            <BlogLink slug="get-paid-before-delivering-real-estate-photos">getting paid before you deliver</BlogLink>.
            This article is about the software.
          </p>
          <ProductCallout title="The invoice is created when the client approves the proposal">
            <p>
              In ShootPortal you don&apos;t build invoices by hand. When the client clicks Approve Proposal, the payment
              is created from the approved line items, with the deposit you set (a percentage, a fixed amount, or pay in
              full). The balance is requested from the same project, and the downloads stay locked until it&apos;s paid.
            </p>
          </ProductCallout>
          <Figure caption="Conceptual diagram: where money changes hands in a typical photography job, from approved estimate to unlocked downloads.">
            <PaymentFlowDiagram withDeposit />
          </Figure>
          <FreeResourceCallout resource="photography-invoice" note="Not ready for software yet? Start with a free invoice template that calculates totals, deposit, tax, and balance due." />
        </>
      ),
    },
    {
      id: "three-kinds-of-tools",
      title: "Invoicing tools vs. payment processors vs. workflow platforms",
      tocLabel: "Three kinds of tools",
      body: () => (
        <>
          <p>
            &quot;Invoicing software&quot; covers three different kinds of product, and the fees stack differently in
            each one. Knowing which layer you&apos;re buying saves a lot of confusion when you compare prices.
          </p>
          <h3>Payment processors</h3>
          <p>
            Stripe, Square, and PayPal actually move the money from the client&apos;s card or bank to yours. Every tool
            in this guide sits on top of a processor, either its own or one you connect. The processor&apos;s
            percentage-plus-fixed-fee is the cost you can&apos;t avoid.
          </p>
          <h3>Invoicing and accounting layers</h3>
          <p>
            QuickBooks Online, FreshBooks, Wave, and Stripe Invoicing create the invoice, send reminders, record the
            payment, and (for the accounting apps) post it to your books. Some charge a subscription, some charge a
            percentage per paid invoice on top of processing. Stripe Invoicing, for example, publishes a{" "}
            <Ext href="https://stripe.com/invoicing/pricing">0.4% per paid invoice</Ext> fee on its Starter tier,
            charged in addition to standard Stripe payment fees.
          </p>
          <h3>Client and workflow platforms</h3>
          <p>
            HoneyBook, Dubsado, Studio Ninja, Bloom, and ShootPortal start from the client and the job. The invoice is
            one step in a flow that might include a proposal and a schedule. ShootPortal goes furthest: the same project
            also holds the video review, the media delivery, and the listing marketing, so payment can control what the
            client can download. Our <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink> goes
            deeper on the client-management side of these tools.
          </p>
          <Figure caption="Conceptual diagram: what each category of tool typically covers, and the gaps you fill with something else.">
            <ToolCategoryMap
              columns={[
                {
                  title: "Accounting software",
                  examples: "e.g. QuickBooks Online, FreshBooks, Wave",
                  covers: ["Invoices & estimates", "Bookkeeping & reports", "Expenses", "Tax-time records"],
                  gaps: ["Shoot scheduling", "Media delivery", "Client approvals on the job"],
                },
                {
                  title: "Invoicing & payment apps",
                  examples: "e.g. Square Invoices, Stripe Invoicing, PayPal",
                  covers: ["Fast invoices", "Card & bank payments", "Reminders"],
                  gaps: ["Client history", "Job workflow", "Delivery", "Full accounting"],
                },
                {
                  title: "Client & workflow platforms",
                  examples: "e.g. HoneyBook, Dubsado, Studio Ninja, ShootPortal",
                  covers: ["Proposals or estimates", "Deposits & balances", "Client portal", "Status per job"],
                  gaps: ["Bookkeeping & tax reports"],
                  accent: true,
                },
              ]}
            />
          </Figure>
          <p>
            For a real estate, drone, or video business, the client-facing side is where money is won or lost: the
            deposit that protects the date, the balance that comes in before the files go out, and the pay button the
            client can actually find. That&apos;s the layer worth choosing carefully. Every payment you collect through
            ShootPortal also lands in your own Stripe account with a receipt, so the record is there when tax time
            comes.
          </p>
        </>
      ),
    },
    {
      id: "features-to-compare",
      title: "What to look for in photography invoicing software",
      tocLabel: "Features to compare",
      body: () => (
        <>
          <h3>Estimates that turn into invoices</h3>
          <p>
            Most photography work is quoted before it&apos;s billed. Look for estimates (or quotes, or proposals) the
            client can approve online, with the approved total carrying through to the invoice so you never retype
            line items. If your prices depend on property size or travel distance, our{" "}
            <BlogLink slug="real-estate-photography-pricing-guide">real estate photography pricing guide</BlogLink>{" "}
            covers how to structure packages and add-ons before you build them into any tool.
          </p>
          <FreeResourceCallout tool="quote-builder" note="See what a clean, approvable quote looks like: build one free with your logo, add-ons, deposit, and terms." />
          <h3>Deposits and payment schedules</h3>
          <p>
            You want to take a deposit (as a percentage or a fixed amount) at booking and the balance later, without
            building two invoices by hand. Check whether deposits are on the plan you&apos;d actually buy; on some
            accounting tools they&apos;re standard, but confirm before assuming.
          </p>
          <h3>Payment methods: card, wallets, and ACH</h3>
          <p>
            Cards are what most clients reach for, and Apple Pay or Google Pay makes paying from a phone a two-tap job.
            ACH (bank transfer) is slower, but it&apos;s usually much cheaper, and several processors cap the fee, which
            matters on large commercial invoices. PayPal and Venmo matter if your clients ask for them.
          </p>
          <h3>A pay link the client can open without logging in</h3>
          <p>
            Real estate agents won&apos;t create an account to pay a $250 invoice. The pay button in your email should
            open a checkout page directly. Every extra step between &quot;your photos are ready&quot; and &quot;paid&quot;
            is a day of waiting.
          </p>
          <h3>Tracking: who owes what</h3>
          <p>
            An unpaid-invoices list is the minimum. Better is a status that lives on the job itself, so you can see
            &quot;shot, edited, delivered, unpaid&quot; at a glance and send a reminder from the same screen.
          </p>
          <h3>Fees, all of them</h3>
          <p>
            Add the monthly subscription, the processor&apos;s card or ACH rate, and any per-invoice or platform
            percentage. A free invoicing tool with a higher card rate can cost more than a paid one once you&apos;re
            billing every week. Also check whether you can pass the card fee on to the client; on high-volume real estate
            work, that alone can be worth more than a lower rate.
          </p>
        </>
      ),
    },
    {
      id: "fee-comparison",
      title: "Card and ACH fees compared (with a $500 example)",
      tocLabel: "Fee comparison",
      body: (ctx) => (
        <>
          <p>
            These are the published US rates on each vendor&apos;s official page as of October 15, 2026. Rates change,
            volume discounts exist, and your account may be priced differently, so treat this as a starting point and
            confirm on the linked pages.
          </p>
          <ComparisonTable
            caption="Published card and ACH processing rates for photography invoicing tools, October 2026"
            columns={["Tool", "Subscription", "Card rate (US)", "ACH / bank rate", "Source"]}
            rows={[
              [
                "ShootPortal",
                "Flat monthly plan; 0% platform fee",
                "Stripe's standard rate on your own Stripe account; optional pass-through to the client",
                "Optional; Stripe's standard ACH rate",
                <SiteLink key="s0" href="/pricing">Pricing</SiteLink>,
              ],
              [
                "Stripe (direct)",
                "None",
                "2.9% + 30¢",
                "0.8%, $5 cap",
                <Ext key="s1" href="https://stripe.com/pricing">stripe.com</Ext>,
              ],
              [
                "Stripe Invoicing",
                "None",
                "Stripe fees + 0.4% (Starter) or 0.5% (Plus) per paid invoice",
                "Stripe ACH fees + same invoicing %",
                <Ext key="s2" href="https://stripe.com/invoicing/pricing">stripe.com</Ext>,
              ],
              [
                "QuickBooks Online",
                "From $38/mo (Simple Start)",
                "2.99% (invoiced card)",
                "1% (a $1 minimum is shown; confirm)",
                <Ext key="s3" href="https://quickbooks.intuit.com/payments/payment-rates/">intuit.com</Ext>,
              ],
              [
                "FreshBooks",
                "From $23/mo (Lite)",
                "2.9% + 30¢",
                "1%",
                <Ext key="s4" href="https://www.freshbooks.com/pricing">freshbooks.com</Ext>,
              ],
              [
                "Wave",
                "Starter $0; Pro $19/mo",
                "2.9% + 60¢ (Starter); Amex 3.4% + 60¢",
                "Not listed on pricing page",
                <Ext key="s5" href="https://www.waveapps.com/pricing">waveapps.com</Ext>,
              ],
              [
                "Square Invoices",
                "Free plan; Plus: see Square",
                "3.3% + 30¢ (Free); 2.9% + 30¢ (Plus/Premium)",
                "1%, $1 min ($10 cap on Plus/Premium)",
                <Ext key="s6" href="https://squareup.com/help/us/en/article/5068-square-s-payment-processing-fees-and-pricing">squareup.com</Ext>,
              ],
              [
                "PayPal Invoicing",
                "None",
                "2.99% + 49¢ (cards); 3.49% + 49¢ (PayPal/Venmo checkout)",
                "1%, $10 cap",
                <Ext key="s7" href="https://www.paypal.com/us/business/paypal-business-fees">paypal.com</Ext>,
              ],
              [
                "HoneyBook",
                "From $29/mo billed yearly",
                "Page lists both 2.9% + 25¢ and 2.7% + 10¢",
                "1.5%",
                <Ext key="s8" href="https://www.honeybook.com/pricing">honeybook.com</Ext>,
              ],
              [
                "Dubsado",
                "From $335/yr",
                "2.9% + 30¢ (Dubsado Payments)",
                "0.8%, $5 cap",
                <Ext key="s9" href="https://help.dubsado.com/en/articles/15920643-dubsado-payments-processing-fees">dubsado.com</Ext>,
              ],
              [
                "Studio Ninja",
                "From $16/mo",
                "Stripe's fees (or PayPal's)",
                "Depends on processor",
                <Ext key="s10" href="https://www.studioninja.co/pricing/">studioninja.co</Ext>,
              ],
            ]}
            note={
              <>
                Rates from official vendor pages, checked October 15, 2026. HoneyBook&apos;s own pricing page shows two
                different starting card rates; check your account. Wave&apos;s Pro plan waives the fixed fee on the
                first 10 card transactions each month. QuickBooks&apos; page layout makes it unclear whether its $1
                minimum applies to ACH.
              </>
            }
          />
          <h3>Worked example: what a $500 invoice costs in fees</h3>
          <p>
            Here&apos;s the arithmetic on a single $500 invoice using the published rates above. This is plain math on
            the listed rates, not a measured result. It leaves out subscriptions, international cards, instant payouts,
            and any discounts your account might qualify for.
          </p>
          <ComparisonTable
            caption="Arithmetic example: processing fees on a $500 invoice at published rates"
            columns={["Tool / rate used", "Paid by card", "Paid by ACH", "You receive (card)"]}
            rows={[
              ["Stripe direct: 2.9% + 30¢ / 0.8%", "$14.80", "$4.00", "$485.20"],
              ["Stripe Invoicing Starter: above + 0.4%", "$16.80", "$6.00", "$483.20"],
              ["QuickBooks Payments: 2.99% / 1%", "$14.95", "$5.00", "$485.05"],
              ["FreshBooks Payments: 2.9% + 30¢ / 1%", "$14.80", "$5.00", "$485.20"],
              ["Wave Starter: 2.9% + 60¢", "$15.10", "Not listed", "$484.90"],
              ["Square Free plan: 3.3% + 30¢ / 1%", "$16.80", "$5.00", "$483.20"],
              ["Square Plus: 2.9% + 30¢ / 1%", "$14.80", "$5.00", "$485.20"],
              ["PayPal, standard card: 2.99% + 49¢ / 1%", "$15.44", "$5.00", "$484.56"],
              ["PayPal or Venmo checkout: 3.49% + 49¢", "$17.94", "n/a", "$482.06"],
              ["HoneyBook at 2.9% + 25¢ / 1.5%", "$14.75", "$7.50", "$485.25"],
              ["HoneyBook at 2.7% + 10¢", "$13.60", "$7.50", "$486.40"],
              ["Dubsado Payments: 2.9% + 30¢ / 0.8%", "$14.80", "$4.00", "$485.20"],
            ]}
            note={
              <>
                Arithmetic only, using the US rates published on each official page on October 15, 2026. ShootPortal and
                Studio Ninja payments run through Stripe, so Stripe&apos;s standard rates on your own account apply.
                ShootPortal adds no percentage of its own, and with card-fee pass-through turned on, the client covers
                the card fee instead of you.
              </>
            }
          />
          <p>
            Two things stand out. First, on a typical card payment the processors land within a couple of dollars of
            each other; the subscription and the workflow matter more than the card rate. Second, ACH is where the
            real differences are. On a $5,000 commercial or wedding invoice, Dubsado&apos;s 0.8% capped at $5 costs $5,
            while HoneyBook&apos;s uncapped 1.5% costs $75, by the same arithmetic. If you bill large jobs, the ACH cap
            is worth more than any feature.
          </p>
          <Callout tone="warning" title="Platform fees on top of processing">
            <p>
              Some workflow tools add their own percentage. Bloom&apos;s Starter plan, for example, publishes a{" "}
              <Ext href="https://bloom.io/pricing">1.5% platform fee</Ext> on digital payments in addition to Stripe or
              Square processing; its Standard and Plus plans don&apos;t. Always check for a platform fee before
              comparing card rates. ShootPortal takes 0% of client payments on every account.
            </p>
          </Callout>
          <InlineCta
            trialDays={ctx.trialDays}
            title="Keep 100% of what your clients pay"
            body="ShootPortal takes no cut of client payments. Connect your own Stripe account, turn on ACH or card-fee pass-through if you want them, and send your first pay link today."
          />
        </>
      ),
    },
    {
      id: "tools",
      title: "The best photography invoicing and payment software, reviewed",
      tocLabel: "The 10 tools",
      body: (ctx) => (
        <>
          <p>
            ShootPortal is our product, and it&apos;s first because it&apos;s the only tool here where the proposal,
            the invoice, the video review, and the delivery are the same project. For real estate photographers, drone
            pilots, and videographers, that&apos;s the difference between chasing payments and having them arrive on
            their own.
          </p>

          <ToolCard
            rank={1}
            id="tool-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="Invoices created on proposal approval, paid from a link, with downloads that unlock on payment"
            pricing={
              ctx.studioMonthly ? (
                <>
                  {ctx.studioMonthly}/month{ctx.studioAnnual ? <>, or {ctx.studioAnnual}/month billed annually</> : null}.
                  0% platform fee; Stripe&apos;s standard processing fees apply.{" "}
                  {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription, 0% platform fee; Stripe&apos;s standard processing fees apply. See{" "}
                  <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Real estate photographers, drone pilots, and videographers who want deposits, balances, and delivery handled on the same job, under their own brand."
            pros={[
              "Payment is created automatically when the client approves your proposal, with a deposit as a percentage, a fixed amount, or pay in full",
              "Pay links open without a login; clients pay by card, Apple Pay, Google Pay, or optional ACH bank transfer",
              "0% platform fee: money goes straight to your own Stripe account through Stripe Connect",
              "Optional card-fee pass-through so the client covers processing",
              "Downloads unlock automatically on payment, and the project can move to Delivered on its own",
              "Receipt PDFs and receipt emails, payment reminders, and offline payments you can mark paid",
            ]}
            cons={[
              "Built for client billing on the job rather than bookkeeping; your accountant still works from your Stripe records",
            ]}
          >
            <p>
              ShootPortal approaches invoicing from the job rather than the ledger. A client requests a shoot through your
              branded form and sees a preliminary estimate the moment they submit. You send an official proposal (with
              versions, an expiry date, and a PDF), and when they click Approve Proposal the payment is created for you,
              with the deposit collected right then. After the shoot, the client gets a Pay Now button in their portal and
              a pay link in their email that opens without a login.
            </p>
            <p>
              The part photographers care about most is the link between payment and delivery. Clients can view and
              review their photos and video while the downloads stay locked until the final payment clears. Then the
              files unlock, the receipt goes out, and the project moves to Delivered without you touching it. Each client
              record shows lifetime revenue, outstanding balance, and last payment, so you always know who owes what.
            </p>
            <p>
              Because invoicing is part of one platform, the same subscription also covers your business website,
              scheduling, video review that replaces Dropbox Replay or Frame.io for client feedback, branded delivery, and
              a Marketing Kit you can sell to agents as an add-on on the same invoice.
            </p>
          </ToolCard>

          <Figure caption="Real ShootPortal screens: the proposal you send (left) and what your client sees, with the deposit terms and an Approve Proposal button. Approval creates the payment automatically.">
            <TwoSidedScreens business="proposals" client="portal-proposal" />
          </Figure>

          <ToolCard
            rank={2}
            id="tool-quickbooks"
            name="QuickBooks Online"
            url="https://quickbooks.intuit.com/pricing/"
            tagline="Full accounting with invoicing and QuickBooks Payments built in"
            pricing={
              <>
                Free plan (1 user); Simple Start $38/mo, Essentials $85/mo, Plus $140/mo, Advanced $340/mo regular
                price, with promotional discounts for the first months (
                <Ext href="https://quickbooks.intuit.com/pricing/">official pricing</Ext>). Invoiced card 2.99%, ACH 1%
                (<Ext href="https://quickbooks.intuit.com/payments/payment-rates/">payment rates</Ext>).
              </>
            }
            bestFor="Photographers who want invoicing and real bookkeeping in the same system, or who work with an accountant."
            pros={[
              "Invoices post straight into your books",
              "The tool most accountants already know",
              "Card, Apple Pay, PayPal, and Venmo on invoices, per Intuit's rate page",
              "Volume discounts may apply above $2,500/month in payments",
            ]}
            cons={[
              "Knows nothing about shoots, galleries, or delivery",
              "Estimates, deposits, and partial payments weren't confirmed per plan on the pricing page; check before buying",
              "Higher monthly cost than invoicing-only tools",
            ]}
          >
            <p>
              QuickBooks Online is the safe choice if tax time is your biggest headache. It&apos;s an accounting system
              that also invoices, which is the reverse of most tools here. Many photographers keep it as the books of
              record and send the client-facing payment requests from a workflow tool.
            </p>
          </ToolCard>

          <ToolCard
            rank={3}
            id="tool-freshbooks"
            name="FreshBooks"
            url="https://www.freshbooks.com/pricing"
            tagline="Polished invoicing and accounting for solo service businesses"
            pricing={
              <>
                Lite $23/mo (5 billable clients), Plus $43/mo (50 clients), Premium $70/mo (unlimited), with intro
                promos (<Ext href="https://www.freshbooks.com/pricing">official pricing</Ext>). Card 2.9% + 30¢, ACH 1%.
              </>
            }
            bestFor="Solo photographers who want clean invoices, estimates, deposits, and time and expense tracking."
            pros={[
              "Estimates, recurring invoices, deposits, and a client portal on all plans",
              "Same published rates whether you use FreshBooks Payments or Stripe through FreshBooks",
              "Simple enough to set up in an afternoon",
            ]}
            cons={[
              "Lite plan's 5-billable-client limit is tight for most photographers",
              "No shoot scheduling or media delivery",
            ]}
          >
            <p>
              FreshBooks sits between pure invoicing and full accounting. It&apos;s friendlier than QuickBooks for a
              one-person business, and deposits and estimates are included on every plan. Watch the client limits: a
              real estate photographer with a dozen regular agents is already past Lite.
            </p>
          </ToolCard>

          <ToolCard
            rank={4}
            id="tool-wave"
            name="Wave"
            url="https://www.waveapps.com/pricing"
            tagline="Free invoicing and basic accounting for budget-conscious beginners"
            pricing={
              <>
                Starter $0 with unlimited estimates and invoices; Pro $19/mo or $190/yr (
                <Ext href="https://www.waveapps.com/pricing">official pricing</Ext>). Cards 2.9% + 60¢ (Amex 3.4% + 60¢).
              </>
            }
            bestFor="New photographers who need professional invoices without a monthly bill."
            pros={[
              "Free plan with unlimited estimates and invoices",
              "Pro waives the fixed card fee on the first 10 transactions each month",
              "Pro adds automated late-payment reminders and removes Wave branding",
            ]}
            cons={[
              "60¢ fixed card fee is double the 30¢ most processors charge",
              "ACH fee not listed on the pricing page",
              "Online payments are optional and require approval",
            ]}
          >
            <p>
              Wave is the easiest way to stop sending invoices from a Word template. The trade-off is the higher fixed
              fee per card payment on Starter, which adds up if you bill many small jobs.
            </p>
          </ToolCard>

          <ToolCard
            rank={5}
            id="tool-square"
            name="Square Invoices"
            url="https://squareup.com/us/en/invoices/pricing"
            tagline="Free invoicing with deposits, estimates, and Square's in-person ecosystem"
            pricing={
              <>
                Free plan available; Plus pricing isn&apos;t shown on the page we checked, see{" "}
                <Ext href="https://squareup.com/us/en/invoices/pricing">Square&apos;s invoices pricing</Ext>. Invoice
                card fee 3.3% + 30¢ on Free, 2.9% + 30¢ on Plus and Premium; ACH 1% ($1 min, $10 cap on Plus/Premium) (
                <Ext href="https://squareup.com/help/us/en/article/5068-square-s-payment-processing-fees-and-pricing">fee details</Ext>).
              </>
            }
            bestFor="Photographers who already use Square for in-person sales, prints, or events."
            pros={[
              "Free plan includes estimates, recurring invoices, and deposit requests with a separate balance due date",
              "Plus adds milestone payment schedules and custom templates",
              "Same account as Square's card readers",
            ]}
            cons={[
              "The free plan's card rate is the highest standard rate in this table",
              "No cap on ACH on the free plan",
              "Plan pricing was not shown on the US invoices page when we checked",
            ]}
          >
            <p>
              Square&apos;s free plan is genuinely capable: deposits with a separate due date for the balance are
              exactly what photographers need. If you invoice a lot, the jump from 3.3% to 2.9% on Plus may pay for
              itself, but you&apos;ll need to check the current Plus price in your Square Dashboard.
            </p>
          </ToolCard>

          <ToolCard
            rank={6}
            id="tool-stripe"
            name="Stripe Invoicing"
            url="https://stripe.com/invoicing/pricing"
            tagline="Pay-per-invoice billing from the processor most photography tools run on"
            pricing={
              <>
                No monthly fee. Starter 0.4% per paid invoice; Plus 0.5% (adds quotes) (
                <Ext href="https://stripe.com/invoicing/pricing">invoicing pricing</Ext>), plus Stripe payment fees: 2.9% +
                30¢ for US cards, ACH 0.8% capped at $5 (<Ext href="https://stripe.com/pricing">Stripe pricing</Ext>).
              </>
            }
            bestFor="Tech-comfortable photographers who want low ACH costs and no subscription."
            pros={[
              "Cheapest published ACH rate in this guide, with a $5 cap",
              "No subscription; you only pay when an invoice is paid",
              "The same Stripe account can also power your workflow tool",
            ]}
            cons={[
              "Stripe's dashboard is built for businesses in general, not photographers",
              "No client history, scheduling, or delivery",
              "The per-invoice percentage stacks on top of processing",
            ]}
          >
            <p>
              Stripe is the processor behind many photography tools, including ShootPortal and Studio Ninja, so
              it&apos;s worth understanding its rates even if you never open Stripe Invoicing. Using it directly makes sense for occasional large commercial invoices where the capped ACH
              fee shines.
            </p>
          </ToolCard>

          <ToolCard
            rank={7}
            id="tool-paypal"
            name="PayPal Invoicing"
            url="https://www.paypal.com/us/business/paypal-business-fees"
            tagline="Invoices clients can pay with PayPal, Venmo, cards, or bank"
            pricing={
              <>
                No subscription. Cards 2.99% + 49¢; PayPal or Venmo checkout 3.49% + 49¢; Pay by Bank 1% capped at $10 (
                <Ext href="https://www.paypal.com/us/business/paypal-business-fees">PayPal fees</Ext>).
              </>
            }
            bestFor="Photographers whose clients specifically want to pay with PayPal or Venmo."
            pros={["Familiar to almost every client", "Venmo and Pay Later options", "No monthly cost"]}
            cons={[
              "The PayPal/Venmo checkout rate is the highest card-style rate here",
              "49¢ fixed fee on every USD transaction",
              "No connection to your jobs or deliveries",
            ]}
          >
            <p>
              PayPal is rarely the cheapest option, but some clients won&apos;t pay any other way. A common pattern is
              to keep PayPal available as a fallback and steer most clients to card or ACH elsewhere.
            </p>
          </ToolCard>

          <ToolCard
            rank={8}
            id="tool-honeybook"
            name="HoneyBook"
            url="https://www.honeybook.com/pricing"
            tagline="All-in-one creative CRM with proposals, contracts, and payment plans"
            pricing={
              <>
                Starter $29/mo, Essentials $49/mo, Premium $109/mo billed yearly (
                <Ext href="https://www.honeybook.com/pricing">official pricing</Ext>). The same page lists card fees
                &quot;starting at 2.9% + 25¢&quot; and &quot;2.7% + 10¢&quot;; ACH 1.5%.
              </>
            }
            bestFor="Portrait, wedding, and event photographers who want proposals, contracts, and invoices in one flow."
            pros={[
              "One-time, recurring, and custom payment schedules with autopay and reminders",
              "Proposals, contracts, and invoices on every plan",
              "QuickBooks Online integration on Essentials and up",
            ]}
            cons={[
              "Two different starting card rates on the same pricing page",
              "1.5% ACH with no stated cap gets expensive on large invoices",
              "No native galleries or media delivery",
            ]}
          >
            <p>
              HoneyBook is the reference point for &quot;proposal, contract, and invoice in one click.&quot; If you
              shoot weddings or portraits with multi-payment plans, it&apos;s strong. For high-ticket work, compare its
              ACH rate carefully against Dubsado&apos;s.
            </p>
          </ToolCard>

          <ToolCard
            rank={9}
            id="tool-dubsado"
            name="Dubsado"
            url="https://www.dubsado.com/pricing"
            tagline="Customizable CRM with payment schedules and low-cost capped ACH"
            pricing={
              <>
                Starter $335/yr, Premier $525/yr (<Ext href="https://www.dubsado.com/pricing">official pricing</Ext>).
                Dubsado Payments: US cards 2.9% + 30¢, ACH 0.8% capped at $5 (
                <Ext href="https://help.dubsado.com/en/articles/15920643-dubsado-payments-processing-fees">fee details</Ext>).
              </>
            }
            bestFor="Photographers billing large invoices who want deposits plus installments and deep customization."
            pros={[
              "Payment schedules with deposits and installments on both plans",
              "ACH capped at $5, the same as Stripe direct",
              "Integrates with Stripe, PayPal, and Square",
            ]}
            cons={[
              "Automated workflows are Premier-only",
              "Steeper setup than HoneyBook",
              "No gallery or media delivery",
            ]}
          >
            <p>
              Dubsado takes more setup but rewards it. For a photographer billing $3,000 to $10,000 jobs, the capped ACH
              fee alone is a meaningful difference over a year.
            </p>
          </ToolCard>

          <ToolCard
            rank={10}
            id="tool-studio-ninja"
            name="Studio Ninja"
            url="https://www.studioninja.co/pricing/"
            tagline="Budget photography CRM with quotes, invoices, and accounting integrations"
            pricing={
              <>
                Starter $16/mo ($160/yr, 5 active jobs), Pro $27/mo ($270/yr), Master $40/mo ($400/yr) in USD (
                <Ext href="https://www.studioninja.co/pricing/">official pricing</Ext>). Payments through Stripe or PayPal at
                their standard fees.
              </>
            }
            bestFor="Solo and small-team photographers who want CRM, invoicing, and a QuickBooks or Xero connection on a budget."
            pros={[
              "Stripe, Xero, and QuickBooks integrations listed on all tiers",
              "Quotes, invoices, payment schedules, and a client portal",
              "Low entry price",
            ]}
            cons={[
              "Starter caps you at 5 active jobs",
              "Galleries via Pic-Time or ShootProof, not native",
              "Plan-level detail on invoicing features wasn't verified",
            ]}
          >
            <p>
              Studio Ninja is one of the few photography CRMs here that lists both QuickBooks and Xero integrations on
              every tier, which makes it a tidy middle ground if you want one tool for clients and a clean handoff to
              your books. (Some third-party sites quote its Australian-dollar prices as USD; the USD prices are the ones
              above.)
            </p>
          </ToolCard>

          <Callout tone="note" title="Also worth a look">
            <p>
              <strong>Zoho Invoice</strong> has a <Ext href="https://www.zoho.com/us/invoice/pricing/">forever-free plan</Ext>{" "}
              with quotes, recurring invoices, and a customer portal (up to 500 invoices a year, with Zoho branding).{" "}
              <strong>Bloom</strong> bundles invoices, contracts, and galleries; note the 1.5% platform fee on its
              Starter plan.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "feature-table",
      title: "Feature comparison at a glance",
      tocLabel: "Feature table",
      body: () => (
        <>
          <p>
            &quot;Not confirmed&quot; means we couldn&apos;t verify the feature on the vendor&apos;s official pages, not
            that it&apos;s missing.
          </p>
          <ComparisonTable
            caption="Photography invoicing software feature comparison, October 2026"
            columns={["Tool", "Estimates", "Deposits / schedules", "Client portal", "Payments processed by", "Accounting", "Tied to delivery"]}
            highlightColumn={undefined}
            rows={[
              ["ShootPortal", <Yes key="a1">Proposals with versions</Yes>, <Yes key="a2">% or fixed, on approval</Yes>, <Yes key="a3">Branded, no login to pay</Yes>, "Your own Stripe account (Stripe Connect), 0% platform fee", "Receipts + client revenue records", <Yes key="a5">Downloads unlock on payment</Yes>],
              ["QuickBooks Online", "Confirm per plan", "Confirm per plan", "Not confirmed", "QuickBooks Payments", <Yes key="b1">Full</Yes>, <No key="b2" />],
              ["FreshBooks", <Yes key="c1" />, <Yes key="c2" />, <Yes key="c3" />, "FreshBooks Payments or Stripe", <Yes key="c4" />, <No key="c5" />],
              ["Wave", <Yes key="d1" />, "Not confirmed", "Not confirmed", "Wave (approval required)", <Yes key="d2">Basic</Yes>, <No key="d3" />],
              ["Square Invoices", <Yes key="e1" />, <Yes key="e2" />, "Not confirmed", "Square", <No key="e3" />, <No key="e4" />],
              ["Stripe Invoicing", <Yes key="f1">Quotes on Plus</Yes>, "Not confirmed", "Not confirmed", "Stripe", <No key="f2" />, <No key="f3" />],
              ["PayPal Invoicing", "Not confirmed", "Not confirmed", "Not confirmed", "PayPal", <No key="g1" />, <No key="g2" />],
              ["HoneyBook", <Yes key="h1">Proposals</Yes>, <Yes key="h2" />, <Yes key="h3" />, "HoneyBook (built in)", <Yes key="h4">QBO sync (Essentials+)</Yes>, <No key="h5" />],
              ["Dubsado", <Yes key="i1">Proposals</Yes>, <Yes key="i2" />, <Yes key="i3" />, "Dubsado Payments, Stripe, PayPal, or Square", <Yes key="i4">Integration (Premier)</Yes>, <No key="i5" />],
              ["Studio Ninja", <Yes key="j1">Quotes</Yes>, <Yes key="j2" />, <Yes key="j3" />, "Stripe or PayPal", <Yes key="j4">Xero / QuickBooks</Yes>, <No key="j5" />],
            ]}
            note={
              <>
                Features from official vendor pages, checked October 15, 2026. &quot;Tied to delivery&quot; means the
                payment can control access to the finished files in the same tool, rather than living on a separate
                invoice.
              </>
            }
          />
        </>
      ),
    },
    {
      id: "shootportal-payments",
      title: "How ShootPortal handles deposits, balances, and delivery",
      tocLabel: "ShootPortal payments",
      body: (ctx) => (
        <>
          <p>
            ShootPortal treats payment as a step in the project rather than a separate document, because the invoice
            itself is rarely the hard part. Knowing when to send it, and making sure the files don&apos;t go out first,
            is. Here&apos;s how a job flows:
          </p>
          <ol>
            <li>
              A request comes in through your website or branded request form. The client sees a preliminary estimate
              built from your service catalog as soon as they submit, with travel fees calculated from ZIP distance.
            </li>
            <li>
              You send an official proposal. The client clicks Approve Proposal in their portal, the payment is created
              automatically, and they pay the deposit right then.
            </li>
            <li>
              You shoot, edit, and upload. The client reviews photos and leaves time-stamped comments on video in the
              same project.
            </li>
            <li>
              The client pays the balance from the Pay Now button in the portal or a pay link in their email, no login
              needed, by card, Apple Pay, Google Pay, or ACH if you&apos;ve turned it on.
            </li>
            <li>
              Downloads unlock automatically, a receipt is emailed, and the project moves to Delivered on its own.
            </li>
          </ol>
          <Figure caption="Real ShootPortal screen: a client's view of a project moving from approved estimate to paid invoice and ready-to-download files (sample client data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <p>
            Money goes straight to your own Stripe account through Stripe Connect, and ShootPortal takes 0% of it. You
            choose whether to accept ACH bank payments and whether to pass the card fee on to the client. If a client
            pays by check outside Stripe, you mark the payment as received on the project. The client record keeps their
            outstanding balance, last payment, and lifetime revenue.
          </p>
          <Figure caption="Real ShootPortal screen: payment settings with your own Stripe account connected. Payments land in your account, not ShootPortal's.">
            <AppScreen view="payment-settings" />
          </Figure>
          <h3>What runs on its own</h3>
          <ul>
            <li>
              <strong>Automatic (once you switch it on):</strong> the payment created at proposal approval, payment
              reminders at 24 hours, 3 days, or 7 days, unlocking downloads after the final payment, moving the project
              to Delivered, and the branded Payment Request, Payment Received, and Payment Receipt emails.
            </li>
            <li>
              <strong>Connected in one place:</strong> the approved proposal, the shoot time, the messages, the media,
              the video review, and the payment status sit on the same project, so &quot;has this job been paid?&quot;
              is answered by opening it, not by cross-checking Stripe against your inbox.
            </li>
            <li>
              <strong>Your call:</strong> your deposit policy, whether downloads lock until payment (as a business default
              or per project), and whether to offer ACH or pass the card fee through.
            </li>
          </ul>
          <Figure caption="Real ShootPortal screen: workflow automation for payments, proposals, scheduling, deliverables, and reminders. Set it once and every job follows it.">
            <AppScreen view="automation" />
          </Figure>
          <BestFitPanel
            heading="Who should take payments through ShootPortal"
            fits={[
              {
                who: "Real estate photographers billing per listing",
                why: "Agents preview the photos, pay from a link without logging in, and download Print or MLS sizes from the same page, so the balance arrives before the files go out.",
              },
              {
                who: "Drone pilots with deposits",
                why: "A percentage or fixed deposit on proposal approval protects the flight day; the balance gates the final downloads.",
              },
              {
                who: "Videographers with revision rounds",
                why: "Clients review cuts with time-stamped comments, approve the final version, and pay, all on the project that holds the invoice.",
              },
              {
                who: "Businesses selling add-ons",
                why: "Sell a property website or social media kit to the agent and it goes on the same invoice or a separate checkout through your Stripe.",
              },
            ]}
          />
          <AllInOnePlatform intro="Invoicing is one part of it. The same subscription runs your website, booking, proposals, video review, delivery, and listing marketing, with no per-project fees and no cut of your payments." />
          <p>
            For a closer look at how proposals, deposits, and card payments work on each project, see the{" "}
            <SiteLink href="/photography-invoicing-software">photography invoicing software</SiteLink> page.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Get your next deposit and balance paid without chasing either"
            body={
              <>
                Connect your Stripe account during setup, add your services, and run one real job: the client approves the
                proposal and pays the deposit, pays the balance from a link, and downloads the files the moment it
                clears. ShootPortal keeps none of it.
              </>
            }
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
          <p>
            If you run real estate work alongside other niches, our roundup of{" "}
            <BlogLink slug="best-real-estate-photography-software">real estate photography software</BlogLink> compares
            platforms that handle ordering, payments, and delivery together, including ShootPortal.
          </p>
        </>
      ),
    },
    {
      id: "recommendations",
      title: "Which invoicing software fits your photography business?",
      tocLabel: "Recommendations",
      body: (ctx) => (
        <>
          <PickGrid
            items={[
              {
                who: "Real estate photographers",
                pick: "ShootPortal",
                why: "Proposal approval creates the invoice, agents pay from a link without logging in, and MLS-size downloads unlock on payment.",
              },
              {
                who: "Drone pilots",
                pick: "ShootPortal",
                why: "Deposits on approval protect the flight day, and travel fees are added automatically by ZIP distance.",
              },
              {
                who: "Videographers",
                pick: "ShootPortal",
                why: "Video review with time-stamped comments and numbered versions sits on the same project as the invoice, replacing Frame.io or Dropbox Replay.",
              },
              {
                who: "Teams with editors or coordinators",
                pick: "ShootPortal",
                why: "Unlimited staff accounts, with a Full access except money preset so staff can work jobs without seeing payments.",
              },
              {
                who: "Lowest possible fees",
                pick: "ShootPortal",
                why: "0% platform fee, Stripe's standard rates, optional ACH, and optional card-fee pass-through to the client.",
              },
              {
                who: "Just starting out",
                pick: "ShootPortal",
                why: `One plan with every feature${ctx.trialDays > 0 ? ` and a ${ctx.trialDays}-day free trial` : ""}, so you look established from the first job.`,
              },
            ]}
          />
          <KeyTakeaways
            items={[
              "The best invoice is the one the client never has to look for: created on approval, paid from a link, with no login.",
              "On a typical card payment, published rates land within a couple of dollars of each other. Platform fees and ACH caps matter more.",
              "Check for platform fees on top of processing. ShootPortal takes 0%.",
              <>
                Tie the balance to delivery. Our guide to{" "}
                <BlogLink slug="get-paid-before-delivering-real-estate-photos">getting paid before delivering photos</BlogLink>{" "}
                covers the policy side.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "conclusion",
      title: "The bottom line",
      body: () => (
        <>
          <p>
            The best photography invoicing software sends the right request at the right point in the job and
            doesn&apos;t quietly eat your margin in fees. General tools like QuickBooks, FreshBooks, Wave, and Square
            send invoices well, but they don&apos;t know when the shoot happened or whether the files went out.
          </p>
          <p>
            For real estate photographers, drone pilots, and videographers, ShootPortal is the pick: the invoice is
            created when the proposal is approved, the client pays from a link without logging in, the downloads unlock
            on payment, and you keep every dollar minus Stripe&apos;s fee. See{" "}
            <SiteLink href="/how-it-works">how ShootPortal&apos;s workflow fits together</SiteLink>.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best invoicing software for photographers?",
      answerText:
        "For real estate photographers, drone pilots, and videographers, ShootPortal is the strongest choice: the invoice is created when the client approves the proposal, deposits are collected on approval, clients pay from a link without logging in, and downloads unlock on payment. ShootPortal takes 0% of payments. General tools like QuickBooks, FreshBooks, Wave, and Square send invoices but aren't connected to the shoot or the delivery.",
      answer: (
        <p>
          For real estate photographers, drone pilots, and videographers, ShootPortal is the strongest choice: the
          invoice is created when the client approves the proposal, deposits are collected on approval, clients pay from
          a link without logging in, and downloads unlock on payment. ShootPortal takes 0% of payments. General tools
          like QuickBooks, FreshBooks, Wave, and Square send invoices but aren&apos;t connected to the shoot or the
          delivery.
        </p>
      ),
    },
    {
      question: "What are the cheapest payment processing fees for photographers?",
      answerText:
        "For US cards, most published rates are about 2.9% plus a fixed fee, so a $500 card payment works out to roughly $13.60 to $17.94 in fees across the tools compared here. ACH is cheaper: Stripe and Dubsado Payments publish 0.8% capped at $5.",
      answer: (
        <p>
          For US cards, most published rates are about 2.9% plus a fixed fee, so a $500 card payment works out to roughly
          $13.60 to $17.94 in fees across the tools compared here. ACH is cheaper: Stripe and Dubsado Payments publish 0.8% capped
          at $5. Always check for platform fees on top of processing.
        </p>
      ),
    },
    {
      question: "Should photographers take a deposit?",
      answerText:
        "Yes, for most booked work. A deposit at approval protects the date you reserved, and collecting the balance before releasing final files protects the work. Most tools in this guide support deposits; confirm it's on the plan you buy.",
      answer: (
        <p>
          Yes, for most booked work. A deposit at approval protects the date you reserved, and collecting the balance
          before releasing final files protects the work. Most tools in this guide support deposits; confirm it&apos;s on
          the plan you buy. See our <BlogLink slug="real-estate-photography-pricing-guide">pricing guide</BlogLink> for
          how deposits fit into your packages.
        </p>
      ),
    },
    {
      question: "Does ShootPortal replace QuickBooks?",
      answerText:
        "It replaces QuickBooks for billing clients: proposals, deposits, pay links, card, wallet, and ACH payments, receipts, reminders, and payment status on every project, with downloads that unlock on payment. ShootPortal is not a bookkeeping ledger, so expense tracking and tax reports stay with you or your accountant, working from your Stripe records and receipts.",
      answer: (
        <p>
          It replaces QuickBooks for billing clients: proposals, deposits, pay links, card, wallet, and ACH payments,
          receipts, reminders, and payment status on every project, with downloads that unlock on payment. ShootPortal
          isn&apos;t a bookkeeping ledger, so expense tracking and tax reports stay with you or your accountant, working
          from your Stripe records and receipts.
        </p>
      ),
    },
    {
      question: "Does ShootPortal take a percentage of my payments?",
      answerText:
        "No. ShootPortal takes 0% of client payments and charges no per-project or per-delivery fees. Payments go straight to your own Stripe account, and only Stripe's standard processing fees apply. You can also pass the card fee on to the client.",
      answer: (
        <p>
          No. ShootPortal takes 0% of client payments and charges no per-project or per-delivery fees. Payments go
          straight to your own Stripe account, and only Stripe&apos;s standard processing fees apply. You can also pass
          the card fee on to the client.
        </p>
      ),
    },
    {
      question: "Can clients pay a photography invoice without creating an account?",
      answerText:
        "In ShootPortal, yes. Payment emails include a pay link that opens a checkout page without a login, and clients can pay by card, Apple Pay, Google Pay, or ACH bank transfer if you've enabled it. A receipt is emailed automatically.",
      answer: (
        <p>
          In ShootPortal, yes. Payment emails include a pay link that opens a checkout page without a login, and clients
          can pay by card, Apple Pay, Google Pay, or ACH bank transfer if you&apos;ve enabled it. A receipt is emailed
          automatically.
        </p>
      ),
    },
    {
      question: "Is Stripe or Square better for photographers?",
      answerText:
        "On published US invoice rates, Stripe charges 2.9% + 30¢ for cards and 0.8% capped at $5 for ACH. Square's free plan charges 3.3% + 30¢ for invoiced cards and 1% for ACH; Plus and Premium drop the card rate to 2.9% + 30¢. Square suits photographers who also sell in person; Stripe powers many photography CRMs.",
      answer: (
        <p>
          On published US invoice rates, Stripe charges 2.9% + 30¢ for cards and 0.8% capped at $5 for ACH.
          Square&apos;s free plan charges 3.3% + 30¢ for invoiced cards and 1% for ACH; Plus and Premium drop the card
          rate to 2.9% + 30¢. Square suits photographers who also sell in person; Stripe powers many photography CRMs.
        </p>
      ),
    },
  ],
  related: ["get-paid-before-delivering-real-estate-photos", "best-photography-crm-software", "real-estate-photography-pricing-guide"],
  cta: {
    title: "Invoices that send themselves and files that unlock when paid.",
    body: "Deposits collected on proposal approval, pay links that need no login, ACH and card-fee pass-through, and downloads that unlock the moment the balance lands. ShootPortal takes 0% of every payment.",
    secondaryHref: "/pricing",
    secondaryLabel: "See pricing",
  },
};
