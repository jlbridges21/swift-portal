import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import { loadBlogRenderContext } from "@/lib/blog/render-context";
import { jsonLdString } from "@/lib/blog/structured-data";
import { getCanonicalSiteUrl } from "@/lib/site-metadata";
import { graph, webPageNode } from "@/lib/marketing-jsonld";
import { RESOURCE_CATEGORIES, RESOURCES } from "@/lib/resources/registry";
import { RESOURCE_FILES } from "@/lib/resources/files";
import { TOOLS } from "@/lib/tools/registry";
import { Breadcrumbs } from "@/components/tools/tool-page-parts";
import { FinalCta, SECTION_X } from "@/components/solutions/solution-sections";

export const revalidate = 300;
export const metadata: Metadata = marketingPageMetadata({
  title: "Free Photography Business Templates",
  description: "Free photography business templates: pricing sheet, drone quote, invoice, real estate shot list, drone business plan, client questionnaire, and workflow checklist.",
  path: "/resources",
});

const FORMAT_LABEL = { pdf: "PDF", docx: "Word", xlsx: "Excel" } as const;

export default async function ResourcesHubPage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();
  const base = getCanonicalSiteUrl();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString(
              graph(webPageNode("/resources", "Free photography business templates", "Free downloadable templates for photographers, videographers, and drone pilots.", [{ name: "Templates", path: "/resources" }]), {
                "@type": "ItemList",
                itemListElement: RESOURCES.map((r, i) => ({ "@type": "ListItem", position: i + 1, url: `${base}${r.path}`, name: r.name })),
              })
            ),
          }}
        />

        <section className="relative overflow-hidden border-b border-[#E2E8F0]">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% -10%, rgba(79,70,229,0.15), transparent 60%), linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)" }} aria-hidden />
          <div className={`${SECTION_X} relative pb-14 pt-8 sm:pt-10 lg:pb-16 lg:pt-12`}>
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Templates" }]} />
            <h1 className="mt-6 max-w-3xl text-[2.25rem] font-bold leading-[1.06] tracking-tight text-[#0F172A] [text-wrap:balance] sm:text-[3.25rem]">
              Free photography business templates
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#475569]">
              Price sheets, quotes, invoices, checklists, and plans for photographers, videographers, and drone pilots. Editable in Word, Excel, or Google, with printable
              PDFs. Free, no email required.
            </p>
            <nav aria-label="Template categories" className="mt-8 flex flex-wrap gap-2">
              {RESOURCE_CATEGORIES.map((c) => (
                <a key={c.key} href={`#${c.key}`} className="inline-flex min-h-10 items-center rounded-full border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334155] hover:border-[#C7D2FE] hover:text-[#0F172A]">
                  {c.label}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {RESOURCE_CATEGORIES.map((cat, ci) => {
          const items = RESOURCES.filter((r) => r.category === cat.key);
          if (!items.length) return null;
          return (
            <section key={cat.key} id={cat.key} className={`scroll-mt-24 border-b border-[#E2E8F0] ${ci % 2 === 0 ? "bg-[#F8FAFC]" : "bg-white"}`}>
              <div className={`${SECTION_X} py-12 lg:py-16`}>
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">{cat.label}</h2>
                  <p className="mt-2 text-[#475569]">{cat.blurb}</p>
                </div>
                <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((r) => {
                    const files = RESOURCE_FILES[r.id];
                    const formats = [...new Set(files.files.map((f) => FORMAT_LABEL[f.format]))];
                    return (
                      <li key={r.id}>
                        <Link
                          href={r.path}
                          className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:shadow-[0_30px_60px_-40px_rgba(79,70,229,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
                        >
                          <span className="relative block h-56 overflow-hidden bg-gradient-to-b from-[#EEF2FF] to-[#F8FAFC] px-6 pt-6">
                            <Image
                              src={files.preview.src}
                              alt=""
                              width={files.preview.width}
                              height={files.preview.height}
                              sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                              className="h-auto w-full rounded-t-lg shadow-[0_20px_40px_-25px_rgba(15,23,42,0.6)] ring-1 ring-[#E2E8F0] transition-transform duration-300 group-hover:-translate-y-1"
                            />
                          </span>
                          <span className="flex flex-1 flex-col p-5">
                            <span className="font-semibold text-[#0F172A]">{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</span>
                            <span className="mt-1.5 text-sm leading-relaxed text-[#475569]">{r.summary}</span>
                            <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
                              {formats.map((f) => (
                                <span key={f} className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-medium text-[#475569]">
                                  {f}
                                </span>
                              ))}
                              <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-[#4F46E5]">
                                Get it <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                              </span>
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}

        <section className="border-b border-[#E2E8F0] bg-white">
          <div className={`${SECTION_X} py-12 lg:py-16`}>
            <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">Need the numbers first?</h2>
            <p className="mt-2 max-w-2xl text-[#475569]">Free calculators work out what to charge, and the quote builder turns it into a PDF you can send.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {TOOLS.map((t) => (
                <li key={t.key}>
                  <Link href={t.path} className="flex h-full gap-3 rounded-2xl border border-[#E2E8F0] p-4 hover:border-[#C7D2FE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]">
                    <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-[#4F46E5]" aria-hidden />
                    <span>
                      <span className="block text-sm font-semibold text-[#0F172A]">{t.name.charAt(0).toUpperCase() + t.name.slice(1)}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[#64748B]">{t.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <FinalCta
          ctaId="resourcepage:hub:final"
          ctx={ctx}
          title="Run the whole job in one place"
          body="ShootPortal connects requests, estimates, scheduling, client communication, payments, video review, and delivery, in a portal branded to your business."
          secondary={{ href: "/how-it-works", label: "See how it works" }}
        />
      </MarketingShell>
    </BrandProvider>
  );
}
