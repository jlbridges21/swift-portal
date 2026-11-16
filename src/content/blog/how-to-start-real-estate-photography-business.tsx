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
import { ProjectBoardDiagram, RoadmapDiagram, ServiceMenu } from "@/components/blog/business-diagrams";
import { ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { AllInOnePlatform, ScreenTrio, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "how-to-start-real-estate-photography-business",
  title: "How to Start and Grow a Real Estate Photography Business in 2026",
  seoTitle: "How to Start a Real Estate Photography Business (2026)",
  description:
    "How to start a real estate photography business: equipment, editing, packages, a website, finding agents, delivery, listing marketing, and scaling up.",
  excerpt:
    "From your first wide-angle lens to a team with editors and a second shooter: what to buy, how to shoot and edit listings, how to package your services, how to launch with a website and booking in one weekend, and how to sell listing marketing from day one.",
  category: "real-estate-photography",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  primaryKeyword: "how to start a real estate photography business",
  secondaryKeywords: [
    "real estate photography business",
    "start real estate photography",
    "real estate photography equipment",
    "real estate photography packages",
    "grow a real estate photography business",
    "real estate photography website",
    "real estate marketing kit",
    "property website for listings",
    "photo editing for real estate",
  ],
  readingMinutes: 12,
  cover: {
    variant: "roadmap",
    tint: "rose",
    label: "2026 Roadmap",
    alt: "Illustration of a business roadmap with connected milestones on a rose background",
  },
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Launch the business side in one weekend:</strong> ShootPortal gives you a professional website,
        booking, payments, delivery, photo editing, and listing marketing on one subscription, so you look established
        from your first listing.
      </>,
      <>
        <strong>Start lean on gear:</strong> a camera that brackets, a wide-angle lens, a sturdy tripod, and a
        flash or bracketing workflow cover most listings.
      </>,
      <>
        <strong>Consistency is the product.</strong> Straight verticals, bright natural interiors, and the same look
        on every listing are what agents pay for.
      </>,
      <>
        <strong>Package your services</strong> into a few clear tiers with add-ons like drone, twilight, video, floor
        plans, and a listing marketing kit (property website, social posts, and flyers) you can sell to agents.
      </>,
      <>
        <strong>Win agents in person, keep them with service.</strong> Fast turnaround, easy delivery, and marketing
        that makes the agent look good drive repeat bookings.
      </>,
      <>
        <strong>Systematize early.</strong> Scheduling, payment, delivery, and team access are what limit growth, not
        your camera.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Real estate photography is one of the more accessible ways to build a photography business. The work is
        local, the demand is recurring, and your clients, listing agents, need the same service again every time they
        take a new listing. That&apos;s the appeal. The challenge is that it&apos;s a volume business with tight
        deadlines, so the photographers who do well are the ones who combine reliable images with reliable
        operations.
      </p>
      <p>
        This guide covers <strong>how to start a real estate photography business</strong> and grow it: the equipment
        that matters, the shooting and editing techniques agents expect, how to build packages, how to find and keep
        agents, and how to run the business once you&apos;re busy enough to need help. If you plan to offer aerials,
        our separate guide on{" "}
        <BlogLink slug="how-to-start-drone-photography-business">starting a drone photography business</BlogLink>{" "}
        covers FAA Part 107 and drone-specific setup.
      </p>
      <p>
        The good news for a new business: the operations side no longer takes months to assemble. With ShootPortal you
        can launch with a professional website, a Book a Shoot form, online payments, branded delivery, a built-in photo
        editor, and listing marketing in one weekend, and agents get one simple link for every listing, with nothing to
        install.
      </p>
    </>
  ),
  sections: [
    {
      id: "opportunity",
      title: "The opportunity: why agents pay for listing photography",
      tocLabel: "The opportunity",
      body: () => (
        <>
          <p>
            Listing photos are usually the first thing a buyer sees, and much of that viewing happens on a phone. In
            NAR&apos;s{" "}
            <Ext href="https://www.nar.realtor/sites/default/files/2024-11/2024-profile-of-home-buyers-and-sellers-highlights-11-04-2024_2.pdf">
              2024 Profile of Home Buyers and Sellers highlights
            </Ext>
            , photos topped the list of website features buyers found useful: 41 percent rated them very useful, ahead of
            detailed property information at 39 percent. Agents know this, and many treat professional photography as a
            standard part of marketing a listing.
          </p>
          <p>
            For a photographer, that creates a business with a few distinct traits:
          </p>
          <ul>
            <li>
              <strong>Recurring clients.</strong> An active listing agent needs photos for every new listing, so one
              relationship can produce steady work.
            </li>
            <li>
              <strong>Short, repeatable shoots.</strong> Most residential jobs follow a similar pattern, which rewards a
              consistent process.
            </li>
            <li>
              <strong>Tight turnaround.</strong> Agents want listings live quickly, so delivery speed is part of the
              product.
            </li>
            <li>
              <strong>Room to add services.</strong> Aerials, video, twilight, floor plans, and 3D tours let you grow
              revenue per listing.
            </li>
            <li>
              <strong>A second product after delivery.</strong> Agents still have to market the listing. A property
              website, Just Listed posts, and a flyer built from your photos are something you can sell them on every
              job.
            </li>
          </ul>
          <p>
            Order data from marketplace HomeJab shows how agents&apos; buying habits shift. Its{" "}
            <Ext href="https://homejab.com/top-real-estate-photography-services-of-2025/">October 2025 review</Ext>{" "}
            reported video walkthroughs at nearly 17% of orders on average in 2025 and aerials at 13–16%, so add-ons
            are worth planning for even if you start with stills only.
          </p>
        </>
      ),
    },
    {
      id: "equipment",
      title: "Equipment: what you actually need to start",
      tocLabel: "Equipment",
      body: () => (
        <>
          <p>
            You don&apos;t need the most expensive kit to shoot listings well. You need gear that handles wide
            interiors, high-contrast light, and a long day of setups without slowing you down.
          </p>
          <ul>
            <li>
              <strong>Camera.</strong> Any interchangeable-lens camera that shoots RAW and offers automatic exposure
              bracketing. Good dynamic range helps with bright windows. Full-frame isn&apos;t required to start.
            </li>
            <li>
              <strong>Wide-angle lens.</strong> The most important purchase. You want a lens wide enough for small
              rooms without heavy distortion; a rectilinear ultra-wide zoom is the usual choice.
            </li>
            <li>
              <strong>Tripod.</strong> Sturdy enough for bracketed exposures to align perfectly, with a head that makes
              leveling quick. A bubble level or the camera&apos;s electronic level keeps verticals straight.
            </li>
            <li>
              <strong>Lighting.</strong> At least one speedlight with a wireless trigger if you plan to use flash.
              Many photographers start with bracketing only and add flash as their editing style develops.
            </li>
            <li>
              <strong>Software and storage.</strong> A RAW editor that handles HDR merges, a computer that can process a
              day&apos;s shoots quickly, and a backup system for client files.
            </li>
          </ul>
          <p>
            Add a drone, a video stabilizer, or a 3D capture camera only when you&apos;re ready to sell those services.
            Buying ahead of demand ties up cash that&apos;s better spent on marketing in the first months.
          </p>
        </>
      ),
    },
    {
      id: "techniques-editing",
      title: "Shooting techniques and editing workflow",
      tocLabel: "Techniques and editing",
      body: () => (
        <>
          <h3>Core shooting techniques</h3>
          <ul>
            <li>
              <strong>Straight verticals.</strong> Keep the camera level and walls vertical. Converging lines are the
              most common tell of amateur real estate photography.
            </li>
            <li>
              <strong>Camera height.</strong> Shooting from roughly chest height or a little lower usually shows
              furniture and floor space naturally. Very high angles make rooms feel cramped.
            </li>
            <li>
              <strong>Composition.</strong> Shoot into corners to show depth, include a sense of flow between rooms, and
              avoid shooting straight at a flat wall. Clear clutter or ask the agent to have it cleared before you
              arrive.
            </li>
            <li>
              <strong>Window views.</strong> Agents and sellers notice whether the view outside a window is visible or
              blown out. This is where your lighting approach matters.
            </li>
          </ul>
          <h3>Bracketing and HDR vs. flash</h3>
          <p>
            There are two broad approaches to the high contrast between bright windows and darker interiors.
            Bracketing captures several exposures and blends them into one image (HDR or exposure fusion). It&apos;s
            fast on site and simple to learn, but colors can drift and results need careful editing. Flash adds light
            to the room so a window and the interior can be captured more evenly, which tends to give cleaner color
            and crisper results but takes more time and skill on site. Many photographers use a hybrid: brackets for
            the base, plus a flash frame for color and clarity.
          </p>
          <h3>Twilight</h3>
          <p>
            Twilight exteriors, shot just after sunset with interior lights on, are a popular premium add-on. Real
            twilight shoots require scheduling around sunset; virtual twilight edits a daytime photo instead. Offer
            whichever you can deliver consistently.
          </p>
          <h3>Editing: in-house or outsourced</h3>
          <p>
            Editing is often where real estate photographers lose the most time. Doing it yourself gives you full
            control over the look; outsourcing frees your evenings but adds a per-image cost and a review step.
          </p>
          <ComparisonTable
            caption="In-house editing versus outsourced editing for real estate photography"
            columns={["Factor", "Edit in-house", "Outsource editing"]}
            rows={[
              ["Control over style", "Full control", "Depends on clear instructions and review"],
              ["Your time", "Evenings and weekends go to editing", "Frees time for shooting and sales"],
              ["Cost", "Your time plus software", "A per-image or per-set fee"],
              ["Turnaround", "Depends on your schedule", "Depends on the editor's queue and time zone"],
              ["Best for", "Starting out; low volume; learning your style", "Higher volume; consistent style already defined"],
            ]}
            note="Many photographers edit in-house while they develop a consistent style, then outsource once volume grows and they can write clear editing instructions."
          />
          <ProductCallout title="Finish edits where the listing already lives">
            <p>
              However you produce your base images, ShootPortal&apos;s built-in photo editor handles the finishing pass
              on uploaded JPEGs: one-click Auto, exposure, highlights and shadows, white balance, curves, HDR and B&amp;W
              looks, spot healing, and lens corrections. Copy one photo&apos;s adjustments to the rest of the set, then
              Save to Project and the gallery and downloads update instantly. Originals are never overwritten.
            </p>
          </ProductCallout>
          <FreeResourceCallout resource="real-estate-photography-shot-list" />
        </>
      ),
    },
    {
      id: "portfolio-packages",
      title: "Portfolio, packages, and pricing",
      tocLabel: "Portfolio and packages",
      body: (ctx) => (
        <>
          <h3>Build your first portfolio</h3>
          <p>
            Before your first paying job, photograph homes you can access: your own, friends&apos; and family&apos;s, a
            rental between tenants, or a listing for a new agent who agrees to let you shoot it. Aim for 20 to 30 strong
            images that show bright interiors, straight lines, attractive exteriors, and a consistent edit. Shoot homes
            similar to the ones your target agents list.
          </p>
          <h3>Put it on a real estate photography website</h3>
          <p>
            Agents will look you up before they reply. A website with your portfolio, your packages, and a clear Book a
            Shoot button turns that look into a request. In ShootPortal, the website builder is part of the same plan:
            pick a Modern, Luxury, or Minimal template, add portfolio projects and featured services, and publish on your
            own domain. Book a Shoot opens your branded request form, which creates the agent&apos;s account and the
            project and shows them a preliminary estimate the moment they submit.
          </p>
          <h3>Package your services</h3>
          <p>
            Agents book faster when choices are simple. Most real estate photographers offer two or three core packages
            based on photo count or home size, with add-ons for extras. Keep names clear, and make it obvious what&apos;s
            included.
          </p>
          <Figure caption="Example package menu. Example numbers — not market rates. Set your own prices from your costs and local market.">
            <ServiceMenu
              packages={[
                {
                  name: "Essentials",
                  price: "$150",
                  blurb: "Smaller homes and condos",
                  includes: ["Up to 20 edited photos", "Interiors and exteriors", "MLS and full-resolution files", "Next-day delivery"],
                },
                {
                  name: "Signature",
                  price: "$250",
                  blurb: "Most single-family listings",
                  includes: ["Up to 35 edited photos", "Flash-assisted interiors", "Two aerial photos", "Next-day delivery"],
                  highlight: true,
                },
                {
                  name: "Premier",
                  price: "$400",
                  blurb: "Larger and luxury homes",
                  includes: ["Up to 50 edited photos", "Aerial photos and short clip", "One twilight image", "Priority scheduling"],
                },
              ]}
              addons={[
                { name: "Aerial photo set", price: "$100" },
                { name: "Real twilight shoot", price: "$150" },
                { name: "Listing video", price: "$250" },
                { name: "Floor plan", price: "$75" },
                { name: "Property website", price: "$49" },
                { name: "Social media kit", price: "$29" },
              ]}
            />
          </Figure>
          <p>
            For real price ranges, Thumbtack&apos;s{" "}
            <Ext href="https://www.thumbtack.com/p/real-estate-photography-prices">real estate photography pricing page</Ext>{" "}
            puts the average single-property total at about $286 (2025 page), but local markets vary widely. Our{" "}
            <BlogLink slug="real-estate-photography-pricing-guide">real estate photography pricing guide</BlogLink>{" "}
            compares published sources and walks through building prices from your own costs.
          </p>
          <FreeResourceCallout tool="real-estate-pricing" />
          <h3>Sell listing marketing from day one</h3>
          <p>
            Most new photographers stop at the photos. Offering the marketing that uses them is an easy upsell, and it
            costs you almost no extra time when the software builds it for you. In ShootPortal, every delivered listing
            can come with a single-property website (Modern, Luxury, or Coastal design, with status from Coming Soon to
            Sold) and a social media kit: five square posts such as Just Listed and Open House, three Stories, an
            Instagram carousel, and a print-ready flyer with a QR code to the property site.
          </p>
          <Figure caption="Real ShootPortal screens: the Social Media Kit, a print-ready flyer, and the property website, all generated from the listing photos you delivered. Include them free or sell them to the agent as an add-on.">
            <ScreenTrio views={["social-kit", "listing-flyer", "property-website"]} />
          </Figure>
          <p>
            You decide whether each product is included or paid (the defaults are $49 for the website and $29 for the
            social kit, and you can set a bundle or change prices per project). The agent sees a preview, adds it to
            the cart, and pays through your own Stripe account, or it goes on the invoice. Their headshot, brokerage
            logo, and colors are saved and reused on the next listing, and an optional &quot;Photography by&quot;
            credit on the site advertises your business to every buyer who views it.
          </p>
          <InlineCta
            trialDays={ctx.trialDays}
            title="Launch your listing business this weekend"
            body="Publish your website, load your packages, connect Stripe, and turn on the marketing kit so your first agent sees a real business, and a reason to book you again."
          />
        </>
      ),
    },
    {
      id: "agents-relationships",
      title: "Finding agents and building client relationships",
      tocLabel: "Finding agents",
      body: () => (
        <>
          <p>
            Your first clients will most likely come from direct contact with active listing agents: brokerage office
            meetings, open houses, personal outreach that references their listings, and referrals from agents
            you&apos;ve already served. A Google Business Profile set up as a service-area business helps agents find
            you when they search locally. We cover all of this in depth, including an example outreach email, in our
            guide on{" "}
            <BlogLink slug="how-to-get-real-estate-photography-clients">how to get real estate photography clients</BlogLink>.
          </p>
          <p>
            Once an agent books you, the relationship is about reliability. Show up on time, communicate before the
            shoot about access and preparation, and deliver when you said you would. Keep notes on each agent&apos;s
            preferences: favorite package, how they share lockbox codes, whether they want twilight on certain
            listings. Small details remembered without asking are what make agents feel looked after.
          </p>
          <Callout tone="tip" title="Send a prep checklist before every shoot">
            <p>
              A short checklist for the agent or seller (lights on, counters cleared, cars out of the driveway, pets
              secured) improves your photos and shows you&apos;re organized before you arrive.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "operations",
      title: "Scheduling, invoicing, and media delivery",
      tocLabel: "Scheduling, invoicing, delivery",
      body: () => (
        <>
          <p>
            Every listing goes through the same sequence: a request comes in, you confirm the details and price,
            schedule the shoot, edit, collect payment, and deliver. The more consistent that sequence is, the more
            listings you can handle.
          </p>
          <Figure caption="Conceptual diagram: listing projects moving through each stage of the business, from new request to delivered (fictional jobs).">
            <ProjectBoardDiagram />
          </Figure>
          <h3>Scheduling</h3>
          <p>
            Collect everything you need with the request: address, home size, occupied or vacant, access method,
            package, and preferred dates. Confirm in writing and put every shoot on the calendar you actually check.
            Plan routes so you&apos;re not crossing town between back-to-back shoots.
          </p>
          <Figure caption="Real ShootPortal screens: the scheduled listing on your side, and the proposed shoot time in the agent's portal with Approve Time and Request a Different Time. One click confirms it, and the shoot pushes to your Google Calendar.">
            <TwoSidedScreens business="project-scheduled" client="portal-shoot-time" />
          </Figure>
          <h3>Invoicing and payment</h3>
          <p>
            Decide your payment policy before your first job: pay at booking, pay before download, or invoice on terms
            for established agents. Online payment removes most of the chasing, especially when downloads unlock
            automatically once the agent pays. Our guide on{" "}
            <BlogLink slug="get-paid-before-delivering-real-estate-photos">getting paid before delivering</BlogLink>{" "}
            covers the options and how to word them.
          </p>
          <h3>Media delivery</h3>
          <p>
            Agents need MLS-sized files for the listing and full-resolution files for print, delivered quickly through
            a link that works on a phone. A shared folder can work at the start, but a dedicated delivery page or client
            portal looks more professional and keeps every listing organized. Our guide on{" "}
            <BlogLink slug="how-to-deliver-real-estate-photos">how to deliver real estate photos</BlogLink> compares the
            methods step by step.
          </p>
        </>
      ),
    },
    {
      id: "scaling",
      title: "Scaling: second shooters, editors, and systems",
      tocLabel: "Scaling operations",
      body: () => (
        <>
          <p>
            At some point, you&apos;ll hit the ceiling of what one person can shoot and edit. The usual path past that
            ceiling looks something like this:
          </p>
          <Figure caption="Illustrative roadmap for growing a real estate photography business. Phases and timing vary; not a forecast of results.">
            <RoadmapDiagram
              phases={[
                {
                  title: "Launch",
                  when: "Starting out",
                  items: ["Core kit and editing workflow", "Portfolio of 20–30 images", "Two or three packages", "First agent clients"],
                },
                {
                  title: "Establish",
                  when: "Steady bookings",
                  items: ["Consistent next-day delivery", "Online payment and delivery", "Google Business Profile and reviews", "Add drone or video"],
                },
                {
                  title: "Delegate",
                  when: "Booked solid",
                  items: ["Outsource editing", "Document your shooting style", "Templates for every client email", "Raise prices"],
                },
                {
                  title: "Scale",
                  when: "Team",
                  items: ["Second shooter for overflow", "Staff with limited access", "Job assignments by project", "Review margins per package"],
                },
              ]}
            />
          </Figure>
          <h3>Adding a second shooter</h3>
          <p>
            A second photographer only works if your style is documented: a shot list per package, camera settings,
            composition rules, and an editing guide. Without that, consistency suffers, and consistency is what agents
            hired you for.
          </p>
          <h3>Editors and staff permissions</h3>
          <p>
            As people join, decide what each person can see and do. An editor needs access to the media for their
            assigned listings, not your client list or revenue. A second shooter needs schedules and access notes, not
            payment settings. Give everyone access only to the jobs and tools they need. In ShootPortal, staff accounts
            are unlimited, with about 25 granular permissions and presets such as Editor, Coordinator, and Full access
            except money.
          </p>
          <h3>Automate the routine hand-offs</h3>
          <p>
            Confirmations, payment requests, receipts, and delivery notifications follow the same rules on every
            listing, so they are good candidates for automation. Our guide to{" "}
            <BlogLink slug="real-estate-photography-automation">real estate photography automation</BlogLink> covers
            what to automate in a listing business and what to keep personal.
          </p>
        </>
      ),
    },
    {
      id: "software",
      title: "How to start a real estate photography business on one system",
      tocLabel: "Software and workflow",
      body: (ctx) => (
        <>
          <p>
            Most new real estate photographers start with a calendar, a cloud folder, and a payment app. That works for
            a handful of listings a week. Beyond that, the cracks appear: booking details buried in texts, delivered
            listings that weren&apos;t paid, no single view of where every job stands. Our comparison of{" "}
            <BlogLink slug="best-real-estate-photography-software">real estate photography software</BlogLink> covers
            the main platforms and how they charge, including per-listing and subscription models.
          </p>
          <h3>Professional from the first listing</h3>
          <p>
            Agents judge a new photographer on the whole experience, not only the photos. When the booking
            confirmation, the price, the shoot time, the payment link, and the download page all come from different
            places, you look like someone getting started, even if your images are excellent. When they come from one
            place with your name on it, you look like an established business on day one. It&apos;s also much easier to
            set up a single workflow at two listings a week than to migrate one at fifteen.
          </p>
          <p>
            ShootPortal (our product) was built for exactly that, around the workflow in this guide. Every listing is
            one project, and the request, estimate, shoot time, messages, edits, files, payment status, and listing
            marketing all live on it, so you answer an agent&apos;s &quot;where are we?&quot; by opening one page:
          </p>
          <ul>
            <li>
              <strong>Website.</strong> A professional site with your portfolio, services, testimonials, and a Book a
              Shoot button, on your own domain.
            </li>
            <li>
              <strong>Requests and estimates.</strong> Agents request shoots from your branded form and pick a package
              from your service catalog. ShootPortal can generate a preliminary estimate with a ZIP-distance travel
              fee, and you send official estimates (with versions, expiry dates, and a PDF) for custom work.
            </li>
            <li>
              <strong>Scheduling.</strong> You propose a shoot time, and the agent accepts or counter-proposes in their
              portal. Shoots push to your Google Calendar.
            </li>
            <li>
              <strong>Editing and review.</strong> A built-in photo editor for finishing passes, and video review with
              time-stamped comments and numbered versions, so you don&apos;t need Dropbox Replay or Frame.io for
              listing films.
            </li>
            <li>
              <strong>Payments.</strong> Deposits on approval or pay in full, by card, Apple Pay, Google Pay, or bank
              transfer straight to your own Stripe account, with email receipts. ShootPortal takes 0% of payments, and
              downloads can unlock automatically once the agent pays.
            </li>
            <li>
              <strong>Delivery.</strong> MLS-sized or full-resolution files, single or ZIP, plus video, 360 tours, and
              3D embeds, in a portal with your logo, colors, and your own domain if you add one.
            </li>
            <li>
              <strong>Listing marketing.</strong> A property website and social media kit for every listing, included
              free or sold to the agent as an add-on.
            </li>
            <li>
              <strong>Growing a team.</strong> Staff accounts have granular permissions and can be assigned to specific
              projects, which suits a second shooter or editor.
            </li>
          </ul>
          <AllInOnePlatform intro="Everything a new real estate photography business needs, from the website that wins the first agent to the marketing kit that keeps them, on one subscription." />
          <p>
            For the agent, it&apos;s simple: one branded link per listing to approve the shoot time, pay, download MLS or
            print sizes, and grab their marketing, with no app and no password to remember. For you, it&apos;s fewer
            texts, faster payment, and a business that looks established from the first job.{" "}
            {ctx.studioMonthly ? (
              <>
                The Studio plan is one plan with every feature, {ctx.studioMonthly}/month
                {ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}, with no per-listing fees and
                Stripe&apos;s standard processing fees on client payments.
              </>
            ) : (
              <>
                See <SiteLink href="/pricing">current pricing</SiteLink>.
              </>
            )}
          </p>
          <p>
            When you&apos;re ready to put the business side in one place, our{" "}
            <SiteLink href="/photography-business-management-software">photography business management software</SiteLink> page
            shows how requests, payments, and delivery fit together.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Launch with the systems most photographers add in year two"
            body={
              <>
                The guided setup walks you through your logo and colors, a starter service menu, and connecting Stripe.
                Publish your website, then run your next portfolio shoot through it as a real listing, from request to
                download to a ready-made property website.
              </>
            }
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
          <p>
            See the full request-to-delivery flow on our <SiteLink href="/how-it-works">How it works page</SiteLink>.
          </p>
          <KeyTakeaways
            items={[
              "A bracketing camera, a wide-angle lens, a solid tripod, and a flash cover most listings.",
              "Straight verticals, natural light, and a consistent edit are what agents pay for.",
              "Offer two or three clear packages plus add-ons; price from your costs and local market.",
              "Win agents in person, then keep them with reliable, fast, organized delivery.",
              "Launch with a website and sell listing marketing from day one; it makes agents look good and adds revenue per listing.",
              "Document your style and set up permissions before adding shooters or editors.",
            ]}
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "How do I start a real estate photography business with no experience?",
      answerText:
        "Learn the core techniques first: straight verticals, bracketing or flash, and composition. Practice on homes you can access, build a portfolio of 20 to 30 strong images, set up two or three simple packages, and then approach active listing agents in person and through personal outreach.",
      answer: (
        <p>
          Learn the core techniques first: straight verticals, bracketing or flash, and composition. Practice on homes
          you can access, build a portfolio of 20 to 30 strong images, set up two or three simple packages, and then
          approach active listing agents in person and through personal outreach.
        </p>
      ),
    },
    {
      question: "What equipment do I need for real estate photography?",
      answerText:
        "A camera that shoots RAW with automatic exposure bracketing, a wide-angle rectilinear lens, a sturdy tripod, and optionally a speedlight with a wireless trigger. Add editing software, a reliable computer, and backup storage. A drone, video gear, or 3D camera can wait until you sell those services.",
      answer: (
        <p>
          A camera that shoots RAW with automatic exposure bracketing, a wide-angle rectilinear lens, a sturdy tripod,
          and optionally a speedlight with a wireless trigger. Add editing software, a reliable computer, and backup
          storage. A drone, video gear, or 3D camera can wait until you sell those services.
        </p>
      ),
    },
    {
      question: "Should I use HDR or flash for real estate photos?",
      answerText:
        "Both work. Bracketing and HDR is faster on site and easier to learn. Flash usually gives cleaner color and crisper images but takes more time and skill. Many photographers use a hybrid of bracketed exposures plus a flash frame.",
      answer: (
        <p>
          Both work. Bracketing and HDR is faster on site and easier to learn. Flash usually gives cleaner color and
          crisper images but takes more time and skill. Many photographers use a hybrid of bracketed exposures plus a
          flash frame.
        </p>
      ),
    },
    {
      question: "Do I need a drone license to offer aerial real estate photos?",
      answerText:
        "In the US, flying a drone for business requires an FAA Part 107 Remote Pilot Certificate, and every drone flown under Part 107 must be registered. See our guide to starting a drone photography business for the full process.",
      answer: (
        <p>
          In the US, flying a drone for business requires an FAA Part 107 Remote Pilot Certificate, and every drone
          flown under Part 107 must be registered. See our guide to{" "}
          <BlogLink slug="how-to-start-drone-photography-business">starting a drone photography business</BlogLink> for
          the full process.
        </p>
      ),
    },
    {
      question: "When should I outsource editing?",
      answerText:
        "Many photographers edit in-house while they develop a consistent style, then outsource once they're booked enough that editing limits how many shoots they can take, and once they can write clear editing instructions.",
      answer: (
        <p>
          Many photographers edit in-house while they develop a consistent style, then outsource once editing limits
          how many shoots they can take, and once they can write clear editing instructions.
        </p>
      ),
    },
    {
      question: "Do I need a website to start a real estate photography business?",
      answerText:
        "Yes. Agents look you up before they reply, so you need a site with your portfolio, packages, and an easy way to book. ShootPortal includes a business website builder with portfolio, services, and a Book a Shoot button that feeds your branded request form, on your own domain, in the same plan as booking, payments, and delivery.",
      answer: (
        <p>
          Yes. Agents look you up before they reply, so you need a site with your portfolio, packages, and an easy way
          to book. ShootPortal includes a business website builder with portfolio, services, and a Book a Shoot button
          that feeds your branded request form, on your own domain, in the same plan as booking, payments, and
          delivery.
        </p>
      ),
    },
    {
      question: "Can real estate photographers sell property websites and social media posts to agents?",
      answerText:
        "Yes. In ShootPortal, each delivered listing can come with a property website and a social media kit (Just Listed and Open House posts, Stories, an Instagram carousel, and a print flyer) built from your photos. You choose whether each is included free or paid, the agent pays through your Stripe or adds it to the invoice, and an optional Photography by credit advertises your business.",
      answer: (
        <p>
          Yes. In ShootPortal, each delivered listing can come with a property website and a social media kit (Just
          Listed and Open House posts, Stories, an Instagram carousel, and a print flyer) built from your photos. You
          choose whether each is included free or paid, the agent pays through your Stripe or adds it to the invoice,
          and an optional &quot;Photography by&quot; credit advertises your business.
        </p>
      ),
    },
  ],
  related: ["best-real-estate-photography-software", "how-to-get-real-estate-photography-clients", "real-estate-photography-pricing-guide"],
  cta: {
    title: "Launch your real estate photography business in one weekend",
    body: "A professional website, agent booking, estimates, scheduling, photo editing, payments, MLS-ready delivery, and a listing marketing kit you can sell, on one project per listing under your own brand.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
