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
import { SampleEstimate, ServiceMenu } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { ProductCallout, TrialCard } from "@/components/blog/conversion-parts";

const THUMBTACK_RE = "https://www.thumbtack.com/p/real-estate-photography-prices";
const THUMBTACK_PHOTO = "https://www.thumbtack.com/p/photographer-prices";
const HOMEGUIDE_SELL = "https://homeguide.com/costs/cost-to-sell-a-house";
const NAR_HOMEJAB =
  "https://www.nar.realtor/magazine/real-estate-news/technology/real-estate-pros-up-spending-on-photos-videos";
const HOMEJAB_2025 = "https://homejab.com/top-real-estate-photography-services-of-2025/";
const PFRE_COMMERCIAL = "https://photographyforrealestate.net/commercial-real-estate-photography-pricing/";
const PFRE_VIDEO = "https://photographyforrealestate.net/what-can-you-charge-for-real-estate-video/";

export const article: BlogArticle = {
  slug: "real-estate-photography-pricing-guide",
  title: "Real Estate Photography Pricing Guide 2026: What to Charge for Photos, Video, and Drone Services",
  seoTitle: "Real Estate Photography Pricing Guide 2026",
  description:
    "Real estate photography pricing for 2026: sourced price ranges, square-footage tiers, good-better-best packages, add-ons, travel fees, and when to raise rates.",
  excerpt:
    "Most listing photographers price by copying the competition. This guide covers what agents actually pay and order, then shows how to build packages and add-ons that are profitable on every listing.",
  category: "pricing-payments",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "real estate photography pricing",
  secondaryKeywords: [
    "real estate photography rates",
    "real estate photography packages",
    "how much to charge for real estate photography",
    "real estate photography price list",
  ],
  readingMinutes: 14,
  cover: {
    variant: "pricetag",
    tint: "indigo",
    label: "Pricing Guide",
    alt: "Illustration of a price tag beside a house on an indigo background",
  },
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Published figures mostly fall between about $150 and $310 per listing shoot.</strong> Thumbtack&apos;s 2025 guides
        report $286–$305 on average, HomeGuide (2024) says $150–$300, and older HomeJab data (2017–2021) averaged
        $229.
      </>,
      <>
        <strong>Price base packages by square footage</strong> so a small condo and a large home don&apos;t cost the
        same, and keep the photo count tied to the tier.
      </>,
      <>
        <strong>Use three packages plus add-ons.</strong> Drone, video, 3D tours, twilight, and floor plans are where
        the margin is, and agents increasingly order them.
      </>,
      <>
        <strong>For add-ons without reliable public prices</strong> (twilight, floor plans, virtual staging, residential
        3D tours), price from your time and vendor costs plus margin.
      </>,
      <>
        <strong>Your market decides the final number.</strong> Location, listing prices, competition, and your own
        costs matter more than any national figure.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Real estate photography has a pricing problem that other niches don&apos;t: the client is a repeat buyer who
        orders the same thing dozens of times a year and remembers exactly what they paid last time. That makes
        agents price-sensitive, but it also makes them loyal once a photographer is reliable, fast, and easy to book.
        Your pricing has to work for both sides of that relationship.
      </p>
      <p>
        This guide is for photographers selling to listing agents. It covers what published data says about{" "}
        <strong>real estate photography pricing</strong> (and how old that data is), how to structure packages by
        square footage or photo count, what to charge for drone, video, and 3D add-ons, and how to make sure each
        package is profitable once editing and driving are counted. If drone work is your main business rather than an
        add-on, the companion{" "}
        <BlogLink slug="drone-photography-pricing-guide">drone photography pricing guide</BlogLink> covers commercial,
        inspection, and mapping rates in more depth.
      </p>
      <Callout tone="note" title="About the numbers">
        <p>
          Market figures link to their source with the publisher and date. Thumbtack and HomeGuide are consumer cost
          guides that reflect what customers report paying. HomeJab is a photography marketplace reporting its own
          order data. PFRE is an industry blog whose figures are the author&apos;s examples, not a survey. Example
          package prices in this article are illustrative, not market rates. Actual pricing depends on your market,
          scope, location, and costs.
        </p>
      </Callout>
    </>
  ),
  sections: [
    {
      id: "what-agents-pay",
      title: "What real estate photography costs: published averages",
      tocLabel: "Published averages",
      body: () => (
        <>
          <p>
            No current national survey of real estate photography prices turned up in our research. What exists is a
            few consumer guides and some marketplace data, collected below with their dates.
          </p>
          <ComparisonTable
            caption="Published real estate photography price data by source"
            columns={["Measure", "Figure", "Source, date, and type"]}
            rows={[
              [
                "Average shoot total",
                "$305 (typical $236–$394)",
                <span key="r1">
                  <Ext href={THUMBTACK_PHOTO}>Thumbtack photography prices</Ext>, 2025 edition (last updated Jan. 22).
                  Consumer guide.
                </span>,
              ],
              [
                "Average total, 1 property",
                "$286",
                <span key="r2">
                  <Ext href={THUMBTACK_RE}>Thumbtack real estate photography</Ext>, 2025 edition (last updated Aug. 12).
                  Consumer guide.
                </span>,
              ],
              [
                "Hourly rate",
                "Avg. $150/hr (typical $123–$272/hr)",
                <span key="r3">
                  <Ext href={THUMBTACK_RE}>Thumbtack real estate photography</Ext>, 2025 edition. Consumer guide.
                </span>,
              ],
              [
                "Typical cost to a FSBO seller",
                "$150–$300",
                <span key="r4">
                  <Ext href={HOMEGUIDE_SELL}>HomeGuide cost-to-sell guide</Ext>, Mar. 15, 2024. Consumer guide.
                </span>,
              ],
              [
                "Average order value",
                "$229 national; $279 in the West",
                <span key="r5">
                  HomeJab analysis of 43,000+ orders from 2017–2021, reported by{" "}
                  <Ext href={NAR_HOMEJAB}>NAR</Ext> (Mar. 21, 2022). Marketplace data; dated.
                </span>,
              ],
              [
                "Commercial real estate",
                "About $250 to $15,000+",
                <span key="r6">
                  <Ext href={PFRE_COMMERCIAL}>PFRE</Ext>, Oct. 3, 2021. Industry blog, author examples; dated.
                </span>,
              ],
            ]}
            note="Checked October 15, 2026. Thumbtack pages show a month and day without a year; their titles say 2025. HomeJab's figures predate 2022 and are now dated. None of these is a survey of your local market."
          />
          <h3>Reading the conflicts</h3>
          <p>
            These figures don&apos;t contradict each other so much as measure different things. Thumbtack&apos;s
            averages come from its marketplace customers. HomeGuide&apos;s range is aimed at sellers listing without an
            agent. HomeJab&apos;s $229 reflects one company&apos;s orders across five years that ended in 2021. Taken
            together, they suggest that a basic residential listing shoot has commonly sold in the low-to-mid hundreds
            of dollars. Your market, home sizes, and add-on mix will move you up or down from there. Thumbtack also notes
            that a long residential shoot of about five hours might run $500–$600, which is a reminder that time on
            site drives price as much as anything.
          </p>
        </>
      ),
    },
    {
      id: "pricing-structures",
      title: "Real estate photography pricing structures",
      tocLabel: "Pricing structures",
      body: () => (
        <>
          <h3>Per shoot (flat rate)</h3>
          <p>
            One price per listing is simple, and agents like simple. It breaks down when home sizes vary widely: you
            lose money on large homes and overcharge for small condos. Flat pricing works if your market is fairly
            uniform or if you cap the photo count.
          </p>
          <h3>By square footage tiers</h3>
          <p>
            Square-footage tiers are the most common fix. The size of the home drives shoot time, photo count, and
            editing time, so the price follows the work. Thumbtack&apos;s guide shows one pro using three tiers: under
            1,000 sq ft for $200, 1,000–1,999 sq ft for $250, and 2,000+ sq ft for $350. Treat that as one
            photographer&apos;s example of the structure, not a benchmark. Keep the tiers few and the bands wide enough
            that agents can work out the price without measuring.
          </p>
          <h3>By photo count</h3>
          <p>
            Some photographers sell a set number of images. The same Thumbtack page shows one pro charging $130 for 13
            photos, $165 for 25, and $195 for 40. Photo-count pricing is transparent, but it can push agents toward the
            smallest package and invites arguments over which rooms make the cut. It works best combined with square
            footage, where each tier includes a set number of photos.
          </p>
          <h3>Packages</h3>
          <p>
            Packages bundle photos with the add-ons agents order most, at a better price than ordering them one by one.
            They raise the average order and make the decision easier. A common setup is a square-footage-tiered base package plus a short list of bundles and add-ons. The next section covers
            how to build one.
          </p>
        </>
      ),
    },
    {
      id: "packages-and-addons",
      title: "Building good, better, best packages and add-ons",
      tocLabel: "Packages and add-ons",
      body: () => (
        <>
          <p>
            Three packages is a familiar structure for a reason. The entry package covers agents watching every
            dollar, the top package anchors the high end, and most clients land in the middle. Build them around what
            agents actually order, then make every other service an add-on.
          </p>
          <h3>What agents are ordering</h3>
          <p>
            HomeJab&apos;s <Ext href={HOMEJAB_2025}>2025 service report</Ext> (Oct. 20, 2025), based on its own national
            order data with no sample size given, offers a rare look at the add-on mix. Video walkthroughs made up
            nearly 17% of orders on average in 2025 and passed 20% by late 2025. Aerial accounted for 13–16% of orders.
            3D tours grew from about 6% in mid-2024 to nearly 12% by early 2025. Virtual twilight rose from about 1% to
            over 7% by September 2025, and floor plans held at 2–5%. That&apos;s one marketplace&apos;s mix, not the
            whole industry, but it suggests video and aerial belong in your middle and top packages, with 3D tours and
            twilight close behind.
          </p>
          <Figure caption="Example numbers for illustration — not market rates. An example good/better/best package menu with add-ons. Package names, contents, and prices are placeholders to show the structure.">
            <ServiceMenu
              packages={[
                {
                  name: "Essentials",
                  price: "From $195",
                  blurb: "For smaller listings and budget-conscious agents.",
                  includes: ["Up to 25 edited photos", "Priced by square footage tier", "Next-day delivery", "MLS and print sizes"],
                },
                {
                  name: "Listing Plus",
                  price: "From $345",
                  blurb: "The everyday package most agents should choose.",
                  includes: ["Up to 35 edited photos", "Drone stills (5)", "Short vertical video clip", "Next-day delivery"],
                  highlight: true,
                },
                {
                  name: "Signature",
                  price: "From $595",
                  blurb: "For premium and luxury listings.",
                  includes: ["Up to 50 edited photos", "Drone stills and aerial video", "Cinematic walkthrough video", "Virtual twilight (2)"],
                },
              ]}
              addons={[
                { name: "Drone stills (5)", price: "$95" },
                { name: "Aerial video clip", price: "$150" },
                { name: "3D tour", price: "Quoted by sq ft" },
                { name: "Floor plan", price: "Quoted by sq ft" },
                { name: "Virtual twilight (per image)", price: "$35" },
                { name: "On-site twilight shoot", price: "$225" },
                { name: "Rush delivery", price: "$50" },
                { name: "Travel beyond home zone", price: "By ZIP distance" },
              ]}
            />
          </Figure>
          <h3>Drone add-ons</h3>
          <p>
            Drone stills are the easiest add-on to sell on homes with land, views, or a notable neighborhood. Thumbtack
            lists individual pros charging $200 for eight retouched drone shots, $249 for unlimited aerials, and $150 for
            an aerial and exterior add-on. Those are single-provider examples. Because you&apos;re already on site, the
            real cost of a drone add-on is your flight and editing time plus your equipment and insurance overhead.
            Price it to cover those costs with margin, not to match the cheapest listing you can find.
          </p>
          <h3>Video add-ons</h3>
          <p>
            Video takes far more time than stills, mostly in editing. PFRE&apos;s{" "}
            <Ext href={PFRE_VIDEO}>2022 video pricing article</Ext> cites $100–$200 per hour for a videographer and
            $65–$175 per hour for editing, broad production rates rather than listing-video packages. Price listing
            video by the finished product (a short social clip versus a full walkthrough) and estimate your editing
            hours honestly before you commit to a price.
          </p>
          <h3>360 and 3D tours</h3>
          <p>
            There&apos;s no consumer-guide price for residential 3D tours. The only figures we found come from
            PFRE&apos;s 2021 commercial pricing article: Matterport from $150 base plus more by square footage, and 360°
            panoramas from $149. Those are dated commercial examples. For residential tours, build the price from
            capture time, your platform&apos;s hosting or processing cost, and margin, and scale it by square footage
            the same way you price photos.
          </p>
        </>
      ),
    },
    {
      id: "unsourced-addons",
      title: "Pricing twilight, floor plans, and virtual staging when there's no benchmark",
      tocLabel: "Twilight, floor plans, staging",
      body: () => (
        <>
          <p>
            Many pricing articles quote confident numbers for these services. We couldn&apos;t find a consumer guide
            that publishes them. The sources that do are mostly editing vendors without a stated methodology. The one
            exception is PFRE&apos;s 2021 commercial article, which lists virtual staging at $250–$350 per shot. That
            is far above what&apos;s commonly mentioned for residential staging, and it reflects a commercial context.
            Rather than borrow a number, price these from your own costs:
          </p>
          <ul>
            <li>
              <strong>On-site twilight:</strong> this is usually a second visit or a long wait on site at dusk, plus
              blending and editing. Price it as its own short shoot (travel, on-site time, and editing at your hourly
              value) rather than a small add-on.
            </li>
            <li>
              <strong>Virtual twilight:</strong> if you outsource it, use your vendor&apos;s per-image cost plus your
              handling time and margin. If you edit in-house, time a few and price from the average.
            </li>
            <li>
              <strong>Floor plans:</strong> add measuring time on site, drafting or vendor cost, and your margin, then
              scale by square footage.
            </li>
            <li>
              <strong>Virtual staging:</strong> vendor cost per image (or your editing time) plus handling and margin.
              Check your MLS&apos;s rules on disclosing or labeling virtually staged images.
            </li>
          </ul>
          <h3>Editing: in-house or outsourced?</h3>
          <p>
            Editing is often the biggest cost in a listing package. Editing in-house costs you time: multiply your
            editing hours per shoot by what your hour is worth. Outsourcing costs money per image or per set, but it
            frees evenings and makes turnaround more predictable. To compare them, get current quotes from a few
            editing services for your typical shoot and set them against your in-house time cost. Whichever you choose,
            make sure that cost appears in every package price.
          </p>
        </>
      ),
    },
    {
      id: "travel-luxury-commercial",
      title: "Travel fees, luxury listings, and commercial real estate",
      tocLabel: "Travel, luxury, commercial",
      body: () => (
        <>
          <h3>Travel fees</h3>
          <p>
            Agents expect one package price in your core area, so define a home zone and charge travel beyond it. Use
            distance tiers (a flat fee per band of miles) or a free radius plus a per-mile rate with a cap. For
            reference, PFRE&apos;s commercial article used a $1.50-per-mile example in 2021. Set your own rate from your
            vehicle costs and your time on the road. Calculating distance by ZIP code keeps the fee consistent and
            explainable.
          </p>
          <h3>Luxury properties</h3>
          <p>
            There&apos;s no published benchmark for luxury listing photography, and the work varies too much for one
            figure to mean anything. Luxury jobs typically take more time on site, more images, more detailed editing,
            often twilight and aerial, and sometimes more than one visit. Quote them as custom projects: estimate the
            hours, add the add-ons, and price above your standard tiers. One simple approach is to extend your
            square-footage tiers upward and add a &quot;custom quote above X sq ft&quot; rule.
          </p>
          <h3>Commercial real estate</h3>
          <p>
            Commercial work is a different market. PFRE&apos;s{" "}
            <Ext href={PFRE_COMMERCIAL}>commercial pricing article</Ext> (Oct. 3, 2021) gives example hourly rates of
            about $85–$120 at the low end and $165–$200 at the high end. Its package examples are about $1,500 for a
            small retail property, about $2,500 for a mid-rise office, and $4,000+ for multi-building properties.
            Thumbtack&apos;s photography page adds that a commercial job with multiple structures may exceed $2,000.
            Commercial clients also expect clear usage rights and longer lead times. Treat those numbers as dated
            examples, and quote commercial work per project.
          </p>
        </>
      ),
    },
    {
      id: "package-profitability",
      title: "Checking package profitability: cost-plus and time",
      tocLabel: "Package profitability",
      body: () => (
        <>
          <p>
            A package can look popular and still lose money. The test is simple: for each package, add up the time it
            really takes and what that time costs, then compare it with the price.
          </p>
          <ol>
            <li>
              <strong>Total the hours:</strong> drive time, on-site time, culling and editing, uploading and delivery,
              and admin such as booking and invoicing.
            </li>
            <li>
              <strong>Multiply by your hourly value:</strong> the income you need plus overhead, divided by billable
              hours.
            </li>
            <li>
              <strong>Add direct costs:</strong> outsourced editing, tour hosting, floor plan drafting, vehicle cost,
              and a share of equipment, insurance, and software.
            </li>
            <li>
              <strong>Compare with the price:</strong> the gap is your margin. If it&apos;s thin, raise the price,
              reduce what&apos;s included, or move a time-heavy item into an add-on.
            </li>
          </ol>
          <p>
            The drone pricing guide includes an{" "}
            <BlogLink slug="drone-photography-pricing-guide">interactive cost-plus worksheet</BlogLink> you can use for
            listing packages too. Your entry package is the one most likely to fail this test. That&apos;s fine if
            it&apos;s a deliberate on-ramp, but not if it&apos;s what most agents buy.
          </p>
          <p>
            One more line belongs in that math: the admin around each listing. Answering the &quot;how much for a
            3,200 sq ft with drone?&quot; text, working out the travel fee, sending a payment link, and re-sending the
            download link to the agent&apos;s assistant can add up to a meaningful slice of an entry-level package. If
            your margin looks thin, cutting that time is often easier than winning a price increase.
          </p>
          <FreeResourceCallout tool="real-estate-pricing" note="Check the profit on your packages and add-ons with your own numbers, then download a price list by square footage." />
        </>
      ),
    },
    {
      id: "service-menu-and-estimates",
      title: "Building your service menu and sending professional estimates",
      tocLabel: "Service menu and estimates",
      body: (ctx) => (
        <>
          <p>
            A clear service menu does half your selling. Agents should be able to see what each package includes, what
            it starts at, and which add-ons exist, without emailing you. For custom work (luxury, commercial, or
            anything with unusual scope), send a formal estimate that lists each item, the travel fee, and how long
            the price is valid.
          </p>
          <Figure caption="Example numbers for illustration — not market rates. A sample listing estimate with a square-footage-tiered package, add-ons, and a ZIP-based travel fee.">
            <SampleEstimate
              title="412 Riverbend Ln: 3,100 sq ft listing"
              client="Maya Ortiz, listing agent"
              lines={[
                { label: "Listing Plus package", detail: "3,000–3,999 sq ft tier, up to 35 photos", amount: 395 },
                { label: "Virtual twilight", detail: "2 images", amount: 70 },
                { label: "3D tour", detail: "Quoted for 3,100 sq ft", amount: 225 },
                { label: "Travel fee: Zone 2", detail: "Based on ZIP-to-ZIP distance", amount: 40 },
              ]}
            />
          </Figure>
          <h3>Why a price list isn&apos;t the same as a quoting system</h3>
          <p>
            A package is only as profitable as the way it gets quoted. Agents compare every invoice with the last one,
            so consistency is part of the price: the same tier for the same square footage, the same travel fee for
            the same town, and add-ons that never &quot;slip&quot; off the bill. The usual leaks are small and
            constant. A travel fee is waived because you didn&apos;t want to look it up, a twilight image is promised
            in a text and never invoiced, or a busy agent gets the gallery before the balance is paid and the reminder
            emails start.
          </p>
          <p>
            The fix is to quote from the same menu every time, get approval in writing, and tie payment to delivery.
            Whatever tools you use, those three habits protect the margin you worked out above.
          </p>
          <ProductCallout title="Your package menu becomes the request form agents order from">
            <p>
              In ShootPortal (our product), each package in your service catalog has a description, a &quot;starting
              at&quot; label, an includes list, and line items. Mark Listing Plus as recommended, hide pricing on
              commercial or luxury work you quote individually, and start from the built-in starter templates if you
              don&apos;t have a menu yet. When an agent picks a package on your request form and enters the address,
              ShootPortal can generate a preliminary estimate with a travel fee from ZIP-to-ZIP distance, using your
              mileage tiers or a free radius plus a capped per-mile rate.
            </p>
            <p>
              For custom jobs, send an official estimate with an expiry date and issue new versions as the scope
              changes. The agent approves in their portal (or downloads the PDF for their records), a deposit can be
              requested on approval, and downloads can stay locked until the balance is paid. The quote, the payment,
              and the photos all sit on the same listing project.
            </p>
          </ProductCallout>
          <p>
            It&apos;s not an all-in-one listing marketing platform. ShootPortal doesn&apos;t build property websites,
            flyers, or Zillow Showcase deliveries, and it doesn&apos;t support pay-at-closing. If those matter in your
            market, compare options in the guide to{" "}
            <BlogLink slug="best-real-estate-photography-software">real estate photography software</BlogLink>. For
            getting paid on approved estimates, see the{" "}
            <BlogLink slug="best-photography-invoicing-software">photography invoicing software comparison</BlogLink>.
            The <SiteLink href="/how-it-works">how it works</SiteLink> page shows the full request-to-delivery flow.
          </p>
          <p>
            Once your prices are set, collecting them is the next step; our{" "}
            <SiteLink href="/photography-invoicing-software">photography invoicing software</SiteLink> page shows how an approved
            estimate becomes a card payment.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Build your package menu once, then let agents request from it"
            body={
              <>
                The guided setup starts you on a service template. Swap in your own tiers and add-ons, set your travel
                rule, and request a test shoot from your own form to see the estimate an agent would get.
              </>
            }
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
          <FreeResourceCallout resource="real-estate-photography-pricing-sheet" />
        </>
      ),
    },
    {
      id: "raising-prices",
      title: "When and how to raise your prices",
      tocLabel: "Raising prices",
      body: () => (
        <>
          <p>
            It&apos;s easy to wait too long to raise prices, because agents are repeat clients and the conversation
            feels personal. A few signals that it&apos;s time: your calendar is regularly full, your
            cost-plus floor has risen above your entry package, or agents book you without asking about price.
          </p>
          <p>
            It also helps to remember why agents buy. Listing photos are the first thing buyers see online, and
            agents know weak media costs them showings and sellers. Good listing media isn&apos;t a luxury purchase
            for agents, and your pricing can reflect that.
          </p>
          <ul>
            <li>
              <strong>Give notice.</strong> Announce new rates ahead of time, and honor existing quotes and bookings at
              the old price.
            </li>
            <li>
              <strong>Raise the packages, not the relationship.</strong> Adjusting tiers or moving an item into an
              add-on often lands better than a flat increase across the board.
            </li>
            <li>
              <strong>Know who your best clients are.</strong> Look at revenue per agent before you decide whether to
              offer volume pricing to anyone.
            </li>
            <li>
              <strong>Automate the routine.</strong> Faster quoting and delivery make a higher price easier to justify.
              The guide to{" "}
              <BlogLink slug="real-estate-photography-automation">real estate photography automation</BlogLink> covers
              where to start.
            </li>
          </ul>
          <Figure caption="Product illustration: a ShootPortal client list showing lifetime revenue per client, useful when deciding who gets volume pricing (demo data).">
            <ProductPreview view="clients" />
          </Figure>
          <p>
            If you&apos;re still in your first year, the guide to{" "}
            <BlogLink slug="how-to-start-real-estate-photography-business">
              starting a real estate photography business
            </BlogLink>{" "}
            covers setting launch prices without anchoring yourself too low.
          </p>
          <KeyTakeaways
            items={[
              <>Published averages are a starting point. Name the source and date, and check your local market.</>,
              <>Tier base packages by square footage and keep the photo count tied to each tier.</>,
              <>Build three packages around what agents order most: video, aerial, and 3D.</>,
              <>Price twilight, floor plans, and staging from your own costs where no benchmark exists.</>,
              <>Test every package against cost-plus, and raise prices with notice when the numbers say so.</>,
            ]}
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "How much do real estate photographers charge per listing?",
      answerText:
        "Published averages fall in the low-to-mid hundreds of dollars. Thumbtack's 2025 guides report about $286–$305 on average, HomeGuide (2024) says $150–$300, and HomeJab's 2017–2021 order data averaged $229. Your price depends on your market, home sizes, add-ons, and costs.",
      answer: (
        <p>
          Published averages fall in the low-to-mid hundreds of dollars. Thumbtack&apos;s 2025 guides report about
          $286–$305 on average, HomeGuide (2024) says $150–$300, and HomeJab&apos;s 2017–2021 order data averaged $229.
          Your price depends on your market, home sizes, add-ons, and costs.
        </p>
      ),
    },
    {
      question: "Should I price real estate photography by square footage?",
      answerText:
        "Square-footage tiers are a common and fair structure because home size drives shoot and editing time. Keep the tiers few and wide, tie a photo count to each tier, and add a custom-quote rule for very large homes.",
      answer: (
        <p>
          Square-footage tiers are a common and fair structure because home size drives shoot and editing time. Keep
          the tiers few and wide, tie a photo count to each tier, and add a custom-quote rule for very large homes.
        </p>
      ),
    },
    {
      question: "What add-ons do real estate agents order most?",
      answerText:
        "In HomeJab's 2025 order data, video walkthroughs were nearly 17% of orders (over 20% by late 2025), aerial 13–16%, 3D tours nearly 12% by early 2025, virtual twilight over 7% by September 2025, and floor plans 2–5%. That's one marketplace's data, not the whole industry.",
      answer: (
        <p>
          In HomeJab&apos;s 2025 order data, video walkthroughs were nearly 17% of orders (over 20% by late 2025),
          aerial 13–16%, 3D tours nearly 12% by early 2025, virtual twilight over 7% by September 2025, and floor plans
          2–5%. That&apos;s one marketplace&apos;s data, not the whole industry.
        </p>
      ),
    },
    {
      question: "How much should I charge for twilight photos or floor plans?",
      answerText:
        "No consumer cost guide publishes reliable prices for these. Price them from your costs: on-site time, travel, editing or vendor fees, and margin. Treat on-site twilight as its own short shoot rather than a small add-on.",
      answer: (
        <p>
          No consumer cost guide publishes reliable prices for these. Price them from your costs: on-site time,
          travel, editing or vendor fees, and margin. Treat on-site twilight as its own short shoot rather than a small
          add-on.
        </p>
      ),
    },
    {
      question: "Should I charge real estate agents a travel fee?",
      answerText:
        "Yes, beyond a defined home zone. Use distance tiers or a free radius plus a per-mile rate with a cap, based on your vehicle cost and time. Calculating distance by ZIP code keeps the fee consistent and easy to explain.",
      answer: (
        <p>
          Yes, beyond a defined home zone. Use distance tiers or a free radius plus a per-mile rate with a cap, based on
          your vehicle cost and time. Calculating distance by ZIP code keeps the fee consistent and easy to explain.
        </p>
      ),
    },
  ],
  related: [
    "best-real-estate-photography-software",
    "drone-photography-pricing-guide",
    "how-to-start-real-estate-photography-business",
  ],
  cta: {
    title: "Make every listing quote consistent, approved, and paid.",
    body: "Publish your packages as a service catalog, let agents get a preliminary estimate with the travel fee already included, and collect deposits and balances on the same project you deliver from.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
