import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { Button } from "@/components/ui/button";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { getActivePartnerLandingBySlug } from "@/lib/partner-landing";
import { getCanonicalSiteUrl } from "@/lib/site-metadata";
import { sanitizePlainText } from "@/lib/landing-content";

type PageProps = { params: Promise<{ slug: string }> };

/**
 * SEO: noindex partner landings.
 * Why: thin personalized CTAs that largely duplicate /partners. Indexing many near-duplicates
 * would dilute the authoritative Partner Program page. Keep them out of sitemap.xml; use
 * canonical → /partners so any accidental crawl consolidates.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const canonical = `${getCanonicalSiteUrl()}/partners`;
  try {
    await requirePlatformMarketingHost();
    const landing = await getActivePartnerLandingBySlug(slug);
    if (!landing) {
      return { title: "Not found", robots: { index: false, follow: false } };
    }
    const title = sanitizePlainText(landing.headline, 80) || "ShootPortal Partner";
    const description =
      sanitizePlainText(landing.description, 160) ||
      `Start a ShootPortal trial with ${landing.partner.brand_name}.`;
    return {
      title,
      description,
      robots: { index: false, follow: false },
      alternates: { canonical },
    };
  } catch {
    return {
      title: "ShootPortal",
      robots: { index: false, follow: false },
      alternates: { canonical },
    };
  }
}

export default async function PartnerLandingSlugPage({ params }: PageProps) {
  // Apex only — tenant subdomain / custom domain → normal 404 (never a partner page).
  await requirePlatformMarketingHost();
  const { slug } = await params;
  const landing = await getActivePartnerLandingBySlug(slug);
  if (!landing) notFound();

  const headline = sanitizePlainText(landing.headline, 200);
  const description = sanitizePlainText(landing.description, 2000);
  const cta = sanitizePlainText(landing.cta_label, 80) || "Start free trial";
  const offer = landing.offer_text ? sanitizePlainText(landing.offer_text, 500) : null;
  const photo = landing.photo_url;

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
              {landing.partner.brand_name}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0F172A] sm:text-5xl">
              {headline}
            </h1>
            {description ? (
              <p className="mt-5 text-lg leading-relaxed text-[#475569]">{description}</p>
            ) : null}
            {offer ? (
              <p className="mt-4 rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#0F172A]">
                {offer}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button className="min-h-11 bg-[#4F46E5] px-6 text-white hover:bg-[#4338CA]">
                  {cta}
                </Button>
              </Link>
              <Link href="/partners">
                <Button variant="outline" className="min-h-11 border-[#E2E8F0] bg-white px-6">
                  About the Partner Program
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-[#64748B]">
              Visiting this page attributes your signup to {landing.partner.brand_name} when you
              create a ShootPortal business (same as their referral link).
            </p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#E2E8F0]">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- partner-provided https URL
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[#64748B]">
                ShootPortal — client portal for photographers &amp; drone professionals
              </div>
            )}
          </div>
        </section>
      </MarketingShell>
    </BrandProvider>
  );
}
