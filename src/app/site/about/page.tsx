import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteAbout } from "@/components/website/site-pages";
import { SiteNavProvider } from "@/components/website/site-ui";
import { optionalPublicSite, requirePublicSite } from "@/lib/website/page-guard";
import { siteMetadata } from "@/lib/website/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await optionalPublicSite();
  if (!site?.view.about) return { title: "Not found", robots: { index: false, follow: false } };
  return siteMetadata(site, {
    path: "/about",
    title: "About",
    description: site.view.about.intro,
    image: site.view.about.image?.url ?? null,
  });
}

/** Optional About Us page. Turned off → not public; the old /about link goes to the homepage. */
export default async function AboutPage() {
  const site = await requirePublicSite();
  if (!site.view.about) redirect("/");
  return (
    <SiteNavProvider preview={false}>
      <SiteAbout view={site.view} />
    </SiteNavProvider>
  );
}
