import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getAppSettings } from "@/lib/app-settings";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { loadPublicProjectView } from "@/lib/load-public-project-view";
import {
  allowPublicLinkPageView,
  PUBLIC_LINK_RATE_LIMITS,
} from "@/lib/public-link-rate-limit";
import {
  incrementPublicLinkViewCount,
  resolvePublicLinkProject,
} from "@/lib/project-link-access";
import { resolveProjectAccess } from "@/lib/project-access";
import { PublicProjectPageClient } from "@/components/projects/public-project-page-client";
import { BrandProvider } from "@/components/brand/brand-provider";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const host = await getPublicHostContext();
  const ctx = await resolvePublicLinkProject(token, host.businessId);
  return {
    title: ctx ? ctx.project.project_name : "Project",
    robots: { index: false, follow: false },
  };
}

export default async function PublicProjectViewPage({ params }: PageProps) {
  const { token } = await params;
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) notFound();

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = allowPublicLinkPageView(ip, token);
  if (!rate.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-muted">Too many requests. Please wait {rate.retryAfterSec}s and try again.</p>
      </div>
    );
  }

  const data = await loadPublicProjectView(token, host.businessId);
  if (!data) notFound();

  const profile = await getProfile();
  if (profile) {
    const access = await resolveProjectAccess(profile, data.ctx.projectId, {
      tenantBusinessId: host.businessId,
    });
    if (access.kind === "admin") {
      redirect(`/admin/projects/${data.ctx.projectId}`);
    }
    if (access.kind === "assigned_client" || access.kind === "share") {
      redirect(`/dashboard/projects/${data.ctx.projectId}`);
    }
  }

  void incrementPublicLinkViewCount(data.ctx.projectId, data.ctx.businessId);

  const settings = await getAppSettings(data.ctx.businessId);
  const brand = getPortalBrandFromSettings(settings);

  return (
    <BrandProvider brand={brand}>
      <PublicProjectPageClient
        token={token}
        project={data.ctx.project}
        hero={data.hero}
        photos={data.photos}
        videos={data.videos}
        documents={data.documents}
        tours={data.tours}
        mediaFolders={data.mediaFolders}
        videoReviews={data.videoReviews}
        requireDeliveredForDownloads={data.requireDeliveredForDownloads}
        viewCount={(data.ctx.project.link_access_view_count ?? 0) + 1}
        rateLimitPagePerMinute={PUBLIC_LINK_RATE_LIMITS.pagePerMinute}
      />
    </BrandProvider>
  );
}
