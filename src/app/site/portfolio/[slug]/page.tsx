import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { SiteProject } from "@/components/website/site-pages";
import { SiteNavProvider } from "@/components/website/site-ui";
import { optionalPublicSite, requirePublicSite } from "@/lib/website/page-guard";
import { siteMetadata, type PublicSite } from "@/lib/website/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

function find(site: PublicSite, slug: string) {
  return site.view.portfolio.find((p) => p.slug === slug) ?? null;
}

/** A renamed project keeps its old URL working (permanent redirect to the new one). */
function renamedTo(site: PublicSite, slug: string): string | null {
  const entry = site.settings.portfolio.entries.find((e) => e.previousSlugs.includes(slug));
  if (!entry) return null;
  return site.view.portfolio.some((p) => p.slug === entry.slug) ? entry.slug : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await optionalPublicSite();
  const project = site ? find(site, slug) : null;
  if (!site || !project) return { title: "Not found", robots: { index: false, follow: false } };
  return siteMetadata(site, {
    path: `/portfolio/${project.slug}`,
    title: project.title,
    description: project.description || `${project.category ? `${project.category} — ` : ""}${project.title}, by ${site.view.business.name}.`,
    image: project.cover?.mediumUrl ?? null,
  });
}

export default async function PortfolioProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const site = await requirePublicSite();
  const project = find(site, slug);
  if (!project) {
    const next = renamedTo(site, slug);
    if (next) permanentRedirect(`/portfolio/${next}`);
    notFound();
  }
  return (
    <SiteNavProvider preview={false}>
      <SiteProject view={site.view} project={project} />
    </SiteNavProvider>
  );
}
