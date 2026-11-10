import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { loadPublicListingBySlug, publicView, recordListingView } from "@/lib/marketing/public";
import { ListingWebsite, MarketingFontFaces } from "@/components/marketing/website/listing-website";
import { LISTING_STATUS_LABEL, clampText } from "@/lib/marketing/model";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const viewport: Viewport = { themeColor: "#111111", colorScheme: "light" };

async function load(slug: string) {
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return null;
  const listing = await loadPublicListingBySlug(host.businessId, slug);
  if (!listing) return null;
  return { host, listing, view: publicView(listing) };
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Listing not found", robots: { index: false, follow: false } };
  const { view } = data;
  const base = await origin();
  const place = [view.property.address, view.property.locality].filter(Boolean).join(", ");
  const title = [place || "Property", view.priceText].filter(Boolean).join(" — ");
  const description = clampText(
    view.property.description ||
      [LISTING_STATUS_LABEL[view.property.status], view.facts.map((f) => `${f.value} ${f.label}`).join(", "), view.agent.name && `Listed by ${view.agent.name}`]
        .filter(Boolean)
        .join(" · "),
    180
  );
  const image = view.hero ? `${base}${view.hero.url.replace("s=large", "s=medium")}` : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${base}${data.host.source === "listing_domain" ? `/${slug}` : `/l/${slug}`}` },
    openGraph: { type: "website", title, description, images: image ? [{ url: image, width: 1600 }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
    icons: view.branding.logoUrl ? { icon: view.branding.logoUrl } : undefined,
  };
}

/** Public property website. */
export default async function PropertyWebsitePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { listing, view } = data;
  void recordListingView(listing.businessId, listing.kitId);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: [view.property.address, view.property.locality].filter(Boolean).join(", "),
    description: view.property.description || undefined,
    image: view.hero ? [view.hero.url] : undefined,
    offers: view.priceText && view.property.price ? { "@type": "Offer", price: view.property.price, priceCurrency: "USD" } : undefined,
  };

  return (
    <>
      <MarketingFontFaces />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="min-h-screen">
        <ListingWebsite view={view} />
      </main>
    </>
  );
}
