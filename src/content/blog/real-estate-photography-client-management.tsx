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
import { CrmRecordDiagram } from "@/components/blog/diagrams";
import { DocumentCard, ProjectBoardDiagram } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { AllInOnePlatform, AppScreen, ScreenTrio, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "real-estate-photography-client-management",
  title: "How to Manage Multiple Real Estate Photography Clients Without Losing Track of Projects",
  seoTitle: "Real Estate Photography Client Management System",
  description:
    "Real estate photography client management: agent profiles, property history, pipeline stages, revisions, and listing marketing that keeps agents loyal.",
  excerpt:
    "A practical operating system for juggling dozens of agents and listings: what to record about each agent, how to track every property, a pipeline with clear exit rules, a daily review, and the listing marketing that turns agents into repeat clients.",
  category: "client-management",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  primaryKeyword: "real estate photography client management",
  secondaryKeywords: [
    "manage real estate photography clients",
    "real estate photography workflow",
    "photography project tracking",
    "real estate photography CRM",
    "managing realtor clients",
    "property website for listings",
    "real estate marketing kit",
    "upsell real estate photography",
  ],
  readingMinutes: 13,
  cover: {
    variant: "timeline",
    tint: "indigo",
    label: "Operations Guide",
    alt: "Illustration of a timeline of listing projects moving through stages",
  },
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Put every agent, listing, message, and payment in one system.</strong> ShootPortal (our product) gives
        each agent one record with their property history, balance, and saved branding, and each listing one project
        from request to delivery.
      </>,
      <>
        <strong>Write down each agent&apos;s preferences once</strong> (access, branding, sizes, billing) so you
        never rely on memory or old texts.
      </>,
      <>
        <strong>Track properties, not just clients.</strong> The same address comes back for relists, price drops,
        and new owners.
      </>,
      <>
        <strong>Use a fixed set of pipeline stages</strong> with a clear rule for when a job moves to the next one.
      </>,
      <>
        <strong>Run a ten-minute daily review</strong> of anything stuck, unscheduled, unpaid, or past due.
      </>,
      <>
        <strong>Give agents a reason to stay:</strong> a property website, Just Listed posts, and a flyer with every
        listing. Include it free or sell it as an add-on for new revenue.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        At five listings a week, you can hold the whole business in your head. You know which agent wants the
        twilight add-on, which one always forgets the lockbox code, and which listing is waiting on a revision. At
        fifteen or twenty listings a week, with agents booking at the same time and some shoots happening on days you
        aren&apos;t there, memory stops being a system. Things slip: a revision nobody answered, an invoice nobody sent,
        a reshoot booked at the wrong address.
      </p>
      <p>
        This guide is a practical approach to <strong>real estate photography client management</strong> for
        businesses at that growth point. It covers what to record about each agent, how to track individual properties,
        how to structure your pipeline, the daily habits that stop jobs from falling through the cracks, and how to make
        each agent relationship worth more over time.
      </p>
      <p>
        We&apos;ll also show how ShootPortal, the platform we build for real estate photographers, drone pilots, and
        videographers, runs this system for you: one record per agent, one project per listing, and listing marketing
        that agents can buy from you with a couple of clicks.
      </p>
    </>
  ),
  sections: [
    {
      id: "why-things-slip",
      title: "Why real estate photography is especially hard to keep organized",
      tocLabel: "Why things slip",
      body: () => (
        <>
          <p>
            Wedding and portrait photographers manage relatively few clients with long timelines. Real estate is the
            opposite: many repeat clients, each sending many short jobs, all with tight deadlines. That shape creates
            specific failure points:
          </p>
          <ul>
            <li>
              <strong>Preferences multiply.</strong> Every agent has their own way of doing things, and a team of
              agents at the same brokerage may each want something different.
            </li>
            <li>
              <strong>Jobs overlap.</strong> On any given day you have listings being requested, shot, edited, reviewed,
              invoiced, and revised at the same time.
            </li>
            <li>
              <strong>Information arrives everywhere.</strong> Texts, emails, calls, and comments on a shared folder,
              often from the agent&apos;s assistant rather than the agent.
            </li>
            <li>
              <strong>Deadlines are external.</strong> The agent has promised the seller a go-live date. Your delay is
              their problem with their client.
            </li>
          </ul>
          <p>
            The fix isn&apos;t working harder. It&apos;s deciding where each type of information lives, and making sure
            every job passes through the same steps.
          </p>
        </>
      ),
    },
    {
      id: "agent-profiles",
      title: "Build a profile for every agent",
      tocLabel: "Agent profiles",
      body: () => (
        <>
          <p>
            The single most useful habit is writing down each agent&apos;s preferences the first time you learn them,
            in a place you&apos;ll look before every job. Here&apos;s a template worth copying into whatever system you
            use:
          </p>
          <Figure caption="Example agent preference sheet. Adapt the fields to the services you offer.">
            <DocumentCard eyebrow="Template" title="Agent preference sheet">
              <ul>
                <li>
                  <strong>Contact:</strong> agent, assistant or transaction coordinator, and who should receive
                  deliveries
                </li>
                <li>
                  <strong>Access:</strong> lockbox or showing-service habits, whether the seller is usually home, pet
                  notes
                </li>
                <li>
                  <strong>Usual package:</strong> standard services and add-ons (aerials, twilight, video, floor plan)
                </li>
                <li>
                  <strong>Style notes:</strong> sky replacement, fire in the fireplace, TVs on or off, preferred hero
                  angle
                </li>
                <li>
                  <strong>MLS and sizes:</strong> which MLS they list in, and whether they also need print files
                </li>
                <li>
                  <strong>Branding:</strong> headshot, brokerage logo, and colors for property websites, social posts,
                  and branded video cuts
                </li>
                <li>
                  <strong>Billing:</strong> pays personally, or invoices go to the brokerage or team lead; payment
                  timing
                </li>
                <li>
                  <strong>Turnaround expectations:</strong> standard, or often needs rush delivery
                </li>
              </ul>
            </DocumentCard>
          </Figure>
          <p>
            Billing deserves special attention. Some agents pay you directly. Others expect the invoice to go to their
            brokerage, a team lead, or to wait until closing. Record the arrangement on the client profile and confirm it
            before the first job, not after. In ShootPortal, pay links open without a login, so you can send one
            straight to the brokerage office or team lead, and you can mark an offline payment paid when a check
            arrives.
          </p>
          <p>
            Wherever this lives, it should sit on the client record alongside their history, not in a separate
            document you have to remember to open. A good CRM record for a real estate photographer looks something like
            this:
          </p>
          <Figure caption="Conceptual diagram: the layers of a client record for a real estate media business.">
            <CrmRecordDiagram />
          </Figure>
          <FreeResourceCallout resource="photography-client-questionnaire" />
        </>
      ),
    },
    {
      id: "property-history",
      title: "Track properties, not just people",
      tocLabel: "Property history",
      body: () => (
        <>
          <p>
            Generic CRMs organize around contacts. Real estate photography also needs to organize around addresses,
            because properties come back. A listing expires and relists with a new agent. A builder sends you the same
            floor plan in a new subdivision. A seller wants updated photos after the landscaping is done.
          </p>
          <p>When you can pull up a property&apos;s history, you can:</p>
          <ul>
            <li>See what was shot last time and which images the agent used.</li>
            <li>Recover access notes, gate codes, and quirks of the property.</li>
            <li>Quote a reshoot accurately, and pitch new services such as aerials if they weren&apos;t included.</li>
            <li>Answer &quot;can you resend the photos from last spring?&quot; in seconds.</li>
          </ul>
          <p>
            Name every project with the full address and keep each project attached to the client who ordered it. In
            ShootPortal, the client record shows property history (each address with its projects and revenue), along
            with timestamped notes, the message timeline, lifetime revenue, outstanding balance, last payment, and last
            portal login. When the same address comes back, you also have its property website and marketing kit from
            last time to update rather than rebuild. Our{" "}
            <BlogLink slug="best-photography-crm-software">photography CRM comparison</BlogLink> covers how other tools
            handle client records.
          </p>
        </>
      ),
    },
    {
      id: "pipeline",
      title: "Run every job through the same pipeline",
      tocLabel: "Pipeline stages",
      body: () => (
        <>
          <p>
            A pipeline is a fixed set of stages every job passes through. Its value comes from consistency: if every
            listing moves through the same columns, you can glance at the board and know where your week stands.
            Here&apos;s an example board using ShootPortal&apos;s eight stages:
          </p>
          <Figure caption="Conceptual diagram: an eight-stage project board with fictional listings (stage names match ShootPortal's pipeline).">
            <ProjectBoardDiagram />
          </Figure>
          <Figure caption="Real ShootPortal screen: a scheduled listing project with its services, status, and client details in one place, so anyone on your team can see where the job stands.">
            <AppScreen view="project-scheduled" />
          </Figure>
          <p>
            Whatever stages you use, define the exit rule for each one: what has to be true before the job moves
            forward. Without exit rules, stages turn into vague labels.
          </p>
          <ComparisonTable
            caption="Pipeline stages and the rule for moving to the next stage"
            columns={["Stage", "What it means", "Moves on when"]}
            rows={[
              ["New request", "A client asked for work", "You've sent an estimate"],
              ["Quote sent", "Waiting on the client's decision", "The client approves (and pays any deposit)"],
              ["Proposal approved", "Scope and price agreed", "A shoot time is confirmed"],
              ["Scheduled", "On the calendar", "The shoot is done and files are backed up"],
              ["Shoot complete", "Editing in progress", "Media is uploaded for the client"],
              ["Review", "Client is checking the work", "Items are approved and revisions resolved"],
              ["Awaiting payment", "Work accepted, balance due", "Final payment received"],
              ["Delivered", "Paid and downloadable", "Nothing: the job is closed"],
            ]}
            note="Example exit rules. Adjust them to your own policies, such as whether you deliver before payment."
          />
          <p>
            Many of these transitions can happen automatically. In ShootPortal, workflow automation moves the project
            when the agent approves the proposal or pays, unlocks downloads, sends the receipt, and sends reminders at
            24 hours, 3 days, or 7 days when a proposal, shoot time, review, or payment is waiting. The same eight
            stages apply to every job, which keeps your board comparable, and agents see friendlier labels for each
            stage in their portal. Our guide to{" "}
            <BlogLink slug="real-estate-photography-automation">real estate photography automation</BlogLink> covers
            which transitions are worth automating.
          </p>
        </>
      ),
    },
    {
      id: "scheduling-and-comms",
      title: "Keep scheduling and communication attached to the job",
      tocLabel: "Scheduling and messages",
      body: () => (
        <>
          <h3>One calendar for everything</h3>
          <p>
            Shoots, personal commitments, and staff availability need to be visible in one view, or double-bookings are
            inevitable. If your business tool has its own calendar, connect it to the calendar you already live in.
            ShootPortal pushes scheduled shoots to the Google Calendar you choose and shows your Google events read-only
            inside its calendar, so conflicts are visible in both places. You propose a time that fits your route and
            the agent taps Approve Time or suggests another, so you never end up with three shoots on opposite sides
            of town. Our{" "}
            <BlogLink slug="best-real-estate-photography-booking-software">
              real estate photography booking software comparison
            </BlogLink>{" "}
            covers booking in more depth.
          </p>
          <h3>One thread per job</h3>
          <p>
            The rule that saves the most time: <strong>job-specific conversations belong on the job</strong>. When an
            agent texts &quot;can you remove the car from the driveway shot?&quot;, copy it into the project (or reply in
            the project&apos;s message thread) so the request, your reply, and the fixed file are all in one place. A
            month later, when someone asks what was agreed, you&apos;ll have the answer.
          </p>
          <Figure caption="Real ShootPortal screen: ShootPortal's client list with project counts, lifetime revenue, and outstanding balances (sample client data).">
            <ProductPreview view="clients" />
          </Figure>
          <h3>Templates for repeat messages</h3>
          <p>
            You send the same handful of messages every week: estimate ready, shoot confirmed, photos ready, payment
            reminder. Write each one once, and edit only the specifics. ShootPortal sends branded automated emails for
            each of these (proposal, shoot time, deliverables, payment request, receipt, and more) with subject and body
            you can edit, plus reminders for proposals, scheduling, review, and payment.
          </p>
        </>
      ),
    },
    {
      id: "deliverables-revisions",
      title: "Track deliverables and revisions per listing",
      tocLabel: "Deliverables and revisions",
      body: () => (
        <>
          <p>
            A listing often has more deliverables than people realize: MLS photos, print files, aerials, a video and its
            social cut, a tour, a floor plan. Missing one is easy when they&apos;re produced by different people or on
            different days.
          </p>
          <ul>
            <li>
              <strong>List deliverables when the job is approved,</strong> straight from the estimate, so the order is
              the checklist.
            </li>
            <li>
              <strong>Mark each one delivered</strong> rather than the job as a whole.
            </li>
            <li>
              <strong>Log revisions against the specific item,</strong> with the client&apos;s note and your response.
            </li>
            <li>
              <strong>Keep the job in Review</strong> until every revision is resolved, so open requests stay visible on
              the board.
            </li>
          </ul>
          <p>
            In ShootPortal, agents approve or flag each deliverable with written feedback and can submit revision
            requests. Listing videos get time-stamped comments pinned to the frame, threaded replies, and numbered
            versions, so you don&apos;t need a separate Dropbox Replay or Frame.io account. Small photo fixes (a dark
            room, a crooked vertical, a spot on the lens) happen in the built-in photo editor, and Save to Project
            updates the agent&apos;s gallery without a re-upload. For the delivery side of this, see{" "}
            <BlogLink slug="how-to-deliver-real-estate-photos">how to deliver real estate photos to clients</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "listing-marketing",
      title: "Win agent loyalty with listing marketing they don't have to make",
      tocLabel: "Listing marketing for agents",
      body: (ctx) => (
        <>
          <p>
            Good photos get you the first booking. What keeps an agent sending you every listing is making their job
            easier after the photos land. The day a listing goes live, an agent needs a property website to share, Just
            Listed posts for Instagram and Facebook, and a flyer for the open house. Most build those themselves in
            Canva, late at night, from the photos you just delivered.
          </p>
          <p>
            If you hand them all of it with the delivery, you become the photographer they can&apos;t replace. And you
            can charge for it.
          </p>
          <Figure
            wide
            caption="Real ShootPortal Marketing Kit output, built from the delivered listing photos: a single-property website (left), a Just Listed social post ready to download (center), and a print-ready flyer with the agent's contact card (right)."
          >
            <ScreenTrio views={["property-website", "social-kit", "listing-flyer"]} />
          </Figure>
          <h3>What the Marketing Kit includes</h3>
          <ul>
            <li>
              <strong>A property website for each listing,</strong> built automatically from the photos and project
              details, in Modern, Luxury, or Coastal designs, with key facts, gallery, video, floor plans, virtual tour,
              open house, and agent contact. Status updates from For Sale to Pending to Sold, and there&apos;s an
              unbranded MLS-safe version.
            </li>
            <li>
              <strong>A social media kit:</strong> five square posts (Just Listed, Open House, Just Sold, Highlights,
              Coming Soon), three Stories, an Instagram carousel, and a print-ready Letter flyer with a QR code to the
              property website.
            </li>
            <li>
              <strong>Saved agent branding.</strong> The agent&apos;s headshot, brokerage logo, and colors are saved on
              their client record and reused on every listing, so the tenth kit takes no more effort than the first.
            </li>
          </ul>
          <h3>Include it, or sell it</h3>
          <p>
            You decide per product: include the property website and social kit free as a reason to book you, or offer
            them as paid add-ons (defaults are $49 for the website and $29 for the social kit, with an optional bundle,
            and you can override prices per project). The agent sees a preview in their project, adds it to the cart,
            and pays through your Stripe or on the same invoice. An optional &quot;Photography by&quot; credit on the
            property website puts your name in front of every buyer who visits.
          </p>
          <Figure caption="Real ShootPortal screens: the Marketing Kit tab where you set each product to Included or Paid (left), and the finished property website on a buyer's phone (right).">
            <TwoSidedScreens business="marketing-kit-tab" client="phone-property-website" clientLabel="What buyers see" />
          </Figure>
          <ProductCallout title="New revenue from listings you already shot">
            <p>
              The Marketing Kit is off until you turn it on. Once it&apos;s on, every delivered listing can carry a
              property website and social kit offer, built from photos you&apos;ve already edited, with no extra
              shooting and almost no extra time.
            </p>
          </ProductCallout>
          <InlineCta
            trialDays={ctx.trialDays}
            title="Give your agents a listing kit with their next delivery"
            body="Deliver one listing through ShootPortal, generate the property website and Just Listed posts from the photos, and send it to the agent free or as a paid add-on."
          />
        </>
      ),
    },
    {
      id: "daily-review",
      title: "The daily review that prevents missed deadlines",
      tocLabel: "Daily review",
      body: () => (
        <>
          <p>
            Systems fail quietly. The cure is a short, fixed review at the same time each day, before you shoot or edit.
            It takes about ten minutes once the pipeline is clean, and it catches most problems while they&apos;re still
            easy to fix.
          </p>
          <Steps
            items={[
              {
                title: "Scan new requests and quotes",
                body: <>Anything waiting on you gets a response today. Old quotes get a follow-up or are closed.</>,
              },
              {
                title: "Check approved but unscheduled jobs",
                body: <>Approved work without a confirmed time is the most common place listings stall.</>,
              },
              {
                title: "Confirm tomorrow's shoots",
                body: <>Address, access notes, package, and any agent preferences, read from the profile, not memory.</>,
              },
              {
                title: "Review everything in editing and review",
                body: <>Compare each job against its promised delivery time. Flag anything at risk now, not at 9pm.</>,
              },
              {
                title: "Clear open revisions",
                body: <>Every revision request gets either a fix or a reply with a time.</>,
              },
              {
                title: "Check awaiting payment",
                body: <>Send reminders where needed, and mark manual payments received.</>,
              },
            ]}
          />
          <p>
            Add a short weekly review on top: which agents haven&apos;t booked in a while, which properties might come
            back, and whether any stage is consistently where jobs get stuck. That last question tells you what to fix
            in your process next.
          </p>
        </>
      ),
    },
    {
      id: "scaling-to-a-team",
      title: "Scaling from solo to a team",
      tocLabel: "Scaling to a team",
      body: () => (
        <>
          <p>
            Hiring a second shooter or an editor is where informal systems break completely, because the information in
            your head has to reach someone else. Before you hire:
          </p>
          <ul>
            <li>
              <strong>Move everything into one system.</strong> If a new team member needs to check three apps and your
              text messages to prepare for a shoot, the system isn&apos;t ready.
            </li>
            <li>
              <strong>Write standard operating procedures</strong> for the shoot, culling, editing, and upload steps.
              Agent preferences cover the exceptions; SOPs cover the defaults.
            </li>
            <li>
              <strong>Give access by role.</strong> A shooter needs addresses, access notes, and the shot list. They
              probably don&apos;t need revenue figures or every client&apos;s billing details.
            </li>
            <li>
              <strong>Assign jobs explicitly.</strong> Every project should have an owner, so nothing is
              &quot;someone&apos;s&quot; job.
            </li>
          </ul>
          <ProductCallout title="Give a second shooter their jobs, not your books">
            <p>
              ShootPortal includes unlimited staff accounts with about 25 granular permissions and presets such as
              Editor, Coordinator, and Full access except money. You assign staff to specific projects, so a shooter
              can open the listing&apos;s address, request notes, and message thread without seeing your revenue.
            </p>
          </ProductCallout>
          <p>
            You choose who shoots each job, which keeps your best photographer on your best agents. For a wider look at
            team tools, see our{" "}
            <BlogLink slug="best-real-estate-photography-software">real estate photography software guide</BlogLink>.
          </p>
          <Callout tone="tip" title="Hire into a working system">
            <p>
              The best time to clean up client records and pipeline stages is before your first hire, not after. A new
              team member will follow whatever system exists, including its gaps.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "connected-record",
      title: "How ShootPortal ties each agent to their listings, messages, and money",
      tocLabel: "One record per agent in ShootPortal",
      body: (ctx) => (
        <>
          <p>
            ShootPortal is our product, so here&apos;s exactly how it maps onto the system above. The idea behind it is that the photos are only half of what an agent buys from you. The other half is a
            smooth request, a clear price, a confirmed time, quick revisions, an easy payment, and files that are easy to
            find, and that half falls apart when it&apos;s spread across texts, a spreadsheet, a calendar, a cloud folder,
            and a payment app.
          </p>
          <p>
            In ShootPortal everything hangs off two records: the <strong>client</strong> (the agent) and the{" "}
            <strong>project</strong> (one listing job). Open an agent and you see every project they&apos;ve ordered;
            open a project and you see that listing&apos;s proposal, shoot time, messages, files, video review,
            approvals, payment status, and marketing kit together.
          </p>
          <ComparisonTable
            caption="Where each part of the client management system lives in ShootPortal"
            columns={["What you need to track", "Where it lives in ShootPortal", "Why it helps"]}
            rows={[
              ["Agent details and preferences", "Client record: name, email, phone, company, plus notes for preferences", "Read before every job instead of scrolling texts"],
              ["Agent branding", "Headshot, brokerage logo, and colors saved per client", "Every property website and social kit comes out on-brand"],
              ["Every listing they've sent", "Projects linked to the client, each moving through the eight-stage pipeline", "One board shows where every listing stands"],
              ["Property history", "Each address with its projects and revenue, on the client record", "Relists start with context and an accurate quote"],
              ["Conversations", "Messages on each project, with templates", "The request, reply, and fixed file sit together"],
              ["Deliverables and revisions", "Files in the agent's portal; approve or flag each item; time-stamped video comments with versions", "No separate review tool or email chains"],
              ["Money", "Proposals, deposits, payments to your own Stripe, lifetime revenue, outstanding balance, last payment", "Agents pay faster; you see who owes what"],
              ["Listing marketing", "Property website and social media kit per listing, included or paid", "Agents stay loyal and you earn more per listing"],
              ["Team", "Unlimited staff accounts with granular permissions, assigned to projects", "Staff see their jobs, not your books"],
            ]}
            note="ShootPortal features as of November 16, 2026."
          />
          <p>
            In practice, this changes the daily review. &quot;Approved but unscheduled&quot; and &quot;awaiting
            payment&quot; are columns on the pipeline board instead of things you reconstruct from memory, and when an
            agent asks what they owe, the outstanding balance is on their record. Stage changes, reminders, receipts,
            and download unlocks happen automatically as agents approve and pay, so you and your staff stop chasing and
            stop asking each other where things are.
          </p>
          <AllInOnePlatform intro="Client management is one piece. The same subscription runs your business website, booking, proposals, scheduling, editing, video review, payment, delivery, and listing marketing." />
          <TrialCard
            trialDays={ctx.trialDays}
            title="Move your three busiest agents in first"
            body={
              <>
                Import your client list by CSV, add your top agents&apos; preferences and branding, and run their next
                listings through the pipeline. Deliver one with a property website and social kit and see how the agent
                responds. Within a week you&apos;ll know whether one record per agent beats the texts-and-spreadsheet
                system you have now.
              </>
            }
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
          <p>
            See how agents, properties, and balances connect on our{" "}
            <SiteLink href="/real-estate-photography-crm">real estate photography CRM</SiteLink> page.
          </p>
        </>
      ),
    },
    {
      id: "choosing-tools",
      title: "What to look for in client management software",
      tocLabel: "Choosing software",
      body: () => (
        <>
          <p>
            Once your process is clear, judge software by how well it supports it. For a real estate photography
            business, the essentials are:
          </p>
          <ul>
            <li>Client records with notes, history, and balances</li>
            <li>Properties linked to clients, with history per address</li>
            <li>A pipeline view of every active job</li>
            <li>Scheduling that shows conflicts with your existing calendar</li>
            <li>Messaging attached to each project</li>
            <li>Delivery, video review, and payment connected to the same project</li>
            <li>Listing marketing (property websites, social posts, flyers) you can include or sell</li>
            <li>Staff accounts with permissions</li>
          </ul>
          <p>
            ShootPortal was built by the owner of a drone photography business around this shape of work, and it checks
            every box on the list. See how the pieces fit on <SiteLink href="/how-it-works">how ShootPortal works</SiteLink>,
            and weigh any tool you consider against the checklist above and what your agents actually ask for.
          </p>
          <KeyTakeaways
            items={[
              <>Record agent preferences, including billing arrangements, before the first job.</>,
              <>Organize around properties as well as people; addresses come back.</>,
              <>Use a fixed pipeline with explicit exit rules for every stage.</>,
              <>Keep job conversations and revisions attached to the job.</>,
              <>Listing marketing (property websites, social posts, flyers) keeps agents loyal and adds revenue per listing.</>,
              <>A ten-minute daily review catches stalled, late, and unpaid jobs early.</>,
              <>Move to one system with role-based access before you hire.</>,
            ]}
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "How do real estate photographers keep track of clients?",
      answerText:
        "Most use a CRM or business platform with a record for each agent (contact details, preferences, notes, billing), each property linked to the agent, and a pipeline showing every active job. ShootPortal does this with one record per agent, including property history, balances, and saved branding, and one project per listing. A short daily review keeps the pipeline accurate.",
      answer: (
        <p>
          Most use a CRM or business platform with a record for each agent (contact details, preferences, notes,
          billing), each property linked to the agent, and a pipeline showing every active job. ShootPortal does this
          with one record per agent, including property history, balances, and saved branding, and one project per
          listing. A short daily review keeps the pipeline accurate.
        </p>
      ),
    },
    {
      question: "What pipeline stages should a real estate photography business use?",
      answerText:
        "A common set is new request, quote sent, approved, scheduled, shoot complete, review, awaiting payment, and delivered. What matters most is a clear rule for when a job moves from one stage to the next.",
      answer: (
        <p>
          A common set is new request, quote sent, approved, scheduled, shoot complete, review, awaiting payment, and
          delivered. What matters most is a clear rule for when a job moves from one stage to the next.
        </p>
      ),
    },
    {
      question: "How do I handle agents who want invoices sent to their brokerage?",
      answerText:
        "Record the billing arrangement on the agent's profile and confirm it before the first job. In ShootPortal, pay links open without a login, so you can send one directly to the brokerage office or team lead, and you can mark a check or other offline payment as paid when it arrives.",
      answer: (
        <p>
          Record the billing arrangement on the agent&apos;s profile and confirm it before the first job. In
          ShootPortal, pay links open without a login, so you can send one directly to the brokerage office or team
          lead, and you can mark a check or other offline payment as paid when it arrives.
        </p>
      ),
    },
    {
      question: "When should a solo real estate photographer start using a CRM?",
      answerText:
        "Before you hire, and ideally once you're juggling more jobs than you can track from memory. Setting up records and stages is much easier before a team depends on them.",
      answer: (
        <p>
          Before you hire, and ideally once you&apos;re juggling more jobs than you can track from memory. Setting up
          records and stages is much easier before a team depends on them.
        </p>
      ),
    },
    {
      question: "How does ShootPortal handle a team of photographers?",
      answerText:
        "You add unlimited staff accounts, give each one granular permissions or a preset like Editor or Coordinator, and assign them to specific projects yourself. Assignment is manual, so you decide who shoots each listing.",
      answer: (
        <p>
          You add unlimited staff accounts, give each one granular permissions or a preset like Editor or Coordinator,
          and assign them to specific projects yourself. Assignment is manual, so you decide who shoots each listing.
        </p>
      ),
    },
    {
      question: "How can real estate photographers earn more from each agent?",
      answerText:
        "Offer listing marketing on top of the photos. ShootPortal's Marketing Kit builds a property website and a social media kit (posts, Stories, a carousel, and a print flyer) from the delivered photos. You can include it free or sell it as an add-on, with defaults of $49 for the website and $29 for the social kit, and the agent pays through your Stripe.",
      answer: (
        <p>
          Offer listing marketing on top of the photos. ShootPortal&apos;s Marketing Kit builds a property website and a
          social media kit (posts, Stories, a carousel, and a print flyer) from the delivered photos. You can include it
          free or sell it as an add-on, with defaults of $49 for the website and $29 for the social kit, and the agent
          pays through your Stripe.
        </p>
      ),
    },
    {
      question: "Can I save each agent's branding for property websites and social posts?",
      answerText:
        "Yes. In ShootPortal, the agent's headshot, brokerage logo, and colors are saved on their client record and reused on every property website and social media kit you create for their listings.",
      answer: (
        <p>
          Yes. In ShootPortal, the agent&apos;s headshot, brokerage logo, and colors are saved on their client record
          and reused on every property website and social media kit you create for their listings.
        </p>
      ),
    },
  ],
  related: [
    "best-photography-crm-software",
    "real-estate-photography-automation",
    "how-to-create-photography-client-portal",
  ],
  cta: {
    title: "Keep every agent organized, and give them a reason to stay",
    body: "One record per agent with listings, property history, balances, and saved branding. One project per listing from request to delivery, plus property websites and social kits you can include or sell.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
