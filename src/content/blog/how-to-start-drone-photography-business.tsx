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
  Steps,
} from "@/components/blog/article-parts";
import { WorkflowDiagram } from "@/components/blog/diagrams";
import { ChecklistCard, RoadmapDiagram } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";

export const article: BlogArticle = {
  slug: "how-to-start-drone-photography-business",
  title: "How to Start a Drone Photography Business in 2026: Step-by-Step Guide",
  seoTitle: "How to Start a Drone Photography Business (2026 Guide)",
  description:
    "How to start a drone photography business in 2026: Part 107 steps, registration, Remote ID, insurance, equipment, business setup, pricing, and finding clients.",
  excerpt:
    "A practical, step-by-step path from FAA Part 107 certification to your first paying clients, with a startup checklist, a 90-day plan, and the systems that keep a drone business organized.",
  category: "drone-business",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "how to start a drone photography business",
  secondaryKeywords: [
    "start a drone business",
    "drone photography business",
    "Part 107 business",
    "commercial drone pilot business",
    "drone business startup checklist",
  ],
  readingMinutes: 14,
  cover: {
    variant: "checklist",
    tint: "indigo",
    label: "Startup Guide",
    alt: "Illustration of a startup checklist with ticked items on an indigo background",
  },
  disclosure: true,
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Get legal first.</strong> Flying for business means FAA Part 107: pass the UAG knowledge test, get
        your Remote Pilot Certificate, and register every drone you fly commercially ($5 each, valid 3 years).
      </>,
      <>
        <strong>Pick one or two niches to start.</strong> Real estate and construction progress are common entry
        points; mapping and inspection usually need extra training and software.
      </>,
      <>
        <strong>Buy for the work, not the spec sheet.</strong> Image quality, reliability, spare batteries, and
        Remote ID compliance matter more than the newest model.
      </>,
      <>
        <strong>Set up the business properly:</strong> entity, bank account, bookkeeping, and liability insurance,
        which the FAA doesn&apos;t require but many commercial clients ask for.
      </>,
      <>
        <strong>Build systems early.</strong> A repeatable path from request to estimate, flight, delivery, and
        payment is what lets a solo pilot take on more jobs without dropping balls.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Plenty of people can fly a drone well. Far fewer turn that skill into a business that books steadily, gets
        paid on time, and doesn&apos;t eat every evening in admin. The gap usually isn&apos;t piloting. It&apos;s the
        unglamorous groundwork: certification, registration, insurance, pricing, a portfolio that matches what
        clients buy, and a way to run jobs that doesn&apos;t live in your text messages.
      </p>
      <p>
        This guide walks through <strong>how to start a drone photography business</strong> in 2026, in the order you
        actually need to do things. We cover the FAA requirements with links to the official sources, what equipment
        matters, how to set up the business side, where the first clients usually come from, and how to build a
        workflow you won&apos;t have to rebuild when you get busy.
      </p>
      <Callout tone="note" title="Not legal or tax advice">
        <p>
          Rules change, and they vary by location. Treat this as a starting point and confirm current requirements
          with the FAA, your state, and your local jurisdiction, and talk to an accountant or attorney about your
          business structure and taxes.
        </p>
      </Callout>
    </>
  ),
  sections: [
    {
      id: "opportunities",
      title: "Where the paid work is for drone photographers",
      tocLabel: "Where the work is",
      body: () => (
        <>
          <p>
            &quot;Drone photography&quot; is really several different businesses that happen to use the same tool. Each
            one has its own buyers, deliverables, and level of technical depth. Choosing one or two to focus on makes
            every later decision easier, from which drone to buy to what goes in your portfolio.
          </p>
          <ComparisonTable
            caption="Common drone service niches: who buys, what they expect, and what extra skills are involved"
            columns={["Niche", "Typical buyer", "Typical deliverables", "Extra skills or tools"]}
            rows={[
              ["Real estate", "Listing agents, builders, property managers", "Aerial stills, short video clips", "Fast turnaround, MLS-ready files"],
              ["Construction progress", "General contractors, developers", "Recurring photos and video from the same angles", "Repeatable flight paths, consistent scheduling"],
              ["Roofing and inspection", "Roofers, insurers, property owners", "Detailed stills, sometimes reports", "Inspection technique; thermal work needs specialist training"],
              ["Events", "Venues, organizers, couples", "Video clips, overview stills", "Careful planning around people and venue rules"],
              ["Commercial and brand", "Resorts, agencies, businesses", "Cinematic video, hero stills", "Video editing, usage and licensing terms"],
              ["Mapping and modeling", "Surveyors, engineers, land managers", "Orthomosaics, 3D models", "Photogrammetry software and training"],
            ]}
            note="Mapping, inspection, and thermal work often require additional training and specialist software beyond Part 107. Don't sell what you can't yet deliver accurately."
          />
          <p>
            Real estate is the most common entry point because demand is steady and the deliverables are
            straightforward. Construction progress is attractive because it&apos;s recurring by nature: the same site,
            the same angles, every week or month. Mapping and inspection can pay more per job, but the client is
            usually relying on your data for decisions, so accuracy, processing software, and domain knowledge matter
            as much as flying.
          </p>
          <p>
            A sensible plan is to start with one niche you can deliver well now, and add a second once your workflow
            is steady. If you also shoot ground-level listing photography, our guide on{" "}
            <BlogLink slug="how-to-start-real-estate-photography-business">starting a real estate photography business</BlogLink>{" "}
            covers that side in depth.
          </p>
        </>
      ),
    },
    {
      id: "faa-part-107",
      title: "Step 1: Get your FAA Part 107 Remote Pilot Certificate",
      tocLabel: "FAA Part 107",
      body: () => (
        <>
          <p>
            In the US, flying a drone under 55 pounds for work or business falls under the FAA&apos;s Part 107 rules,
            and the pilot must hold a Remote Pilot Certificate. If the flight is for work or business, plan on Part 107
            from the start.
          </p>
          <p>
            Per the FAA&apos;s{" "}
            <Ext href="https://www.faa.gov/uas/commercial_operators/become_a_drone_pilot">Become a Drone Pilot page</Ext>,
            you must be at least 16, able to read, speak, write, and understand English, in physical and mental
            condition to fly safely, and pass the initial knowledge test, called &quot;Unmanned Aircraft General –
            Small (UAG).&quot; The process looks like this:
          </p>
          <Steps
            items={[
              {
                title: "Get an FAA Tracking Number (FTN)",
                body: <>Create a profile in IACRA, the FAA&apos;s certification system, to receive your FTN.</>,
              },
              {
                title: "Schedule and pass the UAG knowledge test",
                body: (
                  <>
                    Book at an FAA-approved Knowledge Testing Center and bring government photo ID. The FAA says{" "}
                    <Ext href="https://www.faa.gov/faq/how-much-does-it-cost-get-remote-pilot-certificate">
                      testing centers charge approximately $175
                    </Ext>{" "}
                    for the initial test; confirm the fee when you book.
                  </>
                ),
              },
              {
                title: "Apply in IACRA with Form 8710-13",
                body: <>Use the 17-digit exam ID from your test results. The FAA notes it can take up to 48 hours to appear.</>,
              },
              {
                title: "Complete the TSA security background check",
                body: <>Once it clears, you&apos;ll get an email that lets you print a temporary certificate. The permanent card arrives by mail.</>,
              },
              {
                title: "Stay current",
                body: (
                  <>
                    Complete the FAA&apos;s free online recurrent training every 24 calendar months. Keep your
                    certificate easily accessible whenever you fly.
                  </>
                ),
              },
            ]}
          />
          <p>
            If you already hold a Part 61 pilot certificate with a flight review in the past 24 months, the FAA offers a
            different path: an online course through FAASTeam instead of the knowledge test.
          </p>
          <h3>Airspace, night, and people</h3>
          <p>
            Certification is the start, not the finish. Many real estate and construction jobs sit near airports, so
            you&apos;ll use{" "}
            <Ext href="https://www.faa.gov/uas/getting_started/laanc">LAANC</Ext>, the FAA and industry system that
            gives near-real-time authorization for controlled airspace at or below 400 feet through approved service
            suppliers. LAANC handles airspace authorization only; you still check NOTAMs and weather. Since April 21,
            2021, Part 107 pilots may fly at night and over people or moving vehicles without a waiver if they meet the
            rule&apos;s requirements. Beyond-visual-line-of-sight work still generally needs a waiver or exemption: the
            FAA&apos;s proposed BVLOS rule (a new Part 108){" "}
            <Ext href="https://www.federalregister.gov/documents/2025/08/07/2025-14992/normalizing-unmanned-aircraft-systems-beyond-visual-line-of-sight-operations">
              was published as a proposal in August 2025
            </Ext>{" "}
            and, as of October 2026, has not been issued as a final rule.
          </p>
        </>
      ),
    },
    {
      id: "registration-insurance",
      title: "Step 2: Register your drones, meet Remote ID, and get insured",
      tocLabel: "Registration and insurance",
      body: () => (
        <>
          <h3>Registration</h3>
          <p>
            Under Part 107,{" "}
            <Ext href="https://www.faa.gov/uas/getting_started/register_drone">every drone you fly must be registered</Ext>,
            including drones under 250 grams. The under-250-gram exemption applies only to recreational flying, which
            catches out a lot of new business owners who start with a small drone. Registration costs $5 per drone,
            lasts three years, and is done through FAADroneZone. Mark the registration number on the drone.
          </p>
          <h3>Remote ID</h3>
          <p>
            Any drone that must be registered also has to comply with{" "}
            <Ext href="https://www.faa.gov/uas/getting_started/remote_id">Remote ID</Ext>. The FAA lists three ways to
            comply: fly a Standard Remote ID drone; attach a Remote ID broadcast module (in which case you must keep
            the drone within visual line of sight); or fly within an FAA-Recognized Identification Area (FRIA). Confirm
            which option applies to a drone before you buy it, especially if it&apos;s used or an older model.
          </p>
          <h3>Insurance</h3>
          <p>
            The FAA does not require insurance for Part 107 operations. In the{" "}
            <Ext href="https://www.federalregister.gov/documents/2016/06/28/2016-15079/operation-and-certification-of-small-unmanned-aircraft-systems">
              2016 final rule
            </Ext>
            , the agency said its governing statutes don&apos;t give it authority to mandate insurance. That
            doesn&apos;t make insurance optional in practice. Many commercial clients ask for proof of liability
            insurance before you fly their site, and some venues, states, or localities have their own requirements.
          </p>
          <p>
            Common options are on-demand or monthly policies and annual policies, with liability limits from $500,000
            up. As one reference point, broker BWI&apos;s{" "}
            <Ext href="https://bwifly.com/blog/drone-insurance-price-what-youll-really-pay-in-2025-and-how-to-lower-it/">
              November 2025 pricing article
            </Ext>{" "}
            puts a $1M liability policy at roughly $600–$1,200 per year. Get quotes for your own operation, and ask
            your bigger prospective clients what limits they expect before you buy.
          </p>
          <Callout tone="warning" title="Accidents have reporting rules too">
            <p>
              Part 107 requires reporting to the FAA within 10 days for accidents involving serious injury, loss of
              consciousness, or property damage of $500 or more. Know the rule before you need it.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "equipment",
      title: "Step 3: Choose equipment for the work you sell",
      tocLabel: "Equipment",
      body: () => (
        <>
          <p>
            New pilots tend to over-invest in the aircraft and under-invest in everything that keeps it flying. Buy
            for the jobs in your chosen niche, and think in categories rather than models:
          </p>
          <ul>
            <li>
              <strong>The aircraft and camera.</strong> For real estate and general aerial photography, a larger
              sensor helps with dynamic range at sunrise and sunset. For inspection, zoom and stable hovering matter
              more. For mapping, check compatibility with the processing software you plan to use.
            </li>
            <li>
              <strong>Batteries and charging.</strong> Enough batteries to finish a typical job without waiting, plus a
              way to charge in the car.
            </li>
            <li>
              <strong>A backup.</strong> A second aircraft, even a smaller one, keeps you from cancelling a booked job
              because of one crash or a failed part.
            </li>
            <li>
              <strong>Storage and editing.</strong> Fast memory cards, a laptop or desktop that can handle your video
              resolution, and backup drives. Video files grow quickly.
            </li>
            <li>
              <strong>Safety and field kit.</strong> Landing pad, ND filters for video, a visible vest, and a written
              preflight checklist.
            </li>
          </ul>
          <h3>What drones cost right now</h3>
          <p>
            As a reference point, on October 15, 2026, DJI&apos;s US online store listed the{" "}
            <Ext href="https://store.dji.com/product/dji-mini-3">DJI Mini 3</Ext> at $419, the{" "}
            <Ext href="https://store.dji.com/product/dji-mini-4-pro">DJI Mini 4 Pro</Ext> at $759 (Fly More Combo with
            RC 2 at $1,099), and the <Ext href="https://store.dji.com/product/dji-air-3s">DJI Air 3S</Ext> at $1,099,
            with both the Mini 4 Pro and Air 3S shown as out of stock that day. Thumbtack&apos;s{" "}
            <Ext href="https://www.thumbtack.com/p/aerial-photography-prices">aerial photography cost guide</Ext>{" "}
            puts professional drone equipment at roughly $1,500 to $12,000 or more for operators.
          </p>
          <p>
            US availability of foreign-made drones is in flux. In December 2025 the FCC added uncrewed aircraft systems
            and critical components produced in a foreign country to its{" "}
            <Ext href="https://www.fcc.gov/supplychain/coveredlist">Covered List</Ext>, with specific exceptions, and the
            entry has been updated several times since. What that means for a particular model can change, so check the
            FCC page and current retailer availability before you budget around a specific drone.
          </p>
        </>
      ),
    },
    {
      id: "business-setup",
      title: "Step 4: Set up the business side",
      tocLabel: "Business setup",
      body: () => (
        <>
          <p>
            The business setup is the least exciting part of starting out and the most annoying to fix later. The
            details depend on your state and situation, so treat this as a list of questions to bring to an accountant
            or attorney rather than a set of answers.
          </p>
          <ul>
            <li>
              <strong>Business structure.</strong> Sole proprietorship, LLC, or another entity. Each has different
              liability and tax implications.
            </li>
            <li>
              <strong>EIN.</strong> Many owners get an Employer Identification Number from the IRS so they can open a
              business bank account and avoid giving clients their Social Security number on tax forms.
            </li>
            <li>
              <strong>Separate bank account.</strong> Keep business income and expenses out of your personal account
              from the first job.
            </li>
            <li>
              <strong>Bookkeeping.</strong> Pick a bookkeeping method on day one and record equipment purchases,
              insurance, software, mileage, and income as they happen.
            </li>
            <li>
              <strong>Local licenses and sales tax.</strong> Some cities and counties require a business license, and
              states treat sales tax on photography differently.
            </li>
            <li>
              <strong>Simple written terms.</strong> What&apos;s included, revision limits, weather rescheduling,
              cancellation, payment timing, and image usage.
            </li>
          </ul>
          <Figure caption="Startup checklist for a new drone photography business. Requirements vary by location; confirm with official sources and professionals.">
            <ChecklistCard
              groups={[
                {
                  title: "Legal and FAA",
                  items: [
                    "Pass the UAG knowledge test",
                    "Receive Remote Pilot Certificate",
                    "Register every drone under Part 107",
                    "Confirm Remote ID compliance",
                    "Set a reminder for recurrent training",
                  ],
                },
                {
                  title: "Business",
                  items: [
                    "Choose a business structure",
                    "Get an EIN and open a business bank account",
                    "Set up bookkeeping",
                    "Check local licenses and sales tax",
                    "Get liability insurance quotes",
                  ],
                },
                {
                  title: "Equipment",
                  items: [
                    "Primary drone suited to your niche",
                    "Enough batteries for a full job",
                    "Backup aircraft or plan",
                    "Editing computer and backup storage",
                    "Written preflight checklist",
                  ],
                },
                {
                  title: "Sales and operations",
                  items: [
                    "Portfolio for one or two niches",
                    "Service list with clear pricing",
                    "Request form or booking path",
                    "Estimate, payment, and delivery process",
                    "Simple written terms",
                  ],
                },
              ]}
            />
          </Figure>
        </>
      ),
    },
    {
      id: "portfolio-pricing",
      title: "Step 5: Build a portfolio and set your prices",
      tocLabel: "Portfolio and pricing",
      body: () => (
        <>
          <h3>A portfolio that matches what clients buy</h3>
          <p>
            Your portfolio should look like the job the client is about to hire you for. A roofing contractor wants to
            see clear, well-lit roof detail; a builder wants consistent progress shots; an agent wants a home that looks
            inviting from above with the neighborhood in context. Fifteen strong images and two short clips in one
            niche beat a hundred mixed shots.
          </p>
          <p>
            Early on, shoot your own spec work: a friend&apos;s property, a local business that agrees to it, a public
            landmark where flying is permitted. Always check airspace and get permission from property owners. Present
            the work on a simple page where the client can see it, understand what you offer, and request a job.
          </p>
          <h3>Pricing</h3>
          <p>
            Pricing is where new pilots most often undercut themselves, usually by forgetting the hours after the
            flight: travel, planning, editing, uploads, and client communication. Build prices from your real costs and
            time, then sanity-check them against the market. For context, Thumbtack&apos;s{" "}
            <Ext href="https://www.thumbtack.com/p/photographer-prices">2025 photography prices page</Ext> lists an
            average drone and aerial photography job at about $333, with a typical range of $233 to $475, though your
            local market and niche can differ a lot.
          </p>
          <p>
            Our <BlogLink slug="drone-photography-pricing-guide">drone photography pricing guide</BlogLink> goes deeper
            into hourly versus package pricing, inspection and construction rates from published sources, and a
            cost-plus worksheet you can use for your own numbers.
          </p>
        </>
      ),
    },
    {
      id: "finding-customers",
      title: "Step 6: Find your first customers",
      tocLabel: "Finding customers",
      body: () => (
        <>
          <p>
            The first clients rarely come from ads. They come from people who already need aerial work and meet you
            directly. A few approaches that tend to work for new drone businesses:
          </p>
          <ul>
            <li>
              <strong>Go where the buyers are.</strong> Real estate offices, builders&apos; associations, roofing
              suppliers, and local business groups. Bring printed examples that match their work.
            </li>
            <li>
              <strong>Offer a recurring arrangement.</strong> Construction progress is naturally repeatable. Propose a
              schedule (for example, monthly from the same positions) instead of a single shoot.
            </li>
            <li>
              <strong>Partner with ground photographers.</strong> Many real estate photographers don&apos;t fly. Being
              their reliable aerial subcontractor can fill your calendar while you build direct clients.
            </li>
            <li>
              <strong>Set up a Google Business Profile.</strong> A service-area profile helps local clients find you
              when they search, and gives happy clients a place to leave reviews.
            </li>
          </ul>
          <p>
            If real estate is your niche, our guide on{" "}
            <BlogLink slug="how-to-get-real-estate-photography-clients">how to get real estate photography clients</BlogLink>{" "}
            covers agent outreach, brokerage presentations, and Google Business Profile in detail.
          </p>
        </>
      ),
    },
    {
      id: "operations",
      title: "Step 7: Communication, invoicing, delivery, and repeatable workflows",
      tocLabel: "Operations and workflow",
      body: (ctx) => (
        <>
          <p>
            Once jobs start coming in, the business lives or dies on how smoothly each one moves from first message to
            final payment. Write down the path every job follows, then make that path the same every time.
          </p>
          <Figure caption="Conceptual diagram: the request-to-delivery workflow every drone job should follow.">
            <WorkflowDiagram />
          </Figure>
          <h3>Client communication</h3>
          <p>
            Drone jobs have more moving parts than they look. Weather moves dates, airspace authorization needs lead
            time, and site access depends on someone else. Keep all of that on the job record, not scattered across
            texts and email, and tell clients up front how weather rescheduling works.
          </p>
          <h3>Estimates and invoicing</h3>
          <p>
            Send a written estimate with what&apos;s included before you fly, and collect a deposit for larger or
            custom jobs. Request the balance when the media is ready, and make online payment easy. Our guide to{" "}
            <BlogLink slug="photography-workflow-automation">photography workflow automation</BlogLink> breaks down
            which of these hand-offs you can automate.
          </p>
          <h3>Media delivery</h3>
          <p>
            Drone video files are large. 4K masters regularly exceed email attachment limits, and clients get
            frustrated with links that expire or folders they can&apos;t navigate. Deliver through one organized place
            where clients can preview, approve, and download. Our guide on{" "}
            <BlogLink slug="how-to-send-large-video-files-to-clients">how to send large video files to clients</BlogLink>{" "}
            compares the options.
          </p>
          <h3>Using software as your foundation</h3>
          <p>
            You can run a new drone business on email, a calendar, a cloud folder, and a payment app. The problem is
            that each job ends up spread across all four. A single platform that ties those steps to one project is
            easier to keep consistent from the start than to migrate to later. Our comparison of{" "}
            <BlogLink slug="best-drone-business-management-software">drone business management software</BlogLink>{" "}
            separates flight-operations tools (logs, airspace, compliance) from client-facing business tools.
          </p>
          <p>
            ShootPortal (our product) is on the client-facing side. Each job is a project that moves through stages
            from new request to delivered. Clients request work through your form, approve estimates, accept a proposed
            shoot time or counter it, review photos and video with time-stamped comments, pay through Stripe, and
            download from a branded portal. For mapping and modeling clients, you can embed 3D models from tools like
            DroneDeploy and Pix4D alongside photos and video. It doesn&apos;t do flight logging, airspace checks, or
            contracts, so pair it with your flight-ops app and your own terms.
          </p>
          <Figure caption="Product illustration: drone and photo jobs organized by stage in ShootPortal (demo data).">
            <ProductPreview view="projects" />
          </Figure>
          <InlineCta
            title="Start with a workflow you won't outgrow"
            body="Requests, estimates, scheduling, client review, payments, and delivery on one project per job."
            trialDays={ctx.trialDays}
          />
        </>
      ),
    },
    {
      id: "first-90-days",
      title: "Your first 90 days, and how to scale from there",
      tocLabel: "First 90 days and scaling",
      body: () => (
        <>
          <p>
            Starting a drone business is a sequence, not a single launch. This is one reasonable order of operations
            for the first few months. Timing depends on how much time you can commit and how quickly you pass the test.
          </p>
          <Figure caption="Illustrative roadmap: one way to sequence your first 90 days. Timing varies; this is not a forecast of results.">
            <RoadmapDiagram
              phases={[
                {
                  title: "Get legal",
                  when: "Weeks 1–4",
                  items: ["Study for and pass the UAG test", "Register drones in DroneZone", "Confirm Remote ID", "Pick your first niche"],
                },
                {
                  title: "Set up",
                  when: "Weeks 3–6",
                  items: ["Choose entity, bank, bookkeeping", "Get insurance quotes", "Write simple terms", "Set prices and packages"],
                },
                {
                  title: "Build proof",
                  when: "Weeks 5–9",
                  items: ["Shoot spec projects", "Publish a focused portfolio", "Set up Google Business Profile", "Build request-to-delivery workflow"],
                },
                {
                  title: "Find clients",
                  when: "Weeks 8–13",
                  items: ["Visit offices and associations", "Offer recurring schedules", "Ask every client for a review", "Review what each job really cost"],
                },
              ]}
            />
          </Figure>
          <h3>Scaling past one pilot</h3>
          <p>
            Growth usually comes in a predictable order. First, you raise prices and drop work that doesn&apos;t fit.
            Then you outsource editing or bring in a second pilot for overflow. Then you add a specialty, like
            inspection or mapping, once you&apos;ve trained for it. Each of those steps is much easier if every job
            already follows the same documented workflow, and if team members can be given access to the specific jobs
            they work on.
          </p>
          <p>
            You can see how a complete request-to-delivery workflow fits together on our{" "}
            <SiteLink href="/how-it-works">How it works page</SiteLink>.
          </p>
          <KeyTakeaways
            items={[
              "Part 107 certification and registration of every drone come first, including drones under 250 g.",
              "Insurance isn't federally required, but many commercial clients will ask for proof of coverage.",
              "Start with one or two niches; mapping and inspection need extra training and software.",
              "Price from your real costs and time, including everything after the flight.",
              "Set up a repeatable request-to-delivery workflow before volume forces you to.",
            ]}
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "Do I need a license to start a drone photography business?",
      answerText:
        "Yes. In the US, flying a drone under 55 pounds for business falls under FAA Part 107, and the pilot needs a Remote Pilot Certificate. You get it by passing the FAA's Unmanned Aircraft General – Small (UAG) knowledge test, applying in IACRA, and clearing a TSA background check. Your state or city may have separate business licensing requirements.",
      answer: (
        <p>
          Yes. In the US, flying a drone under 55 pounds for business falls under FAA Part 107, and the pilot needs a
          Remote Pilot Certificate. You get it by passing the FAA&apos;s &quot;Unmanned Aircraft General – Small
          (UAG)&quot; knowledge test, applying in IACRA, and clearing a TSA background check. Your state or city may
          have separate business licensing requirements.
        </p>
      ),
    },
    {
      question: "How much does it cost to get Part 107 certified?",
      answerText:
        "The FAA says knowledge testing centers charge approximately $175 for the initial test. Confirm the fee when you book. Recurrent training every 24 calendar months is free online, and drone registration under Part 107 costs $5 per drone for three years.",
      answer: (
        <p>
          The FAA says knowledge testing centers charge approximately $175 for the initial test; confirm the fee when
          you book. Recurrent training every 24 calendar months is free online, and registration under Part 107 costs
          $5 per drone for three years.
        </p>
      ),
    },
    {
      question: "Do I need to register a drone under 250 grams for business use?",
      answerText:
        "Yes. The FAA requires every drone flown under Part 107 to be registered, regardless of weight. The under-250-gram exemption only applies to recreational flying.",
      answer: (
        <p>
          Yes. The FAA requires every drone flown under Part 107 to be registered, regardless of weight. The
          under-250-gram exemption only applies to recreational flying.
        </p>
      ),
    },
    {
      question: "Is drone insurance required?",
      answerText:
        "The FAA does not require insurance for Part 107 operations. However, many commercial clients ask for proof of liability insurance, and some venues, states, or localities have their own requirements, so most working drone businesses carry liability coverage.",
      answer: (
        <p>
          The FAA does not require insurance for Part 107 operations. However, many commercial clients ask for proof of
          liability insurance, and some venues, states, or localities have their own requirements, so most working
          drone businesses carry liability coverage.
        </p>
      ),
    },
    {
      question: "What is the best niche for a new drone business?",
      answerText:
        "Real estate and construction progress are common starting points because demand is steady and deliverables are straightforward. Mapping, inspection, and thermal work can pay more but usually require additional training and specialist software.",
      answer: (
        <p>
          Real estate and construction progress are common starting points because demand is steady and deliverables
          are straightforward. Mapping, inspection, and thermal work can pay more but usually require additional
          training and specialist software.
        </p>
      ),
    },
  ],
  related: ["best-drone-business-management-software", "drone-photography-pricing-guide", "how-to-send-large-video-files-to-clients"],
  cta: {
    title: "Build your business on an organized foundation from day one.",
    body: "Requests, estimates, scheduling, client review, payments, and delivery on one project per job, in a portal branded to you.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
