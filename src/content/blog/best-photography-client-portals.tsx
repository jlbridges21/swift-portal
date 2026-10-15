import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  KeyTakeaways,
  No,
  PickGrid,
  SiteLink,
  ToolCard,
  Yes,
} from "@/components/blog/article-parts";
import { PortalAnatomyDiagram, VideoReviewDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, TrialCard } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";

export const article: BlogArticle = {
  slug: "best-photography-client-portals",
  title: "Best Client Portals for Photographers and Videographers in 2026",
  seoTitle: "Best Photography Client Portals in 2026",
  description:
    "Compare client portals for photographers and videographers: what clients can see, approve, pay, and download, plus branding, login, and pricing.",
  excerpt:
    "Your client portal is the part of your business clients actually touch. We compare what clients can do inside HoneyBook, Dubsado, Moxie, SuiteDash, Aryeo, ShootPortal, and more.",
  category: "client-management",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "photography client portal",
  secondaryKeywords: [
    "client portal for photographers",
    "videographer client portal",
    "branded client portal",
    "photography client experience",
    "client portal software",
  ],
  readingMinutes: 12,
  cover: {
    variant: "portal",
    label: "Client Experience",
    alt: "Illustration of a branded client portal window with project status, media, and payment panels",
  },
  disclosure: true,
  quickAnswer: {
    heading: "What to know before you compare",
    points: [
      <>
        <strong>Look at the portal from the client&apos;s side.</strong> The question isn&apos;t what the software
        does, it&apos;s what your client can do without emailing you.
      </>,
      <>
        <strong>Paperwork-heavy bookings:</strong> HoneyBook and Dubsado portals handle contracts, forms, and invoices
        well, but don&apos;t deliver galleries.
      </>,
      <>
        <strong>Want a fully white-labeled portal for any service business:</strong> SuiteDash includes white label on
        all plans; Moxie includes it on Pro.
      </>,
      <>
        <strong>Real estate agents as clients:</strong> Aryeo&apos;s agent portal shows past listings, media, and
        invoices in one login.
      </>,
      <>
        <strong>Clients who need to review, approve, pay for, and download photos and video in one place:</strong>{" "}
        ShootPortal (our product) is built around that.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Your clients never see your editing workstation, your calendar, or the spreadsheet where you track who owes
        what. They see emails, links, and whatever page those links open. For a lot of photographers and
        videographers, that page is a cloud folder, a payment link from a different company, and a reply-all thread
        with feedback buried in it. The work can be excellent and the experience still feels improvised.
      </p>
      <p>
        A <strong>photography client portal</strong> gives clients one branded place to see where their project
        stands, approve what you&apos;ve sent, leave feedback, pay, and download. Done well, it answers the
        &quot;any update?&quot; email before it gets written and makes a small studio look established.
      </p>
      <p>
        This guide is about the client&apos;s experience, not your back office. We compare what clients can actually
        do inside ten portals: creative CRMs, general client-portal software, a real estate platform, and ShootPortal,
        which is ours. Pricing links to each vendor&apos;s official page, and where we couldn&apos;t verify a detail,
        we say so.
      </p>
    </>
  ),
  sections: [
    {
      id: "what-is-a-client-portal",
      title: "What a photography client portal is",
      tocLabel: "What a client portal is",
      body: () => (
        <>
          <p>
            A client portal is a private, client-facing view of the work you&apos;re doing for them. Unlike a gallery
            link, which shows finished images, a portal spans the whole job: the estimate or proposal, the shoot date,
            the files, the conversation, and the money.
          </p>
          <p>
            Most portals combine some of the following. Which ones you need depends on what you sell.
          </p>
          <Figure caption="Conceptual diagram: the building blocks a photography client portal can show a client.">
            <PortalAnatomyDiagram />
          </Figure>
          <p>
            For a wedding photographer, the most important blocks might be the contract, questionnaire, and payment
            schedule. For a real estate or commercial photographer, they&apos;re usually status, media, and payment.
            For a videographer, the review tools matter more than anything else. Keep your own list in mind as you
            read the comparisons below, because no portal leads on every block.
          </p>
        </>
      ),
    },
    {
      id: "why-it-matters",
      title: "Why client portals matter for photographers and their clients",
      tocLabel: "Benefits",
      body: () => (
        <>
          <h3>What the photographer gets</h3>
          <ul>
            <li>
              <strong>Fewer status emails.</strong> When the client can see that the project is in editing or awaiting
              payment, they stop asking.
            </li>
            <li>
              <strong>Feedback in one place.</strong> Approvals and revision requests attached to the actual file
              replace scattered texts and emails.
            </li>
            <li>
              <strong>Faster payment.</strong> A pay button next to the deliverables removes the extra step between
              &quot;I love them&quot; and &quot;paid.&quot;
            </li>
            <li>
              <strong>A record you can point to.</strong> When a client asks what was approved or when files were
              delivered, the answer is already there.
            </li>
          </ul>
          <h3>What the client gets</h3>
          <ul>
            <li>
              <strong>One link for everything.</strong> No hunting through email for the invoice, the download, and
              last week&apos;s message.
            </li>
            <li>
              <strong>Clarity on what happens next.</strong> Plain-language status reduces anxiety, especially for
              first-time clients.
            </li>
            <li>
              <strong>Control.</strong> They can approve, request changes, or pay on their own schedule, including from
              their phone between showings or meetings.
            </li>
          </ul>
          <p>
            The portal also quietly sets your pricing power. A client who receives a polished, branded experience
            is less likely to compare you line by line with the cheapest option.
          </p>
        </>
      ),
    },
    {
      id: "login-or-link",
      title: "Login, magic link, or no account: how clients get in",
      tocLabel: "How clients log in",
      body: () => (
        <>
          <p>
            Access is the detail most comparisons skip, and it shapes the experience more than any feature. There are
            three common models:
          </p>
          <ul>
            <li>
              <strong>No account needed.</strong>{" "}
              <Ext href="https://help.honeybook.com/en/articles/6428603-what-clients-can-see-and-do-in-the-client-portal">HoneyBook</Ext>{" "}
              says clients don&apos;t need to log in by default, and{" "}
              <Ext href="https://help.withmoxie.com/en/articles/5855650-client-portal-features">Moxie</Ext> says clients
              don&apos;t need a Moxie account. This is the lowest-friction option.
            </li>
            <li>
              <strong>Client account.</strong>{" "}
              <Ext href="https://help.dubsado.com/en/articles/15920587-what-are-client-portals">Dubsado&apos;s</Ext>{" "}
              portal is a login portal (and off by default), with one portal per client across projects. Aryeo&apos;s
              agent portal is also a login. Accounts make it easy for repeat clients to see their history.
            </li>
            <li>
              <strong>Account plus share links.</strong> In ShootPortal, clients sign in to an account to use the
              portal, and you can also create share links (&quot;anyone with the link&quot; or email invites, one-time
              or reusable, with expiry) so someone without an account, such as an agent&apos;s assistant or a
              client&apos;s marketing contractor, can view files.
            </li>
          </ul>
          <Callout tone="note" title="The trade-off">
            <p>
              No-login portals are faster for one-off clients. Account-based portals are better for repeat clients who
              want a history of every job in one place. If most of your work is repeat business, a quick sign-in is
              rarely the thing clients complain about; a lost download link is.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "branding",
      title: "Professional branding: branded vs. white-label portals",
      tocLabel: "Branding",
      body: () => (
        <>
          <p>
            Branding has levels, and vendors use the terms loosely. It helps to separate them:
          </p>
          <ul>
            <li>
              <strong>Branded:</strong> your logo and colors appear in the portal, but the software vendor&apos;s name
              may still appear somewhere (a footer, a domain, a &quot;powered by&quot; badge).
            </li>
            <li>
              <strong>Custom domain:</strong> the portal lives at an address like portal.yourstudio.com rather than the
              vendor&apos;s domain.
            </li>
            <li>
              <strong>White-label:</strong> the vendor&apos;s branding is removed entirely.
            </li>
          </ul>
          <p>
            Among the tools below, SuiteDash lists white label on all plans, Moxie includes white-label and a custom
            domain on Pro, and Assembly offers a custom domain and badge removal from its Professional tier.
            HoneyBook removes &quot;Powered by HoneyBook&quot; from Essentials up.
          </p>
          <p>
            ShootPortal gives you a branded client portal with your logo, brand color, and a light or dark theme, at
            your own subdomain on shootportal.app or a custom domain you verify through DNS. You can send email from
            your own domain, and each business gets an editable public landing page on its portal domain. It isn&apos;t
            a full white-label product, so if removing every trace of the vendor is a requirement, look at SuiteDash
            or Moxie.
          </p>
          <p>
            Ready to set one up? Our{" "}
            <BlogLink slug="how-to-create-photography-client-portal">step-by-step guide to creating a photography client portal</BlogLink>{" "}
            covers branding, sections, and launch.
          </p>
        </>
      ),
    },
    {
      id: "review-and-delivery",
      title: "Project visibility, deliverables, and feedback",
      tocLabel: "Deliverables & feedback",
      body: () => (
        <>
          <p>
            For photographers and videographers, the deliverable is the product. A portal that handles contracts
            beautifully but sends clients elsewhere to see the work only covers half the relationship.
          </p>
          <h3>Deliverable access</h3>
          <p>
            Check what file types the portal can show (photos, video files, 360 tours, 3D models, PDFs), whether
            clients can download single files and ZIPs, and whether you can offer more than one size. Real estate
            clients, for example, often want both full-resolution and MLS-sized photos. Our{" "}
            <BlogLink slug="best-photo-video-delivery-platforms">photo and video delivery comparison</BlogLink> covers
            the delivery side in depth.
          </p>
          <h3>Feedback that&apos;s attached to the work</h3>
          <p>
            Per-item approval (approve this photo, request changes on that one) keeps revisions precise. For video,
            time-stamped comments are the difference between &quot;the part near the middle&quot; and &quot;0:23.&quot;
          </p>
          <Figure caption="Conceptual diagram: time-stamped comments on a video version, the kind of feedback a portal should capture.">
            <VideoReviewDiagram />
          </Figure>
          <h3>Payments next to the work</h3>
          <p>
            When the pay button sits beside the deliverables, payment becomes part of receiving the work rather than a
            separate chore. Some tools can also keep downloads locked until the final payment, so clients can view
            but not download until they&apos;ve paid. Decide whether that fits your relationships before you turn it
            on.
          </p>
          <h3>Communication</h3>
          <p>
            Messages attached to the project keep context. Watch for whether the portal sends email notifications when
            something changes, since clients rarely check a portal unprompted.
          </p>
        </>
      ),
    },
    {
      id: "comparison-table",
      title: "Client portal comparison table",
      tocLabel: "Comparison table",
      body: () => (
        <>
          <p>
            This table focuses on what clients can do. &quot;Not verified&quot; means we couldn&apos;t confirm it on the
            vendor&apos;s official pages.
          </p>
          <ComparisonTable
            caption="Client portals for photographers and videographers, October 2026"
            columns={[
              "Tool",
              "Entry price with portal",
              "Client login",
              "Pay in portal",
              "Media delivery in portal",
              "Approve media / video comments",
              "White-label",
            ]}
            highlightColumn={undefined}
            rows={[
              ["ShootPortal", "Flat monthly subscription", "Account; share links for others", <Yes key="a" />, <Yes key="b">Photos, video, tours, 3D</Yes>, <Yes key="b2">Per item + time-stamped video</Yes>, <No key="c">Branded + custom domain</No>],
              ["HoneyBook", "$29/mo billed yearly", "Not required by default", <Yes key="d" />, <No key="e">Files only</No>, <No key="e2" />, <No key="f">Badge removed on Essentials+</No>],
              ["Dubsado", "$335/yr", "Login (off by default)", <Yes key="g" />, <No key="h" />, <No key="h2" />, "Not verified"],
              ["Studio Ninja", "$16/mo", "Not verified", <Yes key="i" />, <No key="j" />, <No key="j2">In a separate gallery tool</No>, "Not verified"],
              ["Sprout Studio", "See official pricing", "Not verified", "Not verified", <Yes key="k">Galleries</Yes>, "Not verified", "Not verified"],
              ["Pixieset Studio Manager", "Free", "No persistent portal found", <Yes key="l" />, <No key="m">Separate gallery product</No>, "Not verified", <Yes key="n">Pro removes branding</Yes>],
              ["Moxie", "Pro $20/mo annual", "No Moxie account needed", <Yes key="o" />, <No key="p">File attachments</No>, <No key="p2" />, <Yes key="q">Pro</Yes>],
              ["SuiteDash", "$19/mo", "Login", <Yes key="r" />, <No key="s">File sharing</No>, <No key="s2" />, <Yes key="t">All plans</Yes>],
              ["Assembly", "Free; Starter $29/mo annual", "Sign-in", "Not verified", "Not verified", "Not verified", <Yes key="u">Professional+</Yes>],
              ["Aryeo", "Lite free", "Agent login", <Yes key="v" />, <Yes key="w">Listing media</Yes>, "Not verified", "Not verified"],
            ]}
            note={
              <>
                Prices and portal capabilities from official pricing and help pages, checked October 15, 2026. Links are
                in each profile below. &quot;File sharing&quot; means general file attachments rather than galleries or
                video review. &quot;Approve media / video comments&quot; means the client can approve or request changes on
                individual deliverables, or comment at a moment in a video, inside the same portal.
              </>
            }
          />
        </>
      ),
    },
    {
      id: "portals-reviewed",
      title: "The client portals, grouped by what they're built for",
      tocLabel: "Portals reviewed",
      body: (ctx) => (
        <>
          <p>
            Rather than rank these, we&apos;ve grouped them by design intent. ShootPortal is ours and is listed first,
            clearly labeled.
          </p>

          <h3>Built around media review and delivery</h3>
          <ToolCard
            id="tool-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="A branded project portal where clients approve, review, pay, and download"
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
            bestFor="Photographers, videographers, and drone operators whose clients care most about seeing, approving, and downloading the work."
            pros={[
              "Clients approve estimates (or request changes), download the estimate PDF, and accept, decline, or counter a proposed shoot time",
              "Photos in folders, video files, Kuula 360 tours, 3D model embeds, and documents in one place",
              "Approve or reject each deliverable with feedback; time-stamped, frame-pinned video comments",
              "Pay through Stripe Checkout, with money going to your own Stripe account; download single files or ZIPs in full-res or MLS size",
              "Message you on the project, so the conversation sits next to the files it's about",
              "Your logo, brand color, light or dark theme, and custom domain; share links for people without an account",
            ]}
            cons={[
              "Clients sign in to an account to use the portal (share links cover view-only access)",
              "Not fully white-label",
              "No contracts, e-signature, or questionnaires in the portal",
              "No SMS notifications; clients are notified by email",
            ]}
          >
            <p>
              ShootPortal&apos;s portal is organized around a project. The client sees where the job stands in
              plain-language stages, approves or requests changes to the estimate (and can download it as a PDF),
              accepts or counter-proposes the shoot time, and then reviews the deliverables. You decide which media
              sections each client sees, and you can keep downloads locked until the final payment while still letting
              the client preview everything.
            </p>
            <p>
              Because the portal sits on top of the same project you work from, nothing has to be copied between tools.
              When a client approves the estimate, the project moves forward and a deposit can be requested on
              approval. When they comment at 0:42 of the second cut, that note lives on version two of the video, not
              in an email. When they pay, the payment status shows on the project, and downloads can unlock without you
              sending another link.
            </p>
            <p>
              The trade-off is that it isn&apos;t a contracts-and-questionnaires portal. If those documents are central
              to your booking process, a creative CRM portal like HoneyBook or Dubsado will serve that part better.
            </p>
          </ToolCard>

          <h3>Creative CRMs with client portals</h3>
          <ToolCard
            id="tool-honeybook"
            name="HoneyBook"
            url="https://www.honeybook.com/pricing"
            tagline="Portal for paying, signing, and filling out forms, no login required by default"
            pricing={
              <>
                List prices: Starter $29, Essentials $49, Premium $109 per month billed yearly. 30-day free trial.{" "}
                <Ext href="https://www.honeybook.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Session-based photographers whose portal needs are contracts, forms, and invoices."
            pros={["Clients pay invoices by card or bank transfer and sign contracts", "Clients can view and attach files and message in the activity thread", "Portal on all plans"]}
            cons={["HoneyBook's help center says clients can't schedule meetings from the portal", "No native galleries or video review"]}
          />

          <ToolCard
            id="tool-dubsado"
            name="Dubsado"
            url="https://www.dubsado.com/pricing"
            tagline="One login portal per client across all their projects"
            pricing={
              <>
                Starter $335/year, Premier $525/year. 21-day trial, no card.{" "}
                <Ext href="https://www.dubsado.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Photographers with repeat clients who want every form, invoice, and appointment visible in one portal."
            pros={["Clients see invoices, payment history, forms, appointments, and project details", "External links and an optional task board", "Portal on both plans"]}
            cons={["Portal is off by default and requires a login", "No gallery or media delivery"]}
          />

          <ToolCard
            id="tool-studio-ninja"
            name="Studio Ninja"
            url="https://www.studioninja.co/pricing/"
            tagline="Branded portal for quotes, contracts, and invoices"
            pricing={
              <>
                Starter $16/mo, Pro $27/mo, Master $40/mo. 7-day trial.{" "}
                <Ext href="https://www.studioninja.co/pricing/">Official pricing</Ext>
              </>
            }
            bestFor="Budget-conscious photographers who want clients to accept quotes, sign, and pay online."
            pros={["Clients accept quotes, sign contracts, and pay invoices", "Pic-Time and ShootProof integrations for galleries"]}
            cons={["Media delivery happens in a separate gallery tool", "Login model not confirmed on official pages"]}
          />

          <ToolCard
            id="tool-sprout-studio"
            name="Sprout Studio"
            url="https://getsproutstudio.com/pricing/"
            tagline="CRM with built-in client galleries"
            pricing={
              <>
                Plans from Lite to Unlimited; see <Ext href="https://getsproutstudio.com/pricing/">official pricing</Ext>.
                30-day trial advertised.
              </>
            }
            bestFor="Portrait photographers who want galleries and CRM from the same vendor."
            pros={["Client galleries with a store and design proofs", "Contracts, invoices, and online scheduling"]}
            cons={["We couldn't verify the specific client portal features on official pages"]}
          />

          <ToolCard
            id="tool-pixieset"
            name="Pixieset Studio Manager"
            url="https://pixieset.com/pricing-studio-manager/"
            tagline="Booking site and payments rather than a persistent portal"
            pricing={
              <>
                Free; Plus $12/mo annual; Pro $18/mo annual. <Ext href="https://pixieset.com/pricing-studio-manager/">Official pricing</Ext>
              </>
            }
            bestFor="Photographers who mostly need clients to book, sign, and pay, with galleries on Pixieset's gallery product."
            pros={["Clients book, sign contracts, accept quotes, and pay (cards, Apple/Google Pay, Klarna/Affirm, installments)", "Generous free plan"]}
            cons={["We didn't find a dedicated persistent client portal", "Galleries are a separate product"]}
          />

          <h3>General client-portal software</h3>
          <ToolCard
            id="tool-moxie"
            name="Moxie"
            url="https://www.withmoxie.com/pricing"
            tagline="Freelancer business platform with a white-label portal on Pro"
            pricing={
              <>
                Pro $20/mo annual ($25 monthly), Teams $32/mo annual ($40 monthly). The Starter plan has no portal.{" "}
                <Ext href="https://www.withmoxie.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Videographers working with agencies on retainers, proposals, and requests."
            pros={["Clients view and pay invoices, sign proposals and contracts, book meetings, and submit requests", "No Moxie account needed", "White-label and custom domain on Pro"]}
            cons={["Not built for galleries or video review", "File attachments in tasks are limited to 50 MB"]}
          />

          <ToolCard
            id="tool-suitedash"
            name="SuiteDash"
            url="https://suitedash.com/pricing/"
            tagline="White-label portal suite for any service business"
            pricing={
              <>
                START $19/mo, THRIVE $49/mo, PINNACLE $99/mo (lower with annual billing). 14-day trial.{" "}
                <Ext href="https://suitedash.com/pricing/">Official pricing</Ext>
              </>
            }
            bestFor="Studios that want full white-labeling and are willing to configure a general-purpose tool."
            pros={["White label on all plans and unlimited portals", "Projects, file uploads, forms, messages, invoices, estimates, and tasks", "Client live chat from THRIVE"]}
            cons={["General-purpose; no photo galleries or video review", "More setup to make it feel photography-specific"]}
          />

          <ToolCard
            id="tool-assembly"
            name="Assembly (formerly Copilot)"
            url="https://assembly.com/pricing"
            tagline="Client portal platform for service businesses"
            pricing={
              <>
                Free plan; Starter $29/mo annual ($49 monthly); higher tiers not verified.{" "}
                <Ext href="https://assembly.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Production companies that want a polished general portal and will connect their own delivery tools."
            pros={["Client sign-in experience on all plans", "Custom domain and badge removal from Professional"]}
            cons={["Specific client actions aren't detailed on the pricing page", "No photography-specific features"]}
          />

          <h3>Real estate media</h3>
          <ToolCard
            id="tool-aryeo"
            name="Aryeo"
            url="https://www.aryeo.com/products/login-portal"
            tagline="Agent login portal for listing media, invoices, and orders"
            pricing={
              <>
                Lite free (includes the agent login portal); Pro from $49/mo.{" "}
                <Ext href="https://www.aryeo.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Real estate photographers whose clients are agents placing repeat orders."
            pros={["Agents see past listings and media in one place", "Pay unpaid invoices and download old ones", "Place new orders from the portal"]}
            cons={["Designed for listings, not commercial or event clients", "Pro tiers cap annual listings"]}
          >
            <p>
              For listing-focused alternatives, see our{" "}
              <BlogLink slug="best-aryeo-alternatives">Aryeo alternatives guide</BlogLink>.
            </p>
          </ToolCard>
        </>
      ),
    },
    {
      id: "one-job-in-shootportal",
      title: "One job, one link: what a client does in a ShootPortal portal",
      tocLabel: "A job in ShootPortal",
      body: () => (
        <>
          <p>
            Feature lists blur together, so here&apos;s the client&apos;s side of a single commercial or listing job,
            start to finish, without leaving the portal. Everything below happens at your own address (a{" "}
            <em>yourstudio</em>.shootportal.app subdomain or a custom domain like portal.yourstudio.com), under your logo
            and brand color.
          </p>
          <ol>
            <li>
              <strong>Approve the estimate.</strong> The client opens the versioned estimate, approves it or requests
              changes, and can download it as a PDF for their records.
            </li>
            <li>
              <strong>Confirm the shoot time.</strong> You propose a time; they accept, decline, or counter-propose.
            </li>
            <li>
              <strong>Review the work.</strong> Photos appear in folders, alongside video, Kuula 360 tours, 3D model
              embeds, and documents. They approve or reject each deliverable with written feedback, and leave
              time-stamped comments on video, pinned to a spot on the frame.
            </li>
            <li>
              <strong>Pay.</strong> A Stripe Checkout payment goes straight to your Stripe account, and a receipt is
              emailed.
            </li>
            <li>
              <strong>Download.</strong> Single files or a ZIP, in original &quot;Print&quot; size or 2048-pixel
              &quot;MLS&quot; size, unlocked after payment if you&apos;ve turned that on.
            </li>
            <li>
              <strong>Ask a question at any step.</strong> Messages stay on the project, and email notifications tell
              the client when something needs their attention.
            </li>
          </ol>
          <Figure caption="Product illustration of the ShootPortal client portal, showing a project moving from estimate to shoot, media, payment, and files (demo data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <p>
            What the portal deliberately doesn&apos;t do matters just as much. Clients sign in to use it, which suits
            repeat clients who come back for their history; for a one-time viewer, a share link is the workaround. It
            is branded rather than fully white-labeled. And there are no contracts, questionnaires, or self-booking into
            open slots.
          </p>
          <BestFitPanel
            heading="Who this kind of portal suits"
            fits={[
              {
                who: "Real estate photographers",
                why: "Agents approve, pay, and grab Print or MLS sizes from the same page, and assistants can get a share link without an account.",
              },
              {
                who: "Videographers and editors",
                why: "Frame-pinned, time-stamped comments, threaded replies, and numbered versions keep revision rounds on the record.",
              },
              {
                who: "Drone and 3D capture operators",
                why: "Deliver stills and video next to embeds from Matterport, Polycam, Sketchfab, DroneDeploy, Pix4D, and others.",
              },
              {
                who: "Studios that want to look established",
                why: "Your logo, colors, light or dark theme, custom domain, and email from your own domain on every touchpoint.",
              },
            ]}
            notFor={[
              "Your clients must never create an account, even repeat ones.",
              "You need the vendor's name removed entirely (look at SuiteDash or Moxie Pro).",
              "Contracts, e-signature, and questionnaires are the heart of your booking flow.",
            ]}
          />
          <p>
            See both sides, your studio and your client&apos;s view, on our{" "}
            <SiteLink href="/photography-client-portal">photography client portal</SiteLink> page.
          </p>
        </>
      ),
    },
    {
      id: "choosing-a-portal",
      title: "Choosing a portal: test it as your client would",
      tocLabel: "How to choose",
      body: (ctx) => (
        <>
          <p>
            Every portal looks good in a demo from the photographer&apos;s side. Before you commit, create a test
            client with your personal email and walk through a job on your phone:
          </p>
          <ol>
            <li>Open the first email. Is it clear who it&apos;s from and what to do?</li>
            <li>Get into the portal. Count the steps, including any password setup.</li>
            <li>Approve something and request a change on something else.</li>
            <li>If you deliver video, leave a comment at a specific moment.</li>
            <li>Pay, then download. Note where the money lands and how long downloads take.</li>
            <li>Come back a week later and see whether you can find everything again.</li>
          </ol>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Run this six-step test on ShootPortal today"
            body={
              <>
                Create your studio, add your logo and colors in the guided setup, connect your own Stripe account, and
                send yourself a test project. Then open it on your phone the way a client would: approve, comment,
                pay, and download.
              </>
            }
            secondaryHref="/#product-demo"
            secondaryLabel="Watch the demo first"
          />
          <PickGrid
            items={[
              {
                who: "Contracts and forms matter most",
                pick: "HoneyBook or Dubsado",
                why: "Strong document, invoice, and form handling in the portal; pair with a gallery tool.",
              },
              {
                who: "You need full white-label",
                pick: "SuiteDash or Moxie Pro",
                why: "Both list white-label portals; expect more setup for photography workflows.",
              },
              {
                who: "Agents ordering listing media",
                pick: "Aryeo",
                why: "An agent portal with past listings, media, invoices, and new orders.",
              },
              {
                who: "Review, payment, and delivery of photos and video",
                pick: "ShootPortal",
                why: "Per-item approvals, frame-accurate video comments, Stripe payments, and downloads in a branded portal.",
              },
            ]}
          />
          <KeyTakeaways
            items={[
              "Judge a portal by what clients can do without emailing you.",
              "Decide between no-login convenience and account-based history based on how much repeat work you do.",
              "\"Branded\" and \"white-label\" aren't the same; check for vendor badges and domains.",
              <>
                If your clients mainly need files, compare dedicated options in our{" "}
                <BlogLink slug="best-real-estate-photography-delivery-software">real estate delivery software guide</BlogLink>.
              </>,
              <>
                The portal is only as good as the records behind it. See our{" "}
                <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink>.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "closing-thoughts",
      title: "Closing thoughts",
      body: () => (
        <>
          <p>
            Clients remember how working with you felt as much as how the photos looked. A portal that makes approving,
            paying, and downloading easy turns a good shoot into a booking that repeats. A portal that only collects
            signatures still leaves the most visible part of the job, the delivery, to another tool.
          </p>
          <p>
            Pick the portal that matches the moment your clients care about most. If that moment is the delivery,{" "}
            <SiteLink href="/#product-demo">watch the ShootPortal product demo</SiteLink> or{" "}
            <SiteLink href="/how-it-works">see how the workflow fits together</SiteLink>. Drone operators can
            also read our <BlogLink slug="best-drone-business-management-software">drone business software guide</BlogLink>.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is a photography client portal?",
      answerText:
        "It's a private, branded page where a client can see the status of their project, approve proposals or deliverables, give feedback, pay, and download their files, instead of piecing those together from emails and separate links.",
      answer: (
        <p>
          It&apos;s a private, branded page where a client can see the status of their project, approve proposals or
          deliverables, give feedback, pay, and download their files, instead of piecing those together from emails
          and separate links.
        </p>
      ),
    },
    {
      question: "Do clients need an account to use a client portal?",
      answerText:
        "It depends on the tool. HoneyBook says clients don't need to log in by default, and Moxie says clients don't need a Moxie account. Dubsado's portal requires a login. ShootPortal clients sign in to an account, and you can create share links so others can view files without one.",
      answer: (
        <p>
          It depends on the tool. HoneyBook says clients don&apos;t need to log in by default, and Moxie says clients
          don&apos;t need a Moxie account. Dubsado&apos;s portal requires a login. ShootPortal clients sign in to an
          account, and you can create share links so others can view files without one.
        </p>
      ),
    },
    {
      question: "Is ShootPortal's client portal white-labeled?",
      answerText:
        "It's a branded portal rather than a full white-label one. You can use your logo, brand color, a light or dark theme, your own custom domain, and send email from your own domain. If removing all vendor branding is a requirement, SuiteDash and Moxie Pro list white-label options.",
      answer: (
        <p>
          It&apos;s a branded portal rather than a full white-label one. You can use your logo, brand color, a light or
          dark theme, your own custom domain, and send email from your own domain. If removing all vendor branding is
          a requirement, SuiteDash and Moxie Pro list white-label options.
        </p>
      ),
    },
    {
      question: "Can clients leave feedback on videos in a client portal?",
      answerText:
        "In some. ShootPortal supports time-stamped video comments pinned to a spot on the frame, with threaded replies and numbered versions. Creative CRMs like HoneyBook and Dubsado don't include video review, so videographers using them typically add a separate review tool.",
      answer: (
        <p>
          In some. ShootPortal supports time-stamped video comments pinned to a spot on the frame, with threaded
          replies and numbered versions. Creative CRMs like HoneyBook and Dubsado don&apos;t include video review, so
          videographers using them typically add a separate review tool.
        </p>
      ),
    },
    {
      question: "Can I use a client portal and a gallery platform together?",
      answerText:
        "Yes, and many photographers do. HoneyBook integrates with Pic-Time, and Studio Ninja integrates with Pic-Time and ShootProof. The trade-off is that clients deal with two links and two brands. A portal that delivers media itself keeps everything in one place.",
      answer: (
        <p>
          Yes, and many photographers do. HoneyBook integrates with Pic-Time, and Studio Ninja integrates with Pic-Time
          and ShootProof. The trade-off is that clients deal with two links and two brands. A portal that delivers
          media itself keeps everything in one place.
        </p>
      ),
    },
  ],
  related: ["best-photography-crm-software", "best-photo-video-delivery-platforms", "best-drone-business-management-software"],
  cta: {
    title: "Give your clients one link for the whole job.",
    body: "They approve the estimate, confirm the shoot time, review and comment, pay, and download, all in a portal with your logo, colors, and domain.",
    secondaryHref: "/#product-demo",
    secondaryLabel: "Watch the demo",
  },
};
