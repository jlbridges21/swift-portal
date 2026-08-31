import { Suspense } from "react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProjectHeroMedia } from "@/lib/cover";
import { filterClientMedia, filterClientTours } from "@/lib/client-media";
import { redirect, notFound } from "next/navigation";
import { filterClientVisibleActivities } from "@/lib/communications";
import { getClientVisibleQuotes } from "@/lib/quote-display";
import { getAppSettings } from "@/lib/app-settings";
import { requireTenantContext } from "@/lib/tenant";
import { reconcileProjectPaymentsOnLoad } from "@/lib/stripe-payment-reconcile";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import {
  filterMediaForVideoReviewDelivery,
  loadVideoReviewVersionMap,
} from "@/lib/video-review-media";
import { listProjectVideoReviews } from "@/lib/video-reviews";
import { resolveProjectAccess } from "@/lib/project-access";
import {
  canViewProjectFinancials,
  canViewProjectProgress,
  canAccessVideoReviews,
  sanitizeProjectForMediaViewer,
} from "@/lib/project-page-access";
import type {
  ActivityLog,
  AssetReview,
  Payment,
  ProjectQuote,
  Revision,
  ShootProposal,
} from "@/lib/types";
import { ProjectPageClient } from "@/components/projects/project-page-client";
import { UrlToastHandler } from "@/components/ui/url-toast-handler";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string; welcome?: string }>;
}

async function ProjectContent({
  id,
  preview,
}: {
  id: string;
  preview: boolean;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (profile.role === "admin" && !preview) {
    redirect(`/admin/projects/${id}`);
  }

  const supabase = await createClient();
  const tenant = await requireTenantContext();

  const access = await resolveProjectAccess(profile, id, {
    tenantBusinessId: tenant.businessId,
  });
  if (!access.allowed) notFound();

  const isSharedViewer = access.kind === "share";
  const canViewFinancials = canViewProjectFinancials(access.kind);
  const canViewProgress = canViewProjectProgress(access.kind);
  const canAccessReviews = canAccessVideoReviews(access.kind);

  const [
    { data: projectRow },
    { data: media },
    { data: tours },
    { data: mediaFolders },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("business_id", tenant.businessId).eq("id", id).single(),
    supabase
      .from("media_assets")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("display_order", { ascending: true }),
    supabase.from("tours").select("*").eq("business_id", tenant.businessId).eq("project_id", id).order("display_order"),
    supabase.from("media_folders").select("*").eq("business_id", tenant.businessId).eq("project_id", id).order("display_order", { ascending: true }),
  ]);

  if (!projectRow) notFound();

  let payments: Payment[] = [];
  let revisions: Revision[] = [];
  let shootProposals: ShootProposal[] = [];
  let activities: ActivityLog[] = [];
  let quotes: ProjectQuote[] = [];
  let assetReviews: AssetReview[] = [];

  if (canViewFinancials) {
    await reconcileProjectPaymentsOnLoad(id, tenant.businessId, "project_page");

    const [
      { data: paymentRows },
      { data: revisionRows },
      { data: proposalRows },
      { data: activityRows },
      { data: quoteRows },
      { data: reviewRows },
    ] = await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .eq("business_id", tenant.businessId)
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("revisions")
        .select("*")
        .eq("business_id", tenant.businessId)
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("shoot_proposals")
        .select("*")
        .eq("business_id", tenant.businessId)
        .eq("project_id", id)
        .order("proposed_at", { ascending: true }),
      supabase
        .from("activity_logs")
        .select("*")
        .eq("business_id", tenant.businessId)
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_quotes")
        .select("*")
        .eq("business_id", tenant.businessId)
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("asset_reviews").select("*").eq("business_id", tenant.businessId).eq("project_id", id),
    ]);

    payments = paymentRows ?? [];
    revisions = revisionRows ?? [];
    shootProposals = proposalRows ?? [];
    activities = activityRows ?? [];
    quotes = quoteRows ?? [];
    assetReviews = reviewRows ?? [];
  }

  const appSettings = await getAppSettings(tenant.businessId);
  const project = isSharedViewer ? sanitizeProjectForMediaViewer(projectRow) : projectRow;
  const hero = await getProjectHeroMedia(supabase, projectRow, tenant.businessId);
  const db = await createTenantServiceClient(tenant.businessId);
  const versionMap = await loadVideoReviewVersionMap(db, id);
  const videoReviews = await listProjectVideoReviews(db, id);
  const visibleMedia = filterClientMedia(
    filterMediaForVideoReviewDelivery(media ?? [], versionMap, false)
  );
  const visibleTours = filterClientTours(tours ?? []);
  const photos = visibleMedia.filter((m) => m.media_type === "photo");
  const videos = visibleMedia.filter((m) => m.media_type === "video");
  const documents = visibleMedia.filter((m) => m.media_type === "document");

  return (
    <>
      <Suspense>
        <UrlToastHandler />
      </Suspense>
      <ProjectPageClient
        project={project}
        hero={hero}
        photos={photos}
        videos={videos}
        documents={documents}
        tours={visibleTours}
        payments={payments}
        revisions={revisions}
        shootProposals={shootProposals}
        activities={canViewFinancials ? filterClientVisibleActivities(activities) : []}
        quotes={
          canViewFinancials
            ? getClientVisibleQuotes(quotes, {
                showPreliminaryToClients: appSettings.proposals.showPreliminaryToClients,
              })
            : []
        }
        allowClientProposalChanges={canViewFinancials && appSettings.proposals.allowClientProposalChanges}
        requireDeliveredForDownloads={appSettings.payments.requireDeliveredForDownloads}
        assetReviews={canViewFinancials ? assetReviews : []}
        mediaFolders={mediaFolders ?? []}
        videoReviews={videoReviews}
        isPreview={preview && profile.role === "admin"}
        isAdmin={profile.role === "admin"}
        isSharedViewer={isSharedViewer}
        canViewFinancials={canViewFinancials}
        canViewProjectProgress={canViewProgress}
        canAccessVideoReviews={canAccessReviews}
      />
    </>
  );
}

export default async function ClientProjectPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "1";

  return (
    <Suspense>
      <ProjectContent id={id} preview={isPreview} />
    </Suspense>
  );
}
