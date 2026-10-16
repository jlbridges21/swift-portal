import type { Metadata } from "next";
import Link from "next/link";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import { loadBlogRenderContext } from "@/lib/blog/render-context";
import { getArticle } from "@/lib/blog/registry";
import { jsonLdString } from "@/lib/blog/structured-data";
import { faqNode, graph, webAppNode, webPageNode } from "@/lib/marketing-jsonld";
import { getTool } from "@/lib/tools/registry";
import { calculateDrone, formatHours, formatMoney, formatPct, marginToMarkup, priceFromCost } from "@/lib/tools/pricing-math";
import { DRONE_DEFAULTS, droneInputs } from "@/lib/tools/defaults";
import { DroneCalculator } from "@/components/tools/drone-calculator";
import { Guide, RelatedNext, ToolHero, WorkedExample } from "@/components/tools/tool-page-parts";
import { FinalCta, SECTION_X, Section, SolutionFaq } from "@/components/solutions/solution-sections";
import { ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA } from "@/lib/solution-media";

const TOOL = getTool("drone-pricing");

export const revalidate = 300;
export const metadata: Metadata = {
  ...marketingPageMetadata({ title: TOOL.seoTitle, description: TOOL.description, path: TOOL.path }),
  keywords: [TOOL.primaryKeyword, ...TOOL.secondaryKeywords],
};

const FAQ = [
  {
    q: "How much should I charge for drone photography?",
    a: "Enough to cover your time, travel, and a share of your business costs, plus profit. This calculator gives you that number for a specific job. Local demand and competition then decide how far above it you can price; our drone pricing guide covers published rate ranges by job type.",
  },
  {
    q: "What profit margin should I use?",
    a: "There's no universal right answer. Your hourly rate already pays you, so margin is what the business keeps to replace equipment, grow, and absorb slow months. Try a few values and see how the price and your effective hourly rate move.",
  },
  {
    q: "What's the difference between margin and markup?",
    a: "Margin is profit as a share of the price; markup is profit as a share of your cost. A 30% margin on $100 of cost gives a $142.86 price, while a 30% markup gives $130. The calculator uses margin; set it under Fine-tune.",
  },
  {
    q: "Should I charge by the hour or by the project?",
    a: "Most clients prefer a project price they can approve. Use the hours in this calculator to build that price, then quote the job, not the hour. Keep an hourly rate for open-ended extras like additional revision rounds.",
  },
  {
    q: "How do I account for my drone and equipment?",
    a: "Add up what you spend in a year on insurance, software, and replacing aircraft, batteries, and cameras, then divide by the jobs you expect to do. Enter that as business costs per job under Fine-tune.",
  },
  {
    q: "Is anything I enter saved or sent anywhere?",
    a: "Everything you enter, including your logo, stays in your browser and is saved on this device for next time. The PDF is created on your device too. Nothing is sent to ShootPortal.",
  },
];

export default async function DronePricingCalculatorPage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();
  const ex = calculateDrone(droneInputs(DRONE_DEFAULTS));
  const articles = TOOL.articles.map((s) => getArticle(s)).filter((a): a is NonNullable<typeof a> => !!a).map((a) => ({ slug: a.slug, title: a.title }));

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString(
              graph(
                webPageNode(TOOL.path, "Drone Photography Pricing Calculator", TOOL.description, [
                  { name: "Free tools", path: "/tools" },
                  { name: "Drone pricing calculator", path: TOOL.path },
                ]),
                webAppNode(TOOL.path, "Drone Photography Pricing Calculator", TOOL.description),
                faqNode(FAQ)
              )
            ),
          }}
        />

        <ToolHero
          crumbs={[{ name: "Home", href: "/" }, { name: "Free tools", href: "/tools" }, { name: "Drone pricing calculator" }]}
          title="Drone photography pricing calculator"
          intro={
            <p>
              Answer three quick questions about the job and see what to charge. Add your logo, and download a branded quote that&apos;s ready to send to your
              client.
            </p>
          }
        />

        <section id="calculator" className="scroll-mt-24 border-b border-[#E2E8F0] bg-[#F8FAFC] pb-24 lg:pb-0">
          <div className={`${SECTION_X} py-10 lg:py-14`}>
            <DroneCalculator />
          </div>
        </section>

        <Guide title="How the calculator works">
          <p>
            It uses cost-plus pricing: add up what the job costs you, then add profit. Your price is never below what the job costs you to deliver.
          </p>
          <ol>
            <li>
              <strong>Your time.</strong> Every hour of the job (planning, flying, editing, and driving) multiplied by what you pay yourself per hour. Extras add
              their own time.
            </li>
            <li>
              <strong>Travel.</strong> Round-trip miles multiplied by your vehicle cost per mile.
            </li>
            <li>
              <strong>Business costs.</strong> Each job&apos;s share of insurance, gear, software, and other running costs.
            </li>
            <li>
              <strong>Profit.</strong> A share of the price on top, then any rush fee, then the price is rounded up so rounding never cuts into profit.
            </li>
          </ol>
          <WorkedExample
            caption={`Example: ${formatHours(ex.hours)} real estate aerial job using the calculator's starting values`}
            rows={[
              { label: "Your time", note: `${formatHours(ex.hours)} × ${formatMoney(DRONE_DEFAULTS.hourlyRate)}`, value: formatMoney(ex.laborCost) },
              { label: "Travel", note: `${DRONE_DEFAULTS.travelMiles} miles × ${formatMoney(DRONE_DEFAULTS.mileageRate)}`, value: formatMoney(ex.travelCost) },
              { label: "Business costs", note: "e.g. $6,000 a year ÷ 75 jobs", value: formatMoney(ex.overheadCost) },
              { label: "Break-even price", value: formatMoney(ex.totalCost) },
              { label: `Profit at ${DRONE_DEFAULTS.profitPct}% margin`, note: "Rounded up to the nearest $5", value: formatMoney(ex.profit) },
            ]}
            total={{ label: "Price to quote", value: formatMoney(ex.price) }}
          />
          <p>
            These starting values are examples to show the math, not recommended rates. Replace them with your own and the price updates instantly.
          </p>
        </Guide>

        <Guide title="Margin vs. markup: why your number changes" tone="cloud">
          <p>
            <strong>Margin</strong> is profit as a share of the price. <strong>Markup</strong> is profit as a share of your cost. They describe the same profit
            differently, so the same percentage gives a different price. Mixing them up is one of the most common ways small businesses underprice.
          </p>
          <figure className="my-6 overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white">
            <table className="w-full min-w-[28rem] text-sm">
              <caption className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 text-left font-medium text-[#0F172A]">On a job that costs you $500</caption>
              <thead>
                <tr className="text-left text-xs text-[#64748B]">
                  <th scope="col" className="px-5 py-2 font-medium">
                    Percentage
                  </th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">
                    Price at that margin
                  </th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">
                    Price at that markup
                  </th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">
                    Margin as markup
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] tabular-nums">
                {[15, 25, 35, 50].map((p) => (
                  <tr key={p}>
                    <td className="px-5 py-2.5">{p}%</td>
                    <td className="px-5 py-2.5 text-right">{formatMoney(priceFromCost(500, p, "margin"))}</td>
                    <td className="px-5 py-2.5 text-right">{formatMoney(priceFromCost(500, p, "markup"))}</td>
                    <td className="px-5 py-2.5 text-right text-[#64748B]">{formatPct(marginToMarkup(p), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
          <p>The calculator works in margin: “I want to keep 25% of what the client pays.” If you think in “cost plus 25%,” enter the matching margin from the last column instead.</p>
        </Guide>

        <Guide title="What to count as cost">
          <h3>Time you might be leaving out</h3>
          <ul>
            <li>Checking airspace, requesting any authorization you need, and researching the site before you fly.</li>
            <li>Setup, pre-flight checks, battery swaps, and waiting for the right light or wind.</li>
            <li>Culling, editing, color, exporting, uploading, and answering revision requests.</li>
            <li>Quoting, scheduling, rescheduling for weather, invoicing, and chasing payment.</li>
          </ul>
          <h3>Business costs (spread across your jobs)</h3>
          <ul>
            <li>A replacement fund for your aircraft, batteries, cameras, and accessories.</li>
            <li>Insurance, software subscriptions, cloud storage, website, phone, and accounting.</li>
            <li>Keeping your Remote Pilot Certificate current and any other training you take.</li>
          </ul>
          <h3>One-off job costs</h3>
          <ul>
            <li>A visual observer or second pilot, location or permit fees, equipment rentals, licensed music, parking, and tolls. Add the time they take to the job&apos;s hours, or raise the price on the quote.</li>
          </ul>
          <p>
            Check what applies where you fly: requirements differ by location and type of operation. This calculator doesn&apos;t give legal or tax advice.
          </p>
        </Guide>

        <Guide title="Turning the number into a quote" tone="cloud">
          <ul>
            <li>
              <strong>Know your floor.</strong> The break-even price is the least you can charge without losing money. A short local job still carries setup,
              editing, and admin time, which is why many pilots set a minimum job price.
            </li>
            <li>
              <strong>Quote the project.</strong> Turn your hours into packages clients can approve, with optional add-ons listed separately.
            </li>
            <li>
              <strong>Take a deposit.</strong> A deposit confirms the booking. Weather reschedules are part of drone work, so say how you handle them before the job.
            </li>
            <li>
              <strong>Check the market.</strong> Your costs set the floor; demand sets the ceiling. Our <Link href="/blog/drone-photography-pricing-guide">drone photography pricing guide</Link>{" "}
              covers published rate ranges by job type.
            </li>
          </ul>
          <p>
            The calculator makes a branded quote for you: add your logo and the client&apos;s details and click Download PDF. For a quote with several
            services, use the <Link href="/resources/drone-photography-quote-template">drone photography quote template</Link>.
          </p>
        </Guide>

        <section className="tool-page-chrome border-b border-[#E2E8F0] bg-[#0B1124]">
          <div className={`${SECTION_X} grid gap-10 py-14 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:py-20`}>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">From your price to an approved proposal</h2>
              <p className="mt-3 leading-relaxed text-slate-300">In ShootPortal, the price you just worked out becomes an estimate built from your service catalog, with travel fees added automatically. The client approves it in your branded portal, and approval can create the deposit link.</p>
            </div>
            <figure>
              <ShowcaseImage image={MEDIA.realEstate.twoSided} frame="dark" />
              <figcaption className="mt-2 text-center text-xs text-slate-400">Real ShootPortal screens. Client details are blurred.</figcaption>
            </figure>
          </div>
        </section>

        <Section eyebrow="FAQ" title="Drone pricing questions">
          <SolutionFaq items={FAQ.map((f) => ({ q: f.q, a: <p>{f.a}</p> }))} />
        </Section>

        <RelatedNext tools={["real-estate-pricing", "quote-builder"]} resources={TOOL.resources} articles={articles} solution={TOOL.solution} />

        <div className="tool-page-chrome">
          <FinalCta
            ctaId="toolpage:drone-calculator:final"
            ctx={ctx}
            title="Know what to charge. Now manage the job."
            body="ShootPortal turns your quote into a project: estimate with travel fees, flight times clients accept, video review, deposits and card payments, and delivery in your branded portal."
            secondary={{ href: "/drone-business-management-software", label: "Drone business software" }}
          />
        </div>
      </MarketingShell>
    </BrandProvider>
  );
}
