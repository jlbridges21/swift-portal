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

export const article: BlogArticle = {
  slug: "best-photography-invoicing-software",
  title: "Best Photography Invoicing and Payment Software in 2026",
  seoTitle: "Best Photography Invoicing Software & Payment Tools (2026)",
  description:
    "Compare photography invoicing software on deposits, card and ACH fees, estimates, and client portals: QuickBooks, FreshBooks, Wave, Square, Stripe, HoneyBook, and more.",
  excerpt:
    "Ten invoicing and payment tools photographers actually use, compared on published card and ACH fees, deposits, estimates, and how well each one connects payment to the job and the delivery.",
  category: "pricing-payments",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "photography invoicing software",
  secondaryKeywords: [
    "invoicing software for photographers",
    "photography payment software",
    "photographer deposit invoice",
    "best invoicing app for photographers",
    "photography invoice fees",
  ],
  readingMinutes: 16,
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
        <strong>Want full bookkeeping, tax reports, and invoicing together?</strong> QuickBooks Online or FreshBooks.
        They&apos;re accounting tools first.
      </>,
      <>
        <strong>Want free invoicing and can live with basic features?</strong> Wave&apos;s Starter plan and Square&apos;s
        free plan cost nothing per month; you pay only processing fees.
      </>,
      <>
        <strong>Clients insist on PayPal or Venmo?</strong> PayPal Invoicing has no subscription, but its published
        PayPal and Venmo checkout rate is higher than a standard card rate.
      </>,
      <>
        <strong>Want contracts, proposals, and invoices in one CRM?</strong> HoneyBook, Dubsado, or Studio Ninja.
      </>,
      <>
        <strong>Want payment tied to the project and the delivery</strong>, with deposits on approval and downloads that
        unlock after the final payment? That&apos;s what ShootPortal (our product) does, alongside your accounting
        software rather than instead of it.
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
        Most <strong>photography invoicing software</strong> answers one of those questions well. Accounting apps track
        every dollar for tax time but know nothing about your shoot. Payment processors move money cheaply but
        don&apos;t know what the money is for. Photography CRMs and workflow platforms connect the invoice to the client
        and the job, but most aren&apos;t accounting systems.
      </p>
      <p>
        This guide compares ten tools photographers actually use to bill clients, with each vendor&apos;s published card
        and ACH rates, a worked fee example on a $500 job, and recommendations by business type. Every price links to
        the official page so you can check it yourself before you switch.
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
          <Figure caption="Conceptual diagram: where money changes hands in a typical photography job, from approved estimate to unlocked downloads.">
            <PaymentFlowDiagram withDeposit />
          </Figure>
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
            one step in a flow that might include a proposal, a contract, a schedule, and (in ShootPortal&apos;s case)
            the media delivery itself. They&apos;re strongest at connecting payment to the work and weakest at
            accounting. Our <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink> goes
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
                  gaps: ["Bookkeeping & tax reports (pair with accounting software)"],
                  accent: true,
                },
              ]}
            />
          </Figure>
          <p>
            Plenty of photographers run two of these on purpose: a workflow tool that collects the money at the right
            moment in the job, and accounting software that records it for tax time. That&apos;s a perfectly reasonable
            setup, and it&apos;s worth deciding up front whether you want one tool or two.
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
          <h3>Deposits and payment schedules</h3>
          <p>
            You want to take a deposit (as a percentage or a fixed amount) at booking and the balance later, without
            building two invoices by hand. Check whether deposits are on the plan you&apos;d actually buy; on some
            accounting tools they&apos;re standard, but confirm before assuming.
          </p>
          <h3>Payment methods: card and ACH</h3>
          <p>
            Cards are what most clients reach for. ACH (bank transfer) is slower, but it&apos;s usually much cheaper,
            and several processors cap the fee, which matters on large commercial or wedding invoices. PayPal and Venmo
            matter if your clients ask for them.
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
            billing every week.
          </p>
        </>
      ),
    },
    {
      id: "fee-comparison",
      title: "Card and ACH fees compared (with a $500 example)",
      tocLabel: "Fee comparison",
      body: () => (
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
                "Flat monthly plan",
                "Stripe's standard processing fees on your own Stripe account",
                "Not listed",
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
              comparing card rates.
            </p>
          </Callout>
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
            ShootPortal is first because it&apos;s our product and we&apos;d rather say so than bury it. It isn&apos;t
            the right answer for everyone in this list, especially if what you really want is accounting software.
          </p>

          <ToolCard
            rank={1}
            id="tool-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="Payments built into the project, from approved estimate to unlocked downloads"
            pricing={
              ctx.studioMonthly ? (
                <>
                  {ctx.studioMonthly}/month{ctx.studioAnnual ? <>, or {ctx.studioAnnual}/month billed annually</> : null}.
                  Stripe&apos;s standard processing fees apply.{" "}
                  {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription; Stripe&apos;s standard processing fees apply. See{" "}
                  <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Photographers, videographers, and drone operators who want deposits, balances, and delivery tied to the same job, and who keep accounting in a separate tool."
            pros={[
              "Stripe Connect: payments go directly to your own Stripe account",
              "Deposit on estimate approval as a percentage or fixed amount, with the balance later, or pay in full",
              "Optional: clients can view and preview media, but downloads unlock only after the final payment",
              "Payment status lives on the project, alongside the estimate, messages, and media",
              "Mark payments received outside Stripe as paid manually; email receipts to clients",
            ]}
            cons={[
              "Not accounting software: no bookkeeping, expense tracking, or tax reports",
              "No QuickBooks or Xero sync",
              "No separate invoice-document builder; you request payment from the project",
              "No contracts or e-signature",
            ]}
          >
            <p>
              ShootPortal approaches invoicing from the job rather than the ledger. A client requests a shoot, you send
              an estimate (with versions, an expiry date, and a PDF), and when they approve it in their portal you can
              collect a deposit right then, as a percentage or a fixed amount. After the shoot you request the balance
              from the project, and the client pays through Stripe Checkout.
            </p>
            <p>
              The part photographers tend to care about most is the link between payment and delivery. You can let
              clients view and review their photos and video while the downloads stay locked until the final payment
              clears, and optionally move the project to Delivered automatically once it&apos;s paid. Each client
              record shows lifetime revenue, outstanding balance, and last payment, so you don&apos;t need a separate
              spreadsheet to know who owes what.
            </p>
            <p>
              Be clear about what it isn&apos;t: there&apos;s no bookkeeping, no tax reporting, and no accounting
              integration. If you need those, keep QuickBooks, FreshBooks, or Wave for the books and use ShootPortal for the
              client-facing side.
            </p>
          </ToolCard>

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
            columns={["Tool", "Estimates", "Deposits / schedules", "Client portal", "Accounting", "Tied to delivery"]}
            highlightColumn={undefined}
            rows={[
              ["ShootPortal", <Yes key="a1">With versions</Yes>, <Yes key="a2">% or fixed</Yes>, <Yes key="a3" />, <No key="a4">Pair with accounting</No>, <Yes key="a5">Downloads unlock after payment</Yes>],
              ["QuickBooks Online", "Confirm per plan", "Confirm per plan", "Not confirmed", <Yes key="b1">Full</Yes>, <No key="b2" />],
              ["FreshBooks", <Yes key="c1" />, <Yes key="c2" />, <Yes key="c3" />, <Yes key="c4" />, <No key="c5" />],
              ["Wave", <Yes key="d1" />, "Not confirmed", "Not confirmed", <Yes key="d2">Basic</Yes>, <No key="d3" />],
              ["Square Invoices", <Yes key="e1" />, <Yes key="e2" />, "Not confirmed", <No key="e3" />, <No key="e4" />],
              ["Stripe Invoicing", <Yes key="f1">Quotes on Plus</Yes>, "Not confirmed", "Not confirmed", <No key="f2" />, <No key="f3" />],
              ["PayPal Invoicing", "Not confirmed", "Not confirmed", "Not confirmed", <No key="g1" />, <No key="g2" />],
              ["HoneyBook", <Yes key="h1">Proposals</Yes>, <Yes key="h2" />, <Yes key="h3" />, <Yes key="h4">QBO sync (Essentials+)</Yes>, <No key="h5" />],
              ["Dubsado", <Yes key="i1">Proposals</Yes>, <Yes key="i2" />, <Yes key="i3" />, <Yes key="i4">Integration (Premier)</Yes>, <No key="i5" />],
              ["Studio Ninja", <Yes key="j1">Quotes</Yes>, <Yes key="j2" />, <Yes key="j3" />, <Yes key="j4">Xero / QuickBooks</Yes>, <No key="j5" />],
            ]}
            note={<>Features from official vendor pages, checked October 15, 2026.</>}
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
            is. Here&apos;s how a job flows from the client&apos;s side:
          </p>
          <ol>
            <li>The client approves the estimate in their portal. If you&apos;ve set a deposit, they pay it then.</li>
            <li>You shoot, upload, and the client reviews photos and video in the same project.</li>
            <li>You request the balance from the project; the client pays through Stripe Checkout.</li>
            <li>
              Downloads unlock automatically if you&apos;ve turned that on, and the project can move to Delivered on its
              own.
            </li>
          </ol>
          <Figure caption="Product illustration: a client's view of a project moving from approved estimate to paid invoice and ready-to-download files (demo data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <p>
            Money goes straight to your own Stripe account through Stripe Connect. If a client pays by check or bank
            transfer outside Stripe, you mark the payment as received and the project status catches up. Clients get
            email receipts, and the client record keeps their outstanding balance and lifetime revenue.
          </p>
          <InlineCta
            title="Manage projects, invoices, and payments in one place."
            body="Take deposits on approval, request the balance from the project, and unlock downloads when the final payment lands."
            trialDays={ctx.trialDays}
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
      body: () => (
        <>
          <PickGrid
            items={[
              {
                who: "Just starting out",
                pick: "Wave or Square (free plans)",
                why: "Professional invoices and deposits without a subscription while volume is low.",
              },
              {
                who: "Accounting is the priority",
                pick: "QuickBooks Online or FreshBooks",
                why: "Invoices land directly in your books, which your accountant will thank you for.",
              },
              {
                who: "Weddings and portraits",
                pick: "HoneyBook or Dubsado",
                why: "Proposals, contracts, and multi-payment schedules in one client flow.",
              },
              {
                who: "Large commercial invoices",
                pick: "Dubsado or Stripe direct",
                why: "ACH capped at $5 per published rates, versus an uncapped percentage elsewhere.",
              },
              {
                who: "Real estate, drone, and video work",
                pick: "ShootPortal + your accounting app",
                why: "Deposits, balances, and download unlock live on the same project as the media.",
              },
              {
                who: "Budget CRM with a books handoff",
                pick: "Studio Ninja",
                why: "QuickBooks and Xero integrations on every tier, from $16/month.",
              },
            ]}
          />
          <KeyTakeaways
            items={[
              "Decide whether you want one tool or a workflow tool plus accounting software; many photographers run both.",
              "On a typical card payment, published rates land within a couple of dollars of each other. ACH caps matter much more on big invoices.",
              "Check for platform fees on top of processing before comparing card rates.",
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
            The best photography invoicing software is the one that sends the right request at the right point in the
            job, and doesn&apos;t quietly eat your margin in fees. If accounting is what keeps you up at night, start with
            QuickBooks Online or FreshBooks. If you want free and simple, Wave or Square. If proposals and contracts are
            central to how you sell, HoneyBook or Dubsado.
          </p>
          <p>
            If what you really want is for the deposit, the balance, and the delivery to stop being three separate
            chores, see <SiteLink href="/how-it-works">how ShootPortal&apos;s workflow fits together</SiteLink>, and keep
            your accounting app for the books.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best invoicing software for photographers?",
      answerText:
        "It depends on what you need most. QuickBooks Online and FreshBooks are best for accounting, Wave and Square have free plans, HoneyBook and Dubsado combine proposals, contracts, and invoices, and ShootPortal ties deposits, balances, and download unlock to the same project as the media.",
      answer: (
        <p>
          It depends on what you need most. QuickBooks Online and FreshBooks are best for accounting, Wave and Square
          have free plans, HoneyBook and Dubsado combine proposals, contracts, and invoices, and ShootPortal ties
          deposits, balances, and download unlock to the same project as the media.
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
        "No. ShootPortal handles estimates, deposits, payment requests through Stripe, payment status on each project, and download unlock after payment, but it is not accounting software. It has no bookkeeping, tax reports, or QuickBooks sync, so plan to keep an accounting app alongside it.",
      answer: (
        <p>
          No. ShootPortal handles estimates, deposits, payment requests through Stripe, payment status on each project,
          and download unlock after payment, but it isn&apos;t accounting software. It has no bookkeeping, tax reports,
          or QuickBooks sync, so plan to keep an accounting app alongside it.
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
    title: "Manage projects, invoices, and payments in one place.",
    body: "Collect deposits on approval, request the balance from the project, and release downloads when the final payment lands, with every payment going straight to your own Stripe account.",
    secondaryHref: "/pricing",
    secondaryLabel: "See pricing",
  },
};
