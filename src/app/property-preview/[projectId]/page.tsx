import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-access";
import { canAccessProject } from "@/lib/staff-access";
import { loadKitContext, MarketingSetupRequiredError, resolveMarketingActor, toClientState } from "@/lib/marketing/server";
import { editorUrls } from "@/lib/marketing/editor-urls";
import { buildListingView } from "@/lib/marketing/view-model";
import { ListingWebsite, MarketingFontFaces } from "@/components/marketing/website/listing-website";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Website preview", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#111111", colorScheme: "light" };

interface PageProps {
  params: Promise<{ projectId: string }>;
}

/**
 * Full-page preview of a project's Property Website, from the saved draft, for the business
 * only. Same access checks as the Marketing Kit editor (signed-in owner/admin, or staff with
 * Projects access to this project); clients, shared viewers and signed-out visitors get the
 * normal sign-in / not-found responses. Nothing is published and nothing becomes public: the
 * page is rendered per request for this session, and its media comes from the signed-in
 * `/api/marketing/{projectId}` routes. Lives outside /admin so no admin chrome (banners,
 * trial prompts, tab bar) covers the site.
 */
export default async function PropertyWebsitePreviewPage({ params }: PageProps) {
  const { profile, tenant } = await requireAdminPage({ area: "projects" });
  const { projectId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound();
  if (profile.role === "staff" && !(await canAccessProject(tenant.businessId, profile, projectId))) notFound();
  const actor = await resolveMarketingActor(profile, projectId, tenant.businessId);
  if (!actor || actor.kind !== "business") notFound();

  let ctx: Awaited<ReturnType<typeof loadKitContext>> = null;
  try {
    ctx = await loadKitContext(tenant.businessId, projectId);
  } catch (e) {
    if (!(e instanceof MarketingSetupRequiredError)) throw e;
  }
  if (!ctx) notFound();

  const state = toClientState(ctx, actor);
  const view = buildListingView({
    content: ctx.content,
    media: state.media,
    tours: state.tours,
    coverId: state.coverId,
    businessName: state.businessName,
    urls: editorUrls(state),
  });

  return (
    <>
      <MarketingFontFaces />
      <main className="min-h-screen">
        <ListingWebsite view={view} />
      </main>
    </>
  );
}
