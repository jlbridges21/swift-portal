"use client";

import { useState, useEffect, Suspense, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StickySaveBar } from "@/components/ui/sticky-save-bar";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { AdminPhotoGrid } from "@/components/admin/admin-photo-grid";
import { VideoMediaPlaceholder } from "@/components/ui/video-media-placeholder";
import { mediaDisplayName } from "@/lib/media-display-name";
import { RevisionDrawer } from "@/components/admin/revision-drawer";
import { PROJECT_STATUSES } from "@/lib/constants";
import { FILE_SIZE_LIMITS, formatFileSize } from "@/lib/brand";
import { QuoteSection } from "@/components/projects/quote-section";
import { AdminPaymentActions } from "@/components/admin/admin-payment-actions";
import type { Project, Client, MediaAsset, Tour, Payment, ShootProposal, ActivityLog, Revision, ProjectQuote, AssetReview, MediaFolder } from "@/lib/types";
import { normalizeStatus } from "@/lib/constants";
import { ShootScheduling } from "@/components/projects/shoot-scheduling";
import { ProjectActivityTimeline } from "@/components/projects/project-activity-timeline";
import { NextStepBanner } from "@/components/projects/next-step-banner";
import { getAdminNextStep } from "@/lib/journey";
import {
  Upload, CreditCard, Globe, Trash2, ChevronUp, ChevronDown,
  ExternalLink, Check, Video, ImageIcon, Eye, EyeOff, Link2, Pencil, Users, Plus, MapPin, Share2,
} from "lucide-react";
import { CreateClientModal } from "@/components/admin/create-client-modal";
import { useUploadManager } from "@/components/admin/upload-manager";
import { cn, defaultProjectName } from "@/lib/utils";
import { isClientVisibleMedia } from "@/lib/client-media";
import { ALLOWED_VIDEO_MIME_TYPES } from "@/lib/upload/constants";
import { toast } from "sonner";
import { VideoReviewAdminActions, useVideoReviewDeleteHandler } from "@/components/admin/video-review-admin-actions";
import type { VideoReviewListItem } from "@/lib/video-reviews";
import type { ProjectShareRow } from "@/lib/project-shares";
import { ProjectShareModal } from "@/components/admin/project-share-modal";
import type { ProjectLinkAccessMode } from "@/lib/project-link-access";
import { useAsyncAction } from "@/lib/use-async-action";

function dedupeMedia<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

interface AdminProjectDetailProps {
  project: Project & { clients: Client };
  media: MediaAsset[];
  tours: Tour[];
  payments: Payment[];
  shootProposals: ShootProposal[];
  projectClients: { id: string; client_id: string; is_primary: boolean; clients: Client }[];
  allClients: Pick<Client, "id" | "name" | "email" | "company">[];
  activities: ActivityLog[];
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
}

export function AdminProjectDetail({
  project: initialProject,
  media: initialMedia,
  tours: initialTours,
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
}: AdminProjectDetailProps) {
  const router = useRouter();
  const { enqueueUploads } = useUploadManager();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showTourForm, setShowTourForm] = useState(false);
  const [showYoutubeForm, setShowYoutubeForm] = useState(false);
  const [editingMedia, setEditingMedia] = useState<string | null>(null);
  const [editingTour, setEditingTour] = useState<string | null>(null);
  const [editMediaForm, setEditMediaForm] = useState({ title: "", youtube_url: "" });
  const [editTourForm, setEditTourForm] = useState({ tour_name: "", kuula_url: "", notes: "" });
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [folders, setFolders] = useState(initialFolders);
  const [tourPendingDelete, setTourPendingDelete] = useState<Tour | null>(null);
  const [deletingTour, setDeletingTour] = useState(false);
  const [videoReviews, setVideoReviews] = useState(initialVideoReviews);

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
    if (!res.ok) throw new Error("Failed to restore project");
    toast.success("Project restored");
    router.refresh();
  }, { loadingLabel: "Restoring..." });

  useEffect(() => {
    setPaymentList(payments);
  }, [payments]);

  useEffect(() => {
    setRevisions(initialRevisions);
  }, [initialRevisions]);

  useEffect(() => {
    setMedia(initialMedia);
  }, [initialMedia]);

  useEffect(() => {
    setTours(initialTours);
  }, [initialTours]);

  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  const [form, setForm] = useState({
    project_name: initialProject.project_name,
    property_address: initialProject.property_address,
    service_type: initialProject.service_type,
    status: initialProject.status,
    delivery_date: initialProject.delivery_date || "",
    notes: initialProject.notes || "",
  });

  const [media, setMedia] = useState(initialMedia);
  const [tours, setTours] = useState(initialTours);

  const photos = dedupeMedia(
    media
      .filter((m) => m.media_type === "photo")
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  );
  const videos = media.filter((m) => m.media_type === "video").sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
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
      toast.error("Failed to save project");
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

    enqueueUploads({
      files: fileList,
      projectId: initialProject.id,
      mediaType,
      onAsset: (asset) => {
        setMedia((prev) => dedupeMedia([...prev, asset]));
        if (mediaType === "photo") {
          setPendingNewPhotoIds((prev) => [...prev, asset.id]);
        }
      },
      onBatchComplete: ({ uploaded, errors }) => {
        if (uploaded.length) {
          toast.success(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded`);
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

  async function moveItem(type: "media" | "tour", id: string, direction: "up" | "down", list: { id: string; display_order: number }[]) {
    const idx = list.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;

    const items = list.map((item, i) => {
      if (i === idx) return { id: item.id, display_order: swapIdx, type: type === "tour" ? "tour" : "media" };
      if (i === swapIdx) return { id: item.id, display_order: idx, type: type === "tour" ? "tour" : "media" };
      return { id: item.id, display_order: item.display_order, type: type === "tour" ? "tour" : "media" };
    });

    await fetch("/api/media/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    router.refresh();
    toast.success("Order updated");
  }

  async function setHeroMedia(mediaId: string) {
    await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: initialProject.id, cover_image_id: mediaId }),
    });
    setCoverImageId(mediaId);
    toast.success("Hero media updated");
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
    const ok = await deleteMediaWithReviewCheck(id);
    if (ok) {
      setMedia((m) => m.filter((a) => a.id !== id));
      void refreshVideoReviews();
    }
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
    const res = await fetch("/api/tours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, ...editTourForm }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTours((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditingTour(null);
      toast.success("Tour updated");
    }
  }

  async function addProjectClient() {
    if (!addClientId) return;
    const res = await fetch("/api/project-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: initialProject.id,
        client_id: addClientId,
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
      router.refresh();
    } else {
      toast.error((data as { error?: string }).error || "Failed to add client");
    }
  }

  async function enablePortalForClient(clientId: string) {
    const password = window.prompt(
      "Set a portal password for this client (min 8 characters). They can change it after logging in."
    );
    if (!password) return;
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const res = await fetch(`/api/clients/${clientId}/portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error((data as { error?: string }).error || "Failed to enable portal");
      return;
    }
    toast.success(data.message || "Portal access enabled");
    router.refresh();
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
    const res = await fetch("/api/tours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        project_id: initialProject.id,
        tour_name: fd.get("tour_name"),
        kuula_url: fd.get("kuula_url"),
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
    } else toast.error("Failed to add tour");
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

  const assignedClientForShare = useMemo(() => {
    const primary =
      projectClients.find((pc) => pc.is_primary)?.clients ??
      (initialProject.clients as Client);
    return {
      name: primary.name || primary.full_name || primary.email,
      email: primary.email,
      user_id: primary.user_id,
    };
  }, [projectClients, initialProject.clients]);

  return (
    <div className="space-y-6 pb-6 md:pb-24">
      {/* Sticky project header */}
      <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-white/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-primary truncate">{displayName}</h1>
            <p className="text-sm text-muted truncate">{form.property_address}</p>
            {initialProject.properties && (
              <p className="text-xs text-accent truncate flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                Property: {(initialProject.properties as { nickname?: string; address: string }).nickname || (initialProject.properties as { address: string }).address}
              </p>
            )}
            <p className="text-xs text-muted">{form.service_type}</p>
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
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Eye className="h-4 w-4" /> Client Page
            </a>
            {initialProject.deleted_at ? (
              <Button variant="outline" size="sm" disabled={restoringProject} onClick={() => restoreProject()}>
                Restore
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="text-red-600" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="h-4 w-4" /> Hide
              </Button>
            )}
          </div>
        </div>
      </div>

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

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copyPortalLink}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
          Copy Portal Link
        </Button>
      </div>

      <NextStepBanner step={adminStep} />

      {/* Project details */}
      <Card>
        <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
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
              <Label>Service Type</Label>
              <Input value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} />
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
        </CardContent>
      </Card>

      <ProjectClientsCard
        primaryClient={initialProject.clients as Client}
        primaryClientId={initialProject.client_id}
        projectClients={projectClients}
        allClients={allClients}
        addClientId={addClientId}
        onAddClientIdChange={setAddClientId}
        onAddClient={addProjectClient}
        onSetPrimary={setPrimaryClient}
        onRemove={removeProjectClient}
        onCreateClient={() => setShowCreateClient(true)}
        onEnablePortal={enablePortalForClient}
      />

      <Suspense fallback={null}>
        <ShootScheduling
          projectId={initialProject.id}
          proposals={shootProposals}
          isAdmin
          onUpdate={() => router.refresh()}
        />
      </Suspense>

      <QuoteSection
        projectId={initialProject.id}
        quotes={quotes}
        isAdmin
        clientId={initialProject.client_id}
        clientName={initialProject.clients?.full_name || initialProject.clients?.name || "Client"}
        projectName={initialProject.project_name}
        propertyAddress={initialProject.property_address}
        serviceType={initialProject.service_type}
        payments={paymentList}
        onPaymentCreated={(payment) => setPaymentList((prev) => [payment, ...prev])}
        onStatusChange={(status) => setForm((f) => ({ ...f, status: status as Project["status"] }))}
      />

      {normalizeStatus(form.status) === "shoot_complete_editing" && (
        <div id="deliverables-admin" className="flex justify-end">
          <Button variant="accent" onClick={sendForReview} disabled={sendingForReview}>
            {sendingForReview ? "Sending..." : "Send Deliverables for Review"}
          </Button>
        </div>
      )}

      {/* Photos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Photos</CardTitle>
          <label className="cursor-pointer">
            <span className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-medium hover:bg-slate-50">
              <Upload className="h-4 w-4" /> Upload Photos
            </span>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleUpload(e, "photo")} />
          </label>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted">Max {formatFileSize(FILE_SIZE_LIMITS.photo)} per image</p>
          {photos.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No photos yet</p>
          ) : (
            <AdminPhotoGrid
              projectId={initialProject.id}
              photos={photos}
              folders={folders}
              isHero={isHero}
              onSetHero={setHeroMedia}
              onDelete={deleteMedia}
              onToggleVisibility={toggleMediaVisibility}
              onFoldersChange={setFolders}
              onPhotosChange={(nextPhotos) => {
                setMedia((prev) => {
                  const others = prev.filter((m) => m.media_type !== "photo");
                  return [...others, ...nextPhotos];
                });
              }}
              onPropertyLineSaved={(asset) => {
                const saved = asset as unknown as MediaAsset;
                setMedia((prev) => {
                  const idx = prev.findIndex((m) => m.id === saved.id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = { ...next[idx], ...saved };
                    return next;
                  }
                  return [...prev, saved];
                });
              }}
              onRefresh={() => router.refresh()}
            />
          )}
        </CardContent>
      </Card>

      {/* Videos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">Videos</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowYoutubeForm(!showYoutubeForm)}>
              <Video className="h-4 w-4" /> YouTube Link
            </Button>
            <label className="cursor-pointer">
              <span className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-medium hover:bg-slate-50">
                <Upload className="h-4 w-4" /> Upload Video
              </span>
              <input type="file" multiple accept={ALLOWED_VIDEO_MIME_TYPES.join(",")} className="hidden" onChange={(e) => handleUpload(e, "video")} />
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted">Upload up to {formatFileSize(FILE_SIZE_LIMITS.video)} or paste a YouTube link</p>
          {showYoutubeForm && (
            <form onSubmit={handleYoutube} className="mb-4 space-y-3 rounded-lg border border-border p-4">
              <Input name="title" placeholder="Video title" />
              <Input name="youtube_url" required placeholder="https://youtube.com/watch?v=..." />
              <Button type="submit" variant="accent" size="sm">Add YouTube Video</Button>
            </form>
          )}
          {videos.length === 0 && !showYoutubeForm ? (
            <p className="text-sm text-muted py-4 text-center">No videos yet</p>
          ) : null}
          {videos.map((v, i) => (
            <div key={v.id} className="mb-3 rounded-lg border border-border overflow-hidden">
              {v.media_source === "youtube" && v.embed_url && (
                <div className="aspect-video bg-black">
                  <iframe src={v.embed_url} className="h-full w-full" title={mediaDisplayName(v)} allowFullScreen />
                </div>
              )}
              {v.media_source !== "youtube" && <AdminVideoThumb asset={v} />}
              {editingMedia === v.id ? (
                <div className="space-y-2 p-3 border-t border-border">
                  <Input value={editMediaForm.title} onChange={(e) => setEditMediaForm({ ...editMediaForm, title: e.target.value })} placeholder="Title" maxLength={120} />
                  {v.media_source === "youtube" && (
                    <Input value={editMediaForm.youtube_url} onChange={(e) => setEditMediaForm({ ...editMediaForm, youtube_url: e.target.value })} placeholder="YouTube URL" />
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="accent" onClick={() => saveMediaEdit(v.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingMedia(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <AssetRow name={mediaDisplayName(v)} badge={
                  !isClientVisibleMedia(v) ? "Hidden" : isHero(v.id) ? "Hero" : v.media_source === "youtube" ? "YouTube" : "Upload"
                }
                  onUp={() => moveItem("media", v.id, "up", videos)} onDown={() => moveItem("media", v.id, "down", videos)}
                  canUp={i > 0} canDown={i < videos.length - 1}
                  extra={
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" title={isClientVisibleMedia(v) ? "Hide from client" : "Show to client"} onClick={() => toggleMediaVisibility(v.id, !isClientVisibleMedia(v))}>
                        {isClientVisibleMedia(v) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setHeroMedia(v.id)}>Set as Hero</Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingMedia(v.id);
                        setEditMediaForm({ title: mediaDisplayName(v), youtube_url: v.youtube_url || "" });
                      }}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  }
                  onDelete={() => deleteMedia(v.id)} />
              )}
              {v.media_source !== "youtube" && (
                <div className="border-t border-border px-3 pb-3">
                  <VideoReviewAdminActions
                    projectId={initialProject.id}
                    video={v}
                    reviewItem={reviewByAssetId.get(v.id) ?? null}
                    onReviewsChange={() => void refreshVideoReviews()}
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 360 Tours */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> 360 Tours</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowTourForm(!showTourForm)}>Add Tour</Button>
        </CardHeader>
        <CardContent>
          {showTourForm && (
            <form onSubmit={handleCreateTour} className="mb-4 space-y-3 rounded-lg border border-border p-4">
              <Input name="tour_name" required placeholder="Tour name" />
              <Input name="kuula_url" required placeholder="Kuula URL" />
              <Input name="thumbnail_url" placeholder="Thumbnail URL (optional)" />
              <Textarea name="embed_code" placeholder="Embed code (optional)" rows={2} />
              <Textarea name="notes" placeholder="Notes for client (optional)" rows={2} />
              <Button type="submit" variant="accent" size="sm">Save Tour</Button>
            </form>
          )}
          {tours.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)).map((t, i) => (
            <div key={t.id} className="mb-2">
              {editingTour === t.id ? (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <Input value={editTourForm.tour_name} onChange={(e) => setEditTourForm({ ...editTourForm, tour_name: e.target.value })} />
                  <Input value={editTourForm.kuula_url} onChange={(e) => setEditTourForm({ ...editTourForm, kuula_url: e.target.value })} />
                  <Textarea value={editTourForm.notes} onChange={(e) => setEditTourForm({ ...editTourForm, notes: e.target.value })} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="accent" onClick={() => saveTourEdit(t.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingTour(null)}>Cancel</Button>
                  </div>
                </div>
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

      {/* Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documents</CardTitle>
          <label className="cursor-pointer">
            <span className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-medium hover:bg-slate-50">
              <Upload className="h-4 w-4" /> Upload
            </span>
            <input type="file" multiple accept="application/pdf,application/zip" className="hidden" onChange={(e) => handleUpload(e, "document")} />
          </label>
        </CardHeader>
        <CardContent>
          {documents.map((d, i) => (
            <AssetRow key={d.id} name={mediaDisplayName(d)}
              onUp={() => moveItem("media", d.id, "up", documents)} onDown={() => moveItem("media", d.id, "down", documents)}
              canUp={i > 0} canDown={i < documents.length - 1}
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
                className="w-full rounded-lg border border-border p-4 text-left text-sm hover:bg-slate-50"
              >
                <p className="text-muted line-clamp-2">{rev.description}</p>
                <p className="text-xs text-muted mt-2">{rev.status.replace("_", " ")} · {new Date(rev.created_at).toLocaleDateString()}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payments */}
      <Card id="payments">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Payments</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowPaymentForm(!showPaymentForm)}>Create Payment</Button>
        </CardHeader>
        <CardContent>
          {showPaymentForm && (
            <form onSubmit={handleCreatePayment} className="mb-4 space-y-3 rounded-lg border border-border p-4">
              <Input name="amount" type="number" step="0.01" min="0" required placeholder="Amount (USD)" />
              <Input name="description" required placeholder="Description" />
              <Input name="due_date" type="date" />
              <Button type="submit" variant="accent" size="sm" disabled={creatingPayment}>
                {creatingPayment ? "Creating…" : "Create Payment Link"}
              </Button>
            </form>
          )}
          {paymentList.map((p) => (
            <div key={`payment-${p.id}`} className="border-b border-border py-4 last:border-0">
              <AdminPaymentActions
                payment={p}
                showProjectLink={false}
                showDelete
                onUpdated={(updated) =>
                  setPaymentList((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                }
                onDeleted={deletePayment}
              />
            </div>
          ))}
          {paymentList.length === 0 && (
            <p className="text-sm text-muted text-center py-4">No payment links yet</p>
          )}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-slate-50/80 px-4 py-3 text-sm text-muted">
        Client messaging lives in the{" "}
        <Link href="/admin/messages" className="font-medium text-accent hover:underline">
          Messages
        </Link>{" "}
        inbox (organized by client). Open a client conversation there to reply.
      </div>

      <ProjectActivityTimeline
        activities={activities}
        onRevisionClick={(revisionId) => {
          const rev = revisions.find((r) => r.id === revisionId);
          if (rev) setSelectedRevision(rev);
        }}
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

      <CreateClientModal
        open={showCreateClient}
        onClose={() => setShowCreateClient(false)}
        onCreated={handleClientCreated}
      />

      <StickySaveBar onSave={saveProject} saving={saving} />
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
  onEnablePortal,
}: {
  primaryClient: Client;
  primaryClientId: string;
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
  onEnablePortal: (clientId: string) => void;
}) {
  const associated = useMemo(() => {
    const rows = [...projectClients];
    if (!rows.some((pc) => pc.client_id === primaryClientId)) {
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
          Every assigned client with portal access can see this project in their login. Clients without a portal login
          will not see it until you enable access.
        </p>
        {associated.length > 0 ? (
          <div className="space-y-2">
            {associated.map((pc) => {
              const client = pc.clients as (Client & { user_id?: string | null }) | undefined;
              const displayName = client?.full_name || client?.name || "Client";
              const contact = client?.email || client?.phone;
              const hasPortal = !!(client?.user_id);
              return (
                <div
                  key={pc.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-white p-3 text-sm shadow-sm"
                >
                  <Link
                    href={`/admin/clients/${pc.client_id}`}
                    className="min-h-11 min-w-0 flex-1 rounded-lg transition-colors hover:bg-slate-50 active:bg-slate-100 -m-1 p-1"
                  >
                    <p className="font-medium text-primary">{displayName}</p>
                    {contact && <p className="text-xs text-muted truncate">{contact}</p>}
                    <p className={cn("mt-0.5 text-[11px] font-medium", hasPortal ? "text-emerald-700" : "text-amber-700")}>
                      {hasPortal ? "Portal access linked" : "No portal login — project hidden from them"}
                    </p>
                  </Link>
                  {!hasPortal && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 shrink-0 text-xs"
                      onClick={() => onEnablePortal(pc.client_id)}
                    >
                      Enable Portal
                    </Button>
                  )}
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

function AdminVideoThumb({ asset }: { asset: MediaAsset }) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  async function play() {
    if (playing || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/media/download/${asset.id}`, { credentials: "include" });
      const d = await res.json();
      if (d.url) {
        setStreamUrl(d.url);
        setPlaying(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (playing && streamUrl) {
    return <video src={streamUrl} className="w-full max-h-40" controls playsInline />;
  }

  return (
    <button
      type="button"
      onClick={play}
      className="relative flex w-full max-h-40 min-h-[5rem] overflow-hidden rounded-lg"
      aria-label={`Play ${mediaDisplayName(asset)}`}
    >
      <VideoMediaPlaceholder fileName={mediaDisplayName(asset)} compact className="min-h-[5rem]" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
          Loading…
        </div>
      )}
    </button>
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
