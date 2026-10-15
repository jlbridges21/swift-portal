import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  KeyTakeaways,
  SiteLink,
  Steps,
} from "@/components/blog/article-parts";
import { CostBreakdown, SampleEstimate } from "@/components/blog/business-diagrams";
import { TrialCard, WorkflowCoverageMap } from "@/components/blog/conversion-parts";
import { JobPriceCalculator } from "@/components/blog/job-price-calculator";

const THUMBTACK_AERIAL = "https://www.thumbtack.com/p/aerial-photography-prices";
const THUMBTACK_PHOTO = "https://www.thumbtack.com/p/photographer-prices";
const THUMBTACK_RE = "https://www.thumbtack.com/p/real-estate-photography-prices";
const DRONE_U = "https://www.thedroneu.com/?p=42749";
const HOMEGUIDE_ROOF = "https://homeguide.com/costs/drone-roof-inspection-cost";
const ANGI_ROOF = "https://www.angi.com/articles/drone-roof-inspection-cost.htm";
const HOMEADVISOR_ROOF = "https://www.homeadvisor.com/cost/inspectors-and-appraisers/hire-a-roof-inspector/";
const PFRE_VIDEO = "https://photographyforrealestate.net/what-can-you-charge-for-real-estate-video/";

export const article: BlogArticle = {
  slug: "drone-photography-pricing-guide",
  title: "How Much Should You Charge for Drone Photography in 2026? Complete Pricing Guide",
  seoTitle: "Drone Photography Pricing 2026: What to Charge",
  description:
    "Drone photography pricing for 2026: sourced rate ranges for real estate, commercial, video, roof inspections, and mapping, plus a cost-plus method to set your own rates.",
  excerpt:
    "Published drone rates range widely, and most of the numbers online are guesses. This guide separates what clients report paying from what pilots suggest, then shows you how to build a price from your own costs.",
  category: "pricing-payments",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "drone photography pricing",
  secondaryKeywords: [
    "drone photography rates",
    "aerial photography prices",
    "how much to charge for drone photography",
  ],
  readingMinutes: 16,
  cover: {
    variant: "drone",
    tint: "amber",
    label: "Pricing Guide",
    alt: "Illustration of a drone over a price tag on an amber background",
  },
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Consumer cost guides put typical drone work around $125/hour.</strong> Thumbtack&apos;s 2025 guide
        reports a $102–$367/hour range and an average job total of about $333. Pilot-side guides, such as Drone U&apos;s,
        suggest higher rates.
      </>,
      <>
        <strong>Price by job type.</strong> Real estate aerials, commercial property, video, roof inspections,
        construction progress, and mapping each have their own pricing logic.
      </>,
      <>
        <strong>Start from your costs, not someone else&apos;s rate card.</strong> Add up flight time, editing, admin,
        travel, equipment replacement, and insurance, then add margin.
      </>,
      <>
        <strong>Quote travel separately</strong> with distance tiers or a per-mile rate, so a single package price works
        across your whole service area.
      </>,
      <>
        <strong>Your market sets the final number.</strong> Location, scope, competition, and your own costs matter more
        than any national average.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Ask ten pilots what they charge and you&apos;ll get ten answers. Some quote by the hour, some by the
        deliverable, and some have a single &quot;drone package&quot; that hasn&apos;t changed since they bought their
        first aircraft. Clients are just as confused. They see a bargain listing special in one place and a four-figure
        commercial quote in another, with no idea why the gap exists.
      </p>
      <p>
        This guide is about <strong>drone photography pricing</strong> from the operator&apos;s side. It collects the
        published rate data that actually exists, says where each number comes from and how old it is, and names the
        places where sources disagree. It also says plainly where <em>no</em> reliable public number exists. Then it
        shows how to build your own rates from your costs: equipment, insurance, editing time, and travel. That way your
        price holds up whether the job is a single listing or a monthly construction contract.
      </p>
      <Callout tone="note" title="How to read the numbers in this guide">
        <p>
          Every market figure below links to its source, with the publisher and date. Consumer cost guides (Thumbtack,
          HomeGuide, Angi, HomeAdvisor) reflect what customers report paying. Pilot-side guides (Drone U, PFRE) reflect
          what operators suggest charging, and they say so themselves. Neither is a survey of your local market.
          Actual pricing depends on your market, scope, location, and costs. Figures marked as examples are for
          illustration only.
        </p>
      </Callout>
    </>
  ),
  sections: [
    {
      id: "what-published-data-says",
      title: "What drone photography actually costs: the published ranges",
      tocLabel: "Published price ranges",
      body: () => (
        <>
          <p>
            Little reliable public data exists on drone service pricing. No national survey of drone service rates
            turned up in our research. What exists is a handful of consumer cost guides, some insurer and FAA pages for
            business costs, and pilot-education sites that publish example rate cards. The table below pulls the
            relevant figures together. Read it as a rough map, not a price list.
          </p>
          <ComparisonTable
            caption="Published drone service price ranges by source"
            columns={["Service", "Published range", "Source and type"]}
            rows={[
              [
                "Drone/aerial photography, hourly",
                "Avg. $125/hr; typical $102–$367/hr",
                <span key="s1">
                  <Ext href={THUMBTACK_AERIAL}>Thumbtack aerial cost guide</Ext> (2025 edition, last updated Aug. 12).
                  Consumer guide.
                </span>,
              ],
              [
                "Drone/aerial photography, job total",
                "Avg. $333; typical $233–$475",
                <span key="s2">
                  <Ext href={THUMBTACK_PHOTO}>Thumbtack photography prices</Ext> (2025 edition, last updated Jan. 22).
                  Consumer guide.
                </span>,
              ],
              [
                "Aerial photo, hourly (pilot-quoted)",
                "$150–$400/hr",
                <span key="s3">
                  <Ext href={DRONE_U}>Drone U pricing guide</Ext> (May 30, 2026). Operator guidance with example
                  ranges, not a survey.
                </span>,
              ],
              [
                "Drone roof inspection",
                "$150–$600 (most pay about $375)",
                <span key="s4">
                  <Ext href={HOMEGUIDE_ROOF}>HomeGuide</Ext> (Jan. 6, 2026). Consumer guide.
                </span>,
              ],
              [
                "Drone roof inspection",
                "Typical $120–$600; $80–$250 per flight hour",
                <span key="s5">
                  <Ext href={ANGI_ROOF}>Angi</Ext> (updated Jul. 8, 2026). Consumer guide.
                </span>,
              ],
              [
                "Drone roof inspection",
                "Average $150–$400",
                <span key="s6">
                  <Ext href={HOMEADVISOR_ROOF}>HomeAdvisor</Ext> (Jun. 19, 2026). Consumer guide.
                </span>,
              ],
              [
                "Event coverage (pilot-quoted)",
                "$150–$350/hr; half day $500, full day $800 (examples)",
                <span key="s7">
                  <Ext href={DRONE_U}>Drone U</Ext> (May 30, 2026). Operator guidance.
                </span>,
              ],
              [
                "Construction / surveying (pilot-quoted)",
                "$250–$600/hr",
                <span key="s8">
                  <Ext href={DRONE_U}>Drone U</Ext> (May 30, 2026). Operator guidance.
                </span>,
              ],
              [
                "Mapping (pilot-quoted)",
                "About $5–$20/acre (illustrative)",
                <span key="s9">
                  <Ext href={DRONE_U}>Drone U</Ext> (May 30, 2026). Operator guidance.
                </span>,
              ],
              [
                "Drone footage for video production",
                "$200–$5,000 per day",
                <span key="s10">
                  <Ext href={PFRE_VIDEO}>PFRE</Ext> (Feb. 11, 2022). Industry blog; older and very broad.
                </span>,
              ],
            ]}
            note="Prices as published on each page; checked October 15, 2026. Thumbtack pages show a month and day but no year, with 2025 in the page title. These are national figures and won't match every local market."
          />
          <h3>Why the sources disagree</h3>
          <p>
            The gaps between these numbers are expected. Thumbtack&apos;s $102–$367/hour comes from what customers on
            its marketplace report paying, and that includes a lot of short, simple residential jobs. Drone U&apos;s
            $150–$400/hour for aerial photography is a training company&apos;s view of what a professional operator
            should quote. Its guide calls the figures typical ranges and examples, not standards. Consumer data tends to
            run lower than &quot;what you should charge&quot; guides, and both can be right at once: one measures the
            market as it is, and the other argues for where a sustainable business needs to be.
          </p>
          <p>
            The roof inspection numbers are the most consistent in the set, since three consumer guides overlap around
            $150–$600. Even there, Angi&apos;s $80–$250 per flight hour and HomeGuide&apos;s $100–$350+ per hour for
            hourly-billing inspectors show how much the billing method changes the headline.
          </p>
        </>
      ),
    },
    {
      id: "pricing-structures",
      title: "Drone pricing structures: hourly, day rate, project, deliverable, or recurring",
      tocLabel: "Pricing structures",
      body: () => (
        <>
          <p>
            Before you pick a number, pick a structure. The same pilot can use different structures for different
            clients. The mistake is using one structure for everything.
          </p>
          <h3>Hourly</h3>
          <p>
            Hourly pricing is easy to explain and protects you when scope is fuzzy. Its weakness is that clients pay
            for your time while they want results. If you get faster, you earn less. Thumbtack&apos;s aerial guide also
            notes that shoots running past 90 minutes commonly add about $50–$70 for each extra hour. Many pilots treat
            a first hour or a minimum call-out as the real base price. Hourly works best for open-ended commercial
            work, film and video crew days, and anything where the client controls the schedule on site.
          </p>
          <h3>Half-day and full-day rates</h3>
          <p>
            Day rates suit events, productions, and jobs where you can&apos;t book anything else that day. Drone
            U&apos;s published examples put event coverage at around $500 for a half day and $800 for a full day. Treat
            those as one training site&apos;s examples, not a benchmark. Define what a &quot;day&quot; means (hours on
            site, breaks, and overtime) and whether editing is included.
          </p>
          <h3>Per project</h3>
          <p>
            A flat project price is what most clients prefer: one number, one approval. It works when you can scope the
            job accurately from the address, the deliverables list, and a quick airspace check. Build the project price
            from the cost-plus worksheet further down, and put the assumptions on the quote (acreage, number of
            flights, revision rounds) so changes become paid change orders instead of free extras.
          </p>
          <h3>Per deliverable</h3>
          <p>
            Pricing by what the client receives (a set of edited stills, a 60-second clip, a mapped orthomosaic, an
            inspection report) is the clearest structure for repeat buyers. Real estate agents in particular think in
            deliverables. Thumbtack&apos;s{" "}
            <Ext href={THUMBTACK_RE}>real estate photography guide</Ext> lists individual pros&apos; drone add-ons
            priced this way, for example eight retouched drone shots for $200, or an aerial and exterior add-on for
            $150. Those are single-provider examples, not averages.
          </p>
          <h3>Recurring retainers and subscriptions</h3>
          <p>
            Construction progress, property management, and marketing clients may want the same capture every week or
            month. A recurring agreement gives you predictable revenue and gives them a locked rate and a reserved slot.
            Public data here is thin. The only sourced example we found is Drone U&apos;s: a construction progress
            flight priced at $300, later raised to $450, with recurring contracts priced as &quot;custom.&quot; Build
            your retainer from a per-visit cost-plus price, then decide how much of a commitment discount, if any, the
            guaranteed volume is worth to you.
          </p>
        </>
      ),
    },
    {
      id: "pricing-by-job-type",
      title: "How to price each type of drone job",
      tocLabel: "Pricing by job type",
      body: () => (
        <>
          <h3>Residential real estate aerials</h3>
          <p>
            This is the highest-volume and most price-sensitive segment. Agents compare you against whatever their
            last photographer charged. Thumbtack&apos;s real estate guide shows individual pros offering unlimited
            aerials for $249, or eight retouched drone shots for $200. Its aerial guide includes a pro quoting
            $400–$450 for a 60–90 second real estate video with editing. Drone U&apos;s examples are 20 photos plus a
            short video for $300, and a video package for $600. Drone work for listings is often sold as an add-on to
            ground photography, so the profitable question is how much extra time the flight adds to a job you&apos;re
            already on. If you shoot ground photos too, the{" "}
            <BlogLink slug="real-estate-photography-pricing-guide">real estate photography pricing guide</BlogLink>{" "}
            covers packaging aerials into listing packages.
          </p>
          <h3>Commercial property</h3>
          <p>
            Commercial clients (brokers, owners, developers) usually need more angles, more coordination, sometimes
            controlled airspace, and usage rights for marketing. One pro on Thumbtack&apos;s real estate page lists
            commercial drone packages from $400. Thumbtack&apos;s broader photography page notes that a commercial job
            with multiple structures may exceed $2,000. Quote commercial work per project, list each deliverable, and
            state the licensing terms.
          </p>
          <h3>Aerial videography</h3>
          <p>
            Video is where editing time can quietly double the job. PFRE&apos;s 2022 video pricing article cites drone
            footage at $200–$5,000 per day and editing at $65–$175 per hour, a range so wide it mostly shows how much
            scope varies. Price the capture and the edit separately in your head, even if the client sees one number.
            Spell out the length of the final cut, music licensing, and how many revision rounds are included.
          </p>
          <h3>Construction projects and recurring clients</h3>
          <p>
            Progress documentation rewards consistency: same angles, same altitude, same schedule. Price each visit
            from cost-plus, and define the deliverable set exactly (stills from fixed points, a short overview clip, a
            map if you offer one). Then offer the recurring rate. Drone U&apos;s example of a $300 progress flight later
            raised to $450 is a reminder to build a rate review into recurring agreements from the start.
          </p>
          <h3>Roof inspections</h3>
          <p>
            Roof inspection has the best consumer data of any drone service. <Ext href={HOMEGUIDE_ROOF}>HomeGuide</Ext>{" "}
            (Jan. 6, 2026) puts standard visual inspections at $150–$400, thermal at $400–$600, and LiDAR or 3D mapping
            at $400–$800, with a certification report for an insurer or lender adding $75–$200. Pre-listing roof
            inspections run $200–$400 in the same guide. <Ext href={ANGI_ROOF}>Angi</Ext> (Jul. 8, 2026) reports
            $120–$600 typical and $400–$600 for infrared. If you add inspections, remember that the client is paying for
            the report and its findings, not the flight. Scope the report format before you quote.
          </p>
          <h3>Events</h3>
          <p>
            Events are time-boxed, and airspace and crowd rules matter, so day or half-day pricing usually fits.
            Thumbtack&apos;s aerial guide includes one pro offering an aerial add-on to wedding video from $200. Drone U
            suggests $150–$350 per hour for event coverage. Check venue permission and whether you&apos;ll be flying
            over people before you quote. Those limits can change what you can actually deliver.
          </p>
          <h3>Mapping and surveying</h3>
          <p>
            Mapping is usually priced per acre or per project. The only public figure we found is Drone U&apos;s
            illustrative $5–$20 per acre, which is operator guidance, not market data. Processing software,
            ground-control work, and the accuracy the client needs all drive cost. Be careful not to sell
            survey-grade accuracy unless you&apos;re qualified and licensed to provide it where you work.
          </p>
          <Callout tone="warning" title="Where no reliable number exists">
            <p>
              We found no consumer guide or survey for recurring construction progress contracts. The only per-acre
              mapping numbers come from Drone U&apos;s illustrative examples. If a blog quotes a confident national
              average for either, check where it came from. For these services, the cost-plus method below is a more
              reliable starting point than any figure we could cite.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "cost-of-doing-business",
      title: "Know your costs: equipment, insurance, licensing, and editing time",
      tocLabel: "Your real costs",
      body: () => (
        <>
          <p>
            Underpricing usually comes from forgetting a cost, not from a bad rate card. A drone job has more hidden
            costs than most photography because the main tool wears out, can crash, and needs specific coverage.
          </p>
          <h3>Equipment and a replacement reserve</h3>
          <p>
            Thumbtack&apos;s aerial guide estimates professional drone equipment at about $1,500 to $12,000+. For
            reference points, DJI&apos;s US store listed the{" "}
            <Ext href="https://store.dji.com/product/dji-mini-4-pro">Mini 4 Pro</Ext> at $759 (Fly More Combo $1,099)
            and the <Ext href="https://store.dji.com/product/dji-air-3s">Air 3S</Ext> at $1,099 (Fly More Combo Lite
            $1,599) when we checked on October 15, 2026. Both were shown as out of stock. Add batteries, ND filters,
            spare props, a backup aircraft, cases, a laptop, and editing software.
          </p>
          <p>
            Then set a <strong>replacement reserve</strong>: divide what it would cost to replace your kit by the number
            of paid jobs you expect before you replace it. That amount belongs in every job price, whether or not
            anything breaks that month.
          </p>
          <p>
            Buying plans also carry regulatory risk right now. In December 2025 the FCC added foreign-made drones and
            components to its{" "}
            <Ext href="https://www.fcc.gov/supplychain/coveredlist">Covered List</Ext>. Check the FCC&apos;s current
            list and how it affects new equipment purchases before you count on replacing a crashed aircraft with the
            same model. That uncertainty is one more reason to keep a reserve and a backup aircraft.
          </p>
          <h3>Licensing and registration</h3>
          <p>
            Commercial flying in the US requires a Part 107 remote pilot certificate. The FAA&apos;s{" "}
            <Ext href="https://www.faa.gov/faq/how-much-does-it-cost-get-remote-pilot-certificate">FAQ</Ext> says
            testing centers charge about $175 for the initial knowledge test; confirm the fee when you book. Each drone
            flown under Part 107 must be{" "}
            <Ext href="https://www.faa.gov/uas/getting_started/register_drone">registered</Ext> for $5, valid for three
            years, and must meet <Ext href="https://www.faa.gov/uas/getting_started/remote_id">Remote ID</Ext> rules.
            Recurrent training every 24 calendar months is{" "}
            <Ext href="https://www.faa.gov/uas/commercial_operators/become_a_drone_pilot">free online</Ext>. These are
            small costs, but they belong in your annual overhead.
          </p>
          <h3>Insurance</h3>
          <p>
            Federal rules don&apos;t require drone insurance. In its{" "}
            <Ext href="https://www.federalregister.gov/documents/2016/06/28/2016-15079/operation-and-certification-of-small-unmanned-aircraft-systems">
              2016 Part 107 final rule
            </Ext>{" "}
            the FAA said it lacks the authority to mandate it. Clients, venues, and some states or localities often do
            require it, and you&apos;re still liable for damage either way. Published prices vary by insurer and even
            within a single insurer&apos;s pages:
          </p>
          <ul>
            <li>
              <Ext href="https://www.skywatch.ai/us/monthly-plan">SkyWatch&apos;s plan page</Ext> lists $44/month or
              $466/year, without saying which liability limit that assumes. Its{" "}
              <Ext href="https://www.skywatch.ai/blog/how-much-should-your-drone-insurance-cost">pricing blog</Ext>{" "}
              says $1M coverage starts at $62/month or $750/year, and elsewhere in the same post says about
              $80/month.
            </li>
            <li>
              BWI, a broker, gives three different ranges for a $1M liability policy:{" "}
              <Ext href="https://bwifly.com/aviation-insurance/drone-liability-insurance/">$600–$750/year</Ext> on its
              liability page,{" "}
              <Ext href="https://bwifly.com/blog/drone-insurance-price-what-youll-really-pay-in-2025-and-how-to-lower-it/">
                $600–$1,200/year
              </Ext>{" "}
              in a November 2025 blog post, and <Ext href="https://bwifly.com/faqs/drone-insurance/">$500–$1,500/year</Ext>{" "}
              in its FAQ. The FAQ puts hull coverage at 6–12% of declared value per year.
            </li>
          </ul>
          <p>Get real quotes for your limits and equipment, then spread the annual premium across your expected jobs.</p>
          <h3>Editing and admin time</h3>
          <p>
            Editing is usually the biggest cost pilots underestimate. Panorama stitching, sky replacement, color
            matching, and video edits can easily take longer than the flight. Admin time counts too: quoting, airspace
            authorization, scheduling, uploading, and chasing payment. Track your actual hours for a few weeks before
            you trust your estimates.
          </p>
          <Figure caption="Example numbers for illustration — not market rates. A conceptual breakdown of where a single drone job's price goes.">
            <CostBreakdown
              totalLabel="Example drone job price"
              items={[
                { label: "Flight time on site", amount: 90, note: "Including setup and airspace checks" },
                { label: "Editing", amount: 120, note: "Stills and a short clip" },
                { label: "Quoting, scheduling, delivery", amount: 45 },
                { label: "Travel", amount: 35, note: "Round trip, vehicle cost" },
                { label: "Equipment replacement reserve", amount: 40 },
                { label: "Insurance, software, and fees", amount: 30 },
                { label: "Profit", amount: 90 },
              ]}
            />
          </Figure>
        </>
      ),
    },
    {
      id: "build-your-rate",
      title: "Build your rate with cost-plus pricing",
      tocLabel: "Cost-plus worksheet",
      body: () => (
        <>
          <p>
            Market ranges tell you whether a price is plausible. Cost-plus tells you whether it&apos;s sustainable. Use
            both: calculate your floor, then compare it with what clients in your area actually pay.
          </p>
          <Steps
            items={[
              {
                title: "Set what your hour is worth",
                body: (
                  <p>
                    Take the income you need for the year, add your fixed overhead, and divide by the hours you can
                    realistically bill, not the hours you work. Weather days and admin time count against you.
                  </p>
                ),
              },
              {
                title: "Estimate the hours for this job",
                body: <p>Include on-site time, editing, and admin. Use tracked numbers from similar jobs where you can.</p>,
              },
              {
                title: "Add travel and per-job overhead",
                body: (
                  <p>
                    Round-trip miles times your vehicle cost, plus your share of insurance, the equipment reserve, and
                    software.
                  </p>
                ),
              },
              {
                title: "Add margin, then sanity-check",
                body: (
                  <p>
                    Add a profit margin on top of break-even. If the result sits far above the local market, look for
                    hours to cut or a different client type. If it sits far below, you&apos;re probably underpricing.
                  </p>
                ),
              },
            ]}
          />
          <Figure caption="Interactive cost-plus worksheet. The starting inputs are placeholders to show the math, not market rates. Replace each one with your own numbers.">
            <JobPriceCalculator />
          </Figure>
          <p>
            Run the worksheet for each service you sell. The point isn&apos;t a precise number. It&apos;s finding out
            which services pay for themselves and which are quietly subsidized by the rest. You may find that the
            add-on you sell most often has the thinnest margin once editing time is counted honestly.
          </p>
          <p>
            Pay attention to the admin line in particular. In the example breakdown above, quoting, scheduling, and
            delivery take a bigger share of the price than travel. That share is real time, and it repeats on every
            job. It&apos;s also the one cost you can shrink without lowering your rate or your quality.
          </p>
        </>
      ),
    },
    {
      id: "travel-fees",
      title: "Travel fees: charge by distance, not by guesswork",
      tocLabel: "Travel fees",
      body: () => (
        <>
          <p>
            Drone work often means driving to sites outside town: rural land, construction sites, and properties at the
            edge of your service area. If travel is buried inside your package price, nearby clients overpay and
            distant ones get a discount they never asked for.
          </p>
          <p>Two common approaches:</p>
          <ul>
            <li>
              <strong>Distance tiers.</strong> For example, no fee within your home zone, then a flat fee for each band
              of miles beyond it. Tiers are easy to explain and easy to read on a quote.
            </li>
            <li>
              <strong>Free radius plus per-mile, with a cap.</strong> No charge inside a set radius, a per-mile rate
              beyond it, and a maximum so long trips don&apos;t produce a shocking number. For reference, PFRE&apos;s
              older industry articles use examples of $1.25 and $1.50 per mile. Base your own rate on your vehicle costs
              and time.
            </li>
          </ul>
          <p>
            A practical way to apply either method is by ZIP code: calculate the distance from your base ZIP to the
            job&apos;s ZIP and look up the fee automatically. Straight-line ZIP distance is shorter than actual driving
            distance, so set tier bands or per-mile rates with that in mind. Remember that the cost of travel is your
            time as well as fuel. A two-hour round trip on a one-hour shoot is a three-hour job.
          </p>
        </>
      ),
    },
    {
      id: "professional-quotes",
      title: "Pricing by deliverable and creating professional quotes",
      tocLabel: "Creating quotes",
      body: () => (
        <>
          <p>
            A good drone quote does three things: it shows the client exactly what they&apos;re getting, it puts your
            assumptions in writing, and it makes saying yes easy. Break the price into deliverables, list travel on its
            own line, say how many revisions are included, set an expiry date, and state the deposit up front.
          </p>
          <Figure caption="Example numbers for illustration — not market rates. A sample commercial drone estimate with deliverable line items, a ZIP-based travel fee, and a deposit due on approval.">
            <SampleEstimate
              title="Aerial package: Northgate business park"
              client="Atlas Build"
              depositPercent={30}
              lines={[
                { label: "Aerial stills: 25 edited images", detail: "Multiple elevations, all four sides, site context", amount: 450 },
                { label: "Aerial video: 60-second edit", detail: "Licensed music, one revision round", amount: 550 },
                { label: "Flight planning and airspace authorization", detail: "Controlled airspace, LAANC request", amount: 75 },
                { label: "Travel fee: 26–50 mile tier", detail: "Calculated from your ZIP to the site ZIP", amount: 60 },
              ]}
            />
          </Figure>
          <p>
            For repeat clients, keep the quote short and the package names consistent so they can approve from a phone.
            For new commercial clients, add the scope details that protect you: number of flights, weather
            rescheduling terms, usage rights, and what happens if airspace authorization is denied.
          </p>
          <h3>Deposits</h3>
          <p>
            A deposit on approval covers your travel and the cost of a reserved day if the client cancels. It matters
            most for new clients, long drives, and day-rate work. Pair it with a clear balance policy. The guide to{" "}
            <BlogLink slug="get-paid-before-delivering-real-estate-photos">getting paid before you deliver</BlogLink>{" "}
            walks through structuring deposits and payment-before-download in detail.
          </p>
        </>
      ),
    },
    {
      id: "quoting-in-shootportal",
      title: "From rate card to repeatable quotes: running your pricing in ShootPortal",
      tocLabel: "Quoting in ShootPortal",
      body: (ctx) => (
        <>
          <p>
            A rate only makes money if four things happen every time: it&apos;s quoted the same way, the client
            approves it before you fly, you collect it, and the job is delivered without an evening of follow-up. Miss
            one and the margin you worked out in the worksheet leaks away. Travel gets forgotten on a rural job, a
            verbal &quot;yes&quot; turns into a scope argument, or the balance sits unpaid for three weeks. A price
            list in a spreadsheet can&apos;t enforce any of that. A quoting workflow can.
          </p>
          <p>
            ShootPortal (our product) was built by the owner of a Part 107 drone photography business, and its quoting
            tools follow the same steps as this guide:
          </p>
          <ul>
            <li>
              <strong>Your rate card becomes a service catalog.</strong> Each service or package gets a description, a
              &quot;starting at&quot; label, an includes list, and line items, so &quot;25 edited aerial stills, one
              revision round&quot; is written down once instead of retyped on every quote. Mark your best-value package
              as recommended, start from the built-in starter templates, and hide pricing on services you&apos;d rather
              quote case by case, such as mapping or recurring construction work.
            </li>
            <li>
              <strong>Travel is calculated, not remembered.</strong> When a client picks a service on your request
              form and enters the site address, ShootPortal can produce a preliminary estimate that already includes a
              travel fee from ZIP-to-ZIP distance. You set the rule once: mileage tiers, or a free radius plus a
              per-mile rate with a cap. The same job 40 miles out gets the same fee every time.
            </li>
            <li>
              <strong>Scope is written down and versioned.</strong> For commercial or custom work, send an official
              estimate with an expiry date. If the client adds a flight or a second deliverable, issue a new version
              instead of editing an email thread. Clients approve or request changes in their portal and can download
              the estimate as a PDF.
            </li>
            <li>
              <strong>The deposit is part of the approval.</strong> Request a percentage or fixed deposit when the
              estimate is approved, then the balance later, with payments going through Stripe directly to your own
              account. If you want, downloads stay locked until the final payment, while the client can still view the
              media.
            </li>
          </ul>
          <Figure caption="ShootPortal's verified features at each stage of a job.">
            <WorkflowCoverageMap highlight={["request", "estimate", "pay"]} />
          </Figure>
          <h3>What&apos;s automated, what&apos;s centralized, and what stays with you</h3>
          <p>
            <strong>Automated:</strong> the preliminary estimate and its travel fee, reminder emails for open
            proposals and payments, and some stage changes, such as moving a project to Delivered after payment if you
            turn that on. <strong>Centralized:</strong> the estimate versions, the deposit and balance status, the
            client&apos;s messages, and the delivered files all sit on one project, so &quot;did they approve the
            revised quote?&quot; takes one click to answer. <strong>Still yours:</strong> deciding the price, scoping
            custom jobs, and anything to do with the flight itself.
          </p>
          <p>
            What it won&apos;t do: ShootPortal doesn&apos;t generate contracts or collect e-signatures, and it
            doesn&apos;t log flights or handle airspace authorization, so keep your flight-ops app and your own written
            terms. For a broader look at the options, see the comparison of{" "}
            <BlogLink slug="best-drone-business-management-software">drone business management software</BlogLink>.
            The full request-to-delivery flow is on the <SiteLink href="/how-it-works">how it works</SiteLink> page.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Load your drone rate card and quote a real job"
            body={
              <>
                Add your services from a starter template, set your travel rule, and send yourself an estimate with a
                deposit to see exactly what a client sees. If it doesn&apos;t save you time on the next quote, you
                haven&apos;t paid anything.
              </>
            }
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
          <p>
            More on quoting, scheduling, and delivering aerial jobs:{" "}
            <SiteLink href="/drone-business-management-software">ShootPortal for drone businesses</SiteLink>.
          </p>
        </>
      ),
    },
    {
      id: "avoid-underpricing",
      title: "How to avoid underpricing your drone work",
      tocLabel: "Avoiding underpricing",
      body: () => (
        <>
          <p>
            Underpricing is the most common pricing mistake among newer pilots, and it&apos;s hard to undo once a client
            base is anchored to your launch rate. A few habits help:
          </p>
          <ul>
            <li>
              <strong>Don&apos;t copy the cheapest listing in your area.</strong> You don&apos;t know their costs,
              insurance, or whether they&apos;ll still be in business next year.
            </li>
            <li>
              <strong>Price the edit, not just the flight.</strong> If editing takes twice as long as flying, the price
              should reflect that.
            </li>
            <li>
              <strong>Charge for travel and complexity explicitly.</strong> Controlled airspace, early-morning light,
              and remote sites are real costs. Show them as line items instead of absorbing them.
            </li>
            <li>
              <strong>Use minimums.</strong> A minimum job price stops tiny jobs from costing you money once travel and
              admin are counted.
            </li>
            <li>
              <strong>Review rates on a schedule.</strong> Equipment, insurance, and vehicle costs move. Recheck your
              cost-plus numbers at least once a year and adjust.
            </li>
            <li>
              <strong>Sell outcomes to commercial clients.</strong> A developer cares about marketing a property or
              documenting progress, not your flight time. Package and price around that.
            </li>
          </ul>
          <p>
            If you&apos;re still setting up the business itself, the guide to{" "}
            <BlogLink slug="how-to-start-drone-photography-business">starting a drone photography business</BlogLink>{" "}
            covers certification, insurance, and finding first clients in more depth.
          </p>
          <KeyTakeaways
            items={[
              <>
                Consumer guides and pilot guides measure different things. Use them as a range, not a rate.
              </>,
              <>Pick a pricing structure per service: hourly, day rate, project, deliverable, or recurring.</>,
              <>
                Build every price from your costs: time, editing, travel, equipment reserve, insurance, and margin.
              </>,
              <>Quote travel by distance and show it on its own line.</>,
              <>Where no reliable public number exists, cost-plus is your best guide.</>,
            ]}
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "How much should I charge for drone photography?",
      answerText:
        "Consumer data from Thumbtack's 2025 guide puts drone and aerial photography at an average of about $125/hour (typical $102–$367/hour) and about $333 per job. Pilot-side guides such as Drone U suggest $150–$400/hour for aerial photography. Use those as context, then set your own price from your costs, local market, and the job's scope.",
      answer: (
        <p>
          Consumer data from Thumbtack&apos;s 2025 guide puts drone and aerial photography at an average of about
          $125/hour (typical $102–$367/hour) and about $333 per job. Pilot-side guides such as Drone U suggest
          $150–$400/hour for aerial photography. Use those as context, then set your own price from your costs, local
          market, and the job&apos;s scope.
        </p>
      ),
    },
    {
      question: "Should I charge hourly or per project for drone work?",
      answerText:
        "Per project or per deliverable suits most real estate and commercial clients, who want one approved number. Hourly or day rates fit events, productions, and open-ended work where the client controls the schedule. Many pilots use both, depending on the service.",
      answer: (
        <p>
          Per project or per deliverable suits most real estate and commercial clients, who want one approved number.
          Hourly or day rates fit events, productions, and open-ended work where the client controls the schedule. Many
          pilots use both, depending on the service.
        </p>
      ),
    },
    {
      question: "How much does a drone roof inspection cost?",
      answerText:
        "HomeGuide (January 2026) reports $150–$600, with most homeowners paying about $375 for a standard visual inspection. Angi (July 2026) reports $120–$600 typical, and HomeAdvisor (June 2026) averages $150–$400. Thermal inspections and certification reports cost more.",
      answer: (
        <p>
          HomeGuide (January 2026) reports $150–$600, with most homeowners paying about $375 for a standard visual
          inspection. Angi (July 2026) reports $120–$600 typical, and HomeAdvisor (June 2026) averages $150–$400.
          Thermal inspections and certification reports cost more.
        </p>
      ),
    },
    {
      question: "Is drone insurance required for commercial work?",
      answerText:
        "Not federally. The FAA said in its 2016 Part 107 rule that it lacks authority to require insurance. Clients, venues, and some states or localities may require it, and you remain liable for damage, so most commercial operators carry liability coverage.",
      answer: (
        <p>
          Not federally. The FAA said in its 2016 Part 107 rule that it lacks authority to require insurance. Clients,
          venues, and some states or localities may require it, and you remain liable for damage, so most commercial
          operators carry liability coverage.
        </p>
      ),
    },
    {
      question: "How should I charge travel fees for drone jobs?",
      answerText:
        "Either use distance tiers (a flat fee per band of miles beyond your home zone) or a free radius plus a per-mile rate with a cap. Base the rate on your vehicle costs and time, and show travel as a separate line on the quote.",
      answer: (
        <p>
          Either use distance tiers (a flat fee per band of miles beyond your home zone) or a free radius plus a
          per-mile rate with a cap. Base the rate on your vehicle costs and time, and show travel as a separate line on
          the quote.
        </p>
      ),
    },
  ],
  related: [
    "best-drone-business-management-software",
    "how-to-start-drone-photography-business",
    "real-estate-photography-pricing-guide",
  ],
  cta: {
    title: "Quote every flight the same way, and get paid for it.",
    body: "Turn your rate card into a service catalog, let ZIP-distance travel fees calculate themselves, and send versioned estimates with a deposit due on approval. Delivery and the balance live on the same project.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
