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
import { calculateRealEstate, formatHours, formatMoney } from "@/lib/tools/pricing-math";
import { REAL_ESTATE_DEFAULTS as D, REAL_ESTATE_PACKAGES, realEstateInputs, realEstatePriceSheet } from "@/lib/tools/defaults";
import { RealEstateCalculator } from "@/components/tools/real-estate-calculator";
import { Guide, RelatedNext, ToolHero, WorkedExample } from "@/components/tools/tool-page-parts";
import { FinalCta, SECTION_X, Section, SolutionFaq } from "@/components/solutions/solution-sections";
import { ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA } from "@/lib/solution-media";

const TOOL = getTool("real-estate-pricing");

export const revalidate = 300;
export const metadata: Metadata = {
  ...marketingPageMetadata({ title: TOOL.seoTitle, description: TOOL.description, path: TOOL.path }),
  keywords: [TOOL.primaryKeyword, ...TOOL.secondaryKeywords],
};

const FAQ = [
  {
    q: "How do I price real estate photography?",
    a: "Start from cost: your time on site, editing, travel, and admin, plus a share of your business costs, then add profit. This calculator does that for four home sizes and turns the result into a branded price list. Local demand decides how far above your costs you can go.",
  },
  {
    q: "Why price by square footage?",
    a: "Bigger homes take longer to shoot and usually need more photos, so your time and editing grow with size. Tiers keep pricing simple for agents while protecting your margin on large listings.",
  },
  {
    q: "Should I outsource editing?",
    a: "It turns editing time into a per-photo cost and frees your time for more shoots. Switch “Who edits the photos?” in the calculator to compare your prices both ways.",
  },
  {
    q: "How should I price drone, video, twilight, and 3D tours?",
    a: "Price each add-on from the extra time it adds, with the same profit rule as your main packages. Pick the add-ons you offer and the calculator puts their prices on your price list.",
  },
  {
    q: "Is anything I enter saved or sent anywhere?",
    a: "Everything you enter, including your logo, stays in your browser and is saved on this device for next time. The PDF is created on your device too. Nothing is sent to ShootPortal.",
  },
];

export default async function RealEstatePricingCalculatorPage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();
  const EX = REAL_ESTATE_PACKAGES[1];
  const ex = calculateRealEstate(realEstateInputs(D, EX.upTo, EX.photos));
  const tiers = realEstatePriceSheet(D).packages;
  const articles = TOOL.articles.map((s) => getArticle(s)).filter((a): a is NonNullable<typeof a> => !!a).map((a) => ({ slug: a.slug, title: a.title }));

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString(
              graph(
                webPageNode(TOOL.path, "Real Estate Photography Pricing Calculator", TOOL.description, [
                  { name: "Free tools", path: "/tools" },
                  { name: "Real estate pricing calculator", path: TOOL.path },
                ]),
                webAppNode(TOOL.path, "Real Estate Photography Pricing Calculator", TOOL.description),
                faqNode(FAQ)
              )
            ),
          }}
        />

        <ToolHero
          crumbs={[{ name: "Home", href: "/" }, { name: "Free tools", href: "/tools" }, { name: "Real estate pricing calculator" }]}
          title="Real estate photography pricing calculator"
          intro={
            <p>
              Answer four quick questions and get package prices for every home size. Add your logo, and download a branded price list that&apos;s ready to send to
              agents.
            </p>
          }
        />

        <section id="calculator" className="scroll-mt-24 border-b border-[#E2E8F0] bg-[#F8FAFC] pb-24 lg:pb-0">
          <div className={`${SECTION_X} py-10 lg:py-14`}>
            <RealEstateCalculator />
          </div>
        </section>

        <Guide title="How the price is built">
          <p>
            For each home size, the calculator adds up what the shoot costs you and adds profit on top, so a price never falls below what it costs you to deliver.
          </p>
          <ol>
            <li>
              <strong>Time on site</strong> grows with the home: a base time for any property, plus extra minutes per 1,000 square feet.
            </li>
            <li>
              <strong>Editing</strong> is either your time per photo or what your editing service charges per photo.
            </li>
            <li>
              <strong>Travel and admin</strong> cover the drive, scheduling, uploads, delivery, and invoicing every order needs.
            </li>
            <li>
              <strong>Business costs</strong> are each shoot&apos;s share of insurance, gear, software, and other running costs.
            </li>
            <li>
              <strong>Profit</strong> is added as a share of the price, and the price is rounded up.
            </li>
          </ol>
          <WorkedExample
            caption={`Example: ${EX.upTo.toLocaleString("en-US")} sq ft listing, ${EX.photos} photos, using the calculator's starting values`}
            rows={[
              { label: "Shoot, editing, travel, and admin", note: `${formatHours(ex.base.hours)} × ${formatMoney(D.hourlyRate)}`, value: formatMoney(ex.base.laborCost) },
              { label: "Mileage", note: `${D.travelMiles} miles × ${formatMoney(D.mileageRate)}`, value: formatMoney(ex.base.travelCost) },
              { label: "Business costs", note: "e.g. $6,000 a year ÷ 200 shoots", value: formatMoney(ex.base.overheadCost) },
              { label: "Break-even price", value: formatMoney(ex.base.totalCost) },
              { label: `Profit at ${D.profitPct}% margin`, note: "Rounded up to the nearest $5", value: formatMoney(ex.base.profit) },
            ]}
            total={{ label: "Photo package price", value: formatMoney(ex.base.price) }}
          />
          <p>These starting values show the math. They aren&apos;t recommended rates; replace them with yours.</p>
        </Guide>

        <Guide title="From one listing to a price list" tone="cloud">
          <p>
            Agents want to know the price before they book. The calculator applies your rates to four home sizes, each with a set number of photos, so you get a
            consistent package price for every listing:
          </p>
          <figure className="my-6 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
            <table className="w-full text-sm">
              <caption className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 text-left font-medium text-[#0F172A]">Example price list from the starting values</caption>
              <thead>
                <tr className="text-left text-xs text-[#64748B]">
                  <th scope="col" className="px-5 py-2 font-medium">
                    Size
                  </th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">
                    Photos
                  </th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">
                    Package
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] tabular-nums">
                {tiers.map((t) => (
                  <tr key={t.upTo}>
                    <td className="px-5 py-2.5">{t.from ? `${t.from.toLocaleString("en-US")}–${t.upTo.toLocaleString("en-US")} sq ft` : `Up to ${t.upTo.toLocaleString("en-US")} sq ft`}</td>
                    <td className="px-5 py-2.5 text-right text-[#64748B]">{t.photos}</td>
                    <td className="px-5 py-2.5 text-right font-medium">{formatMoney(t.price, { whole: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
          <p>
            Add your logo in the calculator and download your own as a branded PDF, or start from the editable{" "}
            <Link href="/resources/real-estate-photography-pricing-template">real estate photography pricing sheet template</Link>.
          </p>
        </Guide>

        <Guide title="Pricing add-ons without guesswork">
          <p>
            Add-ons are where real estate photographers often lose money, because a “quick” twilight or video adds far more editing than shooting. The calculator
            prices each one from its own on-site and editing time, with the same profit rule as your packages.
          </p>
          <ul>
            <li>
              <strong>Drone photos:</strong> setup and flight time plus editing. Check what applies to flying where the property is.
            </li>
            <li>
              <strong>Walkthrough video:</strong> usually the biggest editing load of any add-on.
            </li>
            <li>
              <strong>Twilight exteriors:</strong> a return trip or a long wait for the right light.
            </li>
            <li>
              <strong>360° tours and floor plans:</strong> capture time plus any processing, hosting, or vendor fee.
            </li>
          </ul>
          <p>
            For published price ranges and package ideas, read the <Link href="/blog/real-estate-photography-pricing-guide">real estate photography pricing guide</Link>.
          </p>
        </Guide>

        <section className="tool-page-chrome border-b border-[#E2E8F0] bg-[#0B1124]">
          <div className={`${SECTION_X} grid gap-10 py-14 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:py-20`}>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Your price list, as the menu agents order from</h2>
              <p className="mt-3 leading-relaxed text-slate-300">In ShootPortal, agents request a shoot from your service catalog on a branded form and get an automatic preliminary estimate. The request lands on your calendar workflow as a project.</p>
            </div>
            <figure>
              <ShowcaseImage image={MEDIA.booking.twoViews} frame="dark" />
              <figcaption className="mt-2 text-center text-xs text-slate-400">Real ShootPortal screens. Client details are blurred.</figcaption>
            </figure>
          </div>
        </section>

        <Section eyebrow="FAQ" title="Real estate pricing questions" tone="cloud">
          <SolutionFaq items={FAQ.map((f) => ({ q: f.q, a: <p>{f.a}</p> }))} />
        </Section>

        <RelatedNext tools={["quote-builder", "drone-pricing"]} resources={TOOL.resources} articles={articles} solution={TOOL.solution} />

        <div className="tool-page-chrome">
          <FinalCta
            ctaId="toolpage:real-estate-calculator:final"
            ctx={ctx}
            title="Turn your price list into a menu agents order from"
            body="In ShootPortal, your packages become the service catalog on your branded request form, with automatic estimates, scheduling, card payments, and MLS-ready delivery."
            secondary={{ href: "/real-estate-photography-software", label: "Real estate photography software" }}
          />
        </div>
      </MarketingShell>
    </BrandProvider>
  );
}
