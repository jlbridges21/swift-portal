import type { Metadata } from "next";
import { SiteServices } from "@/components/website/site-pages";
import { SiteNavProvider } from "@/components/website/site-ui";
import { optionalPublicSite, requirePublicSite } from "@/lib/website/page-guard";
import { siteMetadata } from "@/lib/website/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await optionalPublicSite();
  if (!site) return { title: "Not found", robots: { index: false, follow: false } };
  const names = site.view.allServices.map((s) => s.name).slice(0, 4).join(", ");
  return siteMetadata(site, {
    path: "/services",
    title: "Services",
    description: names ? `${names} — by ${site.view.business.name}.` : undefined,
  });
}

export default async function ServicesPage() {
  const site = await requirePublicSite();
  return (
    <SiteNavProvider preview={false}>
      <SiteServices view={site.view} />
    </SiteNavProvider>
  );
}
