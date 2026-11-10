import type { Metadata } from "next";
import { SitePortfolio } from "@/components/website/site-pages";
import { SiteNavProvider } from "@/components/website/site-ui";
import { optionalPublicSite, requirePublicSite } from "@/lib/website/page-guard";
import { siteMetadata } from "@/lib/website/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await optionalPublicSite();
  if (!site) return { title: "Not found", robots: { index: false, follow: false } };
  return siteMetadata(site, {
    path: "/portfolio",
    title: "Portfolio",
    description: `Recent work by ${site.view.business.name}.`,
  });
}

export default async function PortfolioPage() {
  const site = await requirePublicSite();
  return (
    <SiteNavProvider preview={false}>
      <SitePortfolio view={site.view} />
    </SiteNavProvider>
  );
}
