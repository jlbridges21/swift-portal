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
import { DocumentCard, FunnelDiagram } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { AllInOnePlatform, AppScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "how-to-get-real-estate-photography-clients",
  title: "How to Get More Real Estate Photography Clients: 15 Strategies That Work",
  seoTitle: "How to Get Real Estate Photography Clients: 15 Strategies",
  description:
    "How to get real estate photography clients: 15 strategies for your website, agent outreach, Google Business Profile, listing marketing, and retention.",
  excerpt:
    "Fifteen practical ways to win listing agents and keep them booking, from a website with a Book a Shoot button and office presentations to property websites that credit your work and a marketing kit agents love.",
  category: "real-estate-photography",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  primaryKeyword: "how to get real estate photography clients",
  secondaryKeywords: [
    "real estate photography marketing",
    "find real estate agents to photograph for",
    "real estate photographer outreach email",
    "grow real estate photography business",
    "real estate photography website",
    "property website for listings",
    "real estate marketing kit",
    "real estate photographer referrals",
  ],
  readingMinutes: 13,
  cover: {
    variant: "funnel",
    tint: "indigo",
    label: "15 Strategies",
    alt: "Illustration of a client acquisition funnel narrowing toward booked shoots on an indigo background",
  },
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Give agents a professional business to hire and a reason to stay:</strong> ShootPortal gives you a
        website with your portfolio and a Book a Shoot button, property websites that credit your photography to every
        buyer, and a marketing kit that makes agents look good to their sellers.
      </>,
      <>
        <strong>Agents hire on trust and convenience.</strong> A focused portfolio and an easy booking path get you
        considered; reliability and fast delivery get you rebooked.
      </>,
      <>
        <strong>In-person beats ads for most new photographers.</strong> Brokerage office meetings, open houses, and
        local events put you in front of active listing agents.
      </>,
      <>
        <strong>Personal outreach works when it&apos;s specific.</strong> Reference the agent&apos;s actual listings,
        offer something useful, and keep it short.
      </>,
      <>
        <strong>Google Business Profile and reviews matter locally.</strong> Set up a service-area profile and share
        a review link, without offering incentives for reviews.
      </>,
      <>
        <strong>Retention is the cheapest growth.</strong> Every repeat booking and referral is a client you
        didn&apos;t have to find from scratch, and agents rebook the photographer who makes their listings easy to
        market.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Real estate photography has an unusual sales dynamic. Your clients are agents who list homes over and over,
        so a single good relationship can mean dozens of shoots a year. But agents are also busy, wary of
        unreliable vendors, and often already have a photographer they&apos;re reasonably happy with. Winning them
        is less about a clever ad and more about being the obvious, low-risk choice.
      </p>
      <p>
        This guide covers <strong>how to get real estate photography clients</strong> with 15 practical strategies,
        grouped by where they sit in the client journey: getting noticed, getting the first booking, and turning one
        booking into a long-term account. None of them are shortcuts. All of them compound.
      </p>
      <p>
        Several of them get much easier with the right platform behind you. ShootPortal gives you a real estate
        photography website that turns visits into bookings, a single link per listing where agents approve, pay, and
        download, and a property website and social media kit for every listing, which you can include or sell. Each
        one either brings in a new agent or gives the current one a reason to come back.
      </p>
      <p>
        If you&apos;re still setting up the business itself, start with our guide on{" "}
        <BlogLink slug="how-to-start-real-estate-photography-business">how to start a real estate photography business</BlogLink>,
        then come back here.
      </p>
    </>
  ),
  sections: [
    {
      id: "client-journey",
      title: "How agents actually choose a photographer",
      tocLabel: "How agents choose",
      body: () => (
        <>
          <p>
            Before the tactics, it helps to picture the path an agent takes from never having heard of you to booking
            you for every listing. Each strategy in this guide moves agents from one stage to the next.
          </p>
          <Figure caption="Conceptual diagram: a typical real estate photography client acquisition funnel. Illustrative, not measured conversion data.">
            <FunnelDiagram
              stages={[
                { label: "Aware", detail: "Sees your work at an office meeting, in search, or on social media" },
                { label: "Interested", detail: "Looks at your portfolio, packages, and reviews" },
                { label: "First booking", detail: "Tries you on one listing, often a lower-risk one" },
                { label: "Repeat client", detail: "Books again because the first job was easy and on time" },
                { label: "Advocate", detail: "Refers teammates and mentions you in the office" },
              ]}
            />
          </Figure>
          <p>
            Most photographers focus on the top of this funnel, chasing awareness. In practice, the bottom stages are
            where a real estate photography business is built. An agent who books you once and has a smooth experience
            is far more likely to become a repeat client than a stranger is to become a first-time one.
          </p>
          <ComparisonTable
            caption="Real estate photography customer journey: what the agent needs at each stage and what you can do"
            columns={["Stage", "What the agent needs", "What you can do", "Strategies"]}
            rows={[
              ["Aware", "To know you exist and shoot listings like theirs", "Show up in person, in local search, and on property websites that credit you", "#3–#6, #9, #11"],
              ["Interested", "Proof of quality and a clear offer", "A website with your portfolio, visible packages, and reviews", "#1, #2, #10"],
              ["First booking", "Low risk and low effort to try", "Personal outreach, a Book a Shoot button, clear pricing", "#2, #7, #8"],
              ["Repeat client", "Reliability, fast delivery, and marketing that makes them look good", "Consistent turnaround, organized delivery, a listing marketing kit", "#12, #13"],
              ["Advocate", "A reason and an easy way to recommend you", "Ask for referrals; serve teammates well", "#14, #15"],
            ]}
          />
        </>
      ),
    },
    {
      id: "foundations",
      title: "Strategies 1–2: Get your foundations right",
      tocLabel: "Foundations",
      body: (ctx) => (
        <>
          <h3>1. Build a portfolio that looks like the agent&apos;s listings</h3>
          <p>
            Agents scan a portfolio for one thing: &quot;Will my listings look like this?&quot; Show 20 to 30 of your
            best images, mostly from homes in the price range and style your target agents actually list. A portfolio
            full of luxury homes can make a mid-market agent assume you&apos;re out of their budget. One heavy on
            twilight shots tells agents nothing about your everyday interiors.
          </p>
          <p>
            Include the basics agents notice: straight verticals, bright and natural interiors, clean windows, and a
            consistent edit. If you offer drone, video, or floor plans, show one strong example of each, clearly
            labelled.
          </p>
          <h3>2. Put it on a website that makes booking you easy</h3>
          <p>
            A professional presentation is mostly about removing friction. An agent who finds you should be able to
            see your packages, a starting price or clear price range, your service area, and a way to request a shoot,
            all within a minute. Use a business email address, a consistent logo and color, and the same business name
            everywhere. If you&apos;re still working out packages, our{" "}
            <BlogLink slug="real-estate-photography-pricing-guide">real estate photography pricing guide</BlogLink>{" "}
            covers how to structure them.
          </p>
          <Figure caption="Real ShootPortal screen: a real estate media business website built in ShootPortal, with the portfolio, services, and a Book a Shoot button that opens your branded request form.">
            <AppScreen view="business-website" />
          </Figure>
          <ProductCallout title="Your website and your booking form are one system">
            <p>
              ShootPortal&apos;s website builder (Modern, Luxury, or Minimal templates) shows your portfolio projects,
              up to nine featured services, testimonials you paste in, and your social links, on your own domain. Book a
              Shoot opens a branded request form where the agent enters their brokerage, picks services from your
              catalog, and sees a preliminary estimate the moment they submit. No account needed, and the client and
              project are created for you.
            </p>
          </ProductCallout>
          <InlineCta
            trialDays={ctx.trialDays}
            title="Look like the established choice to every agent who checks you out"
            body="Publish a portfolio website with a Book a Shoot button, then let every listing you deliver advertise you with a property website that credits your photography."
          />
        </>
      ),
    },
    {
      id: "agent-networking",
      title: "Strategies 3–6: Network with agents and brokerages",
      tocLabel: "Agent networking",
      body: () => (
        <>
          <h3>3. Target active listing agents, not all agents</h3>
          <p>
            Many licensed agents list only a few homes a year. A smaller group lists consistently, and those are the
            agents who need a reliable photographer. Look at current listings in your area and the brokerage sites
            that show agent listing counts, and build a short list of active listers to focus on. It&apos;s
            long-standing advice in the real estate photography community; PFRE&apos;s{" "}
            <Ext href="https://photographyforrealestate.net/how-to-connect-with-agent-clients-when-you-are-starting-out-in-real-estate-photography/">
              guide to connecting with agents when starting out
            </Ext>{" "}
            recommends targeting active listing agents and favoring in-person contact over advertising.
          </p>
          <h3>4. Ask for a few minutes at a brokerage office meeting</h3>
          <p>
            Many brokerages hold regular office or sales meetings, and managing brokers are often open to short,
            useful presentations. Ask for a slot, keep it to about five to ten minutes, and teach rather than sell.
            Topics like &quot;how to prepare a home for photos&quot; or &quot;what makes a listing photo work on a
            phone&quot; are genuinely useful to agents. Leave a one-page handout with your work, packages, and contact
            details. PFRE has described this approach in{" "}
            <Ext href="https://photographyforrealestate.net/giving-a-presentation-on-real-estate-photography-to-an-office-of-agents/">
              its post on presenting to an office of agents
            </Ext>
            .
          </p>
          <h3>5. Build relationships with brokerages, not just individual agents</h3>
          <p>
            Managing brokers and team leads influence which vendors agents trust. A brokerage that knows you&apos;re
            reliable may recommend you to new agents, invite you back to train new hires, or mention you when an agent
            asks for a photographer. Treat each brokerage as an account: learn who the active listers are, how they
            prefer to order, and what the office expects from listing media.
          </p>
          <h3>6. Show up where agents already are</h3>
          <p>
            Open houses, local REALTOR&reg; association events, and business networking groups are places where
            agents expect to meet vendors. Don&apos;t pitch at an open house that&apos;s busy with buyers; introduce
            yourself when it&apos;s quiet, compliment something specific about the listing, and leave a card or a
            postcard showing one of your best images.
          </p>
        </>
      ),
    },
    {
      id: "outreach",
      title: "Strategies 7–8: Reach out personally, then follow up",
      tocLabel: "Outreach",
      body: () => (
        <>
          <h3>7. Send short, specific outreach</h3>
          <p>
            Cold outreach to agents gets ignored when it looks like a template. It gets read when it&apos;s obviously
            written for that agent. Reference one of their current listings, offer something concrete, and make it
            easy to say yes. Avoid big promises like &quot;sell your listings faster&quot;; you can&apos;t guarantee
            that, and agents know it.
          </p>
          <Figure caption="Example outreach email. Adapt the details to the agent and your own offer.">
            <DocumentCard eyebrow="Example outreach email" title="Subject: Photos for your listings on Maple Street">
              <p>Hi Jordan,</p>
              <p>
                I saw your new listing at 214 Maple Street. It&apos;s a lovely home, and the backyard looks like it
                would photograph beautifully at golden hour.
              </p>
              <p>
                I&apos;m a local real estate photographer covering the north side of town. I shoot interiors, exteriors,
                and aerials, and I deliver MLS-sized and full-resolution files through one online link, usually by the
                next business day.
              </p>
              <p>
                If you have another listing coming up, I&apos;d be glad to shoot it so you can see the difference for
                yourself. My packages and recent work are here: [link].
              </p>
              <p>
                Thanks,
                <br />
                Alex Rivera
                <br />
                Rivera Listing Media · (555) 010-0100
              </p>
            </DocumentCard>
          </Figure>
          <p>
            Only promise the turnaround you can actually deliver every time. Some photographers offer a discounted or
            free first shoot to new agents; if you do, set clear limits so the first job isn&apos;t a loss you
            can&apos;t sustain.
          </p>
          <h3>8. Follow up with something they can see</h3>
          <p>
            Most outreach needs a follow-up. A week or two later, send a second short note with something visual: a
            before-and-after of a room you shot, or a printed postcard with a single strong image. A postcard showing
            your best image is a long-standing suggestion in the PFRE community because it gets the work in front of
            agents without another email. Two or three thoughtful touches is plenty. After that, move on and revisit
            in a few months.
          </p>
          <Callout tone="tip" title="Track every conversation">
            <p>
              Keep a simple record of which agents you&apos;ve contacted, when, and what they said. Outreach without
              notes turns into accidental repeat pitches. Our guide to{" "}
              <BlogLink slug="real-estate-photography-client-management">real estate photography client management</BlogLink>{" "}
              covers how to organize agent records.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "local-search-social",
      title: "Strategies 9–11: Local search, reviews, and social media",
      tocLabel: "Local search and social",
      body: () => (
        <>
          <h3>9. Set up a Google Business Profile as a service-area business</h3>
          <p>
            When agents or sellers search for a real estate photographer nearby, a Google Business Profile helps you
            show up. You can{" "}
            <Ext href="https://support.google.com/business/answer/2911778">create or claim a profile</Ext> and verify
            it. Because you travel to clients, Google treats you as a service-area business. Its{" "}
            <Ext href="https://support.google.com/business/answer/9157481">service area guidance</Ext> says to remove
            your address if you don&apos;t serve customers there, and lets you list up to 20 service areas by city or
            postal code, ideally within about two hours&apos; drive.
          </p>
          <p>
            Follow Google&apos;s{" "}
            <Ext href="https://support.google.com/business/answer/3038177">guidelines for representing your business</Ext>:
            use your real-world business name without stuffing in keywords, and choose the fewest, most specific
            categories that describe what you do. P.O. boxes and virtual offices aren&apos;t eligible addresses.
          </p>
          <h3>10. Ask for reviews the right way</h3>
          <p>
            Reviews help agents trust a photographer they haven&apos;t worked with. Google&apos;s{" "}
            <Ext href="https://support.google.com/business/answer/3474122">tips for getting more reviews</Ext>{" "}
            recommend sharing a review link or QR code and replying to reviews. The same page is clear that you
            can&apos;t offer incentives for reviews, so no discounts or freebies in exchange. Instead, ask right after a
            smooth delivery, when the agent is happiest, and include the direct link so it takes them a minute.
          </p>
          <h3>11. Use social media to show the work agents care about</h3>
          <p>
            Agents scroll social media like everyone else. Post your best listing images, short aerial or walkthrough
            clips, and small, practical tips like how to stage a kitchen counter for photos. Tag agents and brokerages
            when they&apos;re happy for you to do so, which puts your work in front of their audience too. Consistency
            matters more than volume; a steady stream of strong work keeps you top of mind.
          </p>
          <p>
            Better still, put your photos in the agent&apos;s own feed. When you hand the agent ready-made Just Listed,
            Open House, and Just Sold posts built from your images, they post your work to their audience for you.
          </p>
          <h3>Let every listing advertise you</h3>
          <p>
            A single-property website for each listing gives the agent a polished link to share with buyers, and it can
            carry a &quot;Photography by&quot; credit with your business name. Every buyer, seller, and agent who opens
            that link sees who shot the home. It&apos;s free advertising, placed in front of exactly the people who hire
            real estate photographers.
          </p>
          <Figure caption="Real ShootPortal screens: the property website editor on your side (Modern, Luxury, and Coastal designs), and the finished listing site on a buyer's phone, built automatically from the photos you delivered.">
            <TwoSidedScreens business="property-website-editor" client="phone-property-website" />
          </Figure>
          <p>
            In ShootPortal, property websites are built from the delivered photos and project details, with sections
            for key facts, the gallery, video, floor plans, a virtual tour, open house times, and the agent&apos;s
            contact card. Status updates from Coming Soon to Sold, there&apos;s an unbranded MLS-safe version, and view
            tracking shows the agent how much attention their listing is getting.
          </p>
        </>
      ),
    },
    {
      id: "retention",
      title: "Strategies 12–15: Keep clients and grow with them",
      tocLabel: "Retention and growth",
      body: (ctx) => (
        <>
          <p>
            Strategies 1–11 earn the first booking. Whether there&apos;s a second one depends on everything that
            happens between the agent&apos;s request and the moment the photos go live on the MLS: how fast you
            confirm, how clearly you price, whether the shoot time is settled without five texts, and how easy the
            files are to get. Agents rarely tell you they found that part clumsy. They just book someone else next
            time.
          </p>
          <h3>12. Make the client experience the reason agents stay</h3>
          <p>
            For a busy agent, a great photographer is one who is easy to book, shows up on time, delivers fast, and
            never makes them hunt for files. Turnaround is often what agents notice most, because their listing
            can&apos;t go live without photos. Easy downloads matter just as much: MLS-sized and full-resolution
            versions, single files or everything at once, on a link that works on a phone.
          </p>
          <p>
            A branded client portal brings that together. Instead of a cloud folder link and a separate payment link,
            the agent sees their listings, media, messages, and payment in one place, with no app to install. Our guide on{" "}
            <BlogLink slug="how-to-deliver-real-estate-photos">how to deliver real estate photos</BlogLink> walks
            through delivery options and how to organize them.
          </p>
          <h3>Make the agent look good to their seller</h3>
          <p>
            The agent&apos;s real client is the seller, and sellers judge agents on how hard they market the home. A
            photographer who delivers the photos plus a property website, social posts, and a print flyer is helping
            the agent win their next listing, and agents remember who did that. It&apos;s retention and referrals in
            one, and it can be paid: offer the kit free to your best accounts and sell it as an add-on to everyone else.
          </p>
          <Figure caption="Real ShootPortal screen: the Marketing Kit tab on a listing project, offering the agent a Property Website and Social Media Kit, each set to included or paid. A new revenue stream on work you've already done.">
            <AppScreen view="marketing-kit-tab" />
          </Figure>
          <h3>13. Make rebooking effortless</h3>
          <p>
            Repeat bookings happen when the second job is easier than the first. Remember each agent&apos;s
            preferences: their usual package, whether they want twilight on luxury listings, how they like lockbox
            details shared. Keep that on their client record so you never have to ask twice. A short check-in after
            delivery (&quot;Did the photos work for the launch?&quot;) catches issues early and keeps the conversation
            open.
          </p>
          <h3>14. Ask for referrals inside the office</h3>
          <p>
            Agents talk to each other constantly, especially within a team or brokerage. When an agent tells you
            they&apos;re happy, ask directly if anyone on their team could use a photographer. Serving one member of a
            team well is often the easiest route to the rest of it.
          </p>
          <h3>15. Build systems before volume breaks you</h3>
          <p>
            Every strategy above works, which creates the next problem: more agents, more listings, more messages.
            Without a system, growth shows up as late deliveries, missed details, and unpaid invoices, which quietly
            undoes the reputation that brought the clients in. Keep each agent&apos;s history in one record, track
            every listing by stage, and use consistent emails for confirmations and delivery.
          </p>
          <h3>What a repeat-agent workflow looks like in ShootPortal</h3>
          <p>
            ShootPortal (our product) is built around keeping agents once you&apos;ve won them. Here is how the
            second, tenth, and fiftieth listing for the same agent works:
          </p>
          <ul>
            <li>
              <strong>Booking is the same every time.</strong> The agent requests the next listing from your branded
              request form, picks a package from your service list, and gets an estimate to approve in their portal.
              You propose a shoot time, and they accept it or suggest another.
            </li>
            <li>
              <strong>You remember what they like.</strong> Their client record keeps timestamped notes (usual
              package, lockbox habits, twilight on luxury listings), the full message history, and property history
              by address, so when a home they listed last year comes back, you can see what you shot and what it
              cost.
            </li>
            <li>
              <strong>Delivery is fast and phone-friendly.</strong> Photos download as MLS size or full-resolution
              print files, one at a time or as a ZIP. Share links let a transaction coordinator or co-listing agent
              download without an account.
            </li>
            <li>
              <strong>Payment doesn&apos;t become a conversation.</strong> The agent pays by card, Apple Pay, Google
              Pay, or bank transfer in the same portal, straight to your Stripe account, and downloads can unlock
              automatically once the balance is paid.
            </li>
            <li>
              <strong>Their marketing is ready when the photos are.</strong> The property website and social kit reuse
              the agent&apos;s saved headshot, brokerage logo, and colors, so every listing looks on-brand for them
              without a single extra request.
            </li>
          </ul>
          <p>
            To be clear about what each part does: reminder emails, receipts, and some stage changes happen
            automatically. The client record, messages, files, and payment status are centralized on the agent and
            the listing. The relationship itself (the check-in call, the referral ask, the office presentation) is
            still yours, and now you have more time for it.
          </p>
          <AllInOnePlatform intro="From the website that wins the agent to the marketing kit that keeps them, everything a real estate photography business needs is on one subscription." />
          <Figure caption="Real ShootPortal screen: an agent's view of a listing in the ShootPortal client portal, moving from estimate to shoot, media, payment, and files (sample client data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <p>
            Once agents start sending work, make ordering easy: our{" "}
            <SiteLink href="/photography-booking-software">photography booking software</SiteLink> page shows how a request
            turns into a confirmed shoot.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Win more agents, and give them every reason to rebook"
            body={
              <>
                Publish a portfolio website with a Book a Shoot button, keep each agent&apos;s notes and property history
                on their record, deliver MLS-ready files they can grab from a phone, and hand them a property website
                and social posts that credit your work. Try it on your next listing.
              </>
            }
          />
          <p>
            For a broader look at tools that track clients and leads, see our{" "}
            <BlogLink slug="best-photography-crm-software">photography CRM software comparison</BlogLink>, or see how
            ShootPortal&apos;s workflow fits together on the <SiteLink href="/how-it-works">How it works page</SiteLink>.
          </p>
        </>
      ),
    },
    {
      id: "putting-it-together",
      title: "How to get real estate photography clients: putting the 15 strategies to work",
      tocLabel: "Putting it together",
      body: () => (
        <>
          <p>
            You don&apos;t need to do all 15 at once. A realistic plan for a new or growing real estate photographer is
            to fix the foundations first (#1 and #2), pick two or three acquisition channels you can sustain (for
            example, office presentations, personal outreach, and Google Business Profile), and invest heavily in the
            retention strategies, since they make every other effort pay off longer.
          </p>
          <p>
            Review what&apos;s working every few months. Note where each new agent came from, and keep doing more of
            what brings in agents who rebook. Over time, a business built on repeat agents and referrals is steadier
            than one that depends on constantly finding new clients.
          </p>
          <KeyTakeaways
            items={[
              "Show a portfolio that matches the listings your target agents actually have.",
              "Focus on active listing agents and meet them in person where you can.",
              "Keep outreach short, specific, and free of promises you can't guarantee.",
              "Set up a service-area Google Business Profile and ask for reviews without incentives.",
              "A website with a Book a Shoot button turns interest into first bookings.",
              "Property websites with your credit advertise you to every buyer and agent who views the listing.",
              "Fast, organized delivery, easy rebooking, and marketing that makes agents look good turn first jobs into long-term clients.",
            ]}
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "How do real estate photographers get clients?",
      answerText:
        "Most build a focused portfolio, then meet active listing agents in person through brokerage office meetings, open houses, and local events. Personal outreach, a Google Business Profile, reviews, and referrals from happy agents fill in the rest. Retention through fast, reliable delivery is what turns first bookings into steady work.",
      answer: (
        <p>
          Most build a focused portfolio, then meet active listing agents in person through brokerage office meetings,
          open houses, and local events. Personal outreach, a Google Business Profile, reviews, and referrals fill in
          the rest. Fast, reliable delivery is what turns first bookings into steady work.
        </p>
      ),
    },
    {
      question: "Should I offer a free shoot to get new agents?",
      answerText:
        "Some photographers offer a discounted or free first shoot to let an agent try them with low risk. If you do, set clear limits on what's included and who qualifies, so you aren't taking on unpaid work you can't sustain.",
      answer: (
        <p>
          Some photographers offer a discounted or free first shoot so an agent can try them with low risk. If you do,
          set clear limits on what&apos;s included and who qualifies, so you aren&apos;t taking on unpaid work you
          can&apos;t sustain.
        </p>
      ),
    },
    {
      question: "Can I give discounts in exchange for Google reviews?",
      answerText:
        "No. Google's review guidance says incentives for reviews are prohibited. Instead, share a direct review link or QR code right after a successful delivery and reply to the reviews you receive.",
      answer: (
        <p>
          No. Google&apos;s review guidance says incentives for reviews are prohibited. Instead, share a direct review
          link or QR code right after a successful delivery and reply to the reviews you receive.
        </p>
      ),
    },
    {
      question: "How do I set up Google Business Profile if I work from home?",
      answerText:
        "Set it up as a service-area business. Google's guidance says to remove your address if you don't serve customers there, and you can list up to 20 service areas by city or postal code. P.O. boxes and virtual offices aren't eligible.",
      answer: (
        <p>
          Set it up as a service-area business. Google&apos;s guidance says to remove your address if you don&apos;t
          serve customers there, and you can list up to 20 service areas by city or postal code. P.O. boxes and virtual
          offices aren&apos;t eligible.
        </p>
      ),
    },
    {
      question: "What makes agents keep booking the same photographer?",
      answerText:
        "Reliability, fast turnaround, and easy delivery. Agents rebook photographers who show up on time, deliver MLS-ready and full-resolution files quickly in one place, remember their preferences, make payment simple, and help them market the listing with ready-made posts and a property website.",
      answer: (
        <p>
          Reliability, fast turnaround, and easy delivery. Agents rebook photographers who show up on time, deliver
          MLS-ready and full-resolution files quickly in one place, remember their preferences, make payment simple,
          and help them market the listing with ready-made posts and a property website.
        </p>
      ),
    },
    {
      question: "Do property websites help real estate photographers get more clients?",
      answerText:
        "They can. A property website gives the agent a polished link to share, and an optional Photography by credit shows your business to every buyer, seller, and agent who views it. In ShootPortal, property websites are built from the photos you deliver, and you can include them free or sell them to the agent as an add-on.",
      answer: (
        <p>
          They can. A property website gives the agent a polished link to share, and an optional &quot;Photography
          by&quot; credit shows your business to every buyer, seller, and agent who views it. In ShootPortal, property
          websites are built from the photos you deliver, and you can include them free or sell them to the agent as
          an add-on.
        </p>
      ),
    },
    {
      question: "What should a real estate photography website include?",
      answerText:
        "A focused portfolio of listings like the ones your target agents have, clear packages with starting prices, your service area, testimonials, and an obvious way to book. ShootPortal's website builder includes portfolio, services, testimonials, and a Book a Shoot button that opens a branded request form with an instant estimate.",
      answer: (
        <p>
          A focused portfolio of listings like the ones your target agents have, clear packages with starting prices,
          your service area, testimonials, and an obvious way to book. ShootPortal&apos;s website builder includes
          portfolio, services, testimonials, and a Book a Shoot button that opens a branded request form with an
          instant estimate.
        </p>
      ),
    },
  ],
  related: ["best-photography-crm-software", "real-estate-photography-client-management", "how-to-start-real-estate-photography-business"],
  cta: {
    title: "Win the agent with your website. Keep them with your marketing kit.",
    body: "A portfolio website with Book a Shoot, estimates agents approve online, fast MLS-ready delivery with payment in the same portal, and property websites and social posts that credit your work and make agents look good.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
