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
  SiteLink,
} from "@/components/blog/article-parts";
import { DocumentCard, PaymentFlowDiagram } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { AllInOnePlatform, AppScreen, PhoneScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "get-paid-before-delivering-real-estate-photos",
  title: "How to Get Paid Before Delivering Real Estate Photos",
  seoTitle: "How to Get Paid Before Delivering Real Estate Photos",
  description:
    "Set a photography payment before delivery policy: deposits, preview-then-unlock downloads, no-login pay links, and software that ties payment to delivery.",
  excerpt:
    "Late payments usually come from unclear policy, not bad clients. Here's how to structure payment, explain it to agents, and connect it to delivery without damaging relationships.",
  category: "pricing-payments",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "photography payment before delivery",
  secondaryKeywords: [
    "real estate photography payment policy",
    "pay to download photos",
    "real estate photographer deposit",
    "get paid faster photography",
    "real estate photography payment link",
    "lock photo downloads until paid",
  ],
  readingMinutes: 12,
  cover: {
    variant: "invoice",
    tint: "indigo",
    label: "Payments Guide",
    alt: "Illustration of an invoice with a paid checkmark on an indigo background",
  },
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Write a payment policy</strong> and put it on every proposal, so payment timing is agreed before the
        shoot, not argued about after it.
      </>,
      <>
        <strong>Let agents preview, then unlock downloads on payment.</strong> They can check the work and plan the
        listing; full files arrive the moment the balance is paid.
      </>,
      <>
        <strong>Make paying a two-tap job.</strong> A pay link that opens without a login, with card, Apple Pay, Google
        Pay, or bank transfer, removes the last excuse to wait.
      </>,
      <>
        <strong>Use deposits selectively:</strong> new clients, large or custom shoots, long drives, and anything you
        can&apos;t easily reschedule.
      </>,
      <>
        <strong>Let software enforce it.</strong> ShootPortal (our product) collects the deposit when the agent approves
        the proposal, sends the pay link, and unlocks downloads automatically when the balance clears, with 0% taken from
        your payments.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Most real estate photographers have a folder of &quot;delivered, not paid&quot; listings somewhere. The photos
        went out on time, the listing went live, and the invoice drifted to the bottom of an agent&apos;s inbox. Nobody
        meant to stiff anyone. But chasing a few dozen small balances every month is unpaid work, and it turns friendly
        clients into awkward conversations.
      </p>
      <p>
        The fix isn&apos;t to become harder to work with. It&apos;s to make <strong>payment before delivery</strong>{" "}
        the normal, expected, easy path: agreed in writing before the shoot, simple to complete from a phone, and
        connected to the moment the agent wants the files. This guide covers why payments run late, the payment
        structures you can choose from, an example policy, how to explain the change to agents, and how to set up
        ShootPortal so the agent previews, pays, and downloads in one branded place, without you checking Stripe and
        sending folders by hand.
      </p>
      <Callout tone="note" title="Not legal advice">
        <p>
          This article is general business guidance, not legal advice. Payment terms, deposits, and withholding
          deliverables are governed by your contracts and local law. Have an attorney review your policy before you
          rely on it.
        </p>
      </Callout>
    </>
  ),
  sections: [
    {
      id: "why-late-payments",
      title: "Why real estate photographers get paid late",
      tocLabel: "Why payments run late",
      body: () => (
        <>
          <p>
            Late payment is rarely about bad intent. It usually comes from a handful of structural problems that you
            can fix:
          </p>
          <ul>
            <li>
              <strong>Delivery comes first, invoice second.</strong> Once the agent has the files, the urgency is
              gone. Your invoice competes with everything else in their week.
            </li>
            <li>
              <strong>No policy was ever stated.</strong> If payment timing wasn&apos;t agreed up front, every agent
              falls back on whatever their last photographer did.
            </li>
            <li>
              <strong>Agents expect to pay when the house sells.</strong> Many agents are paid from commission at
              closing, so paying vendors at that point feels natural to them. It leaves you financing their listing for
              weeks or months, with the risk that the listing expires.
            </li>
            <li>
              <strong>Paying is inconvenient.</strong> A PDF invoice with bank details is easy to postpone. A link that
              opens a card payment on a phone isn&apos;t.
            </li>
            <li>
              <strong>Confusion over who pays.</strong> Agent, team lead, brokerage, or seller? If nobody knows, nobody
              pays.
            </li>
          </ul>
          <p>
            Every fix below addresses one of these: agree terms early, make paying easy, and tie payment to the moment
            the client wants something from you.
          </p>
          <ProductCallout title="A pay button the agent can&apos;t miss">
            <p>
              In ShootPortal, the &quot;your media is ready&quot; email and the client portal both carry a Pay Now
              button. The pay link opens a checkout page without a login, so an agent between showings can pay by card,
              Apple Pay, or Google Pay in under a minute, and the downloads unlock the moment it clears.
            </p>
          </ProductCallout>
        </>
      ),
    },
    {
      id: "payment-approaches",
      title: "Five ways to structure payment, compared",
      tocLabel: "Payment approaches compared",
      body: () => (
        <>
          <p>
            There&apos;s no single right model. Each one trades cash-flow safety for convenience in a different way, and
            many businesses use two: a stricter model for new clients and a looser one for long-standing agents.
          </p>
          <ComparisonTable
            caption="Real estate photography payment approaches: pros and cons"
            columns={["Approach", "How it works", "Pros", "Cons"]}
            rows={[
              [
                "Pay in full upfront",
                "Agent pays when booking or approving the estimate",
                "No collections risk; simplest to run",
                "Friction for new agents; refunds needed for cancellations or weather reschedules",
              ],
              [
                "Deposit + balance",
                "Deposit on approval, balance before or at delivery",
                "Secures the date; covers travel and prep costs",
                "Two payments to track; deposit terms need to be clear",
              ],
              [
                "Pay before download",
                "Agent previews the media; downloads unlock once paid",
                "Agent sees the work first; payment happens when they want the files",
                "Agents who can't pay quickly may delay launch; needs software support",
              ],
              [
                "Net terms",
                "Invoice on delivery, due in a set number of days",
                "Familiar to brokerages and commercial clients",
                "You carry the risk and do the chasing",
              ],
              [
                "Pay at closing",
                "Payment collected when the property closes, often via a third-party service",
                "Matches how many agents are paid; can win agent loyalty",
                "Long wait for cash; usually a fee; listings that don't sell complicate collection",
              ],
            ]}
            note="Editorial comparison. Which approach suits you depends on your market, client mix, and contracts."
          />
          <h3>A note on pay-at-closing</h3>
          <p>
            Agents ask for pay-at-closing because that&apos;s when they&apos;re paid. Some real estate media platforms
            offer it through third-party services such as Titus (Spiro documents a{" "}
            <Ext href="https://support.spiro.media/en/articles/12314725-frequently-asked-questions-titus-integration">
              Titus integration
            </Ext>
            , and Tonomo&apos;s <Ext href="https://www.tonomo.io/pricing">pricing page</Ext> lists it too). These
            services typically charge the photographer a fee, and you still wait weeks or months for the money. For most
            businesses, pay-before-download is the stronger model: the agent gets instant previews and pays from a phone
            in the minute they want the files, and you&apos;re paid this week instead of at closing.
          </p>
        </>
      ),
    },
    {
      id: "payment-policy",
      title: "Write a payment policy clients can read in 30 seconds",
      tocLabel: "Write a payment policy",
      body: () => (
        <>
          <p>
            A good policy is short, specific, and visible: on your website, on every estimate, and in your booking
            confirmation. It should answer four questions: when do I pay, how do I pay, what happens if I cancel, and
            when do I get my files. Here&apos;s an example to start from.
          </p>
          <Figure caption="Example payment policy for illustration only. Adapt it with your attorney and to your local laws before using it.">
            <DocumentCard eyebrow="Example policy (adapt with your attorney)" title="Payment & Delivery Policy">
              <p>
                <strong>Booking.</strong> Shoots are confirmed once the estimate is approved. New clients pay a deposit
                of [X%] at approval; this secures the date and covers scheduling and travel.
              </p>
              <p>
                <strong>Balance.</strong> The remaining balance is requested when your media is ready. You can pay online
                by card, Apple Pay, Google Pay, or bank transfer from the payment link (no account needed) or your client
                portal.
              </p>
              <p>
                <strong>Delivery.</strong> You&apos;ll be able to preview all media as soon as it&apos;s uploaded.
                Full-resolution and MLS downloads unlock once the balance is paid.
              </p>
              <p>
                <strong>Rescheduling and cancellations.</strong> Weather reschedules are free. Cancellations with less
                than [X hours] notice forfeit the deposit.
              </p>
              <p>
                <strong>Revisions.</strong> Requests for edits within the agreed scope are included. Reshoots or
                additional services are quoted separately.
              </p>
              <p>
                <strong>Usage.</strong> Your license to use the media for marketing the listing begins once payment is
                complete, as described in our terms of service.
              </p>
            </DocumentCard>
          </Figure>
          <Callout tone="warning" title="Check the details locally">
            <p>
              Rules on deposits, non-refundable fees, and licensing vary by jurisdiction. The bracketed values above are
              placeholders, not recommendations. An attorney can tell you what&apos;s enforceable where you work.
            </p>
          </Callout>
          <FreeResourceCallout resource="photography-invoice" />
        </>
      ),
    },
    {
      id: "deposits-full-partial",
      title: "Deposits, full payment, and partial payment",
      tocLabel: "Deposits and partial payment",
      body: () => (
        <>
          <p>
            Deposits are the most useful tool you have against no-shows and last-minute cancellations, but they add
            friction, so use them where they matter most:
          </p>
          <ul>
            <li>
              <strong>New clients.</strong> You don&apos;t have a payment history with them yet.
            </li>
            <li>
              <strong>Large or custom jobs.</strong> Luxury listings, twilight shoots, video, and drone work where
              you&apos;re committing a big block of time.
            </li>
            <li>
              <strong>Long drives.</strong> If travel is a meaningful part of the cost, a deposit covers it whether or
              not the shoot happens.
            </li>
            <li>
              <strong>Hard-to-reschedule dates.</strong> Peak-season mornings and golden-hour slots you&apos;ll turn
              other work away for.
            </li>
          </ul>
          <h3>Percentage or fixed amount?</h3>
          <p>
            A percentage scales with the job and feels fair on big quotes. A fixed amount is easier to explain on small
            standard packages. Either way, state it on the estimate so it&apos;s agreed before the client approves.
          </p>
          <h3>When to ask for full payment instead</h3>
          <p>
            For small standard packages, splitting into deposit and balance can be more admin than it&apos;s worth. Pay
            in full at approval, or pay before download, is often simpler. For long-standing agents with a good record,
            you may decide pay-before-download alone is enough. Pricing decisions like these are covered in more depth
            in our <BlogLink slug="real-estate-photography-pricing-guide">real estate photography pricing guide</BlogLink>.
          </p>
          <FreeResourceCallout tool="real-estate-pricing" note="Set package prices for every home size first, then decide where a deposit makes sense." />
        </>
      ),
    },
    {
      id: "delivery-policy",
      title: "Delivery policies: preview first, download after payment",
      tocLabel: "Preview, then unlock",
      body: (ctx) => (
        <>
          <p>
            The most agent-friendly way to get paid before delivery is to separate <em>seeing</em> the media from{" "}
            <em>downloading</em> it. Agents get to confirm the shoot went well and plan the listing; you get paid before
            the full files leave your hands. There are two common versions:
          </p>
          <ul>
            <li>
              <strong>Watermarked or low-resolution previews.</strong> You send a proof set; full files go out after
              payment. Simple, but it means two uploads, and watermarks can annoy agents who want to show the seller.
            </li>
            <li>
              <strong>Locked downloads.</strong> The full media is uploaded once to a portal where the client can view
              it, but downloads stay locked until the balance is paid. One upload, and unlocking is automatic.
            </li>
          </ul>
          <Figure caption="Conceptual diagram: estimate, deposit, preview, balance, and download unlock as one connected sequence.">
            <PaymentFlowDiagram withDeposit />
          </Figure>
          <p>
            The locked-download model only works if paying is genuinely easy: a card payment from a phone, in the same
            place the agent is already looking at their photos. For more on organizing the delivery side, see{" "}
            <BlogLink slug="how-to-deliver-real-estate-photos">how to deliver real estate photos</BlogLink>.
          </p>
          <Figure caption="Real ShootPortal screen: a ShootPortal client portal where the client reviews media and pays the balance (sample client data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <Figure caption="Real ShootPortal screens: your project's payments tab with the deposit, balance, and what's outstanding (left), and the agent's portal with the media ready and a Pay Now button (right). Both sides see the same status.">
            <TwoSidedScreens business="payments" client="portal-pay" />
          </Figure>
          <InlineCta
            trialDays={ctx.trialDays}
            title="Stop sending files before the money lands"
            body="Upload once, let agents preview everything, and have downloads unlock on their own when the balance is paid. No Stripe-watching, no folder links, no awkward follow-ups."
          />
        </>
      ),
    },
    {
      id: "communicating-the-policy",
      title: "How to explain the policy to agents",
      tocLabel: "Explaining it to agents",
      body: () => (
        <>
          <p>
            Changing payment terms with agents you already work with is the part most photographers dread. In practice,
            a clear, friendly explanation that leads with what&apos;s better for <em>them</em> goes a long way. Give
            notice, say when it takes effect, and make it easy to ask questions.
          </p>
          <Figure caption="Example announcement email for illustration. Adjust the tone and details to your business.">
            <DocumentCard eyebrow="Example email" title="Subject: A faster way to get your listing media">
              <p>Hi [Agent name],</p>
              <p>
                Thanks for trusting me with your listings this year. Starting [date], I&apos;m moving every shoot into a
                client portal so you can see your photos the moment they&apos;re ready, request any changes in one place,
                and download MLS and full-size files right after paying online. There&apos;s no account to create: the
                payment link opens straight to checkout.
              </p>
              <p>
                What changes for you: you&apos;ll get a payment link when your media is ready, and downloads unlock as
                soon as it&apos;s paid. New bookings with me will include a small deposit at approval. Any shoots
                already booked under our current arrangement stay exactly as agreed.
              </p>
              <p>If you have any questions, or need billing set up differently for your team, just reply. Happy to talk it through.</p>
              <p>[Your name]</p>
            </DocumentCard>
          </Figure>
          <Figure caption="Real ShootPortal screen: what the agent sees on their phone when the media is ready. One Pay Now button, no app to install and no account to create.">
            <PhoneScreen view="phone-portal-pay" />
          </Figure>
          <h3>Handling pushback</h3>
          <p>
            The most common objection is &quot;my last photographer let me pay at closing.&quot; Acknowledge it
            honestly: that arrangement works for some photographers, but it means waiting weeks or months and carrying
            the risk when a listing is withdrawn. Explain what you offer instead (previews right away, payment from a
            phone, instant download) and, if it makes sense for a valuable client, consider an exception you choose
            deliberately rather than one you drift into.
          </p>
        </>
      ),
    },
    {
      id: "existing-agreements",
      title: "Respect existing agreements, and get advice",
      tocLabel: "Existing agreements",
      body: () => (
        <>
          <p>
            A new policy applies to new work. If you&apos;ve already agreed to different terms with an agent, a
            brokerage, or a commercial client, whether in a signed contract, a vendor agreement, or a long-standing
            written arrangement, honor it until it ends or both sides agree to change it.
          </p>
          <ul>
            <li>
              <strong>Don&apos;t withhold work that was contracted on other terms.</strong> Holding files hostage on a
              job you agreed to invoice later damages trust and may breach your agreement.
            </li>
            <li>
              <strong>Grandfather existing bookings.</strong> Shoots booked before the change keep the old terms, as in
              the example email above.
            </li>
            <li>
              <strong>Put licensing terms in writing.</strong> Many photographers tie the client&apos;s usage license to
              payment. Whether and how that&apos;s enforceable depends on your contract and jurisdiction.
            </li>
            <li>
              <strong>Talk to an attorney</strong> before relying on deposits being non-refundable, late fees, or
              withholding deliverables. This guide isn&apos;t legal advice.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "payment-software",
      title: "Payment collection software that connects to delivery",
      tocLabel: "Payment software",
      body: () => (
        <>
          <p>
            The policy only works if your tools enforce it without extra steps. When comparing software, look for:
            deposits on approval, online card payments from a link, automatic receipts, reminders for unpaid balances,
            and, most importantly, a connection between payment status and download access.
          </p>
          <p>
            Several real estate platforms tie the two together: HDPhotoHub&apos;s{" "}
            <Ext href="https://hdphotohub.com">Pay to Download</Ext> locks media until paid, Tonomo offers pay-to-unlock
            delivery, Rela&apos;s <Ext href="https://www.relahq.com/pricing/photographers">Storefront add-on</Ext> adds
            lock-media-until-paid, and Aryeo&apos;s <Ext href="https://www.aryeo.com/products/orders">order forms</Ext>{" "}
            can require full payment upfront, a deposit, or invoice on delivery. General CRMs such as HoneyBook and
            Dubsado have mature invoicing and payment schedules but don&apos;t deliver media natively, so the link
            between &quot;paid&quot; and &quot;downloaded&quot; becomes manual. Our{" "}
            <BlogLink slug="best-photography-invoicing-software">photography invoicing software comparison</BlogLink> and{" "}
            <BlogLink slug="best-real-estate-photography-delivery-software">real estate delivery software guide</BlogLink>{" "}
            cover the options in detail.
          </p>
          <h3>Why the manual version leaks money</h3>
          <p>
            You can run a pay-before-delivery policy by hand: send a payment link, watch your Stripe dashboard, then
            share the Dropbox folder once the money lands. It works until it doesn&apos;t. The payment confirmation
            arrives while you&apos;re on a shoot, the agent pings you asking where the photos are, and you send the
            folder &quot;just this once&quot; to keep things moving. The gap isn&apos;t discipline; it&apos;s that your
            payment tool and your delivery tool don&apos;t know about each other, so you are the connection between
            them.
          </p>
          <p>
            A connected setup puts the proposal, the deposit, the media, the balance, and the download access on the
            same project record. Payment status isn&apos;t something you check and then act on; it&apos;s a field on the
            job that the delivery reads. That&apos;s how ShootPortal is built, and it takes 0% of the payments that run
            through it.
          </p>
        </>
      ),
    },
    {
      id: "shootportal-payment-flow",
      title: "How the payment-before-delivery flow runs in ShootPortal",
      tocLabel: "ShootPortal payment flow",
      body: (ctx) => (
        <>
          <p>
            In ShootPortal (our product), here&apos;s what a listing shoot looks like with a 25% deposit and downloads
            locked until the balance is paid. The percentage is just an example; use whatever your policy says.
          </p>
          <ol>
            <li>
              <strong>The agent approves the proposal in their portal.</strong> You set the deposit rule (a percentage, a
              fixed amount, or none), and ShootPortal creates the payment the moment the agent clicks Approve Proposal.
              You can also let the agent pay the full total instead of the deposit.
            </li>
            <li>
              <strong>The agent pays from a link, no login needed.</strong> Card, Apple Pay, Google Pay, or optional ACH
              bank transfer. Payments run through Stripe Connect, so the money goes straight to your own Stripe account,
              and a receipt goes out by email. If you turn on card-fee pass-through, the agent covers the card fee.
            </li>
            <li>
              <strong>You shoot, edit, and upload the finals to the same project.</strong> Touch up photos in the built-in
              editor and save them straight to the gallery. The agent can open the portal, view every photo, video, and
              tour, leave time-stamped comments on video, and approve items or request changes right away.
            </li>
            <li>
              <strong>The balance request goes out with a Pay Now button.</strong> The agent pays from their phone, in the
              same place they&apos;re already looking at their photos. Automatic reminders follow up at 24 hours, 3 days,
              or 7 days if it&apos;s still open.
            </li>
            <li>
              <strong>Downloads unlock.</strong> With &quot;unlock downloads after payment&quot; turned on, Print and MLS
              downloads (single files or a ZIP) open once the final payment is made. The project can also move to
              Delivered automatically when it&apos;s paid.
            </li>
          </ol>
          <ComparisonTable
            caption="What ShootPortal handles automatically versus what stays with you"
            columns={["Step", "Automatic (if enabled)", "Your call"]}
            rows={[
              ["Deposit", "Payment created when the proposal is approved", "Choosing the deposit rule and stating it in your policy"],
              ["Collecting payment", "No-login pay link, card, wallet, or ACH checkout, payout to your Stripe, receipt email", "Whether to offer ACH and pass the card fee through"],
              ["Follow-up", "Payment reminders at 24h, 3d, or 7d", "Personal follow-up on anything long overdue"],
              ["Off-platform payments", "Recorded on the project and client record", "Marking a check, cash, or bank transfer as paid"],
              ["Download access", "Downloads unlock after the final payment", "Lock as a business default or per project"],
              ["Project status", "Moves to Delivered once paid", "Nothing"],
            ]}
            note="Based on ShootPortal's payment and workflow settings. ShootPortal takes 0% of payments; Stripe's standard processing fees apply."
          />
          <Figure caption="Real ShootPortal screen: the branded emails that go out at each step, including Payment Request, Payment Received, and Payment Receipt, each with a subject and body you can edit.">
            <AppScreen view="automated-emails" />
          </Figure>
          <h3>What the lock does</h3>
          <p>
            The download lock controls whether the client can download files from the portal before the final payment.
            Viewing stays open by design, so the agent can check the work and show the seller. It works best alongside
            the written policy above: the policy sets the expectation, and the lock makes it the path of least
            resistance.
          </p>
          <h3>Sell more on the same invoice</h3>
          <p>
            Once the photos are in, ShootPortal can offer the agent a property website and a social media kit built from
            the delivered photos. You decide whether each is included or paid (the defaults are $49 and $29, and you can
            change them), and the agent adds it to the invoice or checks out through your Stripe. It&apos;s extra
            revenue on a job you&apos;ve already shot.
          </p>
          <AllInOnePlatform intro="Payments are one step. The same subscription runs your website, booking, proposals, scheduling, editing, video review, delivery, and listing marketing, with no per-project fees and no cut of your payments." />
          <p>
            {ctx.studioMonthly ? (
              <>
                ShootPortal is a flat {ctx.studioMonthly}/month subscription
                {ctx.studioAnnual ? <> ({ctx.studioAnnual}/month billed annually)</> : null} with 0% taken from client
                payments; Stripe&apos;s standard processing fees apply.
              </>
            ) : (
              <>
                See <SiteLink href="/pricing">current pricing</SiteLink>. ShootPortal takes 0% of client payments;
                Stripe&apos;s standard processing fees apply.
              </>
            )}
          </p>
          <p>
            The payment side of this workflow (proposals, deposits, payment requests, and receipts) is covered on our{" "}
            <SiteLink href="/photography-invoicing-software">invoicing and payment software for photographers</SiteLink> page.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Get paid before every delivery, without asking twice"
            body={
              <>
                Connect your Stripe account during setup, set your deposit rule, turn on the download lock, and send one
                real listing through it. Open the portal as your agent would: preview, tap Pay Now, download. You keep
                every dollar minus Stripe&apos;s fee.
              </>
            }
            secondaryHref="/how-it-works"
            secondaryLabel="See the payment flow"
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
            Getting paid before delivery isn&apos;t about distrust. It&apos;s about agreeing terms early, making payment
            easy, and connecting it to the moment the client wants their files. Do that, and most of the chasing simply
            stops. ShootPortal does all three on one project: deposits on approval, previews right away, a pay link with
            no login, and downloads that unlock on payment. See{" "}
            <SiteLink href="/how-it-works">how ShootPortal works</SiteLink>.
          </p>
          <KeyTakeaways
            items={[
              "Late payments mostly come from delivering first and stating no policy.",
              "Pick a payment model (or two) and put it on every estimate.",
              "Preview-then-unlock gives agents what they need while protecting your cash flow.",
              "Make paying easy: a no-login pay link with card, wallet, and bank options.",
              "Honor existing agreements and have an attorney review your policy.",
            ]}
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "Is it okay to require payment before delivering real estate photos?",
      answerText:
        "Yes, as long as the terms are agreed before the shoot and stated on your estimate or contract. Don't change terms on work already booked under a different agreement, and have an attorney review your policy. This is not legal advice.",
      answer: (
        <p>
          Yes, as long as the terms are agreed before the shoot and stated on your estimate or contract. Don&apos;t
          change terms on work already booked under a different agreement, and have an attorney review your policy. This
          isn&apos;t legal advice.
        </p>
      ),
    },
    {
      question: "Should I watermark previews or lock downloads?",
      answerText:
        "Locked downloads are usually smoother: you upload once, the agent can view everything, and full files unlock when the balance is paid. Watermarked previews work without special software but require two uploads.",
      answer: (
        <p>
          Locked downloads are usually smoother: you upload once, the agent views everything, and full files unlock when
          the balance is paid. Watermarked previews work without special software but mean two uploads.
        </p>
      ),
    },
    {
      question: "How much deposit should a real estate photographer charge?",
      answerText:
        "There's no standard figure. Choose a percentage or fixed amount that covers your travel and the cost of losing the slot, apply it to new clients and larger jobs, and state it on the estimate. Check local rules on non-refundable deposits.",
      answer: (
        <p>
          There&apos;s no standard figure. Choose a percentage or fixed amount that covers your travel and the cost of
          losing the slot, apply it to new clients and larger jobs, and state it on the estimate. Check local rules on
          non-refundable deposits.
        </p>
      ),
    },
    {
      question: "What if an agent insists on paying at closing?",
      answerText:
        "Explain the trade-off and what you offer instead: instant previews, a pay link that works from a phone without logging in, and downloads the moment it's paid. Pay-at-closing services exist, but they usually charge the photographer a fee and leave you waiting weeks or months. For a valuable client, an exception you choose deliberately is better than a default you drift into.",
      answer: (
        <p>
          Explain the trade-off and what you offer instead: instant previews, a pay link that works from a phone without
          logging in, and downloads the moment it&apos;s paid. Pay-at-closing services exist, but they usually charge the
          photographer a fee and leave you waiting weeks or months. For a valuable client, an exception you choose
          deliberately is better than a default you drift into.
        </p>
      ),
    },
    {
      question: "Can ShootPortal lock downloads until a client pays?",
      answerText:
        "Yes. The optional unlock-downloads-after-payment setting lets clients view and review their media while downloads stay locked until the final payment is made. You can set it as a business default or per project, and downloads unlock automatically when the payment clears.",
      answer: (
        <p>
          Yes. The optional unlock-downloads-after-payment setting lets clients view and review their media while
          downloads stay locked until the final payment is made. You can set it as a business default or per project, and
          downloads unlock automatically when the payment clears.
        </p>
      ),
    },
    {
      question: "Do agents need an account to pay a real estate photography invoice?",
      answerText:
        "Not in ShootPortal. Payment emails include a pay link that opens checkout without a login. Agents can pay by card, Apple Pay, Google Pay, or ACH bank transfer if you enable it, and a receipt is emailed automatically. ShootPortal takes 0% of the payment.",
      answer: (
        <p>
          Not in ShootPortal. Payment emails include a pay link that opens checkout without a login. Agents can pay by
          card, Apple Pay, Google Pay, or ACH bank transfer if you enable it, and a receipt is emailed automatically.
          ShootPortal takes 0% of the payment.
        </p>
      ),
    },
  ],
  related: ["best-photography-invoicing-software", "how-to-deliver-real-estate-photos", "real-estate-photography-automation"],
  cta: {
    title: "Get paid before the files leave your hands",
    body: "Deposits on proposal approval, no-login pay links with card, wallet, or ACH, automatic reminders, and downloads that unlock the moment the balance lands. ShootPortal takes 0% of your payments.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how payments work",
  },
};
