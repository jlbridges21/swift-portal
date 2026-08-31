"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { ProjectHero } from "@/components/projects/project-hero";
import { ClientPhotoFolders } from "@/components/projects/client-photo-folders";
import { VideoGrid, videosToGridEntries } from "@/components/projects/video-grid";
import { ExpandableMediaList } from "@/components/projects/expandable-media-list";
import { TourCard } from "@/components/projects/tour-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { normalizeStatus } from "@/lib/constants";
import { clientDownloadLockMessage, resolveProjectDownloadAllowed } from "@/lib/deliverables";
import { downloadFileName, mediaDisplayName } from "@/lib/media-display-name";
import type { HeroMedia } from "@/lib/cover";
import type { MediaAsset, MediaFolder, Project, Tour } from "@/lib/types";
import type { VideoReviewListItem } from "@/lib/video-reviews";
import { formatDate } from "@/lib/utils";
import { Clapperboard, Download, FileText, Globe, Images, Lock, LogIn } from "lucide-react";
import { toast } from "sonner";

/**
 * Anonymous public-link project view.
 *
 * INCLUDED (view/download only): project title, property address, service type, delivery
 * status badge, hero, photo/video/document galleries, tours, inline video playback.
 *
 * EXCLUDED (not required for anonymous view/download): client contact details, project.notes,
 * payments/quotes/pricing, revisions, shoot scheduling, activity timeline, messages,
 * deliverable approval, asset reviews, admin/client navigation chrome.
 */
export function PublicProjectPageClient({
  token,
  project,
  hero,
  photos,
  videos,
  documents,
  tours,
  mediaFolders = [],
  videoReviews = [],
  requireDeliveredForDownloads,
  viewCount,
}: {
  token: string;
  project: Pick<
    Project,
    "id" | "project_name" | "property_address" | "service_type" | "status" | "delivery_date"
  >;
  hero: HeroMedia;
  photos: MediaAsset[];
  videos: MediaAsset[];
  documents: MediaAsset[];
  tours: Tour[];
  mediaFolders?: MediaFolder[];
  videoReviews?: VideoReviewListItem[];
  requireDeliveredForDownloads: boolean;
  viewCount: number;
  rateLimitPagePerMinute: number;
}) {
  const brand = usePortalBrand();
  const apiBase = `/api/public/link/${encodeURIComponent(token)}`;
  const signInHref = `/login?redirect=${encodeURIComponent(`/view/${token}#video`)}`;

  const reviewByAssetId = useMemo(() => {
    const map = new Map<string, VideoReviewListItem>();
    for (const item of videoReviews) {
      for (const version of item.versions) {
        map.set(version.media_asset_id, item);
      }
    }
    return map;
  }, [videoReviews]);

  const status = normalizeStatus(project.status);
  const downloadsUnlocked = resolveProjectDownloadAllowed({
    projectStatus: status,
    isAdmin: false,
    requireDeliveredForDownloads,
  });
  const downloadLockMessage = clientDownloadLockMessage(status, requireDeliveredForDownloads);
  const uploadedVideos = videos.filter((v) => v.media_source !== "youtube");
  const youtubeVideos = videos.filter((v) => v.media_source === "youtube");
  const videoEntries = useMemo(() => videosToGridEntries(videos), [videos]);
  const hasMedia = photos.length > 0 || videos.length > 0 || tours.length > 0 || documents.length > 0;

  async function getDownloadUrl(asset: MediaAsset, thumb = false): Promise<string | null> {
    try {
      const preview = !downloadsUnlocked && !thumb;
      const qs = thumb ? "?thumb=1" : preview ? "?preview=1" : "";
      const res = await fetch(`${apiBase}/media/download/${asset.id}${qs}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status !== 404) toast.error(data.error || "Could not load media");
        return null;
      }
      return data.url as string;
    } catch {
      return null;
    }
  }

  async function handleDownload(asset: MediaAsset) {
    if (!downloadsUnlocked) {
      toast.error(downloadLockMessage ?? "Downloads are not available yet");
      return;
    }
    try {
      const res = await fetch(`${apiBase}/media/download/${asset.id}?file=1`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFileName(asset);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b border-border/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="h-8 w-auto max-w-[140px] object-contain" />
            ) : (
              <span className="font-semibold text-primary truncate">{brand.portalName}</span>
            )}
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={signInHref}>
              <LogIn className="h-4 w-4 mr-1.5" />
              Sign in to comment
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-10">
        <div className="space-y-3">
          <Badge variant="default" className="text-xs bg-muted text-muted-foreground">
            Shared project · view only
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
            {project.project_name}
          </h1>
          <p className="text-muted">{project.property_address}</p>
          <p className="text-sm text-muted">
            {project.service_type}
            {project.delivery_date ? ` · Delivered ${formatDate(project.delivery_date)}` : null}
          </p>
          {!downloadsUnlocked && (
            <p className="flex items-center gap-2 text-sm text-amber-700">
              <Lock className="h-4 w-4 shrink-0" />
              {downloadLockMessage}
            </p>
          )}
        </div>

        <ProjectHero
          hero={hero}
          projectName={project.project_name}
          propertyAddress={project.property_address}
          serviceType={project.service_type}
          status={status}
          microsite
          audience="client"
        />

        {!hasMedia ? (
          <EmptyState title="No media yet" description="Check back when deliverables are ready." />
        ) : null}

        {photos.length > 0 && (
          <section id="photos" className="scroll-mt-24 space-y-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
              <Images className="h-5 w-5 text-accent" /> Photos
            </h2>
            <ClientPhotoFolders
              projectId={project.id}
              zipApiBase={downloadsUnlocked ? `${apiBase}/projects/download-zip` : undefined}
              photos={photos}
              folders={mediaFolders}
              downloadsAllowed={downloadsUnlocked}
              getDownloadUrl={getDownloadUrl}
            />
          </section>
        )}

        {videoEntries.length > 0 && (
          <section id="video" className="scroll-mt-24 space-y-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
              <Clapperboard className="h-5 w-5 text-accent" /> Video
            </h2>
            <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-lg ring-1 ring-black/5">
              <VideoGrid
                entries={videoEntries}
                projectId={project.id}
                reviewByAssetId={reviewByAssetId}
                getDownloadUrl={getDownloadUrl}
                reviewPathPrefix="/dashboard/projects"
                downloadsAllowed={downloadsUnlocked}
                onDownload={handleDownload}
                signInHref={signInHref}
              />
            </div>
          </section>
        )}

        {tours.length > 0 && (
          <section id="tours" className="scroll-mt-24 space-y-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
              <Globe className="h-5 w-5 text-accent" /> Virtual tours
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {tours.map((t) => (
                <TourCard key={t.id} tour={t} />
              ))}
            </div>
          </section>
        )}

        {documents.length > 0 && (
          <section id="documents" className="scroll-mt-24 space-y-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
              <FileText className="h-5 w-5 text-accent" /> Documents
            </h2>
            <ExpandableMediaList
              items={documents}
              initialCount={4}
              labelSingular="document"
              labelPlural="documents"
              renderItem={(doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white p-4"
                >
                  <span className="text-sm font-medium truncate">{mediaDisplayName(doc)}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      !downloadsUnlocked &&
                      doc.mime_type !== "application/pdf" &&
                      !doc.file_name.toLowerCase().endsWith(".pdf")
                    }
                    onClick={() => {
                      if (
                        doc.mime_type === "application/pdf" ||
                        doc.file_name.toLowerCase().endsWith(".pdf")
                      ) {
                        void getDownloadUrl(doc, true).then(
                          (u) => u && window.open(u, "_blank", "noopener,noreferrer")
                        );
                      } else {
                        void handleDownload(doc);
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {doc.mime_type === "application/pdf" ||
                    doc.file_name.toLowerCase().endsWith(".pdf")
                      ? "View"
                      : "Download"}
                  </Button>
                </div>
              )}
            />
          </section>
        )}

        <p className="text-xs text-muted border-t border-border/40 pt-6">
          This page is not indexed by search engines. Link views (anonymous, not identifiable):{" "}
          {viewCount.toLocaleString()}. Signed media links expire in 30 minutes.
        </p>
      </main>
    </div>
  );
}
