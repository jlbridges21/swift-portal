"use client";

import { parseProjectDownloadAccess, type ProjectDownloadAccess } from "@/lib/deliverables";
import { useState, useEffect, Suspense, useMemo, useCallback, useRef, use, type ReactNode } from "react";
import { ProjectServicesPicker } from "@/components/admin/project-services-picker";
import type { ServiceOption } from "@/components/forms/service-multi-select";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { normalizeTourUrl, TOUR_URL_ERROR } from "@/lib/tour-url";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StickySaveBar } from "@/components/ui/sticky-save-bar";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { AdminPhotoGrid, type PhotoGridController } from "@/components/admin/admin-photo-grid";
import { VideoGrid, videosToGridEntries } from "@/components/projects/video-grid";
import { mediaDisplayName } from "@/lib/media-display-name";
import { RevisionDrawer } from "@/components/admin/revision-drawer";
import { DOCUMENT_ACCEPT, PROJECT_STATUSES, getStatusLabel, getStatusOrder } from "@/lib/constants";
import { FILE_SIZE_LIMITS, formatFileSize } from "@/lib/brand";
import { QuoteSection } from "@/components/projects/quote-section";
import { BankPaymentsNotice } from "@/components/admin/bank-payments-notice";
import { AdminPaymentActions } from "@/components/admin/admin-payment-actions";
import type { Project, Client, MediaAsset, Tour, Project3dModel, Payment, ShootProposal, ActivityLog, Revision, ProjectQuote, AssetReview, MediaFolder } from "@/lib/types";
import type { DepositMode } from "@/lib/workflow-settings";
import { normalizeStatus } from "@/lib/constants";
import { ShootScheduling } from "@/components/projects/shoot-scheduling";
import { ProjectStaffCard } from "@/components/admin/project-staff-card";
import { ProjectClientsDetailsCard } from "@/components/admin/project-workspace/project-clients-details-card";
import { ProjectActivityTimeline } from "@/components/projects/project-activity-timeline";
import { NextStepBanner } from "@/components/projects/next-step-banner";
import { getAdminNextStep } from "@/lib/journey";
import {
  EXTERNAL_3D_SUPPORTED_LIST,
  normalizeExternal3dUrl,
} from "@/lib/external-3d-models";
import {
  Upload, CreditCard, Globe, Box, Trash2, ChevronUp, ChevronDown,
  ExternalLink, Check, Video, ImageIcon, Eye, EyeOff, Link2, Pencil, Users, Plus, MapPin, Share2,
  Sparkles,
  AlertTriangle,
  Loader2,
  CalendarClock,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Home,
  Info,
  LayoutGrid,
  Megaphone,
  MoreHorizontal,
  Rotate3d,
  Trash,
  History,
  Copy,
  Activity as ActivityIcon,
} from "lucide-react";
import { useInAdminAppShell } from "@/components/admin/app-shell/admin-app-shell-context";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import {
  ActivityPreview,
  SidebarCard,
  CategoryChips,
  ChangeCoverDialog,
  ClientContactCard,
  IconAction,
  LinkedMediaCard,
  MediaSectionHeader,
  ProjectHero,
  RowOverflow,
  StatTile,
  ProjectActionBar,
  StatusSummary,
  VisibilityPanel,
  ClientDownloadsControl,
  WorkspaceTabs,
  type VisibilityRow,
  type WorkspaceTab,
} from "@/components/admin/project-workspace/workspace-parts";
import { MarketingAddOns } from "@/components/admin/project-workspace/marketing-addons";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated, viewerDateArgs } from "@/lib/use-hydrated";
import type { ProjectClientFavorites } from "@/lib/client-favorites";
import { documentKindLabel, downloadMediaFileChecked, isPdf, viewMediaAsset } from "@/lib/download";
import { formatCurrency } from "@/lib/utils";
import { CreateClientModal } from "@/components/admin/create-client-modal";
import { useUploadManager } from "@/components/admin/upload-manager";
import { cn, defaultProjectName } from "@/lib/utils";
import { isClientVisibleMedia } from "@/lib/client-media";
import { ALLOWED_VIDEO_MIME_TYPES } from "@/lib/upload/constants";
import { toast } from "sonner";
import { DeleteProjectModal } from "@/components/admin/permanent-delete-modals";
import { useVideoReviewDeleteHandler } from "@/components/admin/video-review-admin-actions";
import { AdminVideoGridCard } from "@/components/admin/admin-video-grid-card";
import { SortableVideoItem, SortableVideoList } from "@/components/admin/sortable-video-grid";
import { MarketingKitCard } from "@/components/marketing/marketing-kit-card";
import type { KitSummary } from "@/lib/marketing/server";
import type { VideoReviewListItem } from "@/lib/video-reviews";
import type { ProjectShareRow } from "@/lib/project-shares";
import { ProjectShareModal } from "@/components/admin/project-share-modal";
import type { ProjectLinkAccessMode } from "@/lib/project-link-access";
import type { PhotoShareSummary } from "@/lib/media-share-types";
import { usePhotoShareDialog, useProjectPhotoShareSummary } from "@/components/photos/photo-share-dialog";
import { getCachedThumbUrl } from "@/lib/media-thumb-client";
import { useAsyncAction } from "@/lib/use-async-action";
import {
  MEDIA_SECTION_LABELS,
  mediaSectionsFromProject,
  type ProjectSectionKey,
  type ProjectMediaSections,
} from "@/lib/project-media-sections";
import { PortalAccessStatus } from "@/components/admin/portal-access-status";

function dedupeMedia<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function ClientSectionVisibilityToggle({
  sectionKey,
  visible,
  saving,
  onChange,
}: {
  sectionKey: ProjectSectionKey;
  visible: boolean;
  saving: boolean;
  onChange: (visible: boolean) => void;
}) {
  const label = MEDIA_SECTION_LABELS[sectionKey];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={visible}
      aria-label={`${label}: ${visible ? "visible to clients" : "hidden from clients"}`}
      disabled={saving}
      onClick={() => onChange(!visible)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        visible
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-900",
        saving && "opacity-60"
      )}
    >
      {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {visible ? "Visible to clients" : "Hidden from clients"}
    </button>
  );
}

interface AdminProjectDetailProps {
  project: Project & { clients: Client };
  media: MediaAsset[];
  tours: Tour[];
  models: Project3dModel[];
  payments: Payment[];
  shootProposals: ShootProposal[];
  projectClients: { id: string; client_id: string; is_primary: boolean; clients: Client }[];
  allClients: Pick<Client, "id" | "name" | "email" | "company">[];
  /** Streamed from the server (never blocks the page); a plain array also works. */
  activities: ActivityLog[] | Promise<ActivityLog[]>;
  revisions: Revision[];
  quotes: ProjectQuote[];
  assetReviews: AssetReview[];
  mediaFolders: MediaFolder[];
  portalUrl: string;
  clientProjectUrl: string;
  initialVideoReviews?: VideoReviewListItem[];
  projectShares?: ProjectShareRow[];
  linkAccessMode?: ProjectLinkAccessMode;
  linkAccessPublicUrl?: string | null;
  linkAccessViewCount?: number;
  /** Individual photo sharing: what this user may manage, and live counts per photo. */
  photoSharing?: { email: boolean; link: boolean };
  photoShareSummary?: Record<string, PhotoShareSummary>;
  folderShareSummary?: Record<string, PhotoShareSummary>;
  /** Videos currently shared publicly (link / embed). */
  publicVideoIds?: string[];
  /** Hide estimates / payments / payment links when false (staff without money.view). */
  canViewMoney?: boolean;
  depositMode?: DepositMode;
  depositPercent?: number;
  depositAmountCents?: number;
  travel?: import("@/lib/travel-fee").TravelSettings | null;
  /** Expiration the server sets on send, so the proposal preview prints the same date. */
  proposalExpiration?: { autoSetOnSend: boolean; defaultDays: number };
  marketingKit?: KitSummary | null;
  canEditMarketing?: boolean;
  canManageMarketingOffers?: boolean;
  /** New interface: banner-sized cover for the project hero. */
  heroBannerUrl?: string | null;
  /** New interface: the business's service names for the Project Type picker. */
  serviceOptions?: string[];
  /** Every business service (inactive flagged) for the multi-service picker. Empty = legacy picker. */
  serviceCatalog?: ServiceOption[];
  /** Services linked to this project (v127 links, else the primary service_id). */
  serviceIds?: string[];
  /** Client photo likes (read-only here; only clients change them). */
  clientFavorites?: ProjectClientFavorites;
  /** Admin Settings › Payments › Download Access — the default the project override falls back to. */
  businessRequiresDeliveredForDownloads?: boolean;
}

type WorkspaceTabKey = "media" | "estimates" | "marketing" | "payments" | "details";
type MediaCategory = "all" | "photos" | "videos" | "tours" | "models" | "files";
const WORKSPACE_TAB_KEYS: WorkspaceTabKey[] = ["media", "estimates", "marketing", "payments", "details"];
/** Classic in-page anchors (notifications, next-step links) → the New interface tab that holds them. */
const HASH_TO_TAB: Record<string, WorkspaceTabKey> = {
  quote: "estimates",
  payments: "payments",
  "marketing-kit": "marketing",
  scheduling: "details",
  activity: "details",
  photos: "media",
};

function shortLocation(address: string | null | undefined): string | null {
  const parts = (address ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  const rest = parts
    .slice(1)
    .map((p) => p.replace(/\s+\d{5}(-\d{4})?$/, ""))
    .filter((p) => p && !/^\d{5}(-\d{4})?$/.test(p) && !/^(usa|us|united states)$/i.test(p));
  return rest.length ? rest.join(", ") : parts[0];
}

function formatHeroDate(value: string | null | undefined, dateOnly = false, timeZone?: string): string | null {
  if (!value) return null;
  const d = dateOnly ? new Date(`${value.slice(0, 10)}T12:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Date-only values are pinned to local noon, so only timestamps need the hydration-safe zone.
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", ...(dateOnly ? {} : { timeZone }) });
}

async function readServerError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  const message = data?.error?.trim();
  return message || fallback;
}

export function AdminProjectDetail({
  project: initialProject,
  media: initialMedia,
  tours: initialTours,
  models: initialModels,
  payments,
  shootProposals,
  projectClients: initialProjectClients,
  allClients,
  activities,
  revisions: initialRevisions,
  quotes,
  assetReviews,
  mediaFolders: initialFolders,
  portalUrl,
  clientProjectUrl,
  initialVideoReviews = [],
  projectShares = [],
  linkAccessMode = "restricted",
  linkAccessPublicUrl = null,
  linkAccessViewCount = 0,
  photoSharing = { email: false, link: false },
  photoShareSummary = {},
  publicVideoIds: initialPublicVideoIds = [],
  folderShareSummary = {},
  canViewMoney = true,
  depositMode = "none",
  depositPercent = 50,
  depositAmountCents = 0,
  travel = null,
  proposalExpiration,
  marketingKit = null,
  canEditMarketing = false,
  canManageMarketingOffers = false,
  heroBannerUrl = null,
  serviceOptions = [],
  serviceCatalog = [],
  serviceIds = [],
  clientFavorites: initialClientFavorites,
  businessRequiresDeliveredForDownloads = true,
}: AdminProjectDetailProps) {
  // Dates render identically on the server and the hydration pass, then in the viewer's zone.
  const { locale: viewerLocale, timeZone: viewerTimeZone } = viewerDateArgs(useHydrated());
  const router = useRouter();
  const inAppShell = useInAdminAppShell();
  const [activeTab, setActiveTabState] = useState<WorkspaceTabKey>("media");
  const [mediaCategory, setMediaCategory] = useState<MediaCategory>("all");
  const [proposalHistoryOpen, setProposalHistoryOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [typeSaving, setTypeSaving] = useState(false);
  const [showCoverDialog, setShowCoverDialog] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [projectMenuAnchor, setProjectMenuAnchor] = useState<ActionMenuAnchor | null>(null);
  const [uploadMenuAnchor, setUploadMenuAnchor] = useState<ActionMenuAnchor | null>(null);
  const photoGridController = useRef<PhotoGridController | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  async function downloadDocument(asset: MediaAsset) {
    if (downloadingDocId) return;
    setDownloadingDocId(asset.id);
    try {
      await downloadMediaFileChecked(asset);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The download failed. Please try again.");
    } finally {
      setDownloadingDocId(null);
    }
  }
  const [clientFavorites, setClientFavorites] = useState<ProjectClientFavorites>(
    () => initialClientFavorites ?? { available: false, rows: [] }
  );
  useEffect(() => {
    if (initialClientFavorites) setClientFavorites(initialClientFavorites);
  }, [initialClientFavorites]);
  // Clients like photos from their portal while this page is open: refresh likes when the
  // business comes back to the tab, so the count and badges stay current.
  useEffect(() => {
    if (!clientFavorites.available) return;
    let cancelled = false;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      const res = await fetch(`/api/projects/${initialProject.id}/favorites`, { credentials: "include" }).catch(() => null);
      if (!res?.ok || cancelled) return;
      const data = (await res.json().catch(() => null)) as { available?: boolean; favorites?: ProjectClientFavorites["rows"] } | null;
      if (data?.favorites && !cancelled) setClientFavorites({ available: data.available !== false, rows: data.favorites });
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [clientFavorites.available, initialProject.id]);

  /** Tab lives in ?tab= so reloads and shared links land on the same section. */
  const setActiveTab = useCallback((tab: WorkspaceTabKey) => {
    setActiveTabState(tab);
    const url = new URL(window.location.href);
    if (tab === "media") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  useEffect(() => {
    if (!inAppShell) return;
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("tab") as WorkspaceTabKey | null;
    const fromHash = HASH_TO_TAB[url.hash.replace(/^#/, "")];
    const next = fromQuery && WORKSPACE_TAB_KEYS.includes(fromQuery) ? fromQuery : fromHash;
    if (next) setActiveTabState(next);
    // Mount only: later changes come from the tabs.
  }, [inAppShell]);
  const { enqueueUploads } = useUploadManager();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showTourForm, setShowTourForm] = useState(false);
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelFormEmbedUrl, setModelFormEmbedUrl] = useState("");
  const [showYoutubeForm, setShowYoutubeForm] = useState(false);
  const [editingMedia, setEditingMedia] = useState<string | null>(null);
  const [editingTour, setEditingTour] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editMediaForm, setEditMediaForm] = useState({ title: "", youtube_url: "" });
  const [editTourForm, setEditTourForm] = useState({ tour_name: "", kuula_url: "", notes: "" });
  const [editModelForm, setEditModelForm] = useState({ title: "", embed_url: "", description: "" });
  const [addClientId, setAddClientId] = useState("");
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [projectClients, setProjectClients] = useState(initialProjectClients);
  const [revisions, setRevisions] = useState(initialRevisions);
  const [paymentList, setPaymentList] = useState(payments);
  const [pendingNewPhotoIds, setPendingNewPhotoIds] = useState<string[]>([]);
  const [showShootCompleteModal, setShowShootCompleteModal] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null);
  const [coverImageId, setCoverImageId] = useState(initialProject.cover_image_id);
  const [sendingForReview, setSendingForReview] = useState(false);
  const [markingShootComplete, setMarkingShootComplete] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPermanentDelete, setShowPermanentDelete] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [folders, setFolders] = useState(initialFolders);
  const [tourPendingDelete, setTourPendingDelete] = useState<Tour | null>(null);
  const [deletingTour, setDeletingTour] = useState(false);
  const [modelPendingDelete, setModelPendingDelete] = useState<Project3dModel | null>(null);
  const [deletingModel, setDeletingModel] = useState(false);
  const [videoReviews, setVideoReviews] = useState(initialVideoReviews);
  const [mediaSections, setMediaSections] = useState<ProjectMediaSections>(() =>
    mediaSectionsFromProject(initialProject)
  );
  const [sectionSaving, setSectionSaving] = useState<ProjectSectionKey | null>(null);
  // Marketing Kit per-project visibility (v123). Shows the explicit setting when set,
  // otherwise today's automatic result.
  const marketingVisibleFromServer = marketingKit
    ? (marketingKit.clientVisibility ?? marketingKit.visibleToClient)
    : false;
  const [marketingVisible, setMarketingVisibleState] = useState(marketingVisibleFromServer);
  const [marketingVisSaving, setMarketingVisSaving] = useState(false);
  // Client download override (v124). Saved on change; reverts on failure.
  const downloadAccessFromServer = parseProjectDownloadAccess(initialProject.client_download_access);
  const [downloadAccess, setDownloadAccessState] = useState<ProjectDownloadAccess>(downloadAccessFromServer);
  const [downloadAccessSaving, setDownloadAccessSaving] = useState(false);
  useEffect(() => {
    setDownloadAccessState(downloadAccessFromServer);
  }, [downloadAccessFromServer]);
  useEffect(() => {
    setMarketingVisibleState(marketingVisibleFromServer);
  }, [marketingVisibleFromServer]);

  const reviewByAssetId = useMemo(() => {
    const map = new Map<string, VideoReviewListItem>();
    for (const item of videoReviews) {
      for (const version of item.versions) {
        map.set(version.media_asset_id, item);
      }
    }
    return map;
  }, [videoReviews]);

  const refreshVideoReviews = useCallback(async () => {
    const res = await fetch(`/api/video-reviews?project_id=${initialProject.id}`, {
      credentials: "include",
    });
    if (res.ok) {
      setVideoReviews((await res.json()) as VideoReviewListItem[]);
    }
  }, [initialProject.id]);

  const {
    blocked: deleteBlockedReview,
    dismissBlocked,
    removing: removingReviewVersion,
    deleteMedia: deleteMediaWithReviewCheck,
    confirmRemoveVersion,
  } = useVideoReviewDeleteHandler((mediaId) => {
    if (mediaId) setMedia((m) => m.filter((a) => a.id !== mediaId));
    void refreshVideoReviews();
    router.refresh();
  });

  const { run: hideProject, pending: hidingProject } = useAsyncAction(async () => {
    const res = await fetch(`/api/projects/${initialProject.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to hide project");
    toast.success("Project hidden from dashboard");
    router.push("/admin/projects");
    router.refresh();
  }, { loadingLabel: "Hiding..." });

  const { run: restoreProject, pending: restoringProject } = useAsyncAction(async () => {
    const res = await fetch(`/api/projects/${initialProject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    if (!res.ok) {
      toast.error(await readServerError(res, "Failed to restore project"));
      return;
    }
    toast.success("Project restored");
    router.refresh();
  }, { loadingLabel: "Restoring..." });

  useEffect(() => {
    setPaymentList(payments);
  }, [payments]);

  useEffect(() => {
    setRevisions(initialRevisions);
  }, [initialRevisions]);

  // Keep linked clients in step with the server after add / primary changes (router.refresh).
  useEffect(() => {
    setProjectClients(initialProjectClients);
  }, [initialProjectClients]);

  useEffect(() => {
    setMedia(initialMedia);
  }, [initialMedia]);

  useEffect(() => {
    setTours(initialTours);
  }, [initialTours]);

  useEffect(() => {
    setModels(initialModels);
  }, [initialModels]);

  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  useEffect(() => {
    setMediaSections(
      mediaSectionsFromProject({
        client_section_photos: initialProject.client_section_photos,
        client_section_videos: initialProject.client_section_videos,
        client_section_tours: initialProject.client_section_tours,
        client_section_models: initialProject.client_section_models,
        client_section_documents: initialProject.client_section_documents,
        client_section_estimates: initialProject.client_section_estimates,
        client_section_payments: initialProject.client_section_payments,
      })
    );
  }, [
    initialProject.client_section_photos,
    initialProject.client_section_videos,
    initialProject.client_section_tours,
    initialProject.client_section_models,
    initialProject.client_section_documents,
    initialProject.client_section_estimates,
    initialProject.client_section_payments,
  ]);

  const [form, setForm] = useState({
    project_name: initialProject.project_name,
    property_address: initialProject.property_address,
    service_type: initialProject.service_type,
    status: initialProject.status,
    delivery_date: initialProject.delivery_date || "",
    notes: initialProject.notes || "",
  });

  const statusRef = useRef<string>(form.status);
  statusRef.current = form.status;

  async function changeStatus(next: string) {
    const previous = form.status;
    if (next === previous) return;
    setForm((f) => ({ ...f, status: next as typeof f.status }));
    setStatusSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: initialProject.id, status: next }),
      });
      if (!res.ok) {
        setForm((f) => ({ ...f, status: previous }));
        toast.error(await readServerError(res, "Failed to update status"));
        return;
      }
      toast.success(`Status: ${getStatusLabel(next)}`);
      router.refresh();
    } finally {
      setStatusSaving(false);
    }
  }

  async function changeServiceType(next: string) {
    const previous = form.service_type;
    if (next === previous) return;
    setForm((f) => ({ ...f, service_type: next }));
    setTypeSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: initialProject.id, service_type: next }),
      });
      if (!res.ok) {
        setForm((f) => ({ ...f, service_type: previous }));
        toast.error(await readServerError(res, "Failed to update project type"));
        return;
      }
      toast.success("Project type updated");
      router.refresh();
    } finally {
      setTypeSaving(false);
    }
  }

  const [media, setMedia] = useState(initialMedia);
  const [tours, setTours] = useState(initialTours);
  const [models, setModels] = useState(initialModels);

  const modelEmbedPreview = useMemo(() => {
    if (!modelFormEmbedUrl.trim()) return null;
    return normalizeExternal3dUrl(modelFormEmbedUrl);
  }, [modelFormEmbedUrl]);

  const editModelEmbedPreview = useMemo(() => {
    if (!editModelForm.embed_url.trim()) return null;
    return normalizeExternal3dUrl(editModelForm.embed_url);
  }, [editModelForm.embed_url]);

  const photos = dedupeMedia(
    media
      .filter((m) => m.media_type === "photo")
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  );
  const canSharePhotos = photoSharing.email || photoSharing.link;
  const [publicVideoIds, setPublicVideoIds] = useState<string[]>(initialPublicVideoIds);
  const shareSummary = useProjectPhotoShareSummary(
    initialProject.id,
    photoShareSummary,
    photos,
    canSharePhotos,
    folderShareSummary,
    folders.map((f) => f.id)
  );
  const photoShare = usePhotoShareDialog(shareSummary.update);
  const videos = media.filter((m) => m.media_type === "video").sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const videoEntries = useMemo(() => videosToGridEntries(videos), [videos]);
  const documents = media.filter((m) => m.media_type === "document").sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  async function saveProject() {
    setSaving(true);
    const projectName =
      form.project_name.trim() ||
      defaultProjectName(form.property_address, form.service_type);

    const res = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: initialProject.id,
        ...form,
        project_name: projectName,
        delivery_date: form.delivery_date || null,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Project saved");
      if (pendingNewPhotoIds.length > 0) {
        setShowShootCompleteModal(true);
      } else {
        router.refresh();
      }
    } else {
      toast.error(await readServerError(res, "Failed to save project"));
    }
  }

  async function setClientSectionVisible(key: ProjectSectionKey, visible: boolean) {
    const prev = mediaSections;
    const next = { ...mediaSections, [key]: visible };
    setMediaSections(next);
    setSectionSaving(key);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: initialProject.id, media_sections: next }),
      });
      if (!res.ok) {
        setMediaSections(prev);
        toast.error(await readServerError(res, "Failed to update client section visibility"));
        return;
      }
      toast.success(
        visible
          ? `${MEDIA_SECTION_LABELS[key]} visible to clients`
          : `${MEDIA_SECTION_LABELS[key]} hidden from clients`
      );
      router.refresh();
    } catch {
      setMediaSections(prev);
      toast.error("Failed to update client section visibility");
    } finally {
      setSectionSaving(null);
    }
  }

  async function setDownloadAccess(next: ProjectDownloadAccess) {
    const prev = downloadAccess;
    if (next === prev) return;
    setDownloadAccessState(next);
    setDownloadAccessSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: initialProject.id, download_access: next }),
      });
      if (!res.ok) {
        setDownloadAccessState(prev);
        toast.error(await readServerError(res, "Couldn't update client downloads"));
        return;
      }
      toast.success(
        next === "allow"
          ? "Client downloads enabled for this project"
          : next === "restrict"
            ? "Client downloads restricted until Delivered"
            : "Client downloads follow your business default"
      );
      router.refresh();
    } catch {
      setDownloadAccessState(prev);
      toast.error("Couldn't update client downloads");
    } finally {
      setDownloadAccessSaving(false);
    }
  }

  async function setMarketingVisible(visible: boolean) {
    const prev = marketingVisible;
    setMarketingVisibleState(visible);
    setMarketingVisSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: initialProject.id, marketing_visible: visible }),
      });
      if (!res.ok) {
        setMarketingVisibleState(prev);
        toast.error(await readServerError(res, "Failed to update Marketing Kit visibility"));
        return;
      }
      if (visible && marketingKit && !marketingKit.anyOffered) {
        toast.warning("Marketing Kit set to visible — the client will see it once an add-on is offered");
      } else {
        toast.success(visible ? "Marketing Kit visible to clients" : "Marketing Kit hidden from clients");
      }
      router.refresh();
    } catch {
      setMarketingVisibleState(prev);
      toast.error("Failed to update Marketing Kit visibility");
    } finally {
      setMarketingVisSaving(false);
    }
  }

  async function copyPortalLink() {
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    toast.success("Portal link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>, mediaType: "photo" | "video" | "document") {
    const files = e.target.files;
    if (!files?.length) return;

    const fileList = Array.from(files);
    e.target.value = "";
    uploadFiles(fileList, mediaType);
  }

  async function filePhotosIntoFolder(ids: string[], folderId: string) {
    const res = await fetch("/api/media/move-to-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ project_id: initialProject.id, folder_id: folderId, photo_ids: ids }),
    });
    if (!res.ok) {
      toast.error("Uploaded, but couldn't add the photos to the folder. They're in General Photos.");
      return;
    }
    setMedia((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, folder_id: folderId } : m)));
  }

  function uploadFiles(
    fileList: File[],
    mediaType: "photo" | "video" | "document",
    opts?: { folderId?: string | null }
  ) {
    const folderId = mediaType === "photo" ? opts?.folderId ?? null : null;
    enqueueUploads({
      files: fileList,
      projectId: initialProject.id,
      mediaType,
      onAsset: (asset) => {
        setMedia((prev) => dedupeMedia([...prev, folderId ? { ...asset, folder_id: folderId } : asset]));
        if (mediaType === "photo") {
          setPendingNewPhotoIds((prev) => [...prev, asset.id]);
        }
      },
      onBatchComplete: async ({ uploaded, errors }) => {
        if (uploaded.length && folderId) {
          await filePhotosIntoFolder(
            uploaded.map((a) => a.id),
            folderId
          );
        }
        if (uploaded.length) {
          toast.success(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded`);
          // New interface has no page-wide Save (Classic asks on Save): ask right after photos land
          // while the shoot is still before "Shoot Complete".
          if (
            inAppShell &&
            mediaType === "photo" &&
            getStatusOrder(statusRef.current) < getStatusOrder("shoot_complete_editing")
          ) {
            setShowShootCompleteModal(true);
            return;
          }
          router.refresh();
        }
        if (errors.length) {
          if (!uploaded.length) toast.error(errors[0]);
          else toast.warning(`${errors.length} file${errors.length === 1 ? "" : "s"} failed`);
        }
      },
    });
  }

  async function handleClientCreated(client: Client) {
    const res = await fetch("/api/project-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: initialProject.id,
        client_id: client.id,
        is_primary: projectClients.length === 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setProjectClients((prev) => [...prev, { ...data, clients: { ...client, user_id: client.user_id ?? data.clients?.user_id } }]);
      setAddClientId(client.id);
      if (data.portal_has_access) {
        toast.success("Client created and linked — portal access ready");
      } else {
        toast.warning(
          data.portal_message ||
            "Client linked, but they need portal access enabled to see this project."
        );
      }
      router.refresh();
    } else {
      toast.error("Client created but could not link to project");
    }
  }

  async function moveItem(type: "media" | "tour" | "model", id: string, direction: "up" | "down", list: { id: string; display_order: number }[]) {
    const idx = list.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;

    const itemType = type === "tour" ? "tour" : type === "model" ? "model" : "media";
    const items = list.map((item, i) => {
      if (i === idx) return { id: item.id, display_order: swapIdx, type: itemType };
      if (i === swapIdx) return { id: item.id, display_order: idx, type: itemType };
      return { id: item.id, display_order: item.display_order, type: itemType };
    });

    await fetch("/api/media/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    router.refresh();
    toast.success("Order updated");
  }

  /** Persist the full video order (drag-and-drop and arrows), optimistic with rollback. */
  async function reorderVideos(orderedIds: string[]): Promise<boolean> {
    const previous = media;
    const position = new Map(orderedIds.map((id, i) => [id, i]));
    setMedia((prev) =>
      prev.map((m) => (position.has(m.id) ? { ...m, display_order: position.get(m.id)! } : m))
    );
    const res = await fetch("/api/media/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: initialProject.id,
        items: orderedIds.map((id, i) => ({ id, display_order: i, type: "media" })),
      }),
    }).catch(() => null);
    if (!res?.ok) {
      setMedia(previous);
      const data = await res?.json().catch(() => ({}));
      toast.error((data as { error?: string } | undefined)?.error || "Failed to save video order");
      return false;
    }
    router.refresh();
    return true;
  }

  function moveVideo(id: string, direction: "up" | "down") {
    const ids = videos.map((v) => v.id);
    const from = ids.indexOf(id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    void reorderVideos(ids).then((ok) => {
      if (ok) toast.success("Order updated");
    });
  }

  async function setHeroMedia(mediaId: string) {
    await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: initialProject.id, cover_image_id: mediaId }),
    });
    setCoverImageId(mediaId);
    toast.success("Project cover updated");
    router.refresh();
  }

  const isHero = (id: string) => coverImageId === id;

  async function markShootComplete(complete: boolean) {
    setShowShootCompleteModal(false);
    setPendingNewPhotoIds([]);
    if (complete) {
      if (markingShootComplete) return;
      setMarkingShootComplete(true);
      try {
        await fetch("/api/projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: initialProject.id, status: "shoot_complete_editing" }),
        });
        setForm((f) => ({ ...f, status: "shoot_complete_editing" }));
        toast.success("Marked shoot complete");
      } finally {
        setMarkingShootComplete(false);
      }
    }
    router.refresh();
  }

  useEffect(() => {
    setVideoReviews(initialVideoReviews);
  }, [initialVideoReviews]);

  async function deleteMedia(id: string) {
    if (!confirm("Delete this file?")) return;
    await deleteMediaConfirmed(id);
  }

  async function deleteMediaConfirmed(id: string): Promise<boolean> {
    const ok = await deleteMediaWithReviewCheck(id);
    if (ok) {
      setMedia((m) => m.filter((a) => a.id !== id));
      if (coverImageId === id) setCoverImageId(null);
      void refreshVideoReviews();
    }
    return Boolean(ok);
  }

  async function toggleMediaVisibility(id: string, visible: boolean) {
    const res = await fetch(`/api/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, visibility: visible ? "client" : "admin" }),
    });
    if (res.ok) {
      const updated = (await res.json()) as MediaAsset;
      setMedia((prev) => prev.map((m) => (m.id === id ? updated : m)));
      toast.success(visible ? "Visible to client" : "Hidden from client");
    } else {
      toast.error("Failed to update visibility");
    }
  }

  async function toggleTourVisibility(id: string, visible: boolean) {
    const res = await fetch("/api/tours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, client_visible: visible }),
    });
    if (res.ok) {
      const updated = (await res.json()) as Tour;
      setTours((prev) => prev.map((t) => (t.id === id ? updated : t)));
      toast.success(visible ? "Tour visible to client" : "Tour hidden from client");
    } else {
      toast.error("Failed to update tour visibility");
    }
  }

  async function toggleModelVisibility(id: string, visible: boolean) {
    const res = await fetch("/api/project-3d-models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, client_visible: visible }),
    });
    if (res.ok) {
      const updated = (await res.json()) as Project3dModel;
      setModels((prev) => prev.map((m) => (m.id === id ? updated : m)));
      toast.success(visible ? "Model visible to client" : "Model hidden from client");
    } else {
      toast.error("Failed to update model visibility");
    }
  }

  async function handleYoutube(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/media/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: initialProject.id,
        youtube_url: fd.get("youtube_url"),
        title: fd.get("title") || "YouTube Video",
      }),
    });
    if (res.ok) {
      const newVideo = await res.json();
      setMedia((prev) => [...prev, newVideo as MediaAsset]);
      setShowYoutubeForm(false);
      toast.success("YouTube video added");
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to add video");
    }
  }

  async function saveMediaEdit(id: string) {
    const res = await fetch(`/api/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, title: editMediaForm.title, youtube_url: editMediaForm.youtube_url || undefined }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMedia((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setEditingMedia(null);
      toast.success("Video updated");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || "Failed to update");
    }
  }

  async function confirmDeleteTour() {
    if (!tourPendingDelete) return;
    setDeletingTour(true);
    const deleted = tourPendingDelete;
    setTours((prev) => prev.filter((t) => t.id !== deleted.id));
    try {
      const res = await fetch(
        `/api/tours?id=${deleted.id}&project_id=${initialProject.id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        setTours((prev) => sortTours([...prev, deleted]));
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || "Failed to delete tour");
        return;
      }
      toast.success("Tour deleted");
      setTourPendingDelete(null);
      router.refresh();
    } finally {
      setDeletingTour(false);
    }
  }

  function sortTours(list: Tour[]) {
    return [...list].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  async function saveTourEdit(id: string) {
    const tourUrl = normalizeTourUrl(editTourForm.kuula_url);
    if (!tourUrl) {
      toast.error(TOUR_URL_ERROR);
      return;
    }
    const res = await fetch("/api/tours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, ...editTourForm, kuula_url: tourUrl }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTours((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditingTour(null);
      toast.success("Tour updated");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to update tour");
    }
  }

  async function addProjectClient(clientId: string = addClientId): Promise<boolean> {
    if (!clientId) return false;
    if (projectClients.some((pc) => pc.client_id === clientId)) {
      toast.info("That client is already on this project");
      return false;
    }
    const res = await fetch("/api/project-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: initialProject.id,
        client_id: clientId,
        is_primary: projectClients.length === 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.portal_has_access) {
        toast.success("Client added — portal access linked");
      } else {
        toast.warning(
          data.portal_message ||
            "Client added, but they have no portal login yet. Enable portal access so they can see this project."
        );
      }
      setAddClientId("");
      if (data?.id) {
        setProjectClients((prev) =>
          prev.some((pc) => pc.client_id === clientId) ? prev : [...prev, data]
        );
      }
      router.refresh();
      return true;
    } else {
      toast.error((data as { error?: string }).error || "Failed to add client");
      return false;
    }
  }

  async function removeProjectClient(pcId: string) {
    if (pcId === "primary-fallback") return;
    if (!confirm("Remove this client from the project?")) return;
    const res = await fetch(`/api/project-clients?id=${pcId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setProjectClients((prev) => prev.filter((pc) => pc.id !== pcId));
      toast.success("Client removed from project");
      router.refresh();
    } else {
      toast.error("Failed to remove client");
    }
  }

  async function setPrimaryClient(pcId: string, clientId: string) {
    await fetch("/api/project-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: initialProject.id,
        client_id: clientId,
        is_primary: true,
      }),
    });
    router.refresh();
    toast.success("Primary client updated");
  }

  async function handleCreateTour(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Any provider's link; the API stores it in the legacy `kuula_url` column.
    const tourUrl = normalizeTourUrl(fd.get("tour_url"));
    if (!tourUrl) {
      toast.error(TOUR_URL_ERROR);
      return;
    }
    const res = await fetch("/api/tours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: initialProject.id,
        tour_name: fd.get("tour_name"),
        kuula_url: tourUrl,
        embed_code: fd.get("embed_code") || null,
        thumbnail_url: fd.get("thumbnail_url") || null,
        notes: fd.get("notes") || null,
      }),
    });
    if (res.ok) {
      const newTour = await res.json();
      setTours((prev) => [...prev, newTour as Tour]);
      setShowTourForm(false);
      toast.success("Tour added");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to add tour");
    }
  }

  async function confirmDeleteModel() {
    if (!modelPendingDelete) return;
    setDeletingModel(true);
    const deleted = modelPendingDelete;
    setModels((prev) => prev.filter((m) => m.id !== deleted.id));
    try {
      const res = await fetch(
        `/api/project-3d-models?id=${deleted.id}&project_id=${initialProject.id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        setModels((prev) => sortModels([...prev, deleted]));
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || "Failed to delete model");
        return;
      }
      toast.success("Model deleted");
      setModelPendingDelete(null);
      router.refresh();
    } finally {
      setDeletingModel(false);
    }
  }

  function sortModels(list: Project3dModel[]) {
    return [...list].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  async function saveModelEdit(id: string) {
    const res = await fetch("/api/project-3d-models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, ...editModelForm }),
    });
    if (res.ok) {
      const updated = await res.json();
      setModels((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setEditingModel(null);
      toast.success("Model updated");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || "Failed to update model");
    }
  }

  async function handleCreateModel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/project-3d-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: initialProject.id,
        title: fd.get("title"),
        embed_url: modelFormEmbedUrl,
        description: fd.get("description") || null,
      }),
    });
    if (res.ok) {
      const newModel = await res.json();
      setModels((prev) => [...prev, newModel as Project3dModel]);
      setShowModelForm(false);
      setModelFormEmbedUrl("");
      toast.success("3D model added");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error || "Failed to add model");
    }
  }

  async function handleCreatePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (creatingPayment) return;
    setCreatingPayment(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: initialProject.id,
          client_id: initialProject.client_id,
          amount: Math.round(parseFloat(fd.get("amount") as string) * 100),
          description: fd.get("description"),
          due_date: fd.get("due_date") || null,
        }),
      });
      if (res.ok) {
        const payment = await res.json();
        setPaymentList((prev) => [payment, ...prev]);
        setForm((f) => ({ ...f, status: "awaiting_payment" }));
        setShowPaymentForm(false);
        toast.success("Payment link created");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : "Could not create payment link. Check Stripe settings."
        );
      }
    } finally {
      setCreatingPayment(false);
    }
  }

  async function deletePayment(paymentId: string) {
    if (!confirm("Delete this payment link? This cannot be undone.")) return;
    const res = await fetch(`/api/payments/${paymentId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setPaymentList((prev) => prev.filter((p) => p.id !== paymentId));
      toast.success("Payment link deleted");
      router.refresh();
    } else {
      toast.error("Failed to delete");
    }
  }

  async function sendForReview() {
    if (sendingForReview) return;
    setSendingForReview(true);
    try {
      const res = await fetch("/api/asset-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ project_id: initialProject.id, action: "send_for_review" }),
      });
      if (res.ok) {
        toast.success("Sent for client review");
        router.refresh();
      }
    } finally {
      setSendingForReview(false);
    }
  }

  function reviewStatus(assetType: string, assetId: string) {
    return assetReviews.find((r) => r.asset_type === assetType && r.asset_id === assetId)?.status;
  }

  const adminStep = getAdminNextStep({ ...initialProject, status: form.status as Project["status"] }, shootProposals);

  const displayName = form.project_name.trim() || defaultProjectName(form.property_address, form.service_type);

  /** Photo id → ids of the clients who liked it (only photos still on the project). */
  const favoriteClientIdsByPhoto = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const row of clientFavorites.rows) (out[row.media_asset_id] ??= []).push(row.client_id);
    return out;
  }, [clientFavorites.rows]);
  const favoriteClients = useMemo(() => {
    const names = new Map<string, string>();
    const add = (c: Partial<Client> | null | undefined) => {
      if (c?.id) names.set(c.id, c.full_name || c.name || c.email || "Client");
    };
    add(initialProject.clients as Client | null | undefined);
    for (const pc of projectClients) add(pc.clients);
    for (const c of allClients) if (!names.has(c.id)) add(c as Partial<Client>);
    const ids = Array.from(new Set(clientFavorites.rows.map((r) => r.client_id)));
    return ids.map((id) => ({ id, name: names.get(id) ?? "Former client" }));
  }, [clientFavorites.rows, initialProject.clients, projectClients, allClients]);

  const assignedClientForShare = useMemo(() => {
    const primary =
      projectClients.find((pc) => pc.is_primary)?.clients ??
      (initialProject.clients as Client | null | undefined);
    // Orphaned project (its client was deleted): nobody holds assigned-client access.
    if (!primary) return null;
    return {
      name: primary.name || primary.full_name || primary.email,
      email: primary.email,
      user_id: primary.user_id,
    };
  }, [projectClients, initialProject.clients]);


  // ---------------------------------------------------------------------------
  // Section blocks shared by the Classic page and the New interface workspace.
  // Each block is the same element (same handlers, same state) in both layouts.
  // ---------------------------------------------------------------------------

  const photoGrid = (
          <AdminPhotoGrid
            projectId={initialProject.id}
            photos={photos}
            folders={folders}
            isHero={isHero}
            onSetHero={setHeroMedia}
            onDelete={deleteMediaConfirmed}
            onToggleVisibility={toggleMediaVisibility}
            onUploadFiles={(files, folderId) => uploadFiles(files, "photo", { folderId })}
            maxFileSizeLabel={formatFileSize(FILE_SIZE_LIMITS.photo)}
            shareSummary={canSharePhotos ? shareSummary.summary : undefined}
            onShare={
              canSharePhotos
                ? (photo) =>
                    photoShare.openShare({
                      id: photo.id,
                      name: mediaDisplayName(photo),
                      thumbUrl: getCachedThumbUrl(photo.id),
                    })
                : undefined
            }
            folderShareSummary={canSharePhotos ? shareSummary.folderSummary : undefined}
            onShareFolder={
              canSharePhotos
                ? (folder) => {
                    const coverId = photos.find((p) => p.folder_id === folder.id)?.id;
                    photoShare.openShare({
                      kind: "folder",
                      id: folder.id,
                      name: folder.name,
                      thumbUrl: coverId ? getCachedThumbUrl(coverId) : null,
                    });
                  }
                : undefined
            }
            onFoldersChange={setFolders}
            onPhotosChange={(nextPhotos) => {
              setMedia((prev) => {
                const others = prev.filter((m) => m.media_type !== "photo");
                return [...others, ...nextPhotos];
              });
            }}
            onRefresh={() => router.refresh()}
            workspace={inAppShell}
            clientFavorites={clientFavorites.available ? favoriteClientIdsByPhoto : undefined}
            favoriteClients={favoriteClients}
            controllerRef={photoGridController}
            onMediaRoot={() => setMediaCategory("all")}
          />
  );

  const videoGrid = videoEntries.length > 0 ? (
            <SortableVideoList
              id={`admin-video-grid-${initialProject.id}`}
              ids={videos.map((v) => v.id)}
              onReorder={(ids) => void reorderVideos(ids)}
            >
              <VideoGrid
                entries={videoEntries}
                projectId={initialProject.id}
                reviewByAssetId={reviewByAssetId}
                getDownloadUrl={async (asset, thumb) => {
                  const qs = thumb ? "?thumb=1" : "";
                  const res = await fetch(`/api/media/download/${asset.id}${qs}`, {
                    credentials: "include",
                  });
                  const data = (await res.json()) as { url?: string | null };
                  return data.url ?? null;
                }}
                reviewPathPrefix="/admin/projects"
                isAdmin
                canShareVideos={photoSharing.link}
                publicVideoIds={publicVideoIds}
                onPublicVideoChange={(mediaId, isPublic) =>
                  setPublicVideoIds((prev) =>
                    isPublic ? [...new Set([...prev, mediaId])] : prev.filter((id) => id !== mediaId)
                  )
                }
                renderAdminCard={(entry, _index, openPlayer, thumbUrl) => {
                  const v = entry.video;
                  const i = videos.findIndex((row) => row.id === v.id);
                  if (i < 0) return null;
                  const badge = !isClientVisibleMedia(v)
                    ? "Hidden"
                    : isHero(v.id)
                      ? "Hero"
                      : v.media_source === "youtube"
                        ? "YouTube"
                        : "Upload";
                  return (
                    <SortableVideoItem video={v} thumbUrl={thumbUrl} disabled={editingMedia === v.id}>
                      <AdminVideoGridCard
                        video={v}
                        thumbUrl={thumbUrl}
                        onPlay={openPlayer}
                        onEdit={() => {
                          setEditingMedia(v.id);
                          setEditMediaForm({
                            title: mediaDisplayName(v),
                            youtube_url: v.youtube_url || "",
                          });
                        }}
                        onDelete={() => void deleteMedia(v.id)}
                        onUp={() => moveVideo(v.id, "up")}
                        onDown={() => moveVideo(v.id, "down")}
                        canUp={i > 0}
                        canDown={i < videos.length - 1}
                        badge={badge}
                        onToggleVisibility={() =>
                          void toggleMediaVisibility(v.id, !isClientVisibleMedia(v))
                        }
                        visibleToClient={isClientVisibleMedia(v)}
                        onSetHero={() => void setHeroMedia(v.id)}
                        isEditing={editingMedia === v.id}
                        editTitle={editMediaForm.title}
                        editYoutubeUrl={editMediaForm.youtube_url}
                        onEditTitleChange={(title) => setEditMediaForm((f) => ({ ...f, title }))}
                        onEditYoutubeUrlChange={(youtube_url) =>
                          setEditMediaForm((f) => ({ ...f, youtube_url }))
                        }
                        onSaveEdit={() => void saveMediaEdit(v.id)}
                        onCancelEdit={() => setEditingMedia(null)}
                        projectId={initialProject.id}
                        reviewItem={reviewByAssetId.get(v.id) ?? null}
                        onReviewsChange={() => void refreshVideoReviews()}
                        isPublic={publicVideoIds.includes(v.id)}
                      />
                    </SortableVideoItem>
                  );
                }}
              />
            </SortableVideoList>
          ) : null;

  const youtubeForm = (
            <form onSubmit={handleYoutube} className="mb-4 max-w-2xl space-y-3 rounded-lg border border-border p-4">
              <Input name="title" placeholder="Video title" />
              <Input name="youtube_url" required placeholder="https://youtube.com/watch?v=..." />
              <Button type="submit" variant="accent" size="sm">Add YouTube Video</Button>
            </form>
  );

  const tourCreateForm = (
            <form onSubmit={handleCreateTour} className="mb-4 max-w-2xl space-y-3 rounded-lg border border-border p-4">
              <Input name="tour_name" required placeholder="Tour name" />
              <div className="space-y-1">
                <Input
                  name="tour_url"
                  type="text"
                  inputMode="url"
                  required
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="360 Tour URL"
                  placeholder="360 Tour URL — https://example.com/your-360-tour"
                />
                <p className="text-xs text-muted">Paste a link to your 360 tour from any supported hosting platform.</p>
              </div>
              <Input name="thumbnail_url" placeholder="Thumbnail URL (optional)" />
              <Textarea name="embed_code" placeholder="Embed code (optional)" rows={2} />
              <Textarea name="notes" placeholder="Notes for client (optional)" rows={2} />
              <Button type="submit" variant="accent" size="sm">Save Tour</Button>
            </form>
  );

  const renderTourEdit = (t: Tour) => (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Input value={editTourForm.tour_name} onChange={(e) => setEditTourForm({ ...editTourForm, tour_name: e.target.value })} />
                  <Input
                    value={editTourForm.kuula_url}
                    onChange={(e) => setEditTourForm({ ...editTourForm, kuula_url: e.target.value })}
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label="360 Tour URL"
                    placeholder="360 Tour URL — https://example.com/your-360-tour"
                  />
                  <Textarea value={editTourForm.notes} onChange={(e) => setEditTourForm({ ...editTourForm, notes: e.target.value })} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="accent" onClick={() => saveTourEdit(t.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingTour(null)}>Cancel</Button>
                  </div>
                </div>
  );

  const modelCreateForm = (
            <form onSubmit={handleCreateModel} className="mb-4 max-w-2xl space-y-3 rounded-lg border border-border p-4">
              <Input name="title" required placeholder="Model title" />
              <Input
                name="embed_url"
                type="text"
                required
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://… viewer / share URL"
                value={modelFormEmbedUrl}
                onChange={(e) => setModelFormEmbedUrl(e.target.value)}
              />
              {modelEmbedPreview ? (
                <p className={`text-xs ${modelEmbedPreview.ok ? "text-muted" : "text-red-600"}`}>
                  {modelEmbedPreview.ok ? modelEmbedPreview.message : modelEmbedPreview.error}
                </p>
              ) : (
                <p className="text-xs text-muted">Supported: {EXTERNAL_3D_SUPPORTED_LIST}</p>
              )}
              <Textarea name="description" placeholder="Description (optional)" rows={2} />
              <Button type="submit" variant="accent" size="sm">Save Model</Button>
            </form>
  );

  const renderModelEdit = (m: Project3dModel) => (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Input value={editModelForm.title} onChange={(e) => setEditModelForm({ ...editModelForm, title: e.target.value })} />
                  <Input
                    value={editModelForm.embed_url}
                    onChange={(e) => setEditModelForm({ ...editModelForm, embed_url: e.target.value })}
                  />
                  {editModelEmbedPreview ? (
                    <p className={`text-xs ${editModelEmbedPreview.ok ? "text-muted" : "text-red-600"}`}>
                      {editModelEmbedPreview.ok ? editModelEmbedPreview.message : editModelEmbedPreview.error}
                    </p>
                  ) : null}
                  <Textarea
                    value={editModelForm.description}
                    onChange={(e) => setEditModelForm({ ...editModelForm, description: e.target.value })}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="accent" onClick={() => saveModelEdit(m.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingModel(null)}>Cancel</Button>
                  </div>
                </div>
  );

  const paymentForm = (
              <form
                onSubmit={handleCreatePayment}
                className="mb-4 max-w-2xl space-y-3 rounded-lg border border-border p-4"
              >
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="Amount (USD)"
                />
                <Input name="description" required placeholder="Description" />
                <Input name="due_date" type="date" />
                <Button type="submit" variant="accent" size="sm" disabled={creatingPayment}>
                  {creatingPayment ? "Creating…" : "Create Payment Link"}
                </Button>
              </form>
  );

  const paymentListView = (
    <>
            {paymentList.map((p) => (
              <div key={`payment-${p.id}`} className="border-b border-border py-4 last:border-0">
                <AdminPaymentActions
                  payment={p}
                  showProjectLink={false}
                  showDelete
                  onUpdated={(updated) =>
                    setPaymentList((prev) =>
                      prev.map((x) => (x.id === updated.id ? updated : x))
                    )
                  }
                  onDeleted={deletePayment}
                />
              </div>
            ))}
            {paymentList.length === 0 && (
              <p className="text-sm text-muted text-center py-4">No payment links yet</p>
            )}
    </>
  );

  const detailFields = (
    <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input
                value={form.project_name}
                onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                placeholder={defaultProjectName(form.property_address, form.service_type) || "Property Address — Service Type"}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                options={PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Property Address</Label>
            <Input value={form.property_address} onChange={(e) => setForm({ ...form, property_address: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="classic-project-services">Services</Label>
              {serviceCatalog.length ? (
                <ProjectServicesPicker
                  id="classic-project-services"
                  projectId={initialProject.id}
                  catalog={serviceCatalog}
                  initialIds={serviceIds}
                  onSaved={({ serviceType }) => {
                    if (serviceType) setForm((f) => ({ ...f, service_type: serviceType }));
                    router.refresh();
                  }}
                />
              ) : (
                <Input value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} />
              )}
            </div>
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
    </>
  );

  const sharedDialogs = (
    <>
      <ProjectShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        projectId={initialProject.id}
        assignedClient={assignedClientForShare}
        clientProjectUrl={clientProjectUrl}
        initialShares={projectShares}
        initialLinkMode={linkAccessMode}
        initialPublicUrl={linkAccessPublicUrl}
        initialViewCount={linkAccessViewCount}
      />

      <RevisionDrawer
        revision={selectedRevision}
        onClose={() => setSelectedRevision(null)}
        onUpdate={(updated) => setRevisions((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
      />

      <Modal
        open={!!deleteBlockedReview}
        onClose={dismissBlocked}
        title="Video is part of a review"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => confirmRemoveVersion(false)}>
              Remove from review only
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removingReviewVersion}
              onClick={() => confirmRemoveVersion(true)}
            >
              {removingReviewVersion ? "Removing…" : "Remove version & delete file"}
            </Button>
          </div>
        }
      >
        {deleteBlockedReview && (
          <p className="text-sm text-muted">
            This file is version V{deleteBlockedReview.versionNumber} of “{deleteBlockedReview.reviewTitle}”.
            {deleteBlockedReview.commentCount > 0
              ? ` Removing it will permanently delete ${deleteBlockedReview.commentCount} comment${deleteBlockedReview.commentCount === 1 ? "" : "s"} on this version.`
              : " You can remove it from the review first, or delete the version and file together."}
          </p>
        )}
      </Modal>

      <Modal open={showShootCompleteModal} onClose={() => markShootComplete(false)} title="Shoot Complete?"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="accent" className="min-h-11 flex-1" onClick={() => markShootComplete(true)}>
              Yes, mark shoot complete
            </Button>
            <Button variant="outline" className="min-h-11 flex-1" onClick={() => markShootComplete(false)}>
              No, keep current status
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          You uploaded new photos to this project. Is this project&apos;s shoot complete?
        </p>
      </Modal>

      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Hide this project?"
        footer={
          <Button variant="accent" className="w-full min-h-11 bg-red-600 hover:bg-red-700" disabled={hidingProject} onClick={() => hideProject()}>
            {hidingProject ? "Hiding..." : "Hide from dashboard"}
          </Button>
        }
      >
        <p className="text-sm text-muted">
          This will hide <strong>{displayName}</strong> from project lists and dashboard views.
          Media, payments, and history are not permanently deleted and can be restored later.
        </p>
      </Modal>

      <DeleteProjectModal
        open={showPermanentDelete}
        onClose={() => setShowPermanentDelete(false)}
        projectId={initialProject.id}
        projectName={displayName}
        counts={{ media: media.length, tours: tours.length, models: models.length }}
        paidInvoiceCount={paymentList.filter((p) => p.status === "paid" || p.status === "processing").length}
        onHide={initialProject.deleted_at ? undefined : () => hideProject()}
        hiding={hidingProject}
        alreadyHidden={Boolean(initialProject.deleted_at)}
        onDeleted={() => {
          setShowPermanentDelete(false);
          router.push("/admin/projects");
          router.refresh();
        }}
      />

      <Modal
        open={!!tourPendingDelete}
        onClose={() => !deletingTour && setTourPendingDelete(null)}
        title="Delete 360 tour?"
        footer={
          <Button
            variant="accent"
            className="w-full min-h-11 bg-red-600 hover:bg-red-700"
            disabled={deletingTour}
            onClick={() => void confirmDeleteTour()}
          >
            {deletingTour ? "Deleting…" : "Delete permanently"}
          </Button>
        }
      >
        <p className="text-sm text-muted">
          This permanently deletes{" "}
          <strong>{tourPendingDelete?.tour_name}</strong>. The tour will disappear from the
          client project page immediately. This cannot be undone.
        </p>
      </Modal>

      <Modal
        open={!!modelPendingDelete}
        onClose={() => !deletingModel && setModelPendingDelete(null)}
        title="Delete 3D model?"
        footer={
          <Button
            variant="accent"
            className="w-full min-h-11 bg-red-600 hover:bg-red-700"
            disabled={deletingModel}
            onClick={() => void confirmDeleteModel()}
          >
            {deletingModel ? "Deleting…" : "Delete permanently"}
          </Button>
        }
      >
        <p className="text-sm text-muted">
          This permanently deletes{" "}
          <strong>{modelPendingDelete?.title}</strong>. The model will disappear from the
          client project page immediately. This cannot be undone.
        </p>
      </Modal>

      <CreateClientModal
        open={showCreateClient}
        onClose={() => setShowCreateClient(false)}
        onCreated={handleClientCreated}
      />
    </>
  );

  const visibleStep =
    !canViewMoney &&
    (adminStep.actionHref === "#quote" ||
      adminStep.actionHref === "#payments" ||
      /quote|payment|invoice/i.test(adminStep.title + adminStep.description))
      ? {
          ...adminStep,
          title: "Continue this project",
          description: "Review deliverables and scheduling below.",
          actionHref: undefined,
          actionLabel: undefined,
        }
      : adminStep;

  // ---------------------------------------------------------------------------
  // New interface: project workspace (hero, tabs, client sidebar). It arranges the
  // same blocks and handlers as Classic below; nothing here talks to the API directly
  // except through the functions above.
  // ---------------------------------------------------------------------------
  if (inAppShell) {
    const primaryClient =
      projectClients.find((pc) => pc.is_primary)?.clients ??
      (initialProject.clients as Client | null | undefined) ??
      null;
    const linkedClientCount =
      projectClients.length +
      (initialProject.client_id && !projectClients.some((pc) => pc.client_id === initialProject.client_id) ? 1 : 0);
    const confirmedShoot = [...shootProposals]
      .filter((sp) => sp.status === "confirmed")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
    const heroDate =
      formatHeroDate(confirmedShoot?.proposed_at, false, viewerTimeZone) ??
      formatHeroDate(initialProject.shoot_date, true) ??
      (form.delivery_date ? `Delivery ${formatHeroDate(form.delivery_date, true)}` : null);
    const coverCandidates = [...photos, ...videos];
    const heroImage =
      heroBannerUrl ?? (coverImageId ? getCachedThumbUrl(coverImageId) : null) ?? (photos[0] ? getCachedThumbUrl(photos[0].id) : null);
    const SummaryIcon =
      visibleStep.variant === "success"
        ? CheckCircle2
        : visibleStep.variant === "warning"
          ? AlertTriangle
          : visibleStep.variant === "accent"
            ? Sparkles
            : Info;

    function runStepAction() {
      const href = visibleStep.actionHref;
      if (!href) return;
      if (href.startsWith("#")) {
        const tab = HASH_TO_TAB[href.slice(1)];
        if (tab) {
          setActiveTab(tab);
          if (href === "#scheduling") {
            window.setTimeout(() => document.getElementById("scheduling")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
          }
        }
        return;
      }
      router.push(href);
    }
    const stepHasAction = Boolean(
      visibleStep.actionLabel &&
        visibleStep.actionHref &&
        (!visibleStep.actionHref.startsWith("#") || HASH_TO_TAB[visibleStep.actionHref.slice(1)])
    );

    const typeChoices = Array.from(new Set([...serviceOptions, form.service_type].filter(Boolean)));

    const counts = {
      photos: photos.length,
      videos: videos.length,
      tours: tours.length,
      models: models.length,
      files: documents.length,
    };
    const totalMedia = counts.photos + counts.videos + counts.tours + counts.models + counts.files;
    const categoryItems: WorkspaceTab<MediaCategory>[] = [
      { key: "all", label: "All Media", icon: LayoutGrid, count: totalMedia },
      { key: "photos", label: "Photos", icon: ImageIcon, count: counts.photos },
      { key: "videos", label: "Videos", icon: Video, count: counts.videos },
      { key: "tours", label: "360 Tours", icon: Rotate3d, count: counts.tours },
      { key: "models", label: "3D Models", icon: Box, count: counts.models },
      { key: "files", label: "Files", icon: FileText, count: counts.files },
    ];
    const showSection = (key: Exclude<MediaCategory, "all">) =>
      mediaCategory === key || (mediaCategory === "all" && (key === "photos" || counts[key] > 0));

    const tabs: WorkspaceTab<WorkspaceTabKey>[] = [
      { key: "media", label: "Media", icon: ImageIcon },
      ...(canViewMoney ? [{ key: "estimates" as const, label: "Estimates & Proposals", icon: ClipboardList }] : []),
      ...(marketingKit ? [{ key: "marketing" as const, label: "Marketing Kit", icon: Megaphone }] : []),
      ...(canViewMoney ? [{ key: "payments" as const, label: "Payments", icon: CreditCard }] : []),
      { key: "details", label: "Details", icon: CalendarClock },
    ];
    const currentTab = tabs.some((t) => t.key === activeTab) ? activeTab : "media";

    const uploadItems: ActionMenuItem[] = [
      {
        id: "photos",
        label: "Photos",
        icon: ImageIcon,
        hint: "JPEG, PNG or WebP — into the open folder",
        onSelect: () => {
          setMediaCategory((c) => (c === "all" || c === "photos" ? c : "photos"));
          photoGridController.current?.upload();
        },
      },
      {
        id: "videos",
        label: "Video files",
        icon: Upload,
        hint: `Up to ${formatFileSize(FILE_SIZE_LIMITS.video)}`,
        onSelect: () => videoInputRef.current?.click(),
      },
      {
        id: "youtube",
        label: "YouTube link",
        icon: Video,
        onSelect: () => {
          setMediaCategory("videos");
          setShowYoutubeForm(true);
        },
      },
      {
        id: "tour",
        label: "360 tour link",
        icon: Rotate3d,
        onSelect: () => {
          setMediaCategory("tours");
          setShowTourForm(true);
        },
      },
      {
        id: "model",
        label: "3D model link",
        icon: Box,
        onSelect: () => {
          setMediaCategory("models");
          setShowModelForm(true);
        },
      },
      {
        id: "files",
        label: "Documents & files",
        icon: FileText,
        hint: "PDF, Word, Excel, CSV or ZIP",
        onSelect: () => documentInputRef.current?.click(),
      },
    ];

    function onUploadMedia(anchor: HTMLElement) {
      switch (mediaCategory) {
        case "photos":
          photoGridController.current?.upload();
          return;
        case "tours":
          setShowTourForm(true);
          return;
        case "models":
          setShowModelForm(true);
          return;
        case "files":
          documentInputRef.current?.click();
          return;
        case "videos":
          setUploadMenuAnchor({ kind: "element", element: anchor });
          return;
        default:
          setUploadMenuAnchor({ kind: "element", element: anchor });
      }
    }

    const projectMenuItems: ActionMenuItem[] = [
      { id: "edit", label: "Edit project details", icon: Pencil, onSelect: () => setActiveTab("details") },
      { id: "copy", label: copied ? "Portal link copied" : "Copy portal link", icon: Copy, onSelect: () => void copyPortalLink() },
      {
        id: "marketing",
        label: "Open Marketing Kit editor",
        icon: Sparkles,
        onSelect: () => router.push(`/admin/projects/${initialProject.id}/marketing`),
      },
      { id: "clients", label: "Manage clients", icon: Users, onSelect: () => setShowClientsModal(true) },
      { id: "activity", label: "View all activity", icon: History, onSelect: () => setShowActivityModal(true) },
      { type: "separator", id: "sep" },
      initialProject.deleted_at
        ? {
            id: "unhide",
            label: restoringProject ? "Unhiding…" : "Unhide project",
            icon: Eye,
            disabled: restoringProject,
            onSelect: () => void restoreProject(),
          }
        : {
            id: "hide",
            label: "Hide project",
            icon: EyeOff,
            hint: "Hide from your lists and dashboard",
            onSelect: () => setShowDeleteConfirm(true),
          },
      { id: "delete", label: "Delete project", icon: Trash2, destructive: true, onSelect: () => setShowPermanentDelete(true) },
    ];

    const quoteTotals = (() => {
      const latest = quotes[0] ?? null;
      const approved = quotes.find((q) => q.status === "approved") ?? null;
      const focus = approved ?? latest;
      const response = !focus
        ? null
        : focus.status === "approved"
          ? { label: "Accepted", hint: focus.approved_at ? new Date(focus.approved_at).toLocaleDateString(viewerLocale, { timeZone: viewerTimeZone }) : null, tone: "success" as const }
          : focus.status === "changes_requested"
            ? { label: "Changes requested", hint: "Revise and resend", tone: "warning" as const }
            : focus.status === "sent"
              ? { label: "Awaiting response", hint: focus.sent_at ? `Sent ${new Date(focus.sent_at).toLocaleDateString(viewerLocale, { timeZone: viewerTimeZone })}` : null, tone: "accent" as const }
              : { label: "Not sent yet", hint: "Send it when it's ready", tone: "default" as const };
      return { focus, response };
    })();

    const billable = paymentList.filter((p) => !["cancelled", "expired", "failed"].includes(p.status));
    const billedCents = billable.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const paidCents = billable.filter((p) => p.status === "paid").reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const processingCents = billable
      .filter((p) => p.status === "processing")
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const outstandingCents = Math.max(0, billedCents - paidCents - processingCents);
    const approvedQuote = quotes.find((q) => q.status === "approved") ?? null;
    const paymentStatusLabel =
      billable.length === 0
        ? "No invoices yet"
        : outstandingCents === 0 && processingCents === 0
          ? "Paid in full"
          : paidCents > 0 || processingCents > 0
            ? "Partially paid"
            : "Unpaid";

    const sortedTours = [...tours].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const sortedModels = [...models].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    const sectionRow = (
      key: ProjectSectionKey,
      label: string,
      icon: VisibilityRow["icon"]
    ): VisibilityRow => ({
      key,
      label,
      icon,
      checked: mediaSections[key],
      saving: sectionSaving === key,
      onChange: (v: boolean) => void setClientSectionVisible(key, v),
    });
    const visibilityRows: VisibilityRow[] = [
      ...(canViewMoney ? [sectionRow("estimates", "Estimates & Proposals", ClipboardList)] : []),
      sectionRow("photos", "Photos", ImageIcon),
      sectionRow("videos", "Videos", Video),
      sectionRow("documents", "Documents", FileText),
      sectionRow("tours", "360 Tours", Rotate3d),
      sectionRow("models", "3D Models", Box),
      ...(marketingKit && !marketingKit.setupRequired
        ? [
            {
              key: "marketing",
              label: "Marketing Kit",
              icon: Megaphone,
              checked: marketingVisible,
              saving: marketingVisSaving,
              onChange: (v: boolean) => void setMarketingVisible(v),
            } satisfies VisibilityRow,
          ]
        : []),
      ...(canViewMoney ? [sectionRow("payments", "Payments", CreditCard)] : []),
    ];

    const sidebar = (
      <>
        <ClientContactCard
          client={
            primaryClient
              ? {
                  id: primaryClient.id,
                  name: primaryClient.full_name || primaryClient.name || primaryClient.email || "Client",
                  email: primaryClient.email ?? null,
                  phone: primaryClient.phone ?? null,
                }
              : null
          }
          extraClients={Math.max(0, linkedClientCount - 1)}
          onManage={() => setShowClientsModal(true)}
        />
        <VisibilityPanel
          rows={visibilityRows}
          footer={
            <ClientDownloadsControl
              value={downloadAccess}
              businessRequiresDelivered={businessRequiresDeliveredForDownloads}
              saving={downloadAccessSaving}
              onChange={(v) => void setDownloadAccess(v)}
            />
          }
        />
        <Suspense fallback={<ActivityPreviewSkeleton />}>
        <StreamedActivities source={activities}>
        {(activityList) => (
        <ActivityPreview
          activities={activityList}
          onViewAll={() => setShowActivityModal(true)}
          onRevisionClick={(revisionId) => {
            const rev = revisions.find((r) => r.id === revisionId);
            if (rev) setSelectedRevision(rev);
          }}
        />
        )}
        </StreamedActivities>
        </Suspense>
      </>
    );

    return (
      <div className="space-y-4 pb-6">
        <ProjectActionBar
          status={form.status}
          statusSaving={statusSaving}
          onStatusChange={(next) => void changeStatus(next)}
          onShare={() => setShowShareModal(true)}
          previewUrl={portalUrl}
          onMore={(element) => setProjectMenuAnchor({ kind: "element", element })}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem] 2xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-4">
            <ProjectHero
              imageUrl={heroImage}
              name={displayName}
              typeLabel={form.service_type || null}
              dateLabel={heroDate}
              location={shortLocation(form.property_address)}
              hidden={Boolean(initialProject.deleted_at)}
              onChangeCover={coverCandidates.length > 0 ? () => setShowCoverDialog(true) : undefined}
            />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
              {serviceCatalog.length ? (
                <div className="flex min-w-0 shrink-0 items-center gap-3 lg:w-[22rem]">
                  <label htmlFor="project-services" className="shrink-0 text-sm font-medium text-heading">
                    Services
                  </label>
                  <ProjectServicesPicker
                    projectId={initialProject.id}
                    catalog={serviceCatalog}
                    initialIds={serviceIds}
                    className="min-w-0 flex-1"
                    compact
                    onSaved={({ serviceType }) => {
                      if (serviceType) setForm((f) => ({ ...f, service_type: serviceType }));
                      router.refresh();
                    }}
                  />
                </div>
              ) : (
              <label className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-medium text-heading">Project Type</span>
                  <span className="relative inline-flex min-w-0 flex-1 items-center lg:w-64 lg:flex-none">
                    <Home className="pointer-events-none absolute left-3 h-4 w-4 text-muted" aria-hidden />
                    <select
                      value={form.service_type}
                      disabled={typeSaving}
                      onChange={(e) => void changeServiceType(e.target.value)}
                      className="h-10 w-full min-w-0 appearance-none truncate rounded-lg border border-border bg-card pl-9 pr-9 text-sm font-medium text-heading shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                    >
                      {!form.service_type ? <option value="">Choose a type…</option> : null}
                      {typeChoices.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted" aria-hidden />
                  </span>
                </label>
              )}
              <div aria-hidden className="hidden w-px self-stretch bg-border lg:block" />
              <div className="min-w-0 flex-1">
                <StatusSummary
                  step={visibleStep}
                  icon={SummaryIcon}
                  onAction={stepHasAction ? runStepAction : undefined}
                  extraAction={
                    normalizeStatus(form.status) === "shoot_complete_editing" ? (
                      <Button variant="accent" size="sm" onClick={sendForReview} disabled={sendingForReview}>
                        {sendingForReview ? "Sending..." : "Send Deliverables for Review"}
                      </Button>
                    ) : null
                  }
                />
              </div>
            </div>

            <WorkspaceTabs tabs={tabs} active={currentTab} onChange={setActiveTab} />

            {/* Panels stay mounted so folder location, selections, forms and upload state survive tab switches. */}
            <div
              role="tabpanel"
              id="project-panel-media"
              aria-labelledby="project-tab-media"
              hidden={currentTab !== "media"}
              className="space-y-4 rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <CategoryChips items={categoryItems} active={mediaCategory} onChange={setMediaCategory} />
                <Button
                  variant="accent"
                  className="h-9 shrink-0"
                  aria-haspopup={mediaCategory === "all" || mediaCategory === "videos" ? "menu" : undefined}
                  onClick={(e) => onUploadMedia(e.currentTarget)}
                >
                  <Upload className="h-4 w-4" /> Upload Media
                </Button>
              </div>
              <input
                ref={videoInputRef}
                type="file"
                multiple
                accept={ALLOWED_VIDEO_MIME_TYPES.join(",")}
                className="hidden"
                onChange={(e) => handleUpload(e, "video")}
              />
              <input
                ref={documentInputRef}
                type="file"
                multiple
                accept={DOCUMENT_ACCEPT}
                className="hidden"
                onChange={(e) => handleUpload(e, "document")}
              />

              <section id="photos" hidden={!showSection("photos")} className="scroll-mt-20">
                {photoGrid}
                {photoShare.dialog}
              </section>

              <section hidden={!showSection("videos")} className={cn(mediaCategory === "all" && "border-t border-border pt-4")}>
                {mediaCategory === "videos" ? (
                  <WorkspaceBreadcrumb label="Videos" onRoot={() => setMediaCategory("all")} />
                ) : null}
                <MediaSectionHeader
                  icon={Video}
                  title="Videos"
                  count={counts.videos}
                  onOpen={mediaCategory === "all" ? () => setMediaCategory("videos") : undefined}
                  actions={
                    <>
                      <Button variant="outline" size="sm" className="h-8" onClick={() => setShowYoutubeForm(!showYoutubeForm)}>
                        <Video className="h-4 w-4" /> YouTube Link
                      </Button>
                      <Button variant="outline" size="sm" className="h-8" onClick={() => videoInputRef.current?.click()}>
                        <Upload className="h-4 w-4" /> Upload Video
                      </Button>
                    </>
                  }
                />
                <p className="mb-3 text-xs text-muted">
                  Upload up to {formatFileSize(FILE_SIZE_LIMITS.video)} or paste a YouTube link. Drag cards to reorder.
                </p>
                {showYoutubeForm && youtubeForm}
                {videos.length === 0 && !showYoutubeForm ? (
                  <EmptyMediaState icon={Video} text="No videos yet" />
                ) : null}
                {videoGrid}
              </section>

              <section hidden={!showSection("tours")} className={cn(mediaCategory === "all" && "border-t border-border pt-4")}>
                {mediaCategory === "tours" ? (
                  <WorkspaceBreadcrumb label="360 Tours" onRoot={() => setMediaCategory("all")} />
                ) : null}
                <MediaSectionHeader
                  icon={Rotate3d}
                  title="360 Tours"
                  count={counts.tours}
                  onOpen={mediaCategory === "all" ? () => setMediaCategory("tours") : undefined}
                  actions={
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setShowTourForm(!showTourForm)}>
                      <Plus className="h-4 w-4" /> Add Tour
                    </Button>
                  }
                />
                {showTourForm && tourCreateForm}
                {sortedTours.length === 0 && !showTourForm ? <EmptyMediaState icon={Globe} text="No 360 tours yet" /> : null}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {sortedTours.map((t, i) =>
                    editingTour === t.id ? (
                      <div key={t.id} className="sm:col-span-2">
                        {renderTourEdit(t)}
                      </div>
                    ) : (
                      <LinkedMediaCard
                        key={t.id}
                        title={t.tour_name}
                        subtitle={t.notes}
                        href={t.kuula_url}
                        thumbnailUrl={t.thumbnail_url}
                        placeholderIcon={Rotate3d}
                        hidden={t.client_visible === false}
                        onToggleVisibility={() => void toggleTourVisibility(t.id, t.client_visible === false)}
                        onEdit={() => {
                          setEditingTour(t.id);
                          setEditTourForm({ tour_name: t.tour_name, kuula_url: t.kuula_url, notes: t.notes || "" });
                        }}
                        onDelete={() => setTourPendingDelete(t)}
                        onUp={() => void moveItem("tour", t.id, "up", sortedTours)}
                        onDown={() => void moveItem("tour", t.id, "down", sortedTours)}
                        canUp={i > 0}
                        canDown={i < sortedTours.length - 1}
                      />
                    )
                  )}
                </div>
              </section>

              <section hidden={!showSection("models")} className={cn(mediaCategory === "all" && "border-t border-border pt-4")}>
                {mediaCategory === "models" ? (
                  <WorkspaceBreadcrumb label="3D Models" onRoot={() => setMediaCategory("all")} />
                ) : null}
                <MediaSectionHeader
                  icon={Box}
                  title="3D Models"
                  count={counts.models}
                  onOpen={mediaCategory === "all" ? () => setMediaCategory("models") : undefined}
                  actions={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setShowModelForm(!showModelForm);
                        if (showModelForm) setModelFormEmbedUrl("");
                      }}
                    >
                      <Plus className="h-4 w-4" /> Add Model
                    </Button>
                  }
                />
                {showModelForm && modelCreateForm}
                {sortedModels.length === 0 && !showModelForm ? <EmptyMediaState icon={Box} text="No 3D models yet" /> : null}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {sortedModels.map((m, i) =>
                    editingModel === m.id ? (
                      <div key={m.id} className="sm:col-span-2">
                        {renderModelEdit(m)}
                      </div>
                    ) : (
                      <LinkedMediaCard
                        key={m.id}
                        title={m.title}
                        subtitle={m.description}
                        href={m.embed_url}
                        placeholderIcon={Box}
                        hidden={m.client_visible === false}
                        onToggleVisibility={() => void toggleModelVisibility(m.id, m.client_visible === false)}
                        onEdit={() => {
                          setEditingModel(m.id);
                          setEditModelForm({ title: m.title, embed_url: m.embed_url, description: m.description || "" });
                        }}
                        onDelete={() => setModelPendingDelete(m)}
                        onUp={() => void moveItem("model", m.id, "up", sortedModels)}
                        onDown={() => void moveItem("model", m.id, "down", sortedModels)}
                        canUp={i > 0}
                        canDown={i < sortedModels.length - 1}
                      />
                    )
                  )}
                </div>
              </section>

              <section hidden={!showSection("files")} className={cn(mediaCategory === "all" && "border-t border-border pt-4")}>
                {mediaCategory === "files" ? (
                  <WorkspaceBreadcrumb label="Files" onRoot={() => setMediaCategory("all")} />
                ) : null}
                <MediaSectionHeader
                  icon={FileText}
                  title="Files"
                  count={counts.files}
                  onOpen={mediaCategory === "all" ? () => setMediaCategory("files") : undefined}
                  actions={
                    <Button variant="outline" size="sm" className="h-8" onClick={() => documentInputRef.current?.click()}>
                      <Upload className="h-4 w-4" /> Upload
                    </Button>
                  }
                />
                {documents.length === 0 ? (
                  <EmptyMediaState icon={FileText} text="No documents yet — PDF, Word, Excel, CSV and ZIP files are supported" />
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {documents.map((d, i) => {
                      const name = mediaDisplayName(d);
                      const kind = documentKindLabel(d);
                      return (
                        <li key={d.id} className="flex items-center gap-3 bg-card px-3 py-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                            <FileText className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-heading" title={name}>
                              {name}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {[kind, d.file_size ? formatFileSize(d.file_size) : null, new Date(d.created_at).toLocaleDateString(viewerLocale, { timeZone: viewerTimeZone })]
                                .filter(Boolean)
                                .join(" · ")}
                              {!isClientVisibleMedia(d) ? " · Hidden from client" : ""}
                            </p>
                          </div>
                          {isPdf(d) ? (
                            <IconAction label={`Preview ${name}`} onClick={() => viewMediaAsset(d)}>
                              <Eye className="h-4 w-4" />
                            </IconAction>
                          ) : null}
                          <IconAction
                            label={downloadingDocId === d.id ? `Downloading ${name}` : `Download ${name}`}
                            onClick={() => void downloadDocument(d)}
                          >
                            {downloadingDocId === d.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </IconAction>
                          <RowOverflow
                            label={`${name} actions`}
                            items={[
                              {
                                label: "Move up",
                                icon: ChevronUp,
                                disabled: i === 0,
                                onSelect: () => void moveItem("media", d.id, "up", documents),
                              },
                              {
                                label: "Move down",
                                icon: ChevronDown,
                                disabled: i === documents.length - 1,
                                onSelect: () => void moveItem("media", d.id, "down", documents),
                              },
                              { label: "Delete", icon: Trash, destructive: true, onSelect: () => void deleteMedia(d.id) },
                            ]}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            {canViewMoney ? (
              <div
                role="tabpanel"
                id="project-panel-estimates"
                aria-labelledby="project-tab-estimates"
                hidden={currentTab !== "estimates"}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile
                    label="Proposals"
                    value={String(quotes.length)}
                    hint={quotes.length === 0 ? "None yet" : null}
                    onClick={quotes.length > 0 ? () => setProposalHistoryOpen(true) : undefined}
                    ariaLabel={`Proposal history, ${quotes.length} ${quotes.length === 1 ? "proposal" : "proposals"}`}
                  />
                  <StatTile
                    label={quoteTotals.focus?.status === "approved" ? "Accepted total" : "Latest total"}
                    value={quoteTotals.focus ? formatCurrency(quoteTotals.focus.total_cents) : "—"}
                    hint={quoteTotals.focus?.title ?? null}
                  />
                  <StatTile
                    label="Client response"
                    value={quoteTotals.response?.label ?? "—"}
                    hint={quoteTotals.response?.hint ?? null}
                    tone={quoteTotals.response?.tone ?? "default"}
                  />
                  <StatTile
                    label="Client portal"
                    value={mediaSections.estimates ? "Visible" : "Hidden"}
                    hint={mediaSections.estimates ? "Client can review proposals" : "Turn on in Client Portal Visibility"}
                    tone={mediaSections.estimates ? "success" : "warning"}
                  />
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                  <QuoteSection
                    projectId={initialProject.id}
                    quotes={quotes}
                    isAdmin
                    clientId={initialProject.client_id ?? undefined}
                    clientName={initialProject.clients?.full_name || initialProject.clients?.name || "Client"}
                    projectName={initialProject.project_name}
                    propertyAddress={initialProject.property_address}
                    serviceType={initialProject.service_type}
                    payments={paymentList}
                    depositMode={depositMode}
                    depositPercent={depositPercent}
                    depositAmountCents={depositAmountCents}
                    travel={travel}
                    onPaymentCreated={(payment) => setPaymentList((prev) => [payment, ...prev])}
                    onStatusChange={(status) => setForm((f) => ({ ...f, status: status as Project["status"] }))}
                    historyOpen={proposalHistoryOpen}
                    onHistoryOpenChange={setProposalHistoryOpen}
                    proposalExpiration={proposalExpiration}
                  />
                </div>
              </div>
            ) : null}

            {marketingKit ? (
              <div
                role="tabpanel"
                id="project-panel-marketing"
                aria-labelledby="project-tab-marketing"
                hidden={currentTab !== "marketing"}
              >
                <MarketingAddOns
                  projectId={initialProject.id}
                  projectName={displayName}
                  location={shortLocation(form.property_address)}
                  summary={marketingKit}
                  canEdit={canEditMarketing}
                  canManageOffers={canManageMarketingOffers}
                  previewImageUrl={heroImage}
                  clientVisible={marketingVisible}
                  visibilitySaving={marketingVisSaving}
                  onClientVisibleChange={(v) => void setMarketingVisible(v)}
                />
              </div>
            ) : null}

            {canViewMoney ? (
              <div
                role="tabpanel"
                id="project-panel-payments"
                aria-labelledby="project-tab-payments"
                hidden={currentTab !== "payments"}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile
                    label="Total billed"
                    value={formatCurrency(billedCents)}
                    hint={approvedQuote ? `Accepted proposal ${formatCurrency(approvedQuote.total_cents)}` : `${billable.length} invoice${billable.length === 1 ? "" : "s"}`}
                  />
                  <StatTile label="Paid" value={formatCurrency(paidCents)} tone="success" hint={processingCents > 0 ? `${formatCurrency(processingCents)} processing (bank)` : null} />
                  <StatTile label="Outstanding" value={formatCurrency(outstandingCents)} tone={outstandingCents > 0 ? "warning" : "default"} />
                  <StatTile
                    label="Payment status"
                    value={paymentStatusLabel}
                    tone={paymentStatusLabel === "Paid in full" ? "success" : paymentStatusLabel === "No invoices yet" ? "default" : "warning"}
                    hint={mediaSections.payments ? "Visible in client portal" : "Hidden from client portal"}
                  />
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-heading">
                      <CreditCard className="h-5 w-5 text-accent" /> Invoices & payment links
                    </h2>
                    <Button variant="outline" size="sm" className="h-9" onClick={() => setShowPaymentForm(!showPaymentForm)}>
                      <Plus className="h-4 w-4" /> Create Payment
                    </Button>
                  </div>
                  {showPaymentForm && paymentForm}
                  <BankPaymentsNotice className="mb-4" />
                  {paymentListView}
                </div>
              </div>
            ) : null}

            <div
              role="tabpanel"
              id="project-panel-details"
              aria-labelledby="project-tab-details"
              hidden={currentTab !== "details"}
              className="grid gap-4 2xl:grid-cols-2"
            >
              <div className="min-w-0 space-y-4">
                <Suspense fallback={null}>
                  <ShootScheduling
                    projectId={initialProject.id}
                    proposals={shootProposals}
                    isAdmin
                    onUpdate={() => router.refresh()}
                  />
                </Suspense>
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <CardTitle>Project Details</CardTitle>
                    <Button variant="accent" size="sm" className="h-9" onClick={saveProject} disabled={saving}>
                      {saving ? "Saving…" : "Save details"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {detailFields}
                    {initialProject.properties ? (
                      <p className="flex items-center gap-1 text-xs text-accent">
                        <MapPin className="h-3 w-3 shrink-0" />
                        Property:{" "}
                        {(initialProject.properties as { nickname?: string; address: string }).nickname ||
                          (initialProject.properties as { address: string }).address}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
              <div className="min-w-0 space-y-4">
                <ProjectStaffCard projectId={initialProject.id} />
                <ProjectClientsDetailsCard
                  primaryClient={(initialProject.clients as Client | null | undefined) ?? null}
                  primaryClientId={initialProject.client_id}
                  projectClients={projectClients}
                  allClients={allClients}
                  onAddClient={addProjectClient}
                  onSetPrimary={setPrimaryClient}
                  onRemove={removeProjectClient}
                  onCreateClient={() => setShowCreateClient(true)}
                />
                {revisions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Revision Requests</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {revisions.map((rev) => (
                        <button
                          key={`rev-${rev.id}`}
                          type="button"
                          onClick={() => setSelectedRevision(rev)}
                          className="w-full rounded-lg border border-border p-4 text-left text-sm hover:bg-slate-50 surface-dark:hover:bg-subtle"
                        >
                          <p className="line-clamp-2 text-muted">{rev.description}</p>
                          <p className="mt-2 text-xs text-muted">
                            {rev.status.replace("_", " ")} · {new Date(rev.created_at).toLocaleDateString(viewerLocale, { timeZone: viewerTimeZone })}
                          </p>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>

          <aside
            aria-label="Client and activity"
            className="grid min-w-0 content-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1"
          >
            {sidebar}
          </aside>
        </div>

        <ActionMenu
          anchor={projectMenuAnchor}
          onClose={() => setProjectMenuAnchor(null)}
          items={projectMenuItems}
          title="Project actions"
        />
        <ActionMenu
          anchor={uploadMenuAnchor}
          onClose={() => setUploadMenuAnchor(null)}
          items={mediaCategory === "videos" ? uploadItems.filter((i) => i.id === "videos" || i.id === "youtube") : uploadItems}
          title="Upload media"
        />
        <ChangeCoverDialog
          open={showCoverDialog}
          onClose={() => setShowCoverDialog(false)}
          candidates={coverCandidates}
          currentId={coverImageId}
          onPick={(id) => setHeroMedia(id)}
        />
        <Modal open={showClientsModal} onClose={() => setShowClientsModal(false)} title="Project clients" className="sm:max-w-2xl">
          <div className="pb-4 [&>div]:border-0 [&>div]:shadow-none">
            <ProjectClientsCard
              primaryClient={(initialProject.clients as Client | null | undefined) ?? null}
              primaryClientId={initialProject.client_id}
              projectClients={projectClients}
              allClients={allClients}
              addClientId={addClientId}
              onAddClientIdChange={setAddClientId}
              onAddClient={() => void addProjectClient()}
              onSetPrimary={setPrimaryClient}
              onRemove={removeProjectClient}
              onCreateClient={() => setShowCreateClient(true)}
              projectId={initialProject.id}
            />
          </div>
        </Modal>
        <Modal open={showActivityModal} onClose={() => setShowActivityModal(false)} title="Project activity" className="sm:max-w-2xl">
          <div className="pb-4 [&>div]:border-0 [&>div]:shadow-none">
            <Suspense fallback={<ActivityListSkeleton />}>
            <StreamedActivities source={activities}>
            {(activityList) => (
            <ProjectActivityTimeline
              activities={activityList}
              onRevisionClick={(revisionId) => {
                const rev = revisions.find((r) => r.id === revisionId);
                if (rev) {
                  setShowActivityModal(false);
                  setSelectedRevision(rev);
                }
              }}
            />
            )}
            </StreamedActivities>
            </Suspense>
          </div>
        </Modal>
        {sharedDialogs}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 md:pb-24">
      {/* Sticky project header */}
      <div className="app-sticky-below-header sticky z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-white/95 surface-dark:bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-heading truncate">{displayName}</h1>
            <p className="text-sm text-muted truncate">{form.property_address}</p>
            {initialProject.properties && (
              <p className="text-xs text-accent truncate flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                Property: {(initialProject.properties as { nickname?: string; address: string }).nickname || (initialProject.properties as { address: string }).address}
              </p>
            )}
            <p className="text-xs text-muted">{form.service_type || "Service TBD"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <StatusBadge status={form.status} />
            <Button
              variant="accent"
              size="sm"
              className="min-h-10"
              onClick={() => setShowShareModal(true)}
            >
              <Share2 className="h-4 w-4" /> Share
            </Button>
            <Button variant="accent" size="sm" onClick={saveProject} disabled={saving} className="hidden md:inline-flex">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Link
              href={`/admin/projects/${initialProject.id}/marketing`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Sparkles className="h-4 w-4" /> Marketing Kit
            </Link>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Eye className="h-4 w-4" /> Client Page
            </a>
            {initialProject.deleted_at ? (
              <Button variant="outline" size="sm" disabled={restoringProject} onClick={() => restoreProject()} title="This project is hidden — show it again in your lists">
                <Eye className="h-4 w-4" /> {restoringProject ? "Unhiding…" : "Unhide"}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} title="Hide from your lists and dashboard">
                <EyeOff className="h-4 w-4" /> Hide
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-red-600" onClick={() => setShowPermanentDelete(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copyPortalLink}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
          Copy Portal Link
        </Button>
      </div>

      <NextStepBanner
        step={
          !canViewMoney &&
          (adminStep.actionHref === "#quote" ||
            adminStep.actionHref === "#payments" ||
            /quote|payment|invoice/i.test(adminStep.title + adminStep.description))
            ? {
                ...adminStep,
                title: "Continue this project",
                description: "Review deliverables and scheduling below.",
                actionHref: undefined,
                actionLabel: undefined,
              }
            : adminStep
        }
      />

      {/* Project details */}
      <Card>
        <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
        <CardContent className="max-w-4xl space-y-4">
          {detailFields}
        </CardContent>
      </Card>

      <ProjectStaffCard projectId={initialProject.id} />

      <ProjectClientsCard
        primaryClient={(initialProject.clients as Client | null | undefined) ?? null}
        primaryClientId={initialProject.client_id}
        projectClients={projectClients}
        allClients={allClients}
        addClientId={addClientId}
        onAddClientIdChange={setAddClientId}
        onAddClient={() => void addProjectClient()}
        onSetPrimary={setPrimaryClient}
        onRemove={removeProjectClient}
        onCreateClient={() => setShowCreateClient(true)}
        projectId={initialProject.id}
      />

      <Suspense fallback={null}>
        <ShootScheduling
          projectId={initialProject.id}
          proposals={shootProposals}
          isAdmin
          onUpdate={() => router.refresh()}
        />
      </Suspense>

      {canViewMoney && (
        <QuoteSection
          projectId={initialProject.id}
          quotes={quotes}
          isAdmin
          clientId={initialProject.client_id ?? undefined}
          clientName={
            initialProject.clients?.full_name || initialProject.clients?.name || "Client"
          }
          projectName={initialProject.project_name}
          propertyAddress={initialProject.property_address}
          serviceType={initialProject.service_type}
          titleAccessory={
            <ClientSectionVisibilityToggle
              sectionKey="estimates"
              visible={mediaSections.estimates}
              saving={sectionSaving === "estimates"}
              onChange={(v) => void setClientSectionVisible("estimates", v)}
            />
          }
          payments={paymentList}
          depositMode={depositMode}
          depositPercent={depositPercent}
          depositAmountCents={depositAmountCents}
          travel={travel}
          proposalExpiration={proposalExpiration}
          onPaymentCreated={(payment) => setPaymentList((prev) => [payment, ...prev])}
          onStatusChange={(status) =>
            setForm((f) => ({ ...f, status: status as Project["status"] }))
          }
        />
      )}

      {normalizeStatus(form.status) === "shoot_complete_editing" && (
        <div id="deliverables-admin" className="flex justify-end">
          <Button variant="accent" onClick={sendForReview} disabled={sendingForReview}>
            {sendingForReview ? "Sending..." : "Send Deliverables for Review"}
          </Button>
        </div>
      )}

      {/* Photos */}
      <Card id="photos" className="scroll-mt-20">
        <CardHeader className="flex flex-row flex-wrap items-center gap-3">
          <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Photos</CardTitle>
          <ClientSectionVisibilityToggle
            sectionKey="photos"
            visible={mediaSections.photos}
            saving={sectionSaving === "photos"}
            onChange={(v) => void setClientSectionVisible("photos", v)}
          />
        </CardHeader>
        <CardContent>
          {photoGrid}
          {photoShare.dialog}
        </CardContent>
      </Card>

      {/* Videos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <CardTitle className="flex items-center gap-2">Videos</CardTitle>
            <ClientSectionVisibilityToggle
              sectionKey="videos"
              visible={mediaSections.videos}
              saving={sectionSaving === "videos"}
              onChange={(v) => void setClientSectionVisible("videos", v)}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowYoutubeForm(!showYoutubeForm)}>
              <Video className="h-4 w-4" /> YouTube Link
            </Button>
            <label className="cursor-pointer">
              <span className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-white surface-dark:bg-card px-3 text-xs font-medium hover:bg-slate-50 surface-dark:hover:bg-subtle">
                <Upload className="h-4 w-4" /> Upload Video
              </span>
              <input type="file" multiple accept={ALLOWED_VIDEO_MIME_TYPES.join(",")} className="hidden" onChange={(e) => handleUpload(e, "video")} />
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted">Upload up to {formatFileSize(FILE_SIZE_LIMITS.video)} or paste a YouTube link</p>
          {showYoutubeForm && (
            youtubeForm
          )}
          {videos.length === 0 && !showYoutubeForm ? (
            <p className="text-sm text-muted py-4 text-center">No videos yet</p>
          ) : null}
          {videoGrid}
        </CardContent>
      </Card>

      {/* 360 Tours */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> 360 Tours</CardTitle>
            <ClientSectionVisibilityToggle
              sectionKey="tours"
              visible={mediaSections.tours}
              saving={sectionSaving === "tours"}
              onChange={(v) => void setClientSectionVisible("tours", v)}
            />
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setShowTourForm(!showTourForm)}>Add Tour</Button>
        </CardHeader>
        <CardContent>
          {showTourForm && (
            tourCreateForm
          )}
          {tours.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)).map((t, i) => (
            <div key={t.id} className="mb-2">
              {editingTour === t.id ? (
                renderTourEdit(t)
              ) : (
                <AssetRow name={t.tour_name} badge={t.client_visible === false ? "Hidden" : undefined}
                  onUp={() => moveItem("tour", t.id, "up", tours)} onDown={() => moveItem("tour", t.id, "down", tours)}
                  canUp={i > 0} canDown={i < tours.length - 1}
                  extra={
                    <>
                      <Button variant="ghost" size="sm" title={t.client_visible !== false ? "Hide from client" : "Show to client"} onClick={() => toggleTourVisibility(t.id, t.client_visible === false)}>
                        {t.client_visible !== false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingTour(t.id);
                        setEditTourForm({ tour_name: t.tour_name, kuula_url: t.kuula_url, notes: t.notes || "" });
                      }}><Pencil className="h-4 w-4" /></Button>
                      <a href={t.kuula_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 text-accent" /></a>
                    </>
                  }
                  onDelete={() => setTourPendingDelete(t)}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 3D Models */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <CardTitle className="flex items-center gap-2"><Box className="h-5 w-5" /> 3D Models</CardTitle>
            <ClientSectionVisibilityToggle
              sectionKey="models"
              visible={mediaSections.models}
              saving={sectionSaving === "models"}
              onChange={(v) => void setClientSectionVisible("models", v)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setShowModelForm(!showModelForm);
              if (showModelForm) setModelFormEmbedUrl("");
            }}
          >
            Add Model
          </Button>
        </CardHeader>
        <CardContent>
          {showModelForm && (
            modelCreateForm
          )}
          {models.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)).map((m, i) => (
            <div key={m.id} className="mb-2">
              {editingModel === m.id ? (
                renderModelEdit(m)
              ) : (
                <AssetRow
                  name={m.title}
                  badge={m.client_visible === false ? "Hidden" : undefined}
                  onUp={() => moveItem("model", m.id, "up", models)}
                  onDown={() => moveItem("model", m.id, "down", models)}
                  canUp={i > 0}
                  canDown={i < models.length - 1}
                  extra={
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={m.client_visible !== false ? "Hide from client" : "Show to client"}
                        onClick={() => toggleModelVisibility(m.id, m.client_visible === false)}
                      >
                        {m.client_visible !== false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingModel(m.id);
                          setEditModelForm({
                            title: m.title,
                            embed_url: m.embed_url,
                            description: m.description || "",
                          });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <a href={m.embed_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 text-accent" />
                      </a>
                    </>
                  }
                  onDelete={() => setModelPendingDelete(m)}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <CardTitle>Documents</CardTitle>
            <ClientSectionVisibilityToggle
              sectionKey="documents"
              visible={mediaSections.documents}
              saving={sectionSaving === "documents"}
              onChange={(v) => void setClientSectionVisible("documents", v)}
            />
          </div>
          <label className="cursor-pointer shrink-0">
            <span className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-white surface-dark:bg-card px-3 text-xs font-medium hover:bg-slate-50 surface-dark:hover:bg-subtle">
              <Upload className="h-4 w-4" /> Upload
            </span>
            <input type="file" multiple accept={DOCUMENT_ACCEPT} className="hidden" onChange={(e) => handleUpload(e, "document")} />
          </label>
        </CardHeader>
        <CardContent>
          {documents.map((d, i) => (
            <AssetRow key={d.id} name={mediaDisplayName(d)}
              onUp={() => moveItem("media", d.id, "up", documents)} onDown={() => moveItem("media", d.id, "down", documents)}
              canUp={i > 0} canDown={i < documents.length - 1}
              extra={
                <Button
                  variant="ghost"
                  size="sm"
                  title={`Download ${mediaDisplayName(d)}`}
                  aria-label={`Download ${mediaDisplayName(d)}`}
                  disabled={downloadingDocId === d.id}
                  onClick={() => void downloadDocument(d)}
                >
                  {downloadingDocId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
              }
              onDelete={() => deleteMedia(d.id)} />
          ))}
        </CardContent>
      </Card>

      {revisions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Revision Requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {revisions.map((rev) => (
              <button
                key={`rev-${rev.id}`}
                type="button"
                onClick={() => setSelectedRevision(rev)}
                className="w-full rounded-lg border border-border p-4 text-left text-sm hover:bg-slate-50 surface-dark:hover:bg-subtle"
              >
                <p className="text-muted line-clamp-2">{rev.description}</p>
                <p className="text-xs text-muted mt-2">{rev.status.replace("_", " ")} · {new Date(rev.created_at).toLocaleDateString(viewerLocale, { timeZone: viewerTimeZone })}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {marketingKit ? (
        <MarketingKitCard
          projectId={initialProject.id}
          summary={marketingKit}
          canEdit={canEditMarketing}
          canManageOffers={canManageMarketingOffers}
          clientVisible={marketingVisible}
          visibilitySaving={marketingVisSaving}
          onClientVisibleChange={(v) => void setMarketingVisible(v)}
        />
      ) : null}

      {/* Payments — hidden when staff lacks money.view */}
      {canViewMoney && (
        <Card id="payments">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Payments
              </CardTitle>
              <ClientSectionVisibilityToggle
                sectionKey="payments"
                visible={mediaSections.payments}
                saving={sectionSaving === "payments"}
                onChange={(v) => void setClientSectionVisible("payments", v)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPaymentForm(!showPaymentForm)}
            >
              Create Payment
            </Button>
          </CardHeader>
          <CardContent>
            {showPaymentForm && (
              paymentForm
            )}
            <BankPaymentsNotice className="mb-4" />
            {paymentListView}
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-border bg-slate-50/80 surface-dark:bg-subtle/80 px-4 py-3 text-sm text-muted">
        Client messaging lives in the{" "}
        <Link href="/admin/messages" className="font-medium text-accent hover:underline">
          Messages
        </Link>{" "}
        inbox (organized by client). Open a client conversation there to reply.
      </div>

      <Suspense fallback={<ActivityListSkeleton />}>
        <StreamedActivities source={activities}>
          {(activityList) => (
            <ProjectActivityTimeline
              activities={activityList}
              onRevisionClick={(revisionId) => {
                const rev = revisions.find((r) => r.id === revisionId);
                if (rev) setSelectedRevision(rev);
              }}
            />
          )}
        </StreamedActivities>
      </Suspense>

      {sharedDialogs}

      <StickySaveBar
        onSave={saveProject}
        saving={saving}
        contentClassName="max-w-7xl md:px-6 lg:px-8"
      />
    </div>
  );
}

function ProjectClientsCard({
  primaryClient,
  primaryClientId,
  projectClients,
  allClients,
  addClientId,
  onAddClientIdChange,
  onAddClient,
  onSetPrimary,
  onRemove,
  onCreateClient,
  projectId,
}: {
  primaryClient: Client | null;
  primaryClientId: string | null;
  projectClients: {
    id: string;
    client_id: string;
    is_primary: boolean;
    clients?: Client & { user_id?: string | null };
  }[];
  allClients: Pick<Client, "id" | "name" | "email" | "company">[];
  addClientId: string;
  onAddClientIdChange: (id: string) => void;
  onAddClient: () => void;
  onSetPrimary: (pcId: string, clientId: string) => void;
  onRemove: (pcId: string) => void;
  onCreateClient: () => void;
  projectId: string;
}) {
  const associated = useMemo(() => {
    const rows = [...projectClients];
    if (primaryClientId && primaryClient && !rows.some((pc) => pc.client_id === primaryClientId)) {
      rows.unshift({
        id: "primary-fallback",
        client_id: primaryClientId,
        is_primary: true,
        clients: primaryClient,
      });
    }
    return rows;
  }, [projectClients, primaryClientId, primaryClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Project Clients
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted">
          Portal access is optional. Quotes, scheduling, messages and invoices work for every client; clients who
          activate their portal also see this project when they sign in.
        </p>
        {associated.length > 0 ? (
          <div className="space-y-2">
            {associated.map((pc) => {
              const client = pc.clients as (Client & { user_id?: string | null }) | undefined;
              const displayName = client?.full_name || client?.name || "Client";
              const contact = client?.email || client?.phone;
              return (
                <div
                  key={pc.id}
                  className="rounded-xl border border-border bg-white surface-dark:bg-card p-3 text-sm shadow-sm"
                >
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/clients/${pc.client_id}`}
                    className="min-h-11 min-w-0 flex-1 rounded-lg transition-colors hover:bg-slate-50 surface-dark:hover:bg-subtle active:bg-slate-100 surface-dark:active:bg-subtle -m-1 p-1"
                  >
                    <p className="font-medium text-heading">{displayName}</p>
                    {contact && <p className="text-xs text-muted truncate">{contact}</p>}
                  </Link>
                  {pc.is_primary ? (
                    <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                      Primary
                    </span>
                  ) : (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 shrink-0 px-2 text-xs"
                        onClick={() => onSetPrimary(pc.id, pc.client_id)}
                      >
                        Set Primary
                      </Button>
                      {pc.id !== "primary-fallback" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-11 min-w-11 shrink-0 text-red-500 hover:text-red-700"
                          onClick={() => onRemove(pc.id)}
                          aria-label={`Remove ${displayName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <PortalAccessStatus
                  clientId={pc.client_id}
                  projectId={projectId}
                  className="mt-2 border-t border-border pt-2"
                />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">No clients linked yet.</p>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Select
            className="min-w-[12rem] flex-1"
            value={addClientId}
            onChange={(e) => onAddClientIdChange(e.target.value)}
            placeholder="Add client to project"
            options={allClients
              .filter((c) => !associated.some((pc) => pc.client_id === c.id))
              .map((c) => ({ value: c.id, label: c.company ? `${c.name} (${c.company})` : c.name }))}
          />
          <Button variant="outline" size="sm" className="min-h-11" onClick={onAddClient} disabled={!addClientId}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="min-h-11" onClick={onCreateClient}>
            <Plus className="h-4 w-4" /> New Client
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AssetRow({
  name, badge, onUp, onDown, canUp, canDown, onDelete, extra,
}: {
  name: string; badge?: string;
  onUp?: () => void; onDown?: () => void; canUp?: boolean; canDown?: boolean;
  onDelete?: () => void; extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-col gap-0.5">
        <button type="button" onClick={onUp} disabled={!canUp} className="text-muted hover:text-foreground disabled:opacity-30">
          <ChevronUp className="h-4 w-4" />
        </button>
        <button type="button" onClick={onDown} disabled={!canDown} className="text-muted hover:text-foreground disabled:opacity-30">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <span className="flex-1 truncate">{name}</span>
      {badge && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">{badge}</span>}
      {extra}
      {onDelete && (
        <button type="button" onClick={onDelete} className="text-red-500 hover:text-red-700">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function WorkspaceBreadcrumb({ label, onRoot }: { label: string; onRoot: () => void }) {
  return (
    <nav aria-label="Media location" className="mb-3 flex items-center gap-0.5 text-sm">
      <button
        type="button"
        onClick={onRoot}
        aria-label="All media"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-accent-subtle hover:text-heading"
      >
        <Home className="h-4 w-4" />
      </button>
      <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden />
      <button type="button" onClick={onRoot} className="rounded-md px-1.5 py-1 font-medium text-accent hover:bg-accent-subtle">
        Media
      </button>
      <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden />
      <span className="px-1.5 font-semibold text-heading" aria-current="page">
        {label}
      </span>
    </nav>
  );
}

function EmptyMediaState({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted">
      <Icon className="h-4 w-4" /> {text}
    </div>
  );
}

/**
 * Reads the streamed activity history. The server sends it as a promise so the page renders
 * without waiting for it; `use()` suspends only the activity panels (never .then().catch() —
 * streamed RSC promises are thenables).
 */
function StreamedActivities({
  source,
  children,
}: {
  source: ActivityLog[] | Promise<ActivityLog[]>;
  children: (activities: ActivityLog[]) => ReactNode;
}) {
  const list = Array.isArray(source) ? source : use(source);
  return <>{children(list)}</>;
}

function ActivityPreviewSkeleton() {
  return (
    <SidebarCard title="Project Activity" icon={ActivityIcon}>
      <ActivityListSkeleton />
    </SidebarCard>
  );
}

function ActivityListSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      <span className="sr-only">Loading activity…</span>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex gap-2.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
