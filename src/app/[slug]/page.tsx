import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PartnerLandingPublicView } from "@/components/partner/partner-landing-public-view";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import {
  getActivePartnerLandingBySlug,
  resolvePartnerLandingContent,
} from "@/lib/partner-landing";
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
    const content = await resolvePartnerLandingContent(landing);
    const title = sanitizePlainText(content.headline, 80) || "ShootPortal Partner";
    const description =
      sanitizePlainText(content.subheadline, 160) ||
      `Start a ShootPortal trial with ${content.brandName}.`;
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

  const content = await resolvePartnerLandingContent(landing);
  return <PartnerLandingPublicView content={content} />;
}
