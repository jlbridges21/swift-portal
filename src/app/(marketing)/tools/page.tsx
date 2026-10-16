import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, FileText, Receipt } from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import { loadBlogRenderContext } from "@/lib/blog/render-context";
import { jsonLdString } from "@/lib/blog/structured-data";
import { getCanonicalSiteUrl } from "@/lib/site-metadata";
import { graph, webPageNode } from "@/lib/marketing-jsonld";
import { TOOLS, type ToolKey } from "@/lib/tools/registry";
import { RESOURCES } from "@/lib/resources/registry";
import { calculateDrone, formatMoney } from "@/lib/tools/pricing-math";
import { DRONE_DEFAULTS, droneInputs, REAL_ESTATE_DEFAULTS, realEstatePriceSheet } from "@/lib/tools/defaults";
import { Breadcrumbs } from "@/components/tools/tool-page-parts";
import { FinalCta, SECTION_X } from "@/components/solutions/solution-sections";

export const revalidate = 300;
export const metadata: Metadata = marketingPageMetadata({
  title: "Free Tools for Photographers & Drone Pilots",
  description: "Free pricing calculators and a quote builder for real estate photographers, drone pilots, and videographers. No signup, and your numbers stay in your browser.",
  path: "/tools",
});

const ICONS: Record<ToolKey, typeof Calculator> = { "drone-pricing": Calculator, "real-estate-pricing": Calculator, "quote-builder": Receipt };

/** A small static preview of each tool's output, built from the same math the tool uses. */
function ToolPreview({ k }: { k: ToolKey }) {
  if (k === "drone-pricing") {
    const r = calculateDrone(droneInputs(DRONE_DEFAULTS));
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4" aria-hidden>
        <div className="flex items-start justify-between">
          <span className="flex h-7 w-14 items-center justify-center rounded border border-dashed border-[#CBD5E1] text-[0.6rem] text-[#94A3B8]">Your logo</span>
          <p className="text-lg font-semibold text-[#4F46E5]">Quote</p>
        </div>
        <p className="mt-3 flex justify-between text-xs text-[#475569]">
          <span>Real estate aerial photography</span>
          <span className="font-semibold tabular-nums text-[#0F172A]">{formatMoney(r.price, { whole: true })}</span>
        </p>
        <p className="mt-2 flex justify-between rounded bg-[#4F46E5] px-1.5 py-0.5 text-xs font-medium text-white">
          <span>Deposit to book</span>
          <span className="tabular-nums">{formatMoney(r.deposit, { whole: true })}</span>
        </p>
      </div>
    );
  }
  if (k === "real-estate-pricing") {
    const { packages } = realEstatePriceSheet(REAL_ESTATE_DEFAULTS);
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 text-sm" aria-hidden>
        <div className="flex items-start justify-between">
          <span className="flex h-7 w-14 items-center justify-center rounded border border-dashed border-[#CBD5E1] text-[0.6rem] text-[#94A3B8]">Your logo</span>
          <p className="text-lg font-semibold text-[#4F46E5]">Price list</p>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {packages.map((p) => (
            <p key={p.upTo} className="rounded border border-[#E2E8F0] px-2 py-1">
              <span className="block text-[0.65rem] text-[#64748B]">{p.name}</span>
              <span className="font-semibold tabular-nums text-[#4F46E5]">{formatMoney(p.price, { whole: true })}</span>
            </p>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 text-sm" aria-hidden>
      <div className="flex items-start justify-between">
        <p className="font-semibold text-[#0F172A]">Your studio</p>
        <p className="text-lg font-semibold text-[#4F46E5]">Quote</p>
      </div>
      <div className="mt-3 space-y-1 text-xs text-[#475569]">
        <p className="flex justify-between">
          <span>Listing photos</span>
          <span>$ —</span>
        </p>
        <p className="flex justify-between">
          <span>Drone photos</span>
          <span>$ —</span>
        </p>
        <p className="flex justify-between rounded bg-[#EEF2FF] px-1 font-medium text-[#3730A3]">
          <span>Deposit to book</span>
          <span>$ —</span>
        </p>
      </div>
    </div>
  );
}

export default async function ToolsHubPage() {
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
              graph(webPageNode("/tools", "Free tools for photographers and drone pilots", "Free pricing calculators and a quote builder.", [{ name: "Free tools", path: "/tools" }]), {
                "@type": "ItemList",
                itemListElement: TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: `${base}${t.path}`, name: t.name })),
              })
            ),
          }}
        />

        <section className="relative overflow-hidden border-b border-[#E2E8F0]">
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% -10%, rgba(79,70,229,0.15), transparent 60%), linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)" }} aria-hidden />
          <div className={`${SECTION_X} relative pb-14 pt-8 sm:pt-10 lg:pb-16 lg:pt-12`}>
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Free tools" }]} />
            <h1 className="mt-6 max-w-3xl text-[2.25rem] font-bold leading-[1.06] tracking-tight text-[#0F172A] [text-wrap:balance] sm:text-[3.25rem]">
              Free tools for photographers and drone pilots
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#475569]">
              Work out what to charge, build a price list, and send a professional quote. No account, no watermark, and your numbers never leave your browser.
            </p>
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className={`${SECTION_X} py-12 lg:py-16`}>
            <h2 className="sr-only">Tools</h2>
            <ul className="grid gap-5 lg:grid-cols-3">
              {TOOLS.map((t) => {
                const Icon = ICONS[t.key];
                return (
                  <li key={t.key}>
                    <Link
                      href={t.path}
                      className="group flex h-full flex-col rounded-3xl border border-[#E2E8F0] bg-white p-6 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:shadow-[0_30px_60px_-40px_rgba(79,70,229,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="mt-4 text-xl font-semibold text-[#0F172A]">{t.name.charAt(0).toUpperCase() + t.name.slice(1)}</span>
                      <span className="mt-2 text-sm leading-relaxed text-[#475569]">{t.description}</span>
                      <span className="mt-5 block rounded-2xl bg-[#F8FAFC] p-3">
                        <ToolPreview k={t.key} />
                      </span>
                      <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-[#4F46E5]">
                        Open the tool <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="border-b border-[#E2E8F0] bg-white">
          <div className={`${SECTION_X} grid gap-10 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-20`}>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Free templates too</h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                Editable price sheets, quote and invoice templates, a real estate shot list, a drone business plan, and a workflow checklist. Download them free, no
                email required.
              </p>
              <Link href="/resources" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E2E8F0] px-5 text-sm font-semibold text-[#0F172A] hover:border-[#C7D2FE] hover:bg-[#EEF2FF]/50">
                Browse the template library <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {RESOURCES.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <Link href={r.path} className="flex h-full gap-3 rounded-2xl border border-[#E2E8F0] p-4 hover:border-[#C7D2FE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#4F46E5]" aria-hidden />
                    <span>
                      <span className="block text-sm font-semibold text-[#0F172A]">{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[#64748B]">{r.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <FinalCta
          ctaId="toolpage:hub:final"
          ctx={ctx}
          title="When the quote is accepted, run the job in ShootPortal"
          body="Requests, estimates, scheduling, client portal, video review, payments, and delivery in one place, built by a working drone and real estate photographer."
          secondary={{ href: "/how-it-works", label: "See how it works" }}
        />
      </MarketingShell>
    </BrandProvider>
  );
}
