import { Suspense } from "react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProjectHeroMedia } from "@/lib/cover";
import { filterClientMedia, filterClientTours } from "@/lib/client-media";
import { redirect, notFound } from "next/navigation";
import { filterClientVisibleActivities } from "@/lib/communications";
import { getClientVisibleQuotes } from "@/lib/quote-display";
import { getAppSettings } from "@/lib/app-settings";
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

  const [
    { data: project },
    { data: media },
    { data: tours },
    { data: payments },
    { data: revisions },
    { data: shootProposals },
    { data: activities },
    { data: quotes },
    { data: assetReviews },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("media_assets").select("*").eq("project_id", id).order("display_order"),
    supabase.from("tours").select("*").eq("project_id", id).order("display_order"),
    supabase.from("payments").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("revisions").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("shoot_proposals").select("*").eq("project_id", id).order("proposed_at", { ascending: true }),
    supabase.from("activity_logs").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("project_quotes").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("asset_reviews").select("*").eq("project_id", id),
  ]);

  if (!project) notFound();

  const appSettings = await getAppSettings();
  const hero = await getProjectHeroMedia(supabase, project);
  const visibleMedia = filterClientMedia(media ?? []);
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
        payments={payments ?? []}
        revisions={revisions ?? []}
        shootProposals={shootProposals ?? []}
        activities={filterClientVisibleActivities(activities ?? [])}
        quotes={getClientVisibleQuotes(quotes ?? [], {
          showPreliminaryToClients: appSettings.proposals.showPreliminaryToClients,
        })}
        allowClientProposalChanges={appSettings.proposals.allowClientProposalChanges}
        assetReviews={assetReviews ?? []}
        isPreview={preview && profile.role === "admin"}
        isAdmin={profile.role === "admin"}
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
