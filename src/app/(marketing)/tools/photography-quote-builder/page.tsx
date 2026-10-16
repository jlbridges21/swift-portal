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
import { QuoteBuilder } from "@/components/tools/quote-builder";
import { Guide, RelatedNext, ToolHero } from "@/components/tools/tool-page-parts";
import { FinalCta, SECTION_X, Section, SolutionFaq } from "@/components/solutions/solution-sections";
import { ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA } from "@/lib/solution-media";

const TOOL = getTool("quote-builder");

export const revalidate = 300;
export const metadata: Metadata = {
  ...marketingPageMetadata({ title: TOOL.seoTitle, description: TOOL.description, path: TOOL.path }),
  keywords: [TOOL.primaryKeyword, ...TOOL.secondaryKeywords],
};

const FAQ = [
  {
    q: "Is the photography quote builder really free?",
    a: "Yes. There's no account, no watermark, and no limit. Build as many quotes as you like and download them as PDFs.",
  },
  {
    q: "Where is my information stored?",
    a: "Only in your browser on this device, so your business details are filled in next time. Your logo is read on your device and never uploaded. Clear it any time with Start over.",
  },
  {
    q: "What's the difference between a quote, an estimate, and an invoice?",
    a: "An estimate is an early approximation. A quote is a specific price for a defined scope that the client can accept. An invoice asks for payment for work that's been agreed or delivered.",
  },
  {
    q: "Should I include a deposit?",
    a: "Many photographers take a deposit to confirm the date and cover early costs. The builder shows the deposit and remaining balance so the client knows exactly what's due and when.",
  },
  {
    q: "Can I add sales tax?",
    a: "Yes, enter a tax rate. Whether tax applies to photography depends on where you work and what you deliver, so check your local rules.",
  },
  {
    q: "Does this create a quote inside ShootPortal?",
    a: "No. This free tool works on its own. In ShootPortal, proposals are built from your service catalog and your client approves them online, on the same project that handles scheduling, payment, and delivery.",
  },
];

export default async function QuoteBuilderPage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();
  const articles = TOOL.articles.map((s) => getArticle(s)).filter((a): a is NonNullable<typeof a> => !!a).map((a) => ({ slug: a.slug, title: a.title }));

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString(
              graph(
                webPageNode(TOOL.path, "Photography Quote Builder", TOOL.description, [
                  { name: "Free tools", path: "/tools" },
                  { name: "Photography quote builder", path: TOOL.path },
                ]),
                webAppNode(TOOL.path, "Photography Quote Builder", TOOL.description),
                faqNode(FAQ)
              )
            ),
          }}
        />

        <ToolHero
          crumbs={[{ name: "Home", href: "/" }, { name: "Free tools", href: "/tools" }, { name: "Photography quote builder" }]}
          title="Free photography quote builder"
          intro={
            <p>
              Build a polished quote for a photo, video, or drone job in a few minutes: your logo, the client and project, services with optional add-ons, deposit, and
              terms. Download it as a PDF and send it today.
            </p>
          }
        />

        <section id="quote-builder" className="scroll-mt-24 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className={`${SECTION_X} py-10 lg:py-14`}>
            <QuoteBuilder />
          </div>
        </section>

        <Guide title="What a photography quote should include">
          <ul>
            <li>
              <strong>Who and what:</strong> your business details, the client, and the project with its location and date.
            </li>
            <li>
              <strong>Deliverables in plain words:</strong> number of edited photos, video length, file formats, and turnaround, so the client knows exactly what
              they&apos;re buying.
            </li>
            <li>
              <strong>Line items:</strong> each service with quantity and price, plus travel if you charge it.
            </li>
            <li>
              <strong>Options:</strong> add-ons listed separately so the client can say yes to more without asking for a new quote.
            </li>
            <li>
              <strong>Money terms:</strong> total, deposit to book, balance due, and when each is paid.
            </li>
            <li>
              <strong>Validity and policies:</strong> how long the price holds, how rescheduling works, and how the images may be used.
            </li>
          </ul>
        </Guide>

        <Guide title="How to write quotes clients approve" tone="cloud">
          <ol>
            <li>
              <strong>Send it fast.</strong> A quote sent the same day, while the client is still deciding, has the best chance of being accepted.
            </li>
            <li>
              <strong>Lead with the outcome.</strong> Describe what the client gets (listing photos ready for the MLS, a 60-second brand film) before the technical
              detail.
            </li>
            <li>
              <strong>Offer a choice.</strong> Two or three packages, or a core package with optional add-ons, makes the decision “which one” instead of “whether.”
            </li>
            <li>
              <strong>Be specific about money.</strong> Show the deposit and the balance, and when each is due.
            </li>
            <li>
              <strong>Set an expiry date.</strong> A validity window protects you from old pricing and gives the client a reason to decide.
            </li>
          </ol>
          <p>
            Not sure what to charge? Work it out first with the <Link href="/tools/real-estate-photography-pricing-calculator">real estate photography pricing calculator</Link> or
            the <Link href="/tools/drone-photography-pricing-calculator">drone photography pricing calculator</Link>.
          </p>
        </Guide>

        <Guide title="Quote, estimate, or invoice?">
          <p>
            An <strong>estimate</strong> is a first approximation, useful when the scope isn&apos;t fixed. A <strong>quote</strong> commits to a price for a defined
            scope, which the client accepts. An <strong>invoice</strong> requests payment for agreed or delivered work. If you need an invoice next, use the free{" "}
            <Link href="/resources/photography-invoice-template">photography invoice template</Link>.
          </p>
          <p>
            Running every job on separate documents gets hard to track. See how <Link href="/photography-invoicing-software">photography invoicing software</Link> keeps
            estimates, deposits, and payments on the project they belong to.
          </p>
        </Guide>

        <section className="tool-page-chrome border-b border-[#E2E8F0] bg-[#0B1124]">
          <div className={`${SECTION_X} grid gap-10 py-14 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:py-20`}>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Quotes clients approve online</h2>
              <p className="mt-3 leading-relaxed text-slate-300">In ShootPortal, you send the proposal from the project and the client approves it or asks for changes in your branded portal, with the estimate PDF one click away.</p>
            </div>
            <figure>
              <ShowcaseImage image={MEDIA.realEstate.twoSided} frame="dark" />
              <figcaption className="mt-2 text-center text-xs text-slate-400">Real ShootPortal screens. Client details are blurred.</figcaption>
            </figure>
          </div>
        </section>

        <Section eyebrow="FAQ" title="Quote builder questions" tone="cloud">
          <SolutionFaq items={FAQ.map((f) => ({ q: f.q, a: <p>{f.a}</p> }))} />
        </Section>

        <RelatedNext tools={["real-estate-pricing", "drone-pricing"]} resources={TOOL.resources} articles={articles} solution={TOOL.solution} />

        <div className="tool-page-chrome">
          <FinalCta
            ctaId="toolpage:quote-builder:final"
            ctx={ctx}
            title="Creating a quote is just the beginning"
            body="In ShootPortal, clients approve proposals online, and the same project carries the shoot time, messages, card payments, video review, and delivery."
            secondary={{ href: "/photography-business-management-software", label: "See the full platform" }}
          />
        </div>
      </MarketingShell>
    </BrandProvider>
  );
}
