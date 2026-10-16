import type { Metadata } from "next";
import { SITE } from "@/lib/site-metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import { loadBlogRenderContext } from "@/lib/blog/render-context";
import { getArticle } from "@/lib/blog/registry";
import { jsonLdString } from "@/lib/blog/structured-data";
import { getCanonicalSiteUrl } from "@/lib/site-metadata";
import { faqNode, graph, webPageNode } from "@/lib/marketing-jsonld";
import { RESOURCES } from "@/lib/resources/registry";
import { RESOURCE_FILES } from "@/lib/resources/files";
import { RESOURCE_CONTENT } from "@/lib/resources/content";
import { getSolutionPage } from "@/lib/solutions";
import { Breadcrumbs, RelatedNext } from "@/components/tools/tool-page-parts";
import { DownloadButton } from "@/components/resources/download-button";
import { ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA, type SolutionImageAsset } from "@/lib/solution-media";
import type { ResourceId } from "@/lib/resources/registry";
import { DocumentBuilder } from "@/components/tools/quote-builder";
import type { DocKind, QuoteTemplateKey } from "@/lib/tools/quote-model";
import { FinalCta, SECTION_X, Section, SolutionFaq } from "@/components/solutions/solution-sections";

export const revalidate = 300;

/** Templates you can fill in on the page, with a live preview and one-click PDF. */
const ONLINE_BUILDER: Partial<
  Record<
    ResourceId,
    {
      kind: DocKind;
      template: QuoteTemplateKey;
      storageKey: string;
      analyticsId: string;
    }
  >
> = {
  "drone-photography-quote": {
    kind: "quote",
    template: "drone",
    storageKey: "sp:tool:drone-quote:v1",
    analyticsId: "drone-quote-template",
  },
  "photography-invoice": {
    kind: "invoice",
    template: "real-estate",
    storageKey: "sp:tool:invoice:v1",
    analyticsId: "invoice-template",
  },
};

/** Real ShootPortal screens that show the workflow each template feeds into. */
const BRIDGE_IMAGE: Record<ResourceId, SolutionImageAsset> = {
  "real-estate-photography-pricing-sheet": MEDIA.booking.twoViews,
  "drone-photography-quote": MEDIA.realEstate.twoSided,
  "photography-invoice": MEDIA.invoicing.clientView,
  "real-estate-photography-shot-list": MEDIA.booking.calendar,
  "drone-photography-business-plan": MEDIA.drone.dashboard,
  "photography-client-questionnaire": MEDIA.booking.twoViews,
  "photography-project-workflow-checklist": MEDIA.workflow.stages,
};
export const dynamicParams = false;

export function generateStaticParams() {
  return RESOURCES.map((r) => ({ slug: r.slug }));
}

function find(slug: string) {
  return RESOURCES.find((r) => r.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = find((await params).slug);
  if (!r) return {};
  return {
    ...marketingPageMetadata({
      title: r.seoTitle,
      description: r.description,
      path: r.path,
    }),
    // Long titles drop the " | ShootPortal" suffix so results don't truncate them.
    ...(r.seoTitle.length + SITE.name.length + 3 > 60 ? { title: { absolute: r.seoTitle } } : {}),
    keywords: [r.primaryKeyword],
  };
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePlatformMarketingHost();
  const r = find((await params).slug);
  if (!r) notFound();
  const ctx = await loadBlogRenderContext();
  const files = RESOURCE_FILES[r.id];
  const c = RESOURCE_CONTENT[r.id];
  const sol = getSolutionPage(r.solution);
  const base = getCanonicalSiteUrl();
  const builder = ONLINE_BUILDER[r.id];
  const articles = r.articles
    .map((s) => getArticle(s))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({ slug: a.slug, title: a.title }));

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString(
              graph(
                webPageNode(r.path, c.h1, r.description, [
                  { name: "Templates", path: "/resources" },
                  { name: c.h1, path: r.path },
                ]),
                {
                  "@type": "CreativeWork",
                  "@id": `${base}${r.path}#template`,
                  name: c.h1,
                  description: r.description,
                  isAccessibleForFree: true,
                  image: `${base}${files.preview.src}`,
                  publisher: { "@id": `${base}/#organization` },
                  encoding: files.files.map((f) => ({
                    "@type": "MediaObject",
                    contentUrl: `${base}${f.href}`,
                    encodingFormat:
                      f.format === "pdf"
                        ? "application/pdf"
                        : f.format === "docx"
                          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  })),
                },
                faqNode(c.faq),
              ),
            ),
          }}
        />

        {builder ? (
          <>
            <section className="border-b border-[#E2E8F0] bg-white">
              <div className={`${SECTION_X} pb-8 pt-8 sm:pt-10 lg:pt-12`}>
                <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Templates", href: "/resources" }, { name: c.h1 }]} />
                <h1 className="mt-5 max-w-3xl text-[2.1rem] font-bold leading-[1.08] tracking-tight text-[#0F172A] [text-wrap:balance] sm:text-5xl">{c.h1}</h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#475569]">{c.intro}</p>
              </div>
            </section>
            <section id="builder" className="scroll-mt-24 border-b border-[#E2E8F0] bg-[#F8FAFC] pb-24 lg:pb-0">
              <div className={`${SECTION_X} py-8 lg:py-12`}>
                <DocumentBuilder kind={builder.kind} template={builder.template} storageKey={builder.storageKey} analyticsId={builder.analyticsId} />
                <div className="mt-10 rounded-3xl border border-[#E2E8F0] bg-white p-5 sm:p-7">
                  <h2 className="text-lg font-semibold text-[#0F172A]">Prefer a blank file?</h2>
                  <p className="mt-1 text-sm text-[#64748B]">Download the same layout to edit on your computer or print and fill in by hand.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {files.files.map((f) => (
                      <DownloadButton key={f.href} resourceId={r.id} file={f} primary={false} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="relative overflow-hidden border-b border-[#E2E8F0]">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 85% -10%, rgba(79,70,229,0.14), transparent 60%), linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)",
              }}
              aria-hidden
            />
            <div className={`${SECTION_X} relative grid gap-10 pb-14 pt-8 sm:pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:pb-20 lg:pt-12`}>
              <div>
                <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Templates", href: "/resources" }, { name: c.h1 }]} />
                <h1 className="mt-5 text-[2.1rem] font-bold leading-[1.08] tracking-tight text-[#0F172A] [text-wrap:balance] sm:text-5xl">{c.h1}</h1>
                <p className="mt-4 text-lg leading-relaxed text-[#475569]">{c.intro}</p>
                <p className="mt-4 text-sm text-[#64748B]">For: {r.audience}. Free, no email required.</p>
                <div className="mt-7 grid gap-3 sm:max-w-md">
                  {files.files.map((f, i) => (
                    <DownloadButton key={f.href} resourceId={r.id} file={f} primary={i === 0} />
                  ))}
                </div>
              </div>
              <figure className="lg:sticky lg:top-24">
                <div className="rounded-3xl bg-gradient-to-b from-[#EEF2FF] to-[#F8FAFC] p-4 sm:p-6">
                  <ShowcaseImage
                    image={{
                      src: files.preview.src,
                      width: files.preview.width,
                      height: files.preview.height,
                      alt: `Preview of the ${r.name}, first page`,
                    }}
                    frame="none"
                    priority
                    className="overflow-hidden rounded-xl bg-white shadow-[0_40px_80px_-45px_rgba(15,23,42,0.55)] ring-1 ring-[#E2E8F0]"
                  />
                </div>
                <figcaption className="mt-2 text-center text-xs text-[#64748B]">First page preview. Select to enlarge.</figcaption>
              </figure>
            </div>
          </section>
        )}

        <Section eyebrow="What's inside" title="Everything the template covers" align="left">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.inside.map((it) => (
              <li key={it.title} className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
                <h3 className="font-semibold text-[#0F172A]">{it.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{it.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section eyebrow="How to use it" title="From download to done" tone="cloud" align="left">
          <div className="grid gap-10 lg:grid-cols-2">
            <ol className="space-y-4">
              {c.steps.map((s, i) => (
                <li key={s} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#4F46E5] ring-1 ring-[#C7D2FE]">
                    {i + 1}
                  </span>
                  <p className="pt-1 leading-relaxed text-[#334155]">{s}</p>
                </li>
              ))}
            </ol>
            <div className="space-y-5">
              {c.tips.map((t) => (
                <div key={t.title} className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
                  <h3 className="font-semibold text-[#0F172A]">{t.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <section className="border-b border-[#E2E8F0] bg-[#0B1124]">
          <div className={`${SECTION_X} grid gap-10 py-14 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-20`}>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{c.productBridge.title}</h2>
              <p className="mt-3 leading-relaxed text-slate-300">{c.productBridge.body}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  data-sp-cta={`resourcepage:${r.id}:bridge`}
                  className="inline-flex min-h-12 items-center rounded-xl bg-[#4F46E5] px-6 font-semibold text-white hover:bg-[#4338CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {ctx.trialDays > 0 ? `Start Your ${ctx.trialDays}-Day Free Trial` : "Start Free"}
                </Link>
                <Link
                  href={sol.path}
                  className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-5 text-sm font-medium text-white hover:bg-white/10"
                >
                  <span className="capitalize">{sol.primaryKeyword}</span>
                </Link>
              </div>
            </div>
            <figure>
              <ShowcaseImage image={BRIDGE_IMAGE[r.id]} frame="dark" />
              <figcaption className="mt-2 text-center text-xs text-slate-400">Real ShootPortal screens. Client details are blurred.</figcaption>
            </figure>
          </div>
        </section>

        <Section eyebrow="FAQ" title="Template questions">
          <SolutionFaq items={c.faq.map((f) => ({ q: f.q, a: <p>{f.a}</p> }))} />
        </Section>

        <RelatedNext
          tools={r.tools}
          resources={RESOURCES.filter((x) => x.category === r.category && x.id !== r.id)
            .map((x) => x.id)
            .slice(0, 2)}
          articles={articles}
          solution={r.solution}
        />

        <FinalCta
          ctaId={`resourcepage:${r.id}:final`}
          ctx={ctx}
          title="Templates help. A system runs the business."
          body="ShootPortal connects requests, estimates, scheduling, client communication, payments, and delivery on one project, in a portal branded to you."
          secondary={{ href: "/resources", label: "More free templates" }}
        />
      </MarketingShell>
    </BrandProvider>
  );
}
