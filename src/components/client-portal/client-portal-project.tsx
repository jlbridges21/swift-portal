"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft, Box, CheckCircle2, Clapperboard, Clock, CreditCard, Eye, FileText, Images, Megaphone, Rotate3d, X,
} from "lucide-react";
import { toast } from "sonner";
import type { ProjectPageClientProps } from "@/components/projects/project-page-client";
import { PaymentOptionsProvider } from "@/components/projects/payments-section";
import { useClientFavorites } from "@/components/projects/use-client-favorites";
import { useProjectZipDownload } from "@/components/projects/project-zip-download";
import { videosToGridEntries } from "@/components/projects/video-grid";
import { ClientMessagesChat } from "@/components/projects/client-messages-chat";
import { DownloadQualityDialog } from "@/components/projects/download-quality-dialog";
import { HashScrollHandler } from "@/components/ui/hash-scroll-handler";
import { PortalTopBar } from "@/components/client-portal/portal-ui";
import { resolvePortalFinancialState } from "@/components/client-portal/portal-financial-state";
import { parsePortalTab, type PortalCtx, type PortalTab } from "@/components/client-portal/portal-context";
import { GalleryTab } from "@/components/client-portal/portal-gallery";
import {
  EstimatePayTab, FilesTab, MarketingTab, ModelsTab, ToursTab, VideosTab,
} from "@/components/client-portal/portal-sections";
import { normalizeStatus } from "@/lib/constants";
import { clientDownloadLockMessage, resolveProjectDownloadAllowed } from "@/lib/deliverables";
import { downloadMediaAsset, downloadMediaFileChecked, viewMediaAsset } from "@/lib/download";
import type { DownloadQuality } from "@/lib/download-quality";
import { mediaDisplayName } from "@/lib/media-display-name";
import { isStorageBackedDeliverable } from "@/lib/project-zip-assets";
import { DEFAULT_PROJECT_MEDIA_SECTIONS, isMediaSectionVisibleForClient } from "@/lib/project-media-sections";
import type { MediaAsset } from "@/lib/types";
import type { VideoReviewListItem } from "@/lib/video-reviews";
import { cn, formatCurrency } from "@/lib/utils";

/** Hash targets used by emails, notifications and the shared proposal/payment components. */
const HASH_TAB: Record<string, PortalTab> = {
  quote: "pay",
  payments: "pay",
  scheduling: "gallery",
  "deliverable-review": "gallery",
  "photo-gallery": "gallery",
  video: "videos",
  models: "models",
  documents: "files",
};

/**
 * New-experience client project portal. Receives exactly the props of the classic page
 * (ProjectPageClient) — the server already scoped every list to this viewer — and lays them out
 * as tabs: Gallery (home) | Videos | 360 Tours | 3D Models | Marketing Kit | Files | Estimate & Pay.
 * All actions reuse the classic components and APIs (proposals, Stripe checkout, ZIPs, favorites,
 * reviews, scheduling, messages), so permissions and workflows are unchanged.
 */
export function ClientPortalProject(props: ProjectPageClientProps) {
  const {
    project,
    hero,
    photos,
    videos,
    documents,
    tours,
    models,
    payments,
    revisions: initialRevisions,
    shootProposals,
    activities,
    quotes,
    assetReviews,
    mediaFolders = [],
    videoReviews = [],
    mediaSections = DEFAULT_PROJECT_MEDIA_SECTIONS,
    isPreview = false,
    allowClientProposalChanges = true,
    requireDeliveredForDownloads = true,
    isSharedViewer = false,
    videoSharing,
    canViewFinancials = false,
    canViewProjectProgress,
    canAccessVideoReviews = false,
    depositMode = "none",
    depositPercent = 50,
    depositAmountCents = 0,
    allowClientPayInFull = false,
    paymentOptions = { bankAvailable: false, passCardFee: false },
    marketingKit = null,
    clientFavoriteIds = null,
  } = props;

  const searchParams = useSearchParams();
  const requestedTab = parsePortalTab(searchParams.get("tab"));
  const [revisions, setRevisionsState] = useState(initialRevisions);
  const setRevisions = useCallback((fn: (prev: typeof initialRevisions) => typeof initialRevisions) => setRevisionsState(fn), []);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [pendingPhotoDownload, setPendingPhotoDownload] = useState<MediaAsset | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const favoritesController = useClientFavorites(project.id, clientFavoriteIds ?? []);
  const favorites = clientFavoriteIds && !isPreview ? favoritesController : undefined;

  const status = normalizeStatus(project.status);
  const clientDownloadsUnlocked = resolveProjectDownloadAllowed({
    projectStatus: status,
    isAdmin: false,
    requireDeliveredForDownloads,
  });
  const downloadsUnlocked = isPreview || clientDownloadsUnlocked;
  const downloadLockMessage = clientDownloadLockMessage(status, requireDeliveredForDownloads);

  const show = {
    photos: isMediaSectionVisibleForClient(mediaSections, "photos"),
    videos: isMediaSectionVisibleForClient(mediaSections, "videos"),
    tours: isMediaSectionVisibleForClient(mediaSections, "tours"),
    models: isMediaSectionVisibleForClient(mediaSections, "models"),
    documents: isMediaSectionVisibleForClient(mediaSections, "documents"),
    estimates: isMediaSectionVisibleForClient(mediaSections, "estimates"),
    payments: isMediaSectionVisibleForClient(mediaSections, "payments"),
  };

  const hasAnyMedia =
    (show.photos && photos.length > 0) ||
    (show.videos && videos.length > 0) ||
    (show.tours && tours.length > 0) ||
    (show.models && models.length > 0) ||
    (show.documents && documents.length > 0);

  const uploadedVideos = videos.filter((v) => v.media_source !== "youtube");
  const downloadableFileCount = [...(show.photos ? photos : []), ...(show.videos ? uploadedVideos : [])].filter(
    (m) => m.file_path && m.media_source !== "youtube" && m.media_source !== "kuula" && m.media_source !== "external"
  ).length;
  const favoriteDownloadCount = favorites
    ? photos.filter((p) => favorites.isFavorite(p.id) && isStorageBackedDeliverable(p)).length
    : 0;

  const financial = useMemo(
    () =>
      canViewFinancials && !isSharedViewer
        ? resolvePortalFinancialState(show.estimates ? quotes : [], show.payments ? payments : [])
        : resolvePortalFinancialState([], []),
    [canViewFinancials, isSharedViewer, quotes, payments, show.estimates, show.payments]
  );

  const marketingProducts = useMemo(() => {
    if (!marketingKit?.visibleToClient || isSharedViewer) return [] as ("website" | "social")[];
    return (["website", "social"] as const).filter((p) => marketingKit.access[p].state !== "unavailable");
  }, [marketingKit, isSharedViewer]);

  const availableTabs = useMemo(() => {
    const set = new Set<PortalTab>(["gallery"]);
    if (show.videos && videos.length > 0) set.add("videos");
    if (show.tours && tours.length > 0) set.add("tours");
    if (show.models && models.length > 0) set.add("models");
    if (marketingProducts.length > 0) set.add("marketing");
    if (show.documents && documents.length > 0) set.add("files");
    if (canViewFinancials && !isSharedViewer && (show.estimates || show.payments)) set.add("pay");
    return set;
  }, [show.videos, show.tours, show.models, show.documents, show.estimates, show.payments, videos.length, tours.length, models.length, documents.length, marketingProducts.length, canViewFinancials, isSharedViewer]);

  const tab: PortalTab = availableTabs.has(requestedTab) ? requestedTab : "gallery";

  const goTo = useCallback(
    (next: PortalTab, extra?: Record<string, string | null>, hash?: string) => {
      const params = new URLSearchParams(window.location.search);
      if (next === "gallery") params.delete("tab");
      else params.set("tab", next);
      // Leaving the gallery drops the album; callers pass it again when they want one.
      if (next !== "gallery" || !extra || !("album" in extra)) params.delete("album");
      for (const [k, v] of Object.entries(extra ?? {})) {
        if (v == null) params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
      window.history.pushState(null, "", url);
      if (hash) {
        // HashScrollHandler listens for hashchange; pushState doesn't fire it.
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        return;
      }
      // Keep the tab bar in view without jumping to the very top of a long page.
      const nav = navRef.current;
      if (nav) {
        const top = nav.getBoundingClientRect().top + window.scrollY;
        if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top - 8), behavior: "auto" });
      }
    },
    []
  );

  // Deep links: #quote / #payments / #scheduling … land on the tab that holds them.
  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;
      if (hash === "messages") {
        if (canViewFinancials && !isSharedViewer) setMessagesOpen(true);
        return;
      }
      const target = HASH_TAB[hash];
      if (!target || !availableTabs.has(target)) return;
      const params = new URLSearchParams(window.location.search);
      const current = parsePortalTab(params.get("tab"));
      if (current === target && !params.get("album")) return;
      if (target === "gallery") params.delete("tab");
      else params.set("tab", target);
      params.delete("album");
      const qs = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}#${hash}`);
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [availableTabs, canViewFinancials, isSharedViewer]);

  // Messages drawer: Escape closes, page behind doesn't scroll.
  useEffect(() => {
    if (!messagesOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMessagesOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [messagesOpen]);

  const getDownloadUrl = useCallback(
    async (asset: MediaAsset, thumb = false): Promise<string | null> => {
      try {
        const preview = !downloadsUnlocked && !thumb;
        const res = await fetch(`/api/media/download/${asset.id}${thumb ? "?thumb=1" : preview ? "?preview=1" : ""}`, {
          credentials: "include",
        });
        const text = await res.text();
        if (!text) return null;
        const data = JSON.parse(text);
        if (!res.ok) {
          if (res.status !== 404) toast.error(data.error || "Couldn't load media preview");
          return null;
        }
        return data.url as string;
      } catch {
        return null;
      }
    },
    [downloadsUnlocked]
  );

  const handleDownload = useCallback(
    async (asset: MediaAsset) => {
      if (!downloadsUnlocked) {
        toast.error(downloadLockMessage ?? "Downloads are not available yet");
        return;
      }
      if (asset.media_type === "photo") {
        setPendingPhotoDownload(asset);
        return;
      }
      if (asset.media_type === "document") {
        const pending = toast.loading(`Downloading ${mediaDisplayName(asset)}…`);
        try {
          await downloadMediaFileChecked(asset);
          toast.success("Download started", { id: pending });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "The download failed. Please try again.", { id: pending });
        }
        return;
      }
      await downloadMediaAsset(asset);
    },
    [downloadsUnlocked, downloadLockMessage]
  );

  const handleView = useCallback(
    async (asset: MediaAsset) => {
      if (!downloadsUnlocked) {
        const url = await getDownloadUrl(asset);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      viewMediaAsset(asset);
    },
    [downloadsUnlocked, getDownloadUrl]
  );

  const zipAll = useProjectZipDownload({ projectId: project.id, expectedFileCount: downloadableFileCount });
  const zipFavorites = useProjectZipDownload({
    projectId: project.id,
    favoritesOnly: true,
    folderLabel: "Favorites",
    expectedFileCount: favoriteDownloadCount,
  });

  const reviewByAssetId = useMemo(() => {
    const map = new Map<string, VideoReviewListItem>();
    for (const item of videoReviews) for (const v of item.versions) map.set(v.media_asset_id, item);
    return map;
  }, [videoReviews]);
  const videoEntries = useMemo(() => videosToGridEntries(videos), [videos]);

  const canMessage = canViewFinancials && !isSharedViewer;
  const openMessages = canMessage ? () => setMessagesOpen(true) : null;

  const ctx: PortalCtx = {
    project,
    hero,
    photos,
    videos,
    documents,
    tours,
    models,
    payments,
    shootProposals,
    activities,
    quotes,
    assetReviews,
    mediaFolders,
    depositMode,
    depositPercent,
    depositAmountCents,
    allowClientPayInFull,
    allowClientProposalChanges,
    marketingKit,
    revisions,
    setRevisions,
    isPreview,
    isSharedViewer,
    canViewFinancials,
    canViewProjectProgress,
    canAccessVideoReviews,
    videoSharing,
    show,
    clientDownloadsUnlocked,
    downloadsUnlocked,
    downloadLockMessage,
    hasAnyMedia,
    downloadableFileCount,
    favorites,
    financial,
    videoEntries,
    reviewByAssetId,
    getDownloadUrl,
    handleDownload,
    handleView,
    goTo,
    openMessages,
    zipAll,
    zipFavorites,
    favoriteDownloadCount,
    availableTabs,
    marketingProducts,
  };

  const pageTitle = project.property_address?.trim() || project.project_name;

  return (
    <PaymentOptionsProvider value={paymentOptions}>
      <div className="min-h-screen bg-slate-50 surface-dark:bg-background">
        <HashScrollHandler />
        {isPreview ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
            <Eye className="mr-1 inline h-4 w-4" />
            Preview — this is what your client sees
            <Link href={`/admin/projects/${project.id}`} className="ml-3 font-medium text-accent hover:underline">
              <ArrowLeft className="inline h-3 w-3" /> Back to project
            </Link>
          </div>
        ) : null}
        <PortalTopBar title={pageTitle} onOpenMessages={openMessages ?? undefined} showMyProjects={!isPreview} preview={isPreview}>
          <div ref={navRef} className="border-t border-border/70">
            <ProjectTabsNav tab={tab} ctx={ctx} />
          </div>
        </PortalTopBar>

        <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-8">
          {tab === "gallery" && <GalleryTab ctx={ctx} />}
          {tab === "videos" && <VideosTab ctx={ctx} />}
          {tab === "tours" && <ToursTab ctx={ctx} />}
          {tab === "models" && <ModelsTab ctx={ctx} />}
          {tab === "marketing" && <MarketingTab ctx={ctx} />}
          {tab === "files" && <FilesTab ctx={ctx} />}
          {tab === "pay" && <EstimatePayTab ctx={ctx} />}
        </main>

        {/* ZIP pickers + progress, shared by every Download All / Download Favorites button. */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto w-full max-w-md empty:hidden">
            {zipAll.panel}
            {zipFavorites.panel}
          </div>
        </div>

        {messagesOpen && canMessage ? (
          <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Messages">
            <button type="button" aria-label="Close messages" className="absolute inset-0 bg-slate-900/40" onClick={() => setMessagesOpen(false)} />
            <div
              className="relative flex h-full w-full max-w-md flex-col bg-card shadow-2xl"
              style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-base font-semibold text-heading">Messages</p>
                <button
                  type="button"
                  onClick={() => setMessagesOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-accent-subtle hover:text-heading"
                  aria-label="Close messages"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <ClientMessagesChat projectId={project.id} clientId={project.client_id ?? undefined} />
              </div>
            </div>
          </div>
        ) : null}

        <DownloadQualityDialog
          open={!!pendingPhotoDownload}
          onClose={() => setPendingPhotoDownload(null)}
          title="Download photo"
          onConfirm={(q: DownloadQuality) => {
            if (pendingPhotoDownload) void downloadMediaAsset(pendingPhotoDownload, { quality: q });
            setPendingPhotoDownload(null);
          }}
        />
      </div>
    </PaymentOptionsProvider>
  );
}

const TAB_META: Record<PortalTab, { label: string; icon: ComponentType<{ className?: string }> }> = {
  gallery: { label: "Gallery", icon: Images },
  videos: { label: "Videos", icon: Clapperboard },
  tours: { label: "360 Tours", icon: Rotate3d },
  models: { label: "3D Models", icon: Box },
  marketing: { label: "Marketing Kit", icon: Megaphone },
  files: { label: "Files", icon: FileText },
  pay: { label: "Estimate & Pay", icon: CreditCard },
};

/** Estimate & Pay button state: blue (review), red (due), green (paid). */
function payTabAppearance(ctx: PortalCtx): { suffix: string | null; tone: "blue" | "red" | "green" | "amber" | "plain"; icon?: ComponentType<{ className?: string }> } {
  const f = ctx.financial;
  switch (f.kind) {
    case "due":
      return { suffix: `${formatCurrency(f.dueCents)} Due`, tone: "red" };
    case "balance":
      return { suffix: `${formatCurrency(f.balanceCents)} Balance`, tone: "amber" };
    case "review":
      return { suffix: "Review", tone: "blue" };
    case "processing":
      return { suffix: "Processing", tone: "amber", icon: Clock };
    case "paid":
      return { suffix: "Paid", tone: "green", icon: CheckCircle2 };
    default:
      return { suffix: null, tone: "plain" };
  }
}

function ProjectTabsNav({ tab, ctx }: { tab: PortalTab; ctx: PortalCtx }) {
  const order: PortalTab[] = ["gallery", "videos", "tours", "models", "marketing", "files"];
  const items = order.filter((t) => ctx.availableTabs.has(t));
  const pay = ctx.availableTabs.has("pay") ? payTabAppearance(ctx) : null;
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the active tab visible on narrow screens.
  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  return (
    <nav aria-label="Project sections" className="mx-auto w-full max-w-7xl px-2 sm:px-4 lg:px-6">
      <div ref={scrollerRef} className="no-scrollbar flex items-center gap-1 overflow-x-auto py-2">
        {items.map((t) => {
          const { label, icon: Icon } = TAB_META[t];
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => ctx.goTo(t)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                active ? "bg-accent text-accent-foreground shadow-sm" : "text-foreground hover:bg-accent-subtle hover:text-accent"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
        {pay ? (
          <button
            type="button"
            aria-current={tab === "pay" ? "page" : undefined}
            onClick={() => ctx.goTo("pay")}
            className={cn(
              "order-first inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold sm:order-none sm:ml-auto transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              pay.tone === "red" && "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
              pay.tone === "amber" && "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
              pay.tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
              pay.tone === "blue" && "border-accent/30 bg-accent-subtle text-accent hover:bg-accent/15",
              pay.tone === "plain" && "border-transparent text-foreground hover:bg-accent-subtle hover:text-accent",
              tab === "pay" && "ring-2 ring-offset-1",
              tab === "pay" && pay.tone === "red" && "ring-red-300",
              tab === "pay" && pay.tone === "amber" && "ring-amber-300",
              tab === "pay" && pay.tone === "green" && "ring-emerald-300",
              tab === "pay" && (pay.tone === "blue" || pay.tone === "plain") && "bg-accent text-accent-foreground ring-accent/30 hover:bg-accent-hover"
            )}
          >
            <CreditCard className="h-4 w-4" />
            Estimate &amp; Pay
            {pay.suffix ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>·</span>
                {pay.suffix}
                {pay.icon ? <pay.icon className="h-4 w-4" /> : null}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
    </nav>
  );
}
