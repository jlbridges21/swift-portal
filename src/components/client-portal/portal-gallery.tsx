"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight, Box, CalendarDays, CheckCircle2, ChevronRight, Clapperboard, CreditCard, Download, Eye, FileText,
  Folder, Heart, History, Home, Images, LayoutGrid, List, Lock, MapPin, Megaphone, MessageSquare, Phone,
  Rotate3d, Sparkles, Tag, Truck,
} from "lucide-react";
import { toast } from "sonner";
import { PhotoGallery } from "@/components/projects/photo-gallery";
import { VideoGrid } from "@/components/projects/video-grid";
import { ProjectZipDownload } from "@/components/projects/project-zip-download";
import { ShootScheduling } from "@/components/projects/shoot-scheduling";
import { DeliverableReview } from "@/components/projects/deliverable-review";
import { ProjectActivityTimeline } from "@/components/projects/project-activity-timeline";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { CoverPlaceholder } from "@/components/projects/cover-placeholder";
import { ViewOnlyAccessChip } from "@/components/ui/view-only-access-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PortalCard, PortalPillButton, ThumbTile, useThumbUrls } from "@/components/client-portal/portal-ui";
import type { PortalCtx } from "@/components/client-portal/portal-context";
import { getClientNextStep } from "@/lib/journey";
import { PROJECT_STATUSES, getStatusOrder, normalizeStatus } from "@/lib/constants";
import { formatShootDateTime, getProjectShootDateTime } from "@/lib/scheduling";
import { countFolderDownloadableAssets, UNFILED_FOLDER_LABEL, UNFILED_FOLDER_SCOPE } from "@/lib/project-zip-assets";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { MediaAsset } from "@/lib/types";

const REVISION_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

function sortPhotos(list: MediaAsset[]) {
  return [...list].sort((a, b) => {
    const order = (a.display_order ?? 0) - (b.display_order ?? 0);
    if (order !== 0) return order;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function GalleryTab({ ctx }: { ctx: PortalCtx }) {
  const album = useSearchParams().get("album");
  if (album && ctx.show.photos) return <FullGallery ctx={ctx} album={album} />;
  return <GalleryHome ctx={ctx} />;
}

// ---------------------------------------------------------------------------
// Gallery home
// ---------------------------------------------------------------------------

function GalleryHome({ ctx }: { ctx: PortalCtx }) {
  const { project, photos, show } = ctx;
  const status = normalizeStatus(project.status);
  const sortedPhotos = useMemo(() => sortPhotos(photos), [photos]);
  const showScheduling =
    ctx.canViewFinancials &&
    !ctx.isSharedViewer &&
    (["quote_sent", "proposal_approved", "scheduled"].includes(status) ||
      ctx.shootProposals.some((p) => p.status === "pending"));
  const showDeliverableReview = status === "ready_for_review" && ctx.canViewFinancials && !ctx.isSharedViewer;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PortalHero ctx={ctx} />
      <StatusBanner ctx={ctx} />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          {showDeliverableReview ? (
            <DeliverableReview
              projectId={project.id}
              photos={ctx.photos}
              videos={ctx.videos}
              tours={ctx.tours}
              documents={ctx.documents}
              reviews={ctx.assetReviews}
            />
          ) : null}

          {showScheduling ? (
            <Suspense fallback={null}>
              <SchedulingBlock ctx={ctx} />
            </Suspense>
          ) : null}

          {show.photos ? (
            <PortalCard
              id="photo-gallery"
              title="Photo Gallery"
              icon={Images}
              subtitle={
                photos.length
                  ? `${photos.length} photo${photos.length === 1 ? "" : "s"}${ctx.mediaFolders.length ? ` · ${ctx.mediaFolders.length} folder${ctx.mediaFolders.length === 1 ? "" : "s"}` : ""}`
                  : undefined
              }
              action={
                photos.length ? (
                  <PortalPillButton onClick={() => ctx.goTo("gallery", { album: ctx.mediaFolders.length ? "folders" : "all" })}>
                    View Full Gallery <ArrowRight className="h-3.5 w-3.5" />
                  </PortalPillButton>
                ) : null
              }
            >
              {photos.length ? (
                <PhotoGallery
                  layout="mosaic"
                  photos={sortedPhotos}
                  getDownloadUrl={ctx.getDownloadUrl}
                  downloadsAllowed={ctx.downloadsUnlocked}
                  favorites={ctx.favorites}
                  onMore={() => ctx.goTo("gallery", { album: "all" })}
                />
              ) : (
                <EmptyState icon={Images} title="No photos yet" description="Your photos will appear here once your shoot is ready." />
              )}
            </PortalCard>
          ) : null}

          {ctx.availableTabs.has("videos") ? (
            <PortalCard
              title="Videos"
              icon={Clapperboard}
              subtitle={`${ctx.videoEntries.length} video${ctx.videoEntries.length === 1 ? "" : "s"}`}
              action={
                ctx.videoEntries.length > 3 ? (
                  <PortalPillButton onClick={() => ctx.goTo("videos")}>
                    View All Videos <ArrowRight className="h-3.5 w-3.5" />
                  </PortalPillButton>
                ) : (
                  <PortalPillButton onClick={() => ctx.goTo("videos")}>
                    Open Videos <ArrowRight className="h-3.5 w-3.5" />
                  </PortalPillButton>
                )
              }
            >
              <VideoGrid
                entries={ctx.videoEntries.slice(0, 3)}
                projectId={project.id}
                reviewByAssetId={ctx.reviewByAssetId}
                getDownloadUrl={ctx.getDownloadUrl}
                reviewPathPrefix="/dashboard/projects"
                downloadsAllowed={ctx.downloadsUnlocked}
                onDownload={(v) => void ctx.handleDownload(v)}
                canAccessVideoReviews={ctx.canAccessVideoReviews}
                canShareVideos={ctx.videoSharing?.canShare}
                publicVideoIds={ctx.videoSharing?.publicVideoIds}
              />
            </PortalCard>
          ) : null}

          {ctx.availableTabs.has("tours") || ctx.availableTabs.has("models") ? (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              {ctx.availableTabs.has("tours") ? <TourPreviewCard ctx={ctx} /> : null}
              {ctx.availableTabs.has("models") ? <ModelPreviewCard ctx={ctx} /> : null}
            </div>
          ) : null}

          {!show.photos && !ctx.hasAnyMedia ? (
            <PortalCard>
              <EmptyState
                icon={Images}
                title="No media yet"
                description="Your media will appear here as soon as it's ready."
              />
            </PortalCard>
          ) : null}

          <ProjectUpdates ctx={ctx} />
        </div>

        <aside className="min-w-0 space-y-4 sm:space-y-5" aria-label="Project information">
          <ProjectStatusCard ctx={ctx} />
          <ProjectDetailsCard ctx={ctx} />
          {ctx.favorites && show.photos && photos.length > 0 ? <FavoritesCard ctx={ctx} /> : null}
          {ctx.availableTabs.has("marketing") ? <MarketingSideCard ctx={ctx} /> : null}
          <ContactCard ctx={ctx} />
        </aside>
      </div>
    </div>
  );
}

function SchedulingBlock({ ctx }: { ctx: PortalCtx }) {
  const router = useRouter();
  return (
    <ShootScheduling
      projectId={ctx.project.id}
      proposals={ctx.shootProposals}
      isAdmin={false}
      onUpdate={() => router.refresh()}
    />
  );
}

/** Split "123 Main St, City, ST 12345" into a headline and a location line. */
function heroText(project: PortalCtx["project"]) {
  const address = project.property_address?.trim() ?? "";
  if (!address) return { title: project.project_name, location: null as string | null };
  const comma = address.indexOf(",");
  if (comma > 0) return { title: address.slice(0, comma).trim(), location: address.slice(comma + 1).trim() || null };
  return { title: address, location: null };
}

function PortalHero({ ctx }: { ctx: PortalCtx }) {
  const { project, hero } = ctx;
  const { title, location } = heroText(project);
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = hero?.type === "image" ? hero.url : hero?.type === "youtube" ? hero.posterUrl : null;
  const showFavorites = !!ctx.favorites;
  const locked = !ctx.downloadsUnlocked;
  const canDownloadAll = ctx.downloadsUnlocked && ctx.downloadableFileCount > 0;

  function lockedClick() {
    if (ctx.financial.kind === "due") {
      ctx.goTo("pay", undefined, "payments");
      return;
    }
    toast.message(ctx.downloadLockMessage ?? "Downloads aren't available yet.");
  }

  return (
    <section aria-label="Project" className="relative isolate overflow-hidden rounded-2xl bg-slate-900 shadow-sm">
      <div className="relative h-56 sm:h-64 lg:h-72">
        {hero?.type === "video" ? (
          <video src={hero.url} autoPlay muted loop playsInline className="absolute inset-0 -z-10 h-full w-full object-cover" />
        ) : imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" onError={() => setImgFailed(true)} />
        ) : (
          <div className="absolute inset-0 -z-10">
            <CoverPlaceholder variant="hero" />
          </div>
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/35 to-black/5" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        <div className="flex h-full flex-col justify-end gap-3 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-center gap-2">
            {project.service_type ? (
              <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-white/40 bg-black/25 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                {project.service_type}
              </span>
            ) : null}
            <StatusBadge status={project.status} audience="client" className="sm:hidden" />
            {ctx.isSharedViewer ? <ViewOnlyAccessChip tone="onDark" /> : null}
          </div>
          <div className="min-w-0">
            <h1 className="line-clamp-2 text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl lg:text-4xl">{title}</h1>
            {location ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/90 sm:text-base">
                <MapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{location}</span>
              </p>
            ) : null}
          </div>
          {ctx.hasAnyMedia || ctx.photos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {locked ? (
                <button
                  type="button"
                  onClick={lockedClick}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white/15 px-4 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25"
                >
                  <Lock className="h-4 w-4" /> Downloads locked
                </button>
              ) : canDownloadAll ? (
                <button
                  type="button"
                  onClick={ctx.zipAll.start}
                  disabled={!ctx.zipAll.ready || ctx.zipAll.active}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
                >
                  <Download className="h-4 w-4" /> {ctx.zipAll.active ? "Preparing…" : "Download All"}
                </button>
              ) : null}
              {showFavorites && !locked ? (
                <button
                  type="button"
                  onClick={ctx.favoriteDownloadCount > 0 ? ctx.zipFavorites.start : () => ctx.goTo("gallery", { album: "favorites" })}
                  disabled={ctx.zipFavorites.active}
                  title={ctx.favoriteDownloadCount > 0 ? "Download your favorite photos" : "Heart photos to build your favorites"}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white/90 disabled:opacity-60"
                >
                  <Heart className={cn("h-4 w-4", ctx.favorites!.count > 0 && "fill-current text-accent")} />
                  {ctx.zipFavorites.active ? "Preparing…" : `Download Favorites (${ctx.favorites!.count})`}
                </button>
              ) : showFavorites && ctx.favorites!.count > 0 ? (
                <button
                  type="button"
                  onClick={() => ctx.goTo("gallery", { album: "favorites" })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white/90"
                >
                  <Heart className="h-4 w-4 fill-current text-accent" /> Favorites ({ctx.favorites!.count})
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * The one banner under the hero. Says what is actually true: payment due (and whether it is
 * what's holding downloads back), an estimate to review, or why downloads are still locked.
 */
function StatusBanner({ ctx }: { ctx: PortalCtx }) {
  const f = ctx.financial;
  const status = normalizeStatus(ctx.project.status);
  const mediaReady = ctx.hasAnyMedia;
  const hasPay = ctx.availableTabs.has("pay");

  if (hasPay && f.kind === "due") {
    const amount = formatCurrency(f.dueCents);
    const downloadsHeldByPayment = mediaReady && !ctx.clientDownloadsUnlocked;
    const title = downloadsHeldByPayment ? "Your media is ready!" : "Payment due";
    const body = downloadsHeldByPayment
      ? `A payment of ${amount} is required before you can download your files.`
      : mediaReady && ctx.clientDownloadsUnlocked
        ? `A payment of ${amount} is due. Your downloads are already available.`
        : `A payment of ${amount} is due for this project.`;
    return (
      <BannerShell tone="red" icon={CreditCard} title={title} body={body}>
        <Button variant="accent" className="min-h-11" onClick={() => ctx.goTo("pay", undefined, "payments")}>
          Pay Now — {amount}
        </Button>
        {f.activeQuote && ctx.show.estimates ? (
          <Button variant="outline" className="min-h-11" onClick={() => ctx.goTo("pay", undefined, "quote")}>
            <FileText className="h-4 w-4" /> View Estimate
          </Button>
        ) : null}
      </BannerShell>
    );
  }

  if (hasPay && f.kind === "review") {
    return (
      <BannerShell
        tone="blue"
        icon={FileText}
        title="Your estimate is ready for review"
        body="Review the proposal and approve it to move your project forward."
      >
        <Button variant="accent" className="min-h-11" onClick={() => ctx.goTo("pay", undefined, "quote")}>
          Review Estimate <ArrowRight className="h-4 w-4" />
        </Button>
      </BannerShell>
    );
  }

  if (status === "ready_for_review" && ctx.canViewFinancials && !ctx.isSharedViewer) {
    return (
      <BannerShell tone="blue" icon={Eye} title="Your media is ready for review" body="Take a look and approve your deliverables or ask for changes.">
        <Button variant="accent" className="min-h-11" onClick={() => ctx.goTo("gallery", undefined, "deliverable-review")}>
          Review Deliverables
        </Button>
      </BannerShell>
    );
  }

  if (mediaReady && !ctx.clientDownloadsUnlocked && ctx.downloadLockMessage && !ctx.isPreview) {
    return (
      <BannerShell
        tone="neutral"
        icon={Lock}
        title="Preview your media"
        body={
          f.kind === "processing"
            ? "Your bank payment is processing. Downloads unlock once your project is marked Delivered."
            : ctx.downloadLockMessage
        }
      />
    );
  }

  return null;
}

function BannerShell({
  tone,
  icon: Icon,
  title,
  body,
  children,
}: {
  tone: "red" | "blue" | "neutral";
  icon: typeof CreditCard;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      role="status"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:p-5",
        tone === "red" && "border-red-200 bg-gradient-to-r from-red-50 to-white surface-dark:from-card surface-dark:to-card",
        tone === "blue" && "border-accent/25 bg-gradient-to-r from-accent-subtle to-white surface-dark:from-card surface-dark:to-card",
        tone === "neutral" && "border-border bg-card"
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            tone === "red" && "bg-red-100 text-red-600",
            tone === "blue" && "bg-accent/15 text-accent",
            tone === "neutral" && "bg-slate-100 text-muted surface-dark:bg-subtle"
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-semibold text-heading">{title}</p>
          <p className="mt-0.5 text-sm text-muted">{body}</p>
        </div>
      </div>
      {children ? <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">{children}</div> : null}
    </section>
  );
}

function TourPreviewCard({ ctx }: { ctx: PortalCtx }) {
  const tour = ctx.tours[0];
  return (
    <PortalCard
      title={ctx.tours.length > 1 ? "360° Virtual Tours" : "360° Virtual Tour"}
      icon={Rotate3d}
      subtitle={ctx.tours.length > 1 ? `${ctx.tours.length} interactive tours` : tour.tour_name || "Interactive tour"}
    >
      <button
        type="button"
        onClick={() => ctx.goTo("tours")}
        className="group relative block aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {tour.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tour.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_120%_at_80%_0%,color-mix(in_srgb,var(--color-accent)_45%,transparent),transparent_60%),linear-gradient(135deg,#0f172a,#1e293b)]" />
        )}
        <span className="absolute inset-0 bg-black/20" aria-hidden />
        <span className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground shadow-lg">
          <Rotate3d className="h-4 w-4" /> View 360 Tour <ArrowRight className="h-4 w-4" />
        </span>
      </button>
    </PortalCard>
  );
}

function ModelPreviewCard({ ctx }: { ctx: PortalCtx }) {
  const model = ctx.models[0];
  return (
    <PortalCard
      title={ctx.models.length > 1 ? "3D Models" : "3D Model"}
      icon={Box}
      subtitle={ctx.models.length > 1 ? `${ctx.models.length} interactive models` : model.title || "Interactive 3D walkthrough"}
    >
      <button
        type="button"
        onClick={() => ctx.goTo("models")}
        className="group relative block aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_90%_at_50%_40%,#334155,transparent_70%),linear-gradient(135deg,#0f172a,#111827)]" />
        <Box className="absolute left-1/2 top-[40%] h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-white/25 transition-transform duration-500 group-hover:scale-110" aria-hidden />
        <span className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground shadow-lg">
          <Box className="h-4 w-4" /> View 3D Model <ArrowRight className="h-4 w-4" />
        </span>
      </button>
    </PortalCard>
  );
}

/** Revision requests and the activity log — kept on the home page, below the media. */
function ProjectUpdates({ ctx }: { ctx: PortalCtx }) {
  const status = normalizeStatus(ctx.project.status);
  const canRevise = ctx.canViewFinancials && !ctx.isSharedViewer && status !== "ready_for_review" && status !== "awaiting_payment";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!ctx.canViewFinancials || ctx.isSharedViewer) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (ctx.isPreview) {
      toast.message("Clients can send revision requests here. Disabled in preview.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/revisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ project_id: ctx.project.id, description: text }),
    });
    setSubmitting(false);
    if (res.ok) {
      const created = await res.json();
      ctx.setRevisions((prev) => [created, ...prev]);
      setOpen(false);
      setText("");
      toast.success("Revision request submitted");
    } else {
      toast.error("Failed to submit request");
    }
  }

  return (
    <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
      {canRevise || ctx.revisions.length > 0 ? (
        <PortalCard
          title="Request a Revision"
          icon={MessageSquare}
          subtitle="Need something changed? Let us know."
          action={
            canRevise && !open ? (
              <PortalPillButton onClick={() => setOpen(true)}>New Request</PortalPillButton>
            ) : null
          }
        >
          {ctx.revisions.length > 0 ? (
            <ul className="space-y-2">
              {ctx.revisions.map((rev) => (
                <li key={rev.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={rev.status === "completed" ? "success" : rev.status === "in_progress" ? "warning" : "default"}>
                      {REVISION_STATUS_LABEL[rev.status] || rev.status}
                    </Badge>
                    <span className="text-xs text-muted">{formatDate(rev.created_at)}</span>
                  </div>
                  <p className="mt-2 text-muted">{rev.description}</p>
                </li>
              ))}
            </ul>
          ) : !open ? (
            <p className="text-sm text-muted">No revision requests yet.</p>
          ) : null}
          {open ? (
            <form onSubmit={submit} className={cn("space-y-3", ctx.revisions.length > 0 && "mt-3")}>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} required rows={3} placeholder="Describe the changes you need..." />
              <div className="flex gap-2">
                <Button type="submit" variant="accent" size="sm" className="min-h-10" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </PortalCard>
      ) : null}

      {ctx.activities.length > 0 ? (
        <PortalCard title="Project Activity" icon={History} className={canRevise || ctx.revisions.length > 0 ? undefined : "xl:col-span-2"}>
          <ProjectActivityTimeline activities={ctx.activities} clientMode />
        </PortalCard>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function ProjectStatusCard({ ctx }: { ctx: PortalCtx }) {
  const brand = usePortalBrand();
  const status = normalizeStatus(ctx.project.status);
  const order = getStatusOrder(status);
  const total = PROJECT_STATUSES.length;
  const step = getClientNextStep(
    ctx.project,
    ctx.financial.openPayments.length > 0,
    ctx.shootProposals,
    brand.name,
    { hasQuote: ctx.show.estimates && ctx.quotes.length > 0, downloadsUnlocked: ctx.clientDownloadsUnlocked }
  );
  const actionTarget = step.actionHref?.startsWith("#") ? step.actionHref.slice(1) : null;
  const actionTab = actionTarget === "quote" || actionTarget === "payments" ? "pay" : "gallery";
  const actionAllowed =
    actionTarget && (actionTab === "gallery" || ctx.availableTabs.has("pay")) && !ctx.isSharedViewer;

  return (
    <PortalCard title="Project Status" icon={CheckCircle2}>
      <StatusBadge status={ctx.project.status} audience="client" />
      {ctx.canViewProjectProgress ? (
        <>
          <p className="mt-2 text-sm text-muted">{step.description}</p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted">
              <span>Progress</span>
              <span>
                Step {order + 1} of {total}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 surface-dark:bg-subtle">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((order + 1) / total) * 100}%` }} />
            </div>
          </div>
          <details className="group mt-2">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 text-xs font-medium text-accent">
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" /> All steps
            </summary>
            <ol className="mt-1 space-y-1.5">
              {PROJECT_STATUSES.map((s) => {
                const done = s.order < order;
                const current = s.order === order;
                return (
                  <li key={s.value} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        done && "border-accent bg-accent text-white",
                        current && "border-accent bg-accent/15",
                        !done && !current && "border-border"
                      )}
                    >
                      {done ? <CheckCircle2 className="h-3 w-3" /> : null}
                    </span>
                    <span className={cn(current ? "font-semibold text-heading" : done ? "text-foreground" : "text-muted")}>{s.clientLabel}</span>
                  </li>
                );
              })}
            </ol>
          </details>
          {actionAllowed && step.actionLabel ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 min-h-10 w-full"
              onClick={() => ctx.goTo(actionTab, undefined, actionTarget!)}
            >
              {step.actionLabel} <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
        </>
      ) : null}
    </PortalCard>
  );
}

function ProjectDetailsCard({ ctx }: { ctx: PortalCtx }) {
  const { project } = ctx;
  const shootWhen = getProjectShootDateTime(project, ctx.shootProposals);
  const rows: { icon: typeof MapPin; label: string; value: string }[] = [];
  if (project.project_name && project.project_name !== project.property_address) {
    rows.push({ icon: Home, label: "Project", value: project.project_name });
  }
  if (project.property_address) rows.push({ icon: MapPin, label: "Location", value: project.property_address });
  if (project.service_type) rows.push({ icon: Tag, label: "Type", value: project.service_type });
  if (shootWhen) {
    // A bare shoot_date has no real time of day; only a confirmed proposal carries one.
    const hasTime = shootWhen !== `${project.shoot_date}T09:00:00.000Z`;
    rows.push({
      icon: CalendarDays,
      label: "Shoot date",
      value: formatShootDateTime(
        shootWhen,
        hasTime
          ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
          : { month: "short", day: "numeric", year: "numeric" }
      ),
    });
  }
  if (project.delivery_date) {
    rows.push({
      icon: Truck,
      label: normalizeStatus(project.status) === "delivered" ? "Delivered" : "Delivery",
      value: formatDate(project.delivery_date),
    });
  }
  if (!rows.length) return null;
  return (
    <PortalCard title="Project Details" icon={Home}>
      <dl className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-2.5 text-sm">
            <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0">
              <dt className="sr-only">{r.label}</dt>
              <dd className="break-words text-foreground">{r.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </PortalCard>
  );
}

function FavoritesCard({ ctx }: { ctx: PortalCtx }) {
  const fav = ctx.favorites!;
  const favPhotos = useMemo(() => sortPhotos(ctx.photos).filter((p) => fav.isFavorite(p.id)), [ctx.photos, fav]);
  const preview = favPhotos.slice(0, 3);
  const urls = useThumbUrls(preview.map((p) => p.id));
  const extra = favPhotos.length - preview.length;
  return (
    <PortalCard title="Your Favorites" icon={Heart}>
      {favPhotos.length ? (
        <button
          type="button"
          onClick={() => ctx.goTo("gallery", { album: "favorites" })}
          className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <div className="grid grid-cols-4 gap-1.5">
            {preview.map((p) => (
              <ThumbTile key={p.id} url={urls[p.id]} className="aspect-square rounded-lg" />
            ))}
            {extra > 0 ? (
              <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-muted surface-dark:bg-subtle">
                +{extra}
              </div>
            ) : null}
          </div>
          <p className="mt-2 flex items-center justify-between text-xs text-muted">
            {favPhotos.length} favorited photo{favPhotos.length === 1 ? "" : "s"}
            <ChevronRight className="h-4 w-4" />
          </p>
        </button>
      ) : (
        <p className="text-sm text-muted">
          Tap the <Heart className="inline h-3.5 w-3.5 align-[-2px]" /> on any photo to save it here. Your photographer can see your picks.
        </p>
      )}
    </PortalCard>
  );
}

function MarketingSideCard({ ctx }: { ctx: PortalCtx }) {
  const previewIds = useMemo(() => sortPhotos(ctx.photos).slice(0, 2).map((p) => p.id), [ctx.photos]);
  const urls = useThumbUrls(previewIds);
  return (
    <PortalCard title="Marketing Kit" icon={Megaphone} subtitle="Ready-to-use marketing for this project.">
      {previewIds.length ? (
        <div className="grid grid-cols-[1.6fr_1fr] gap-1.5">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex gap-1 border-b border-border px-1.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            </div>
            <ThumbTile url={urls[previewIds[0]]} className="aspect-[16/10]" />
          </div>
          <ThumbTile url={urls[previewIds[1] ?? previewIds[0]]} className="aspect-[3/4] rounded-lg border border-border" />
        </div>
      ) : null}
      <Button variant="accent" className="mt-3 min-h-10 w-full" onClick={() => ctx.goTo("marketing")}>
        View Marketing Kit <ArrowRight className="h-4 w-4" />
      </Button>
    </PortalCard>
  );
}

function ContactCard({ ctx }: { ctx: PortalCtx }) {
  const brand = usePortalBrand();
  const phone = brand.phoneNumber?.trim();
  if (!ctx.openMessages && !phone) return null;
  return (
    <PortalCard title="Contact" icon={MessageSquare} subtitle={`Have a question for ${brand.name}?`}>
      <div className="space-y-2">
        {ctx.openMessages ? (
          <Button variant="outline" className="min-h-11 w-full border-accent/40 text-accent" onClick={ctx.openMessages}>
            <MessageSquare className="h-4 w-4" /> Send a Message
          </Button>
        ) : null}
        {phone ? (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent-subtle"
          >
            <Phone className="h-4 w-4" /> Call {phone}
          </a>
        ) : null}
      </div>
    </PortalCard>
  );
}

// ---------------------------------------------------------------------------
// Full gallery (?album=folders | all | favorites | unfiled | <folderId>)
// ---------------------------------------------------------------------------

function FullGallery({ ctx, album }: { ctx: PortalCtx; album: string }) {
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const folders = useMemo(() => [...ctx.mediaFolders].sort((a, b) => a.display_order - b.display_order), [ctx.mediaFolders]);
  const all = useMemo(() => sortPhotos(ctx.photos), [ctx.photos]);
  const byFolder = useMemo(() => {
    const map = new Map<string, MediaAsset[]>();
    for (const p of all) {
      const key = p.folder_id ?? UNFILED_FOLDER_SCOPE;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [all]);
  const unfiled = useMemo(() => byFolder.get(UNFILED_FOLDER_SCOPE) ?? [], [byFolder]);
  const visibleFolders = useMemo(() => folders.filter((f) => (byFolder.get(f.id) ?? []).length > 0), [folders, byFolder]);
  const hasFolders = visibleFolders.length > 0;
  const fav = ctx.favorites;
  const favPhotos = fav ? all.filter((p) => fav.isFavorite(p.id)) : [];

  const folder = folders.find((f) => f.id === album) ?? null;
  const view: "folders" | "all" | "favorites" | "folder" =
    album === "favorites" && fav
      ? "favorites"
      : album === UNFILED_FOLDER_SCOPE || folder
        ? "folder"
        : album === "folders" && hasFolders
          ? "folders"
          : "all";
  const folderName = folder?.name ?? (album === UNFILED_FOLDER_SCOPE ? UNFILED_FOLDER_LABEL : "");
  const list = view === "all" ? all : view === "favorites" ? favPhotos : view === "folder" ? byFolder.get(folder?.id ?? UNFILED_FOLDER_SCOPE) ?? [] : [];

  const coverIds = useMemo(() => {
    if (view !== "folders") return [] as string[];
    const ids: string[] = [];
    for (const f of visibleFolders) {
      const first = byFolder.get(f.id)?.[0];
      const cover = f.cover_media_id && all.some((p) => p.id === f.cover_media_id) ? f.cover_media_id : first?.id;
      if (cover) ids.push(cover);
    }
    if (unfiled[0]) ids.push(unfiled[0].id);
    return ids;
  }, [view, visibleFolders, byFolder, all, unfiled]);
  const coverUrls = useThumbUrls(coverIds);

  const go = (next: string) => ctx.goTo("gallery", { album: next });
  const crumbs: { label: string; album?: string; home?: boolean }[] = [{ label: "Gallery", home: true }];
  if (view === "folders") crumbs.push({ label: "All Folders" });
  else if (view === "all") crumbs.push({ label: "All Photos" });
  else if (view === "favorites") crumbs.push({ label: "Favorites" });
  else {
    if (hasFolders) crumbs.push({ label: "All Folders", album: "folders" });
    crumbs.push({ label: folderName });
  }

  const folderScope = view === "folder" ? folder?.id ?? UNFILED_FOLDER_SCOPE : null;
  const folderDownloadCount = folderScope ? countFolderDownloadableAssets(ctx.photos, folderScope, false) : 0;

  const tabs: { key: string; label: string; count: number; active: boolean; icon: typeof Folder }[] = [];
  if (hasFolders) tabs.push({ key: "folders", label: "Folders", count: visibleFolders.length + (unfiled.length ? 1 : 0), active: view === "folders" || view === "folder", icon: Folder });
  tabs.push({ key: "all", label: "All Photos", count: all.length, active: view === "all", icon: Images });
  if (fav) tabs.push({ key: "favorites", label: "Favorites", count: fav.count, active: view === "favorites", icon: Heart });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-4 w-4 text-muted" aria-hidden /> : null}
                {last ? (
                  <span className="font-semibold text-heading" aria-current="page">
                    {c.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => (c.home ? ctx.goTo("gallery") : go(c.album!))}
                    className="rounded font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {c.label}
                  </button>
                )}
              </span>
            );
          })}
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="no-scrollbar -mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => go(t.key)}
                aria-pressed={t.active}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  t.active ? "bg-accent text-accent-foreground" : "bg-slate-100 text-foreground hover:bg-accent-subtle surface-dark:bg-subtle"
                )}
              >
                <t.icon className={cn("h-4 w-4", t.key === "favorites" && t.count > 0 && "fill-current")} />
                {t.label}
                <span className={cn("text-xs", t.active ? "text-accent-foreground/80" : "text-muted")}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {view === "folder" && ctx.downloadsUnlocked && folderDownloadCount > 0 ? (
              <ProjectZipDownload
                projectId={ctx.project.id}
                folderId={folderScope!}
                folderLabel={folderName}
                expectedFileCount={folderDownloadCount}
                variant="default"
                buttonClassName="min-h-10"
              />
            ) : null}
            {view === "favorites" && ctx.downloadsUnlocked && ctx.favoriteDownloadCount > 0 ? (
              <Button variant="outline" className="min-h-10" onClick={ctx.zipFavorites.start} disabled={ctx.zipFavorites.active}>
                <Download className="h-4 w-4" /> Download Favorites
              </Button>
            ) : null}
            {view === "all" && ctx.downloadsUnlocked && ctx.downloadableFileCount > 0 ? (
              <Button variant="outline" className="min-h-10" onClick={ctx.zipAll.start} disabled={ctx.zipAll.active}>
                <Download className="h-4 w-4" /> Download All
              </Button>
            ) : null}
            {view !== "folders" && list.length > 0 ? (
              <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Layout">
                <button
                  type="button"
                  aria-pressed={layout === "grid"}
                  aria-label="Grid view"
                  onClick={() => setLayout("grid")}
                  className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md", layout === "grid" ? "bg-accent-subtle text-accent" : "text-muted hover:text-heading")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-pressed={layout === "list"}
                  aria-label="List view"
                  onClick={() => setLayout("list")}
                  className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md", layout === "list" ? "bg-accent-subtle text-accent" : "text-muted hover:text-heading")}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {view === "folder" && hasFolders ? (
          <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5" aria-label="Switch folder">
            {visibleFolders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => go(f.id)}
                aria-pressed={f.id === folder?.id}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  f.id === folder?.id ? "border-accent bg-accent-subtle text-accent" : "border-border text-foreground hover:border-accent/40"
                )}
              >
                <Folder className="h-3.5 w-3.5" /> {f.name}
              </button>
            ))}
            {unfiled.length ? (
              <button
                type="button"
                onClick={() => go(UNFILED_FOLDER_SCOPE)}
                aria-pressed={album === UNFILED_FOLDER_SCOPE}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  album === UNFILED_FOLDER_SCOPE ? "border-accent bg-accent-subtle text-accent" : "border-border text-foreground hover:border-accent/40"
                )}
              >
                <Folder className="h-3.5 w-3.5" /> {UNFILED_FOLDER_LABEL}
              </button>
            ) : null}
          </div>
        ) : null}

        {!ctx.downloadsUnlocked && ctx.downloadLockMessage && !ctx.isPreview ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" /> Preview only. {ctx.downloadLockMessage}
          </p>
        ) : null}
      </div>

      {view === "folders" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {visibleFolders.map((f) => {
            const items = byFolder.get(f.id) ?? [];
            const coverId = f.cover_media_id && all.some((p) => p.id === f.cover_media_id) ? f.cover_media_id : items[0]?.id;
            return (
              <FolderCard key={f.id} name={f.name} count={items.length} url={coverId ? coverUrls[coverId] : undefined} onOpen={() => go(f.id)} />
            );
          })}
          {unfiled.length ? (
            <FolderCard
              name={UNFILED_FOLDER_LABEL}
              count={unfiled.length}
              url={coverUrls[unfiled[0].id]}
              onOpen={() => go(UNFILED_FOLDER_SCOPE)}
            />
          ) : null}
        </div>
      ) : (
        <div className={cn(layout === "grid" && "rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4")}>
          <PhotoGallery
            key={`${view}-${album}`}
            layout={layout}
            photos={list}
            getDownloadUrl={ctx.getDownloadUrl}
            downloadsAllowed={ctx.downloadsUnlocked}
            favorites={ctx.favorites}
            gridClassName="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4"
            emptyState={
              view === "favorites" ? (
                <EmptyState
                  icon={Heart}
                  title="No favorites yet"
                  description="Tap the heart on any photo to save it here. Your favorites are shared with your photographer."
                />
              ) : undefined
            }
          />
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Button variant="ghost" className="min-h-11" onClick={() => ctx.goTo("gallery")}>
          <Sparkles className="h-4 w-4" /> Back to project overview
        </Button>
      </div>
    </div>
  );
}

function FolderCard({ name, count, url, onOpen }: { name: string; count: number; url?: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 surface-dark:bg-subtle">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <Folder className="h-8 w-8 opacity-40" />
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
          <Folder className="h-3 w-3" /> Folder
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-heading">{name}</p>
          <p className="text-xs text-muted">
            {count} photo{count === 1 ? "" : "s"}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

