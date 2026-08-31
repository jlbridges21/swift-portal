import { Header } from "@/components/layout/header";
import { getProfile } from "@/lib/auth";
import { mediaDisplayName } from "@/lib/media-display-name";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireTenantContext } from "@/lib/tenant";
import { VideoReviewView } from "@/components/video-review/video-review-view";
import { getVideoReviewVersionLink } from "@/lib/video-reviews";
import { resolveProjectAccess } from "@/lib/project-access";
import {
  canReopenVideoReviewComments,
  canResolveVideoReviewComments,
} from "@/lib/project-page-access";
import type { VideoReview, VideoReviewVersionRow } from "@/lib/video-reviews";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string; assetId: string }>;
}

export default async function ClientLazyVideoReviewPage({ params }: PageProps) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { id: projectId, assetId } = await params;
  const tenant = await requireTenantContext();
  const access = await resolveProjectAccess(profile, projectId, {
    tenantBusinessId: tenant.businessId,
  });
  if (!access.allowed) notFound();

  const db = await createTenantServiceClient(tenant.businessId);
  const { data: asset, error: assetError } = await db
    .from("media_assets")
    .select("id, business_id, project_id, media_type, title, file_name, duration_seconds")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError || !asset || asset.project_id !== projectId || asset.media_type !== "video") {
    notFound();
  }

  const existing = await getVideoReviewVersionLink(db, assetId);
  if (existing) {
    redirect(`/dashboard/projects/${projectId}/reviews/${existing.reviewId}`);
  }

  const now = new Date().toISOString();
  const stubReview: VideoReview = {
    id: "__lazy__",
    business_id: tenant.businessId,
    project_id: projectId,
    title: mediaDisplayName(asset),
    created_by: null,
    created_at: now,
    updated_at: now,
  };
  const stubVersion: VideoReviewVersionRow = {
    id: "__lazy__",
    business_id: tenant.businessId,
    review_id: "__lazy__",
    media_asset_id: assetId,
    version_number: 1,
    uploaded_by: null,
    notes: null,
    created_at: now,
    media_assets: {
      id: asset.id as string,
      title: asset.title as string | null,
      file_name: asset.file_name as string | null,
      media_type: asset.media_type as string,
      duration_seconds: asset.duration_seconds as number | null,
    },
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header variant="dashboard" userRole={profile.role === "admin" ? "admin" : "client"} />
      <VideoReviewView
        projectId={projectId}
        reviewId="__lazy__"
        review={stubReview}
        versions={[stubVersion]}
        isAdmin={false}
        canResolveComments={canResolveVideoReviewComments(access.kind)}
        canReopenComments={canReopenVideoReviewComments(access.kind)}
        currentUserId={profile.id}
        backHref={`/dashboard/projects/${projectId}#video`}
        backLabel="Back to project"
        lazyMode={{
          mediaAssetId: assetId,
          reviewPathPrefix: "/dashboard/projects",
        }}
      />
    </div>
  );
}
