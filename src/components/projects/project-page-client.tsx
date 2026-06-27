"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusTimeline } from "@/components/projects/status-timeline";
import { PhotoGallery } from "@/components/projects/photo-gallery";
import { TourCard } from "@/components/projects/tour-card";
import { ShootScheduling } from "@/components/projects/shoot-scheduling";
import { ProjectActivityTimeline } from "@/components/projects/project-activity-timeline";
import { NextStepBanner } from "@/components/projects/next-step-banner";
import { PaymentsSection } from "@/components/projects/payments-section";
import { getClientNextStep } from "@/lib/journey";
import { QuoteSection } from "@/components/projects/quote-section";
import { DeliverableReview } from "@/components/projects/deliverable-review";
import { EmptyState } from "@/components/ui/empty-state";
import { normalizeStatus } from "@/lib/constants";
import { canDownloadDeliverables } from "@/lib/deliverables";
import type { Project, MediaAsset, Tour, Payment, Revision, ShootProposal, ActivityLog, ProjectQuote, AssetReview } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import {
  Download, MessageSquare, CheckCircle,
  FileText, Clapperboard, Images, Globe, Eye, ArrowLeft, Lock,
} from "lucide-react";
import type { HeroMedia } from "@/lib/cover";
import { ProjectHero } from "@/components/projects/project-hero";
import { ProjectQuickActions } from "@/components/projects/project-quick-actions";
import { HashScrollHandler } from "@/components/ui/hash-scroll-handler";
import { downloadMediaAsset, viewMediaAsset, isPdf } from "@/lib/download";
import { toast } from "sonner";

interface ProjectPageClientProps {
  project: Project;
  hero: HeroMedia;
  photos: MediaAsset[];
  videos: MediaAsset[];
  documents: MediaAsset[];
  tours: Tour[];
  payments: Payment[];
  revisions: Revision[];
  shootProposals: ShootProposal[];
  activities: ActivityLog[];
  quotes: ProjectQuote[];
  assetReviews: AssetReview[];
  isPreview?: boolean;
  isAdmin?: boolean;
  allowClientProposalChanges?: boolean;
}

const REVISION_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

function MicrositeSection({
  id, title, icon: Icon, subtitle, children,
}: {
  id?: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <Icon className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">{title}</h2>
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ProjectPageClient({
  project,
  hero,
  photos,
  videos,
  documents,
  tours,
  payments,
  revisions: initialRevisions,
  shootProposals,
  activities,
  quotes,
  assetReviews,
  isPreview,
  isAdmin,
  allowClientProposalChanges = true,
}: ProjectPageClientProps) {
  const router = useRouter();
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [revisions, setRevisions] = useState(initialRevisions);

  const status = normalizeStatus(project.status);
  const downloadsUnlocked = isPreview || isAdmin || canDownloadDeliverables(status);
  const hasAnyMedia = photos.length > 0 || videos.length > 0 || tours.length > 0 || documents.length > 0;
  const mediaVisible = isPreview || isAdmin || hasAnyMedia;
  const pendingPayments = payments.filter((p) => p.status === "pending" || p.status === "sent");
  const clientStep = getClientNextStep(project, pendingPayments.length > 0, shootProposals);
  const uploadedVideos = videos.filter((v) => v.media_source !== "youtube");
  const youtubeVideos = videos.filter((v) => v.media_source === "youtube");
  const hasMedia = photos.length > 0 || videos.length > 0 || tours.length > 0 || documents.length > 0;
  const isClientView = !isPreview && !isAdmin;

  async function getDownloadUrl(asset: MediaAsset, thumb = false): Promise<string | null> {
    try {
      const preview = !downloadsUnlocked && !thumb;
      const res = await fetch(
        `/api/media/download/${asset.id}${thumb ? "?thumb=1" : preview ? "?preview=1" : ""}`,
        { credentials: "include" }
      );
      const text = await res.text();
      if (!text) return null;
      const data = JSON.parse(text);
      if (!res.ok) {
        if (res.status !== 404) {
          toast.error(data.error || "Couldn't load media preview");
        }
        return null;
      }
      return data.url as string;
    } catch {
      return null;
    }
  }

  async function handleDownload(asset: MediaAsset) {
    if (!downloadsUnlocked) {
      toast.error("Downloads unlock after final payment");
      return;
    }
    await downloadMediaAsset(asset);
  }

  async function handleView(asset: MediaAsset) {
    if (!downloadsUnlocked) {
      const url = await getDownloadUrl(asset);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    viewMediaAsset(asset);
  }

  async function handleRevisionSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/revisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ project_id: project.id, description: revisionText }),
    });
    setSubmitting(false);
    if (res.ok) {
      const newRevision = await res.json();
      setRevisions((prev) => [newRevision, ...prev]);
      setShowRevisionForm(false);
      setRevisionText("");
      toast.success("Revision request submitted");
    } else {
      toast.error("Failed to submit request");
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <HashScrollHandler />
      {isPreview ? (
        <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          <Eye className="inline h-4 w-4 mr-1" />
          Admin preview — this is what the client sees
          <Link href={`/admin/projects/${project.id}`} className="ml-3 font-medium text-accent hover:underline">
            <ArrowLeft className="inline h-3 w-3" /> Back to editor
          </Link>
        </div>
      ) : (
        <Header variant="dashboard" userRole={isAdmin ? "admin" : "client"} />
      )}

      <ProjectHero
        hero={hero}
        projectName={project.project_name}
        propertyAddress={project.property_address}
        serviceType={project.service_type}
        status={project.status}
        audience={isAdmin ? "admin" : "client"}
        microsite={isClientView || isPreview}
      >
        {(isClientView || isPreview) && (
          <div className="mt-8">
            <ProjectQuickActions
              status={project.status}
              hasPendingPayment={pendingPayments.length > 0}
              hasMedia={hasAnyMedia}
              projectId={project.id}
            />
          </div>
        )}
      </ProjectHero>

      <main className="mobile-container py-12 pb-16 space-y-16">
        {!isPreview && (
          <NextStepBanner step={clientStep} />
        )}

        <Card className="border-0 shadow-lg shadow-slate-200/50 rounded-2xl overflow-hidden">
          <CardHeader className="bg-white border-b border-border/60 pb-4">
            <CardTitle className="text-lg font-semibold">Your Progress</CardTitle>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 bg-white">
            <StatusTimeline currentStatus={project.status} />
          </CardContent>
        </Card>

        {!isPreview && (
          <QuoteSection
            projectId={project.id}
            quotes={quotes}
            isAdmin={!!isAdmin}
            allowClientProposalChanges={allowClientProposalChanges}
          />
        )}

        {!isPreview && (
          <Suspense fallback={null}>
            <ShootScheduling
              projectId={project.id}
              proposals={shootProposals}
              isAdmin={!!isAdmin}
              onUpdate={() => router.refresh()}
            />
          </Suspense>
        )}

        {isClientView && (
          <MicrositeSection
            id="deliverables"
            title="Photo Gallery"
            icon={Images}
            subtitle={
              photos.length > 0
                ? downloadsUnlocked
                  ? "Full-resolution downloads available"
                  : "Tap any photo to view fullscreen — downloads unlock after payment"
                : undefined
            }
          >
            <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-lg shadow-slate-200/40 ring-1 ring-black/5">
              {photos.length > 0 ? (
                <PhotoGallery photos={photos} getDownloadUrl={getDownloadUrl} downloadsAllowed={downloadsUnlocked} />
              ) : (
                <EmptyState
                  icon={Images}
                  title="No photos yet"
                  description="No photos have been added yet. Your image previews will appear here once they're ready."
                />
              )}
            </div>
          </MicrositeSection>
        )}

        {isClientView && (
          <MicrositeSection
            title="Video"
            icon={Clapperboard}
            subtitle={
              uploadedVideos.length > 0 || youtubeVideos.length > 0
                ? downloadsUnlocked
                  ? undefined
                  : "Stream previews below — download after payment"
                : undefined
            }
          >
            {uploadedVideos.length > 0 || youtubeVideos.length > 0 ? (
              <div className="space-y-5">
                {youtubeVideos.map((v) => (
                  <div key={v.id} className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/40 ring-1 ring-black/5">
                    <div className="aspect-video bg-black">
                      <iframe src={v.embed_url || ""} className="h-full w-full" allowFullScreen title={v.file_name} />
                    </div>
                    <div className="px-5 py-3 text-sm text-muted border-t border-border/60">{v.file_name}</div>
                  </div>
                ))}
                {uploadedVideos.map((video) => (
                  <UploadedVideo
                    key={video.id}
                    video={video}
                    onDownload={() => handleDownload(video)}
                    getDownloadUrl={getDownloadUrl}
                    downloadsAllowed={downloadsUnlocked}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Clapperboard}
                title="No videos yet"
                description="No videos have been added yet. Your video previews will appear here once they're ready."
              />
            )}
          </MicrositeSection>
        )}

        {isClientView && (
          <MicrositeSection title="360° Virtual Tours" icon={Globe} subtitle={tours.length > 0 ? "Explore immersive walkthroughs" : undefined}>
            {tours.length > 0 ? (
              <div className="space-y-6">
                {tours.map((tour) => (
                  <div key={tour.id} className="rounded-2xl overflow-hidden shadow-lg shadow-slate-200/40 ring-1 ring-black/5">
                    <TourCard tour={tour} embedInPortal />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Globe}
                title="No 360° tours yet"
                description="No 360° tours have been added yet. Interactive tour links will appear here when available."
              />
            )}
          </MicrositeSection>
        )}

        {isClientView && (
          <MicrositeSection
            id="documents"
            title="Documents"
            icon={FileText}
            subtitle={
              documents.length > 0
                ? downloadsUnlocked
                  ? "Download your files below"
                  : "Preview available — full downloads unlock after payment"
                : undefined
            }
          >
            {documents.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-md shadow-slate-200/30 ring-1 ring-black/5 transition-shadow hover:shadow-lg sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-primary">{doc.file_name}</p>
                      {!downloadsUnlocked && !isPreview && (
                        <p className="text-xs text-muted mt-1 flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Download locked
                        </p>
                      )}
                    </div>
                    {!isPreview && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {isPdf(doc) && (
                          <Button variant="outline" size="sm" className="min-h-11 flex-1 sm:flex-none" onClick={() => handleView(doc)}>
                            <Eye className="h-4 w-4" /> Preview
                          </Button>
                        )}
                        {downloadsUnlocked && (
                          <Button variant="accent" size="sm" className="min-h-11 flex-1 sm:flex-none" onClick={() => handleDownload(doc)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No documents yet"
                description="Project documents and deliverable files will appear here when they're ready."
              />
            )}
          </MicrositeSection>
        )}

        {!isClientView && mediaVisible && photos.length > 0 && (
          <MicrositeSection
            id="deliverables"
            title="Photo Gallery"
            icon={Images}
            subtitle={downloadsUnlocked ? "Full-resolution downloads available" : "Tap any photo to view fullscreen — downloads unlock after payment"}
          >
            <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-lg shadow-slate-200/40 ring-1 ring-black/5">
              <PhotoGallery photos={photos} getDownloadUrl={getDownloadUrl} downloadsAllowed={downloadsUnlocked} />
            </div>
          </MicrositeSection>
        )}

        {!isClientView && mediaVisible && (uploadedVideos.length > 0 || youtubeVideos.length > 0) && (
          <MicrositeSection
            title="Video"
            icon={Clapperboard}
            subtitle={downloadsUnlocked ? undefined : "Stream previews below — download after payment"}
          >
            <div className="space-y-5">
              {youtubeVideos.map((v) => (
                <div key={v.id} className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/40 ring-1 ring-black/5">
                  <div className="aspect-video bg-black">
                    <iframe src={v.embed_url || ""} className="h-full w-full" allowFullScreen title={v.file_name} />
                  </div>
                  <div className="px-5 py-3 text-sm text-muted border-t border-border/60">{v.file_name}</div>
                </div>
              ))}
              {uploadedVideos.map((video) => (
                <UploadedVideo
                  key={video.id}
                  video={video}
                  onDownload={() => handleDownload(video)}
                  getDownloadUrl={getDownloadUrl}
                  downloadsAllowed={downloadsUnlocked}
                />
              ))}
            </div>
          </MicrositeSection>
        )}

        {!isClientView && mediaVisible && tours.length > 0 && (
          <MicrositeSection title="360° Virtual Tours" icon={Globe} subtitle="Explore immersive walkthroughs">
            <div className="space-y-6">
              {tours.map((tour) => (
                <div key={tour.id} className="rounded-2xl overflow-hidden shadow-lg shadow-slate-200/40 ring-1 ring-black/5">
                  <TourCard tour={tour} embedInPortal />
                </div>
              ))}
            </div>
          </MicrositeSection>
        )}

        {!isClientView && mediaVisible && documents.length > 0 && (
          <MicrositeSection
            id="documents"
            title="Documents"
            icon={FileText}
            subtitle={downloadsUnlocked ? "Download your files below" : "Preview available — full downloads unlock after payment"}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-md shadow-slate-200/30 ring-1 ring-black/5 transition-shadow hover:shadow-lg sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-primary">{doc.file_name}</p>
                    {!downloadsUnlocked && !isPreview && (
                      <p className="text-xs text-muted mt-1 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Download locked
                      </p>
                    )}
                  </div>
                  {!isPreview && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {isPdf(doc) && (
                        <Button variant="outline" size="sm" className="min-h-11 flex-1 sm:flex-none" onClick={() => handleView(doc)}>
                          <Eye className="h-4 w-4" /> Preview
                        </Button>
                      )}
                      {downloadsUnlocked && (
                        <Button variant="accent" size="sm" className="min-h-11 flex-1 sm:flex-none" onClick={() => handleDownload(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </MicrositeSection>
        )}

        {!isPreview && status === "ready_for_review" && (isClientView || mediaVisible) && (
          <DeliverableReview
            projectId={project.id}
            photos={photos}
            videos={videos}
            tours={tours}
            documents={documents}
            reviews={assetReviews}
          />
        )}

        {!isPreview && status === "awaiting_payment" && (
          <Card className="border-orange-200/80 bg-gradient-to-r from-orange-50 to-white shadow-lg rounded-2xl">
            <CardContent className="p-6 sm:p-8 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100">
                <CheckCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-orange-900">Final Payment</p>
                <p className="text-sm text-orange-800 mt-1">Your deliverables are approved. Complete your final payment below to unlock all downloads.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <PaymentsSection payments={payments} isPreview={isPreview} alwaysShow={isClientView} />

        {!isPreview && status !== "ready_for_review" && status !== "awaiting_payment" && (
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5 text-accent" /> Request Revision
              </CardTitle>
              {!showRevisionForm && (
                <Button variant="outline" size="sm" onClick={() => setShowRevisionForm(true)}>New Request</Button>
              )}
            </CardHeader>
            <CardContent>
              {revisions.length > 0 && (
                <div className="mb-4 space-y-2">
                  {revisions.map((rev) => (
                    <div key={rev.id} className="rounded-xl border border-border p-4 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={rev.status === "completed" ? "success" : rev.status === "in_progress" ? "warning" : "default"}>
                          {REVISION_STATUS_LABEL[rev.status] || rev.status}
                        </Badge>
                        <span className="text-xs text-muted">{formatDate(rev.created_at)}</span>
                      </div>
                      <p className="mt-2 text-muted">{rev.description}</p>
                    </div>
                  ))}
                </div>
              )}
              {showRevisionForm ? (
                <form onSubmit={handleRevisionSubmit} className="space-y-3">
                  <Textarea value={revisionText} onChange={(e) => setRevisionText(e.target.value)} required rows={3} placeholder="Describe the changes you need..." />
                  <div className="flex gap-2">
                    <Button type="submit" variant="accent" size="sm" disabled={submitting}>Submit</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowRevisionForm(false)}>Cancel</Button>
                  </div>
                </form>
              ) : revisions.length === 0 ? (
                <p className="text-sm text-muted">No revision requests yet.</p>
              ) : null}
            </CardContent>
          </Card>
        )}

        <MicrositeSection title="Project Activity" icon={MessageSquare}>
          <div className="rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/40 ring-1 ring-black/5">
            <ProjectActivityTimeline activities={activities} />
          </div>
        </MicrositeSection>
      </main>
    </div>
  );
}

function UploadedVideo({
  video, onDownload, getDownloadUrl, downloadsAllowed,
}: {
  video: MediaAsset;
  onDownload: () => void;
  getDownloadUrl: (a: MediaAsset, thumb?: boolean) => Promise<string | null>;
  downloadsAllowed: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadVideo() {
    setLoading(true);
    const u = await getDownloadUrl(video);
    setLoading(false);
    if (u) setUrl(u);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/40 ring-1 ring-black/5">
      {url ? (
        <video src={url} controls className="w-full aspect-video bg-black" playsInline />
      ) : (
        <button
          onClick={loadVideo}
          disabled={loading}
          className="flex w-full aspect-video items-center justify-center bg-slate-900 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
        >
          {loading ? "Loading preview…" : "▶ Play Video Preview"}
        </button>
      )}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border/60">
        <span className="text-sm font-medium text-primary">{video.file_name}</span>
        {downloadsAllowed ? (
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="h-4 w-4" /> Download
          </Button>
        ) : (
          <span className="text-xs text-muted flex items-center gap-1">
            <Lock className="h-3 w-3" /> Preview only
          </span>
        )}
      </div>
    </div>
  );
}
