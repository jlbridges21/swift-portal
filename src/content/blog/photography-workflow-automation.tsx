import { FreeResourceCallout } from "@/components/blog/free-resource-callout";
import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  KeyTakeaways,
  SiteLink,
} from "@/components/blog/article-parts";
import { ToolSprawlDiagram, WorkflowDiagram } from "@/components/blog/diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { TrialCard } from "@/components/blog/conversion-parts";

export const article: BlogArticle = {
  slug: "photography-workflow-automation",
  title: "How to Build an Automated Photography Workflow From Booking to Final Delivery",
  seoTitle: "Photography Workflow Automation: Booking to Delivery",
  description:
    "A stage-by-stage guide to photography workflow automation for drone, commercial, video, and real estate work, with a reusable trigger-and-action template.",
  excerpt:
    "Map every stage of a shoot, from first inquiry to follow-up, decide what triggers each step, and turn it into a reusable workflow template you can run on any job.",
  category: "business-automation",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "photography workflow automation",
  secondaryKeywords: [
    "automated photography workflow",
    "photography business workflow",
    "photography client workflow template",
    "drone photography workflow",
  ],
  readingMinutes: 11,
  cover: {
    variant: "automation",
    tint: "amber",
    label: "Workflow Template",
    alt: "Illustration of connected workflow steps and arrows on a warm amber background",
  },
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Treat your workflow as stages,</strong> each with a trigger (what starts it), an action (what
        happens), and an owner (you, the client, or the system).
      </>,
      <>
        <strong>The biggest wins are in the hand-offs:</strong> inquiry to estimate, approval to deposit, upload to
        review, and payment to download.
      </>,
      <>
        <strong>Niche changes the details, not the shape.</strong> Drone jobs add airspace and weather checks;
        commercial adds usage terms; video adds revision rounds.
      </>,
      <>
        <strong>Follow-up is the most neglected stage.</strong> Review requests and re-booking nudges are worth doing
        by hand if your tools don&apos;t automate them.
      </>,
      <>
        <strong>Use the template table below</strong> to write your own workflow before you shop for software.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Every photography business already has a workflow. It&apos;s just usually stored in the owner&apos;s head, a few
        saved email drafts, and a calendar full of notes. That works until you&apos;re booked solid, at which point the
        workflow starts to leak: an estimate that never got a follow-up, a video revision that slipped a week, a
        delivered gallery that was never paid for.
      </p>
      <p>
        <strong>Photography workflow automation</strong> means writing that workflow down as a sequence of stages, then
        letting software handle the stages that follow a predictable rule. It doesn&apos;t matter whether you shoot
        listings, construction progress, product launches, or brand videos. The shape is the same: someone asks, you
        quote, you schedule, you prepare, you shoot, you edit and revise, you get paid, you deliver, and you follow up.
      </p>
      <p>
        This guide walks through each of those stages for any niche, shows what to automate in each, and ends with a
        reusable workflow template you can copy. If you run a listing-heavy business specifically, our companion piece
        on <BlogLink slug="real-estate-photography-automation">real estate photography automation</BlogLink> focuses on
        agent orders and listing turnaround.
      </p>
    </>
  ),
  sections: [
    {
      id: "map-your-workflow",
      title: "Start by mapping the workflow you already run",
      tocLabel: "Map your workflow",
      body: () => (
        <>
          <p>
            Before you change any tools, write down what actually happens on a typical job. Take your last three
            projects and list every message you sent, every app you opened, and every time you had to wait for the
            client. You&apos;re looking for three things at each step:
          </p>
          <ul>
            <li>
              <strong>Trigger:</strong> what event starts this step? A form submission, an approval, a date, an upload,
              a payment.
            </li>
            <li>
              <strong>Action:</strong> what has to happen? Send a message, create a calendar event, request money,
              unlock files.
            </li>
            <li>
              <strong>Owner:</strong> who does it? You, a team member, the client, or the system.
            </li>
          </ul>
          <p>
            Most people discover their workflow is spread across five to eight separate tools, and that the
            &quot;system&quot; connecting them is their memory.
          </p>
          <Figure caption="Conceptual diagram: a single project scattered across email, texts, calendar, spreadsheets, cloud folders, and payment apps.">
            <ToolSprawlDiagram />
          </Figure>
          <p>
            Any step where the trigger is clear and the action is always the same is a candidate for automation. Any
            step where the owner is &quot;me, from memory&quot; is a risk, whether or not you automate it.
          </p>
        </>
      ),
    },
    {
      id: "lead-intake",
      title: "Stages 1 and 2: Lead intake and inquiries",
      tocLabel: "Lead intake and inquiries",
      body: () => (
        <>
          <p>
            Leads arrive from everywhere: your website, Instagram DMs, referrals, a phone call from a site manager.
            The first automation is the least glamorous and the most valuable: <strong>one front door</strong>. Every
            inquiry, however it arrives, should end up as a record in one place, ideally through a request form you can
            link to from anywhere.
          </p>
          <h3>Ask the questions your niche needs</h3>
          <p>
            A good request form saves a round of email by collecting what you&apos;d otherwise ask in your first reply:
          </p>
          <ul>
            <li>
              <strong>Drone and aerial:</strong> site address or coordinates, what needs to be captured (roof,
              progress, overview), any known access restrictions, and the deadline.
            </li>
            <li>
              <strong>Commercial and brand:</strong> intended usage (web, print, paid ads), number of deliverables,
              on-site contact, and brand guidelines.
            </li>
            <li>
              <strong>Video:</strong> target length, format (horizontal, vertical, both), music preferences, and how
              many revision rounds they expect.
            </li>
            <li>
              <strong>Real estate:</strong> address, size, occupied or vacant, access method, and package.
            </li>
          </ul>
          <h3>Automate the acknowledgment</h3>
          <p>
            The moment a request lands, the client should get a confirmation that it arrived and what happens next.
            That one automated email removes the anxiety that makes clients send the same inquiry to three other
            photographers while they wait for you.
          </p>
        </>
      ),
    },
    {
      id: "estimates",
      title: "Stage 3: Estimates and proposals",
      tocLabel: "Estimates and proposals",
      body: () => (
        <>
          <p>
            Pricing is where many photographers hesitate to automate, because custom work deserves a custom quote.
            The trick is to automate the <em>skeleton</em> of the estimate and keep the judgment for yourself.
          </p>
          <ul>
            <li>
              <strong>Packages with line items.</strong> Define services once, with descriptions and starting prices,
              so every estimate starts from the same building blocks.
            </li>
            <li>
              <strong>Rule-based fees.</strong> Travel by distance, rush fees, and standard add-ons can be calculated
              instead of looked up.
            </li>
            <li>
              <strong>Preliminary vs. official estimates.</strong> A system can produce an instant ballpark from the
              request; you review and send the binding version.
            </li>
            <li>
              <strong>Expiry dates and versions.</strong> Quotes that expire encourage decisions, and versions keep a
              record when scope changes.
            </li>
          </ul>
          <p>
            Pair every estimate with an automatic reminder if it hasn&apos;t been approved after a few days. A
            surprising amount of lost work is simply quotes nobody followed up on. For drone-specific quoting and
            pricing, see our <BlogLink slug="drone-photography-pricing-guide">drone photography pricing guide</BlogLink>.
          </p>
          <FreeResourceCallout tool="quote-builder" note="Build a clean quote with optional add-ons and a deposit, and download it as a PDF." />
        </>
      ),
    },
    {
      id: "scheduling-preparation",
      title: "Stages 4 and 5: Scheduling and project preparation",
      tocLabel: "Scheduling and preparation",
      body: () => (
        <>
          <h3>Scheduling</h3>
          <p>
            Approval should trigger scheduling, not a separate email chain. There are two models. Some tools let clients
            self-book into open slots, which suits simple, repeatable sessions. Others let you propose a time and the
            client accepts or counters, which suits work that depends on weather, light, site access, or travel. Many
            drone and exterior jobs fit the second model better, because the &quot;right&quot; time isn&apos;t only
            about your availability. Our{" "}
            <SiteLink href="/photography-booking-software">photography booking software</SiteLink> page shows how the
            propose-and-confirm model works from request to confirmed shoot.
          </p>
          <p>
            Whichever model you use, the confirmed time should land on the calendar you actually look at, and your
            existing commitments should be visible when you pick a slot.
          </p>
          <Figure caption="Product illustration: a ShootPortal calendar with a confirmed shoot alongside other bookings (demo data).">
            <ProductPreview view="calendar" />
          </Figure>
          <h3>Project preparation</h3>
          <p>
            Preparation is where the job details turn into a plan: a shot list, a creative brief, access notes,
            equipment, and for drone work, airspace and weather checks. Some of this is a checklist you can template:
          </p>
          <ul>
            <li>A standard shot list per package or deliverable type, attached to the project.</li>
            <li>Access notes and on-site contact stored on the project, not in a text thread.</li>
            <li>
              For drone jobs, an airspace check and authorization where required. The FAA&apos;s{" "}
              <Ext href="https://www.faa.gov/uas/getting_started/laanc">LAANC program</Ext> provides near-real-time
              authorization for controlled airspace through approved providers, but you still need to check NOTAMs and
              weather yourself.
            </li>
            <li>A day-before confirmation to the client, with arrival time and anything they need to prepare.</li>
          </ul>
          <Callout tone="note" title="Don't automate the safety call">
            <p>
              Weather and airspace decisions for drone work stay with the pilot. Automation can remind you to check;
              it shouldn&apos;t decide whether you fly.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "session-editing-revisions",
      title: "Stages 6 and 7: The session, editing, and revisions",
      tocLabel: "Session, editing, revisions",
      body: () => (
        <>
          <p>
            The shoot itself is yours. What you can automate is everything that tells the client where the job stands
            afterwards. When the shoot is done, the project should move to the next stage so the client knows editing
            has started, without you writing &quot;we&apos;re all wrapped, files coming soon&quot; each time.
          </p>
          <h3>Make revisions structured</h3>
          <p>
            Revisions are where projects stall, especially video. Feedback that arrives as a long email (&quot;at about
            the one-minute mark, maybe a different shot?&quot;) turns into back-and-forth. Structured review fixes that:
          </p>
          <ul>
            <li>Clients approve or reject each deliverable, with written feedback attached to the specific item.</li>
            <li>
              Video comments are pinned to a timestamp, and new versions are numbered so nobody reviews the wrong cut.
            </li>
            <li>Your revision allowance is stated in the estimate, so extra rounds are a scope conversation, not a surprise.</li>
          </ul>
          <p>
            If video review is a big part of your work, our{" "}
            <BlogLink slug="best-video-review-approval-software">video review and approval software comparison</BlogLink>{" "}
            compares dedicated tools such as Frame.io and Vimeo review with all-in-one options.
          </p>
        </>
      ),
    },
    {
      id: "payment-communication",
      title: "Stages 8 and 9: Payment collection and client communication",
      tocLabel: "Payments and communication",
      body: () => (
        <>
          <h3>Payment collection</h3>
          <p>
            Payment has two natural triggers: estimate approval (for a deposit) and final media being ready (for the
            balance). Tie your payment requests to those events and they&apos;ll go out without you remembering. Add an
            automatic receipt and a polite reminder for unpaid balances, and most chasing disappears. Whether to hold
            downloads until payment is a policy choice; we cover the options and the wording in{" "}
            <BlogLink slug="get-paid-before-delivering-real-estate-photos">how to get paid before delivering</BlogLink>.
          </p>
          <h3>Client communication</h3>
          <p>
            Automated communication should be about status, not chatter. A sensible set of automatic messages covers:
            request received, estimate ready, shoot time proposed or confirmed, media ready for review, payment
            requested, payment received, and delivered. Everything else should be a real conversation, ideally kept on
            the project so you and the client can scroll back through decisions.
          </p>
          <Figure caption="Product illustration: a project message thread between a business and its client in ShootPortal (demo data).">
            <ProductPreview view="messages" />
          </Figure>
        </>
      ),
    },
    {
      id: "delivery-follow-up",
      title: "Stages 10 and 11: Media delivery and follow-up",
      tocLabel: "Delivery and follow-up",
      body: () => (
        <>
          <h3>Media delivery</h3>
          <p>
            Delivery should happen in the same place the client reviewed and paid, so they don&apos;t have to hunt for a
            separate link. Think through the formats each niche needs: MLS-sized and full-resolution photos for real
            estate, large video masters for commercial clients, embedded 3D models or maps for survey and inspection
            work. Clients should be able to download single files or everything at once, and share with colleagues who
            don&apos;t have an account.
          </p>
          <h3>Follow-up</h3>
          <p>
            Follow-up is the stage most workflows forget, and it&apos;s where repeat business comes from. After
            delivery, a short check-in a few days later (&quot;Did everything work for the launch?&quot;) catches
            problems early and opens the door to the next job. Ask happy clients for a review on whatever platform
            matters in your market, and for seasonal clients like builders or resorts, set a reminder to reach out before
            their next busy period.
          </p>
          <p>
            Many all-in-one tools, including ShootPortal, don&apos;t automate review requests or re-booking campaigns.
            That&apos;s fine: a recurring calendar reminder and a saved email draft are enough. The point is to make it a
            stage in your workflow so it happens every time.
          </p>
        </>
      ),
    },
    {
      id: "workflow-template",
      title: "A reusable photography workflow template",
      tocLabel: "Workflow template",
      body: () => (
        <>
          <p>
            Here&apos;s the whole workflow as a single table. Copy it into a document, adjust the triggers to your
            business, and fill in the &quot;Tool&quot; column with what you use today. Any row where the tool column
            contains three different apps is a good place to start consolidating.
          </p>
          <ComparisonTable
            caption="Reusable photography workflow template: stage, trigger, action, tool, and owner"
            columns={["Stage", "Trigger", "Action", "Tool", "Who"]}
            rows={[
              ["1. Lead intake", "Form submitted, or inquiry arrives elsewhere", "Create client and project record; send acknowledgment", "Request form / CRM", "System"],
              ["2. Inquiry reply", "New request", "Answer questions; confirm scope", "Email or project messages", "You"],
              ["3. Estimate", "Scope confirmed", "Build from packages; apply travel fee; set expiry", "Estimate tool", "System + you"],
              ["3a. Estimate reminder", "No approval after a few days", "Send polite reminder", "Email template", "System"],
              ["4. Deposit", "Estimate approved", "Request deposit (percent or fixed)", "Payments", "System"],
              ["5. Scheduling", "Deposit paid or estimate approved", "Propose or offer time; push to calendar", "Calendar", "You + client"],
              ["6. Preparation", "Shoot confirmed", "Attach shot list or brief; check access, weather, airspace", "Project checklist", "You"],
              ["7. Session", "Shoot day", "Shoot; mark complete", "Project status", "You"],
              ["8. Review", "Media uploaded", "Notify client; collect per-item feedback and video comments", "Client portal / review tool", "Client"],
              ["9. Revisions", "Changes requested", "Edit; upload new version", "Review tool", "You"],
              ["10. Payment", "Media approved or ready", "Request balance; send receipt when paid", "Payments", "System"],
              ["11. Delivery", "Balance paid", "Unlock downloads; mark delivered", "Delivery / portal", "System"],
              ["12. Follow-up", "A few days after delivery", "Check in; ask for a review; note next booking window", "Calendar reminder + email", "You"],
            ]}
            note="Template, not a prescription. Swap triggers to match your payment policy (for example, pay in full upfront) and your niche."
          />
          <Figure caption="Conceptual diagram: the core request-to-delivery loop the template above expands on.">
            <WorkflowDiagram highlight={["estimate", "pay", "deliver"]} />
          </Figure>
          <p>
            The highlighted steps in the diagram are the three hand-offs where automation usually pays back fastest:
            turning a request into a price, turning approval or finished media into payment, and turning payment into
            delivered files.
          </p>
          <FreeResourceCallout resource="photography-project-workflow-checklist" />
        </>
      ),
    },
    {
      id: "choosing-software",
      title: "Choosing integrated software, and putting it together",
      tocLabel: "Choosing software",
      body: (ctx) => (
        <>
          <p>
            Once your template is written, compare tools against it row by row. You have two broad options. You can keep
            specialist tools for each stage and connect them with an automation service, or you can move most rows into
            one integrated platform. Specialist stacks are flexible but every connection is a place to fail. Integrated
            platforms are simpler but you accept their choices.
          </p>
          <p>
            Which category fits depends on your niche. Drone operators should read our{" "}
            <BlogLink slug="best-drone-business-management-software">drone business management software guide</BlogLink>,
            which separates flight-ops tools from client and delivery tools. Listing-focused businesses should start with
            the <BlogLink slug="best-real-estate-photography-software">real estate photography software comparison</BlogLink>.
            If contracts and lead nurturing are your priority, the{" "}
            <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink> is the better starting
            point.
          </p>
          <h3>Running the template in ShootPortal, stage by stage</h3>
          <p>
            ShootPortal is our product, so weigh this accordingly. It exists because the camera work is only half of a
            media business; the other half is the inquiry, the estimate, the schedule, the revision notes, the payment,
            and the hand-off, and that half usually lives in five apps. ShootPortal keeps it on one project record and
            one branded client portal, whether the job is a listing, a roof inspection, a construction progress flight,
            or a brand video.
          </p>
          <p>
            &quot;Covers a stage&quot; can mean very different things, so here is the template again with each row
            split three ways: what the software does <em>by itself</em>, what it simply keeps <em>in one place</em>,
            and what is still <em>your job</em>.
          </p>
          <ComparisonTable
            caption="The workflow template in ShootPortal: automated, centralized, or still manual at each stage"
            columns={["Stage", "Automated", "Centralized on the project", "Still manual"]}
            rows={[
              ["1. Lead intake", "Client record created from the request form; request acknowledgment email", "Contact details, address, chosen service, preferred date, notes", "Moving DMs and phone inquiries to the form link"],
              ["2. Inquiry reply", "—", "Two-way messages on the project", "Answering questions; confirming scope"],
              ["3. Estimate", "Preliminary estimate from your service catalog, with a ZIP-to-ZIP travel fee", "Official estimate with versions, expiry, and PDF", "Reviewing and sending the official estimate"],
              ["3a. Estimate reminder", "Reminder emails for proposals", "—", "Deciding when to call instead"],
              ["4. Deposit", "Deposit request on approval (percentage or fixed), if configured", "Payment status on the project", "Choosing your deposit policy"],
              ["5. Scheduling", "Confirmed shoots pushed to Google Calendar; scheduling reminder emails", "Calendar with your Google events shown read-only", "Proposing the shoot time (client accepts, declines, or counters)"],
              ["6. Preparation", "—", "Address and request notes on the project", "Shot list, gear, weather, airspace, LAANC"],
              ["7. Session", "—", "—", "Shooting; updating the project when you're done"],
              ["8. Review", "Review reminder emails; batched notifications for video comments", "Per-item approve or reject with feedback; time-stamped video comments; numbered versions", "Uploading media; your own final check"],
              ["9. Revisions", "—", "Revision requests and comment threads, resolved or reopened", "Editing and uploading the new version"],
              ["10. Payment", "Email receipts; payment reminder emails", "Stripe Checkout payments to your own Stripe account; balances on the client record", "Requesting the balance from the project; marking offline payments paid"],
              ["11. Delivery", "Unlock downloads after payment and move to Delivered, if enabled", "Print and MLS-size downloads, ZIPs, video, 360 tours, 3D embeds, share links", "Choosing which media sections the client sees"],
              ["12. Follow-up", "—", "Client history and lifetime revenue on the record", "Check-ins, review requests, and re-booking"],
            ]}
            note="Based on ShootPortal's current features as of October 15, 2026. “If enabled” and “if configured” items are settings you choose. Some pipeline stage changes also happen automatically as clients approve, pay, or respond."
          />
          <p>
            Read the table column by column and the pattern is clear. The automated column handles the predictable
            hand-offs: acknowledging, pricing the skeleton, nudging, receipting, and unlocking. The centralized column is
            the bigger day-to-day win: the estimate, the shoot time, the messages, the files, and the payment status
            all sit on the same project, so &quot;where are we on this job?&quot; is answered by opening one page, by you
            or by the client in their portal. The manual column is the creative and judgment work no tool should take
            from you, plus follow-up, which ShootPortal doesn&apos;t automate. It also has no contracts or e-signature, so
            keep your own contract process alongside it.
          </p>
          <p>
            If you shoot real estate, our{" "}
            <SiteLink href="/real-estate-photography-workflow-software">real estate photography workflow software</SiteLink> page
            maps these columns onto a listing, trigger by trigger.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Run one job through your new template"
            body={
              <>
                Load your services during the guided setup, connect your own Stripe account, and send the request link to
                your next client. You&apos;ll see rows 1 through 11 happen on a single project, and find out quickly which
                of your old steps you no longer need.
              </>
            }
            secondaryHref="/#product-demo"
            secondaryLabel="Take the product tour"
          />
          <p>
            Whatever you choose, build it in the order of the template, test each stage on a real job, and see the full
            flow on our <SiteLink href="/how-it-works">How it works page</SiteLink> if you want a reference model.
          </p>
          <KeyTakeaways
            items={[
              "Map each stage as trigger, action, and owner before you change tools.",
              "Automate the hand-offs: request to estimate, approval to deposit, upload to review, payment to delivery.",
              "Niche affects the questions and checks, not the overall shape of the workflow.",
              "Keep safety decisions, creative judgment, and difficult conversations human.",
              "Make follow-up a real stage, even if it's a manual reminder.",
            ]}
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is photography workflow automation?",
      answerText:
        "It's writing your process as stages, each with a trigger, an action, and an owner, then letting software handle the predictable stages such as acknowledgments, estimate reminders, payment requests, receipts, and download access.",
      answer: (
        <p>
          It&apos;s writing your process as stages, each with a trigger, an action, and an owner, then letting software
          handle the predictable ones: acknowledgments, estimate reminders, payment requests, receipts, and download
          access.
        </p>
      ),
    },
    {
      question: "Which stage of the photography workflow should I automate first?",
      answerText:
        "Start with intake: route every inquiry through one request form with an automatic acknowledgment. Then automate payment requests and receipts, because those two changes usually remove the most manual follow-up.",
      answer: (
        <p>
          Start with intake: route every inquiry through one request form with an automatic acknowledgment. Then
          automate payment requests and receipts, because those usually remove the most manual follow-up.
        </p>
      ),
    },
    {
      question: "Is workflow automation different for drone photography?",
      answerText:
        "The overall stages are the same, but drone jobs add preparation steps such as airspace checks, LAANC authorization where required, NOTAMs, and weather. Automation can remind you to do those checks, but the go or no-go decision stays with the pilot.",
      answer: (
        <p>
          The stages are the same, but drone jobs add preparation steps: airspace checks, LAANC authorization where
          required, NOTAMs, and weather. Automation can remind you to check; the go or no-go decision stays with the
          pilot.
        </p>
      ),
    },
    {
      question: "Can I automate review requests after delivery?",
      answerText:
        "Some CRMs offer automated follow-up sequences. ShootPortal does not automate review requests or re-booking, so a recurring calendar reminder and a saved email template are a simple way to make follow-up a consistent stage.",
      answer: (
        <p>
          Some CRMs offer automated follow-up sequences. ShootPortal doesn&apos;t automate review requests or
          re-booking, so a recurring calendar reminder and a saved email template are a simple way to make follow-up a
          consistent stage.
        </p>
      ),
    },
    {
      question: "Do I need one platform or several tools?",
      answerText:
        "Either can work. Several specialist tools connected with an automation service are flexible but fragile. One integrated platform is simpler to run. Compare tools against your written workflow template, row by row, before deciding.",
      answer: (
        <p>
          Either can work. Specialist tools connected with an automation service are flexible but fragile; one
          integrated platform is simpler to run. Compare tools against your written workflow template, row by row,
          before deciding.
        </p>
      ),
    },
  ],
  related: ["best-drone-business-management-software", "real-estate-photography-automation", "best-video-review-approval-software"],
  cta: {
    title: "Turn your workflow template into a system that runs",
    body: "Request, estimate, schedule, review, payment, and delivery on one project for any kind of shoot, with acknowledgments, reminders, receipts, and download unlocks handled for you. The creative work and the judgment calls stay yours.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
