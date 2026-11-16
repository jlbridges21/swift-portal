import { FreeResourceCallout } from "@/components/blog/free-resource-callout";
import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Figure,
  InlineCta,
  KeyTakeaways,
  SiteLink,
  Steps,
} from "@/components/blog/article-parts";
import { PortalAnatomyDiagram } from "@/components/blog/diagrams";
import { BeforeAfter } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { ProductCallout, TrialCard, TrialPlan } from "@/components/blog/conversion-parts";
import { AllInOnePlatform, ScreenTrio, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "how-to-create-photography-client-portal",
  title: "How to Create a Professional Client Portal for Your Photography Business",
  seoTitle: "How to Create a Client Portal for Your Photography Business",
  description:
    "How to build a client portal for your photography business: what to include, branding and domains, DIY vs. software, and what your client sees.",
  excerpt:
    "What clients expect from a portal, how to plan and brand one, why DIY setups break down, and a step-by-step ShootPortal walkthrough with real screens of exactly what your client sees.",
  category: "client-management",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  primaryKeyword: "client portal for photography business",
  secondaryKeywords: [
    "photography client portal",
    "how to create a client portal",
    "branded client portal",
    "client portal custom domain",
    "DIY client portal",
    "real estate photography client portal",
    "client portal with online payments",
    "photography business website",
    "video review for clients",
  ],
  readingMinutes: 13,
  cover: {
    variant: "portal",
    tint: "teal",
    label: "How-To Guide",
    alt: "Illustration of a branded client portal window with project, media, and payment panels",
  },
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>A client portal is one branded place</strong> where each client approves the proposal, confirms the
        shoot time, reviews photos and video, pays, and downloads.
      </>,
      <>
        <strong>The fastest way to build one:</strong> ShootPortal (our product) creates a portal for every client and
        project automatically, under your logo and domain, and keeps it current as the job moves.
      </>,
      <>
        <strong>For your client, it&apos;s simple:</strong> every email opens the right page in one click, every action
        is one big button (Approve Proposal, Approve Time, Pay Now, Download All), and it works on any phone with
        nothing to install.
      </>,
      <>
        <strong>A DIY portal</strong> built from shared folders, a page builder, and payment links is cheap but has to
        be updated by hand for every client, and it breaks the moment you forget.
      </>,
      <>
        <strong>Brand it properly:</strong> your logo, colors, and a custom domain do more for perceived
        professionalism than any design flourish.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Ask a photographer where a client&apos;s project lives and the honest answer is often &quot;in a few
        places&quot;. The quote is a PDF in an email, the shoot date is a text, the photos are in a Dropbox folder, and
        the invoice is a payment link sent separately. It works, but the client has to keep track of all of it, and so
        do you.
      </p>
      <p>
        A <strong>client portal for your photography business</strong> pulls those pieces into one branded space. This
        guide walks through how to build one: what to include, how to brand it, how far a do-it-yourself setup can take
        you, and how to set one up in ShootPortal, the platform we build for real estate photographers, drone pilots,
        and videographers. We&apos;ll show the real screens your client sees at each step, because the client&apos;s
        experience is the whole point. If you&apos;re still comparing products, our roundup of the{" "}
        <BlogLink slug="best-photography-client-portals">best client portals for photographers</BlogLink> covers the
        options side by side.
      </p>
    </>
  ),
  sections: [
    {
      id: "what-clients-expect",
      title: "What clients actually expect from a portal",
      tocLabel: "What clients expect",
      body: () => (
        <>
          <p>
            A portal isn&apos;t valuable because it exists. It&apos;s valuable when it answers a client&apos;s
            questions before they have to ask. Those questions are remarkably consistent across niches:
          </p>
          <ul>
            <li>
              <strong>&quot;What am I paying for?&quot;</strong> The estimate or proposal, in a form they can approve.
            </li>
            <li>
              <strong>&quot;When is it happening?&quot;</strong> The confirmed shoot date and any details they need to
              prepare.
            </li>
            <li>
              <strong>&quot;Where is it at?&quot;</strong> A plain-language status: scheduled, shot, editing, ready.
            </li>
            <li>
              <strong>&quot;Where are my files?&quot;</strong> Every deliverable in one place, in the sizes they need.
            </li>
            <li>
              <strong>&quot;How do I ask for a change?&quot;</strong> A clear way to leave feedback on specific items.
            </li>
            <li>
              <strong>&quot;What do I owe?&quot;</strong> The balance, and a way to pay it by card.
            </li>
          </ul>
          <p>
            Notice what&apos;s missing: clients rarely ask for features. They ask for clarity. A portal that answers
            these six questions for every project is more professional than one with a dozen tabs nobody opens.
          </p>
          <p>
            They also expect it to be easy. Your client is an agent between showings or a marketing manager between
            meetings, usually on a phone. If they have to install an app, create a password, or hunt for the right link,
            they&apos;ll text you instead, and the portal has failed.
          </p>
        </>
      ),
    },
    {
      id: "plan-the-portal",
      title: "Step 1: Plan what your portal needs to show",
      tocLabel: "Plan the contents",
      body: () => (
        <>
          <p>
            Before you pick a tool, map your client journey from first contact to final download, and decide which
            moments the portal should handle. Most photography businesses end up with some version of these six
            building blocks:
          </p>
          <Figure caption="Conceptual diagram: the six building blocks of a photography client portal.">
            <PortalAnatomyDiagram />
          </Figure>
          <p>Not every business needs all six on day one. A few ways to prioritize:</p>
          <ul>
            <li>
              <strong>Real estate and commercial work</strong> leans on media delivery, payment, and fast status
              updates, because clients are working to listing or launch deadlines. Our{" "}
              <BlogLink slug="how-to-deliver-real-estate-photos">guide to delivering real estate photos</BlogLink>{" "}
              covers that side in depth.
            </li>
            <li>
              <strong>Video-heavy work</strong> needs a review step with feedback attached to the right moment in the
              cut, ideally inside the portal rather than in a separate Frame.io or Dropbox Replay link.
            </li>
            <li>
              <strong>Custom-quoted work</strong> (aerial surveys, commercial shoots) needs estimates the client can
              approve or push back on before anything is scheduled.
            </li>
          </ul>
          <p>
            Write your list down. It becomes the checklist you hold every tool against, including a DIY setup.
          </p>
          <FreeResourceCallout resource="photography-client-questionnaire" />
        </>
      ),
    },
    {
      id: "branding",
      title: "Step 2: Brand it with your logo, colors, and domain",
      tocLabel: "Branding and domain",
      body: () => (
        <>
          <p>
            Branding is what makes a portal feel like part of your business instead of a third-party website you sent
            the client to. Three layers matter, in order of impact:
          </p>
          <h3>Logo and brand color</h3>
          <p>
            Use the same logo file and primary color as your website and invoices. Consistency is what reads as
            professional. If your logo is a wide wordmark, check how it looks in a narrow header on a phone.
          </p>
          <h3>A subdomain or custom domain</h3>
          <p>
            Most portal tools give you a subdomain on their own domain (something like{" "}
            <em>yourstudio.portalvendor.com</em>). Many also let you connect a custom domain such as{" "}
            <em>portal.yourstudio.com</em>. Setting that up usually means adding a DNS record at your domain registrar,
            then waiting for the tool to verify it. It&apos;s a one-time, fifteen-minute job that makes every link you
            send look like yours.
          </p>
          <h3>Email from your own domain</h3>
          <p>
            Portal notifications (&quot;your photos are ready&quot;, &quot;your estimate is waiting&quot;) should come
            from your domain where possible. Clients trust and open emails from a name they recognize.
          </p>
          <Callout tone="note" title="Branded vs. white-label">
            <p>
              &quot;White-label&quot; usually means removing every trace of the software vendor. &quot;Branded&quot;
              means your logo, colors, and domain are front and center, but the vendor may still appear somewhere, such
              as a small footer credit. For most photographers, a branded portal on your own domain is plenty. If full
              white-label matters to you, confirm exactly what each vendor removes before you commit.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "build-sections",
      title: "Step 3: Set up services, communication, media, payments, and status",
      tocLabel: "Build the sections",
      body: () => (
        <>
          <p>With the plan and branding in place, build out each block. Here&apos;s what to get right in each.</p>
          <h3>Services and estimates</h3>
          <p>
            Define your packages once, with clear names, what&apos;s included, and a starting price (or no price, if
            everything is custom). When a client requests work, the estimate should come from that catalog so the
            portal and your pricing never disagree.
          </p>
          <h3>Communication</h3>
          <p>
            Pick one channel per project and say so. If the portal has messaging, tell clients that project questions
            go there, and reply there yourself even when they text. Within a few jobs, conversations stop scattering.
          </p>
          <h3>Media access</h3>
          <p>
            Organize deliverables the way the client will use them: photos in folders, video files with any hosted
            versions, tours and 3D models embedded alongside, and documents. Decide which download sizes to offer and
            whether people without an account (an assistant, a business partner) can view a shared link.
          </p>
          <h3>Payments</h3>
          <p>
            Connect a payment processor so clients can pay by card from the portal. Decide your deposit policy, when the
            balance is due, and whether downloads wait for payment. Writing these rules into the portal itself means
            you never have to negotiate them by email.
          </p>
          <ProductCallout title="Payment rules that enforce themselves">
            <p>
              In ShootPortal, a deposit (none, a percentage, or a fixed amount) is created the moment the client
              approves the proposal. Clients pay by card, Apple Pay, Google Pay, or bank transfer, straight to your own
              Stripe account, and ShootPortal takes 0%. Downloads can stay locked until the balance is paid, then unlock
              and send the receipt automatically.
            </p>
          </ProductCallout>
          <h3>Project status</h3>
          <p>
            Use a small number of stages with names a client understands. &quot;Shoot complete&quot; and &quot;Ready
            for review&quot; mean something to a client; &quot;Post-processing queue 2&quot; doesn&apos;t. Status is
            what stops &quot;any update?&quot; emails.
          </p>
        </>
      ),
    },
    {
      id: "diy-vs-dedicated",
      title: "The DIY portal: what works and what doesn't",
      tocLabel: "DIY vs. dedicated",
      body: () => (
        <>
          <p>
            You can build something portal-like without dedicated software. A common DIY setup combines:
          </p>
          <ul>
            <li>A shared Google Drive or Dropbox folder per client for files</li>
            <li>A Notion page or Google Sites page per client with status, links, and notes</li>
            <li>Payment links from Stripe, Square, or PayPal</li>
            <li>A booking or form tool for intake</li>
          </ul>
          <p>
            It&apos;s honest to say this can work well, especially for a handful of high-touch clients. You control the
            layout completely, the tools are familiar, and the cost is low or zero if you already pay for them.
          </p>
          <p>
            The catch is maintenance. Every page is a manual copy you have to update: change the status, paste in the
            new folder link, add the payment link, mark it paid. Nothing updates itself when the client pays or approves.
            Each new client means building another page from a template, and if you forget to update one, the portal
            tells the client something wrong, which is worse than having no portal at all. The pieces also don&apos;t
            share data, so your client history ends up split across four tools. For a deeper look at the file-sharing
            piece on its own, see{" "}
            <BlogLink slug="google-drive-vs-dropbox-photo-delivery">Google Drive vs. Dropbox for photo delivery</BlogLink>.
          </p>
          <Figure caption="Conceptual comparison: a hand-built DIY portal versus a portal generated by dedicated software.">
            <BeforeAfter
              beforeTitle="DIY portal"
              afterTitle="Dedicated portal software"
              before={[
                "One page per client, built and updated by hand",
                "Status changes only when you remember to edit the page",
                "Files, page, and payments live in separate tools",
                "Payment status checked in a separate dashboard",
                "Branding limited to what each tool allows",
                "Client history split across apps",
              ]}
              after={[
                "Portal created automatically for every client",
                "Status follows the project as work moves forward",
                "Estimate, media, messages, and payment on one project",
                "Payments recorded against the project when they clear",
                "Your logo, colors, and domain throughout",
                "One client record with every project",
              ]}
            />
          </Figure>
          <ComparisonTable
            caption="DIY client portal versus dedicated portal software"
            columns={["", "DIY (folders + page builder + payment links)", "Dedicated portal software"]}
            highlightColumn={2}
            rows={[
              ["Upfront cost", "Low; often tools you already pay for", "Monthly subscription"],
              ["Setup per client", "Build or duplicate a page each time", "Created when the client is added or requests work"],
              ["Keeping it current", "Manual edits", "Updates as the project moves"],
              ["Layout control", "Total", "Within the tool's design"],
              ["Approvals and feedback", "Email or comments in separate tools", "Built in, attached to the project"],
              ["Best for", "A few high-touch clients", "Steady volume or many repeat clients"],
            ]}
          />
        </>
      ),
    },
    {
      id: "set-up-in-shootportal",
      title: "Setting up a client portal with dedicated software",
      tocLabel: "Setup walkthrough",
      body: (ctx) => (
        <>
          <p>
            The difference between a DIY portal and a dedicated one comes down to where the portal gets its
            information. A DIY page shows whatever you last typed into it. A dedicated portal is the client&apos;s view
            of the project record you already work from: when you send the estimate, propose a shoot time, upload the
            finals, or record a payment, the client&apos;s page reflects it because it&apos;s the same record.
          </p>
          <p>
            To make the setup concrete, here&apos;s the path in ShootPortal, the platform we build. The order is
            similar in most dedicated tools, so use it as a template even if you choose something else.
          </p>
          <Steps
            items={[
              {
                title: "Create your account and pick your portal address",
                body: (
                  <>
                    Sign up with Google, or fill in five fields: business name, your name, portal address, email, and
                    password. The portal address becomes <em>yourstudio.shootportal.app</em>. No credit card is
                    requested to start the trial.
                  </>
                ),
              },
              {
                title: "Follow the guided setup",
                body: (
                  <>
                    Onboarding walks you through your business identity, branding, services, payments, and your
                    website, then finishes. Any step can be skipped and completed later from settings, so you don&apos;t
                    need every answer on day one.
                  </>
                ),
              },
              {
                title: "Brand it",
                body: (
                  <>
                    Upload your logo, email logo, and favicon, and set your brand colors. They carry through the portal,
                    every automated email, checkout, and your websites.
                  </>
                ),
              },
              {
                title: "Add services from templates",
                body: (
                  <>
                    Start from starter service templates and edit them into your packages: descriptions, what&apos;s
                    included, line items, a &quot;starting at&quot; label, or hidden pricing for custom work.
                  </>
                ),
              },
              {
                title: "Connect your Stripe account",
                body: (
                  <>
                    Client payments go straight to your own Stripe account through Stripe Connect. Decide whether to take
                    a deposit on approval (percentage or fixed) and whether downloads unlock only after final payment.
                  </>
                ),
              },
              {
                title: "Publish your business website and Book a Shoot form",
                body: (
                  <>
                    Build your business website in the Sites editor (Modern, Luxury, or Minimal templates, with your
                    portfolio, services, and contact page) and turn on the Book a Shoot form. A client&apos;s request
                    (contact details, brokerage, services, preferred date, notes) needs no account: it creates their
                    portal account and a new project, and shows them a preliminary estimate the moment they submit.
                  </>
                ),
              },
              {
                title: "Move to your own domain when you're ready",
                body: (
                  <>
                    Add a custom domain such as <em>portal.yourstudio.com</em>. ShootPortal shows the DNS record to add
                    and verifies it. You can also send client emails from your own domain.
                  </>
                ),
              },
              {
                title: "Walk through it as a client",
                body: (
                  <>
                    Submit a test request, approve the proposal, approve a proposed time, pay, and download on your
                    phone before your first real client does.
                  </>
                ),
              },
            ]}
          />
          <Figure caption="Real ShootPortal screen: the client side of a ShootPortal portal, with status, estimate, media, and payment (sample client data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <h3>What the portal does for you</h3>
          <ul>
            <li>
              <strong>Automatic once set up:</strong> a client account and project from each request, an instant
              preliminary estimate from your catalog (with travel fees by ZIP distance), branded emails at every step,
              reminders for proposals, scheduling, review, and payment, stage changes as work moves forward, payment
              receipts, and an optional download unlock after payment.
            </li>
            <li>
              <strong>Centralized:</strong> the proposal, shoot time, messages, media, video review, approvals, and
              payment status for each project, and every project on one client record with lifetime revenue and
              outstanding balance.
            </li>
            <li>
              <strong>Kept in your hands:</strong> you send the official proposal and propose the shoot time, so pricing
              and your route stay under your control. You can touch up any photo in the built-in editor before it goes
              out, and Save to Project updates the client&apos;s gallery instantly.
            </li>
          </ul>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Set up your portal and run one real client through it"
            body={
              <>
                Pick your portal address, add your logo and a service or two, connect Stripe, and send your next client
                their own branded project page. Skip anything you&apos;re not ready for and come back to it.
                {ctx.studioMonthly ? (
                  <>
                    {" "}
                    After the trial, the Studio plan is {ctx.studioMonthly}/month
                    {ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}.
                  </>
                ) : null}
              </>
            }
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
          <p>
            Want to see the finished result first? Tour the{" "}
            <SiteLink href="/photography-client-portal">ShootPortal client portal</SiteLink>.
          </p>
        </>
      ),
    },
    {
      id: "what-your-client-sees",
      title: "What your client sees in a ShootPortal client portal for a photography business",
      tocLabel: "What your client sees",
      body: (ctx) => (
        <>
          <p>
            Here&apos;s the part that matters most: the client&apos;s side. Every step below opens from a link in a
            branded email, on a phone or a laptop, with no app to download. Each screen asks the client for one thing,
            with one obvious button.
          </p>
          <Figure
            wide
            caption="Real ShootPortal client screens: the official proposal with line items and deposit terms and an Approve Proposal button (left), a proposed shoot time with Approve Time or Request a Different Time (center), and finished media with Pay Now (right)."
          >
            <ScreenTrio views={["portal-proposal", "portal-shoot-time", "portal-pay"]} />
          </Figure>
          <ol>
            <li>
              <strong>Approve the proposal.</strong> Line items, the total, and the deposit terms on one page. One click
              approves it and creates the deposit payment; or the client requests changes and you send a new version.
            </li>
            <li>
              <strong>Approve the shoot time.</strong> You propose a time; they tap Approve Time or suggest a different
              one. The confirmed shoot lands on your Google Calendar.
            </li>
            <li>
              <strong>Follow progress without asking.</strong> The portal shows the same pipeline you work from, in
              plain language: scheduled, shoot complete, ready for review, delivered.
            </li>
            <li>
              <strong>Review and comment.</strong> Photos come in folders, with hearts for favorites. Video plays in the
              portal, and comments pin to the timestamp and a point on the frame, with numbered versions as you revise.
              No Frame.io or Dropbox Replay link, and no extra cost.
            </li>
            <li>
              <strong>Pay and download.</strong> Pay Now opens a checkout with card, Apple Pay, Google Pay, or bank
              payment. Downloads unlock right away, in Print or MLS size, one at a time or with Download All.
            </li>
          </ol>
          <Figure caption="Real ShootPortal screens: the project's Media tab where you organize the finals (left), and the finished project on your client's phone with Download All (right).">
            <TwoSidedScreens business="project-media" client="phone-portal-finished" />
          </Figure>
          <p>
            For real estate clients there&apos;s one more step that agents love. With the Marketing Kit turned on, the
            agent can preview a property website and a social media kit (Just Listed posts, Stories, a carousel, and a
            print flyer) built from their photos, and buy it or receive it free, right from the same project.
          </p>
          <InlineCta
            trialDays={ctx.trialDays}
            title="See your portal through your client's eyes"
            body="Set up your branding, send yourself a test proposal, and approve, pay, and download on your own phone. The guided setup handles branding, services, and Stripe first."
          />
        </>
      ),
    },
    {
      id: "multiple-clients",
      title: "Managing many clients in one portal",
      tocLabel: "Many clients",
      body: () => (
        <>
          <p>
            A portal that works for one client has to keep working for fifty. A few principles keep it manageable:
          </p>
          <ul>
            <li>
              <strong>One login per client, many projects.</strong> A repeat client should see every project
              they&apos;ve had with you under one account, not a new link each time. That history is part of why
              they keep booking.
            </li>
            <li>
              <strong>Share links for the people around your client.</strong> Agents have assistants; businesses have
              marketing teams. Link-based or invite-based access keeps them out of your client&apos;s account. In
              ShootPortal, you can share with &quot;anyone with the link&quot; or by email invite, with an expiry.
            </li>
            <li>
              <strong>Use the portal&apos;s data on your side too.</strong> The same record that powers the client
              portal should tell you lifetime revenue, outstanding balance, and when the client last logged in.
            </li>
            <li>
              <strong>Save what repeats.</strong> For agents, ShootPortal saves their headshot, brokerage logo, and
              colors on the client record, so every new listing&apos;s property website and social posts come out
              already branded for them.
            </li>
            <li>
              <strong>Give staff access by role.</strong> If you have editors or second shooters, they need access to
              their projects, not your whole business. ShootPortal includes unlimited staff accounts with granular
              permissions (presets like Editor or Coordinator) and assignment to specific projects.
            </li>
          </ul>
          <p>
            When client count really climbs, the portal becomes one part of a broader system. We cover the operational
            side in{" "}
            <BlogLink slug="real-estate-photography-client-management">
              managing multiple real estate photography clients
            </BlogLink>
            .
          </p>
        </>
      ),
    },
    {
      id: "client-journey",
      title: "Example: one client's journey through the portal",
      tocLabel: "Example journey",
      body: () => (
        <>
          <p>
            Here&apos;s how a single job might flow for a commercial client who needs aerial photos and a short video
            of a new building. The steps are generic; the right column shows what the client does in the portal.
          </p>
          <ComparisonTable
            caption="Example client journey through a photography client portal"
            columns={["Moment", "What the client sees", "What the client does"]}
            rows={[
              ["Request", "Your business website and Book a Shoot form", "Submits a request and sees a preliminary estimate instantly"],
              ["Proposal", "Line items, total, deposit terms, and expiry date", "Clicks Approve Proposal, or requests changes"],
              ["Deposit", "Amount due on approval", "Pays by card"],
              ["Scheduling", "Your proposed shoot time", "Taps Approve Time or suggests another time"],
              ["Shoot and editing", "Plain-language status updates", "Nothing; no need to ask for updates"],
              ["Review", "Photos in folders and the video draft (V1, V2)", "Approves items, leaves notes, comments pinned to the video frame"],
              ["Final payment", "Remaining balance", "Pays online; downloads unlock if you use that option"],
              ["Delivery", "All final media", "Downloads files or a ZIP; shares a link with their team"],
              ["Marketing (optional)", "Property website and social kit preview", "Adds it to the cart, or receives it free"],
            ]}
            note="Illustrative journey based on ShootPortal. The exact steps depend on how you configure it."
          />
          <p>
            The client never has to search their inbox for a link or ask what&apos;s next, and you never have to
            reconstruct where the job stands. That is the whole point of the portal.
          </p>
        </>
      ),
    },
    {
      id: "launch",
      title: "Launching your portal to existing clients",
      tocLabel: "Launching",
      body: () => (
        <>
          <p>
            Don&apos;t migrate everyone at once. Start new jobs in the portal, and move repeat clients over the next
            time they book. A short note helps: tell them their projects, files, and invoices will now live in one place
            at your domain, and that they&apos;ll get an email whenever something needs their attention.
          </p>
          <p>
            Then watch for friction. If a client emails instead of using the portal, reply with a link to the right
            spot rather than handling it in email. Most clients adapt within one or two projects.
          </p>
          <h3>A one-week pilot before you switch everything</h3>
          <p>
            If you&apos;re trying a dedicated tool, evaluate it on a real job rather than a feature list. A simple plan:
          </p>
          <TrialPlan />
          <AllInOnePlatform intro="The portal is the client's view of one connected system: your website brings the request in, and the same subscription runs proposals, scheduling, editing, video review, payment, delivery, and listing marketing." />
          <p>
            To see the full flow
            before you build anything, take a look at{" "}
            <SiteLink href="/how-it-works">how ShootPortal&apos;s client portal works</SiteLink>, or browse the wider
            options in our{" "}
            <BlogLink slug="best-real-estate-photography-software">real estate photography software guide</BlogLink>.
          </p>
          <KeyTakeaways
            items={[
              <>A good portal answers six client questions: cost, date, status, files, changes, and balance.</>,
              <>Plan the building blocks you need before choosing a tool.</>,
              <>Logo, color, and a custom domain do most of the branding work.</>,
              <>DIY portals are cheap but must be updated by hand for every client.</>,
              <>Dedicated software keeps the portal current as the project moves.</>,
              <>Test the whole journey as a client before inviting real ones.</>,
            ]}
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What should a photography client portal include?",
      answerText:
        "At minimum: project status, the estimate or proposal, the shoot date, media delivery, a way to give feedback, messaging, and online payment. Prioritize the parts your clients ask about most.",
      answer: (
        <p>
          At minimum: project status, the estimate or proposal, the shoot date, media delivery, a way to give feedback,
          messaging, and online payment. Prioritize the parts your clients ask about most.
        </p>
      ),
    },
    {
      question: "Can I build a client portal for free?",
      answerText:
        "You can approximate one with shared folders, a free page builder, and payment links. It costs little but must be updated by hand for every client, and the pieces don't share data. Dedicated software automates that for a monthly fee.",
      answer: (
        <p>
          You can approximate one with shared folders, a free page builder, and payment links. It costs little, but it
          has to be updated by hand for every client, and the pieces don&apos;t share data. Dedicated software
          automates that for a monthly fee.
        </p>
      ),
    },
    {
      question: "How do I put my client portal on my own domain?",
      answerText:
        "Most portal tools that support custom domains ask you to add a DNS record, usually a CNAME, at your domain registrar for a subdomain like portal.yourstudio.com. The tool then verifies the record and serves your portal there.",
      answer: (
        <p>
          Most portal tools that support custom domains ask you to add a DNS record, usually a CNAME, at your domain
          registrar for a subdomain like <em>portal.yourstudio.com</em>. The tool then verifies the record and serves
          your portal there.
        </p>
      ),
    },
    {
      question: "Is ShootPortal's client portal white-label?",
      answerText:
        "ShootPortal is a branded portal: your logo, favicon, and brand colors across the portal, emails, checkout, and websites, on your own subdomain or a custom domain like portal.yourstudio.com, with emails that can send from your own domain.",
      answer: (
        <p>
          ShootPortal is a branded portal: your logo, favicon, and brand colors across the portal, emails, checkout, and
          websites, on your own subdomain or a custom domain like <em>portal.yourstudio.com</em>, with emails that can
          send from your own domain.
        </p>
      ),
    },
    {
      question: "Do clients need an account to use a photography portal?",
      answerText:
        "It depends on the tool. In ShootPortal, the client's account is created automatically when they request a shoot or you add them, and every email opens their portal in one click. Pay links open without logging in, and you can share media with people who don't have an account using view links or email invites.",
      answer: (
        <p>
          It depends on the tool. In ShootPortal, the client&apos;s account is created automatically when they request a
          shoot or you add them, and every email opens their portal in one click. Pay links open without logging in,
          and you can share media with people who don&apos;t have an account using view links or email invites.
        </p>
      ),
    },
    {
      question: "Do clients need to download an app to use the portal?",
      answerText:
        "Not with ShootPortal. The portal runs in any phone or desktop browser. Clients approve proposals and shoot times, comment on videos, pay with card, Apple Pay, or Google Pay, and download files without installing anything.",
      answer: (
        <p>
          Not with ShootPortal. The portal runs in any phone or desktop browser. Clients approve proposals and shoot
          times, comment on videos, pay with card, Apple Pay, or Google Pay, and download files without installing
          anything.
        </p>
      ),
    },
    {
      question: "Can my client portal connect to my photography business website?",
      answerText:
        "Yes. ShootPortal includes a business website builder with Modern, Luxury, and Minimal templates, your portfolio and services, and a Book a Shoot form. A request from the website creates the client's portal account and project automatically and shows them an instant estimate.",
      answer: (
        <p>
          Yes. ShootPortal includes a business website builder with Modern, Luxury, and Minimal templates, your
          portfolio and services, and a Book a Shoot form. A request from the website creates the client&apos;s portal
          account and project automatically and shows them an instant estimate.
        </p>
      ),
    },
  ],
  related: ["best-photography-client-portals", "how-to-deliver-real-estate-photos", "best-photography-crm-software"],
  cta: {
    title: "Build a branded client portal your clients will actually use",
    body: "Every client gets one page to approve the proposal, confirm the shoot time, comment on the video, pay, and download, with nothing to install. You get fewer emails and faster payment.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See the client portal",
  },
};
