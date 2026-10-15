import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Figure,
  KeyTakeaways,
  SiteLink,
  Steps,
} from "@/components/blog/article-parts";
import { PortalAnatomyDiagram } from "@/components/blog/diagrams";
import { BeforeAfter } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { TrialCard, TrialPlan } from "@/components/blog/conversion-parts";

export const article: BlogArticle = {
  slug: "how-to-create-photography-client-portal",
  title: "How to Create a Professional Client Portal for Your Photography Business",
  seoTitle: "How to Create a Client Portal for Your Photography Business",
  description:
    "A step-by-step guide to building a client portal for your photography business: what to include, branding and domains, DIY options vs. dedicated software.",
  excerpt:
    "What clients actually expect from a portal, how to plan and brand one, the honest pros and cons of a DIY setup, and a step-by-step walkthrough for building it with dedicated software.",
  category: "client-management",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  primaryKeyword: "client portal for photography business",
  secondaryKeywords: [
    "photography client portal",
    "how to create a client portal",
    "branded client portal",
    "client portal custom domain",
    "DIY client portal",
  ],
  readingMinutes: 12,
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
        <strong>A client portal is one branded place</strong> where each client sees their project status, approves
        quotes, picks up media, messages you, and pays.
      </>,
      <>
        <strong>Plan the contents before the tool.</strong> Decide which of six building blocks (status, estimate,
        schedule, media, messages, payments) your clients actually need.
      </>,
      <>
        <strong>A DIY portal</strong> built from shared folders, a page builder, and payment links is cheap but has to
        be maintained by hand for every client.
      </>,
      <>
        <strong>Dedicated software</strong> creates the portal automatically for each client and project, so it stays
        current without extra work.
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
        you, and how to set one up with dedicated software. If you&apos;re already at the point of comparing products,
        our roundup of the{" "}
        <BlogLink slug="best-photography-client-portals">best client portals for photographers</BlogLink> covers the
        options side by side. This article is about the build.
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
              cut.
            </li>
            <li>
              <strong>Custom-quoted work</strong> (aerial surveys, commercial shoots) needs estimates the client can
              approve or push back on before anything is scheduled.
            </li>
          </ul>
          <p>
            Write your list down. It becomes the checklist you hold every tool against, including a DIY setup.
          </p>
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
                    Onboarding walks you through your business identity, branding, services, payments, and your landing
                    page, then finishes. Any step can be skipped and completed later from settings, so you don&apos;t
                    need every answer on day one.
                  </>
                ),
              },
              {
                title: "Brand it",
                body: (
                  <>
                    Upload your logo, set your brand color, and choose a light or dark portal theme.
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
                title: "Publish your landing page and request form",
                body: (
                  <>
                    Each business gets an editable public page on its portal domain with your services and a request
                    form. A client&apos;s request (details, property address, service, preferred date) creates their
                    portal account and a new project.
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
                    Submit a test request, approve the estimate, accept a proposed time, and check the delivery on your
                    phone before your first real client does.
                  </>
                ),
              },
            ]}
          />
          <Figure caption="Product illustration: the client side of a ShootPortal portal, with status, estimate, media, and payment (demo data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <h3>What the portal does for you, and what it doesn&apos;t</h3>
          <ul>
            <li>
              <strong>Automatic once set up:</strong> a client account and project from each request, preliminary
              estimates from your catalog (if you turn them on), email notifications from editable templates, some
              stage changes as work moves forward, payment receipts, and an optional download unlock after final
              payment.
            </li>
            <li>
              <strong>Centralized:</strong> the estimate, shoot time, messages, media, approvals, and payment status for
              each project, and every project on one client record with lifetime revenue and outstanding balance.
            </li>
            <li>
              <strong>Still yours to do:</strong> sending the official estimate, proposing shoot times (clients accept,
              decline, or counter; they don&apos;t book open slots themselves), uploading finals, and following up on
              anything unusual.
            </li>
          </ul>
          <p>
            Some honest limits worth knowing: ShootPortal is a branded portal (your logo, colors, and domain), not a
            fully white-labeled one, and there&apos;s no built-in e-signature for contracts. If those are essential,
            weigh them against the tools in our{" "}
            <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink>.
          </p>
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
              ShootPortal, you can share with &quot;anyone with the link&quot; or by email invite, one-time or reusable,
              with an expiry.
            </li>
            <li>
              <strong>Use the portal&apos;s data on your side too.</strong> The same record that powers the client
              portal should tell you lifetime revenue, outstanding balance, and when the client last logged in.
            </li>
            <li>
              <strong>Give staff access by role.</strong> If you have editors or second shooters, they need access to
              their projects, not your whole business. ShootPortal supports staff accounts with granular permissions and
              assignment to specific projects.
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
              ["Request", "Your branded landing page and service catalog", "Submits a request with address, service, and preferred date"],
              ["Estimate", "Line items, total, and expiry date", "Approves, or requests changes"],
              ["Deposit", "Amount due on approval", "Pays by card"],
              ["Scheduling", "Your proposed shoot time", "Accepts, declines, or suggests another time"],
              ["Shoot and editing", "Plain-language status updates", "Nothing; no need to ask for updates"],
              ["Review", "Photos in folders and the video draft", "Approves items, leaves notes, comments on the video timeline"],
              ["Final payment", "Remaining balance", "Pays online; downloads unlock if you use that option"],
              ["Delivery", "All final media", "Downloads files or a ZIP; shares a link with their team"],
            ]}
            note="Illustrative journey. The exact steps depend on the tool and how you configure it."
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
        "ShootPortal is a branded portal: your logo, brand color, light or dark theme, and your own subdomain or custom domain. It is not marketed as fully white-label.",
      answer: (
        <p>
          ShootPortal is a branded portal: your logo, brand color, light or dark theme, and your own subdomain or custom
          domain. It isn&apos;t marketed as fully white-label.
        </p>
      ),
    },
    {
      question: "Do clients need an account to use a photography portal?",
      answerText:
        "It depends on the tool. In ShootPortal, clients sign in to their portal, and you can share media with people who don't have an account using view links or email invites.",
      answer: (
        <p>
          It depends on the tool. In ShootPortal, clients sign in to their portal, and you can share media with people
          who don&apos;t have an account using view links or email invites.
        </p>
      ),
    },
  ],
  related: ["best-photography-client-portals", "how-to-deliver-real-estate-photos", "best-photography-crm-software"],
  cta: {
    title: "Build a branded client portal your clients will actually use",
    body: "Pick your portal address, add your logo and services, connect your own Stripe account, and give every client one page for their estimate, shoot time, files, and payments.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See the client portal",
  },
};
