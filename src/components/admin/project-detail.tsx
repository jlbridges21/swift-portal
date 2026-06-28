"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StickySaveBar } from "@/components/ui/sticky-save-bar";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { AdminPhotoGrid } from "@/components/admin/admin-photo-grid";
import { RevisionDrawer } from "@/components/admin/revision-drawer";
import { PROJECT_STATUSES } from "@/lib/constants";
import { FILE_SIZE_LIMITS, formatFileSize } from "@/lib/brand";
import { QuoteSection } from "@/components/projects/quote-section";
import { AdminPaymentActions } from "@/components/admin/admin-payment-actions";
import type { Project, Client, MediaAsset, Tour, Payment, ShootProposal, ActivityLog, Revision, ProjectQuote, AssetReview } from "@/lib/types";
import { normalizeStatus } from "@/lib/constants";
import { ShootScheduling } from "@/components/projects/shoot-scheduling";
import { ProjectActivityTimeline } from "@/components/projects/project-activity-timeline";
import { NextStepBanner } from "@/components/projects/next-step-banner";
import { getAdminNextStep } from "@/lib/journey";
import {
  Upload, CreditCard, Globe, Trash2, ChevronUp, ChevronDown,
  ExternalLink, Check, Video, ImageIcon, Eye, EyeOff, Link2, Pencil, Users, Plus, MapPin,
} from "lucide-react";
import { UploadProgressList, type UploadProgressItem } from "@/components/admin/upload-progress-list";
import { CreateClientModal } from "@/components/admin/create-client-modal";
import { defaultProjectName } from "@/lib/utils";
import { uploadMediaFile, retryMediaSave, validateMediaFileBeforeUpload, UploadSaveError, UploadBinaryError } from "@/lib/upload";
import { userFacingUploadError } from "@/lib/upload/upload-errors";
import { ALLOWED_VIDEO_MIME_TYPES } from "@/lib/upload/constants";
import { toast } from "sonner";

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
  portalUrl: string;
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
  portalUrl,
}: AdminProjectDetailProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadProgressItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showTourForm, setShowTourForm] = useState(false);
  const [showYoutubeForm, setShowYoutubeForm] = useState(false);
  const [editingMedia, setEditingMedia] = useState<string | null>(null);
  const [editingTour, setEditingTour] = useState<string | null>(null);
  const [editMediaForm, setEditMediaForm] = useState({ file_name: "", youtube_url: "" });
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
    media.filter((m) => m.media_type === "photo").sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
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

  function patchUploadItem(id: string, patch: Partial<UploadProgressItem>) {
    setUploadItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, mediaType: "photo" | "video" | "document") {
    const files = e.target.files;
    if (!files?.length) return;

    const fileList = Array.from(files);
    const newItems: UploadProgressItem[] = [];
    const validFiles: File[] = [];

    for (const file of fileList) {
      const uploadId = `${file.name}-${Date.now()}-${Math.random()}`;
      const validation = validateMediaFileBeforeUpload(file, mediaType);
      if (!validation.ok) {
        newItems.push({
          id: uploadId,
          fileName: file.name,
          progress: 0,
          phase: "failed",
          status: "error",
          error: validation.error,
        });
        continue;
      }
      validFiles.push(file);
      newItems.push({
        id: uploadId,
        fileName: file.name,
        progress: 0,
        phase: "queued",
        status: "uploading",
        bytesTotal: file.size,
        mimeType: validation.mimeType,
        startedAt: Date.now(),
      });
    }

    if (newItems.length) setUploadItems((prev) => [...prev, ...newItems]);

    const uploaded: MediaAsset[] = [];
    const errors: string[] = newItems.filter((i) => i.status === "error").map((i) => `${i.fileName}: ${i.error}`);

    let validIndex = 0;
    for (const item of newItems) {
      if (item.status === "error") continue;
      const file = validFiles[validIndex++];
      const uploadId = item.id;
      try {
        const { asset } = await uploadMediaFile({
          projectId: initialProject.id,
          file,
          mediaType,
          onProgress: ({ phase, progress, bytesLoaded, bytesTotal }) => {
            patchUploadItem(uploadId, {
              phase,
              progress,
              bytesLoaded,
              bytesTotal,
              status: phase === "failed" ? "error" : "uploading",
            });
          },
        });
        uploaded.push(asset as unknown as MediaAsset);
        patchUploadItem(uploadId, { progress: 100, phase: "uploaded", status: "success" });
      } catch (err) {
        if (err instanceof UploadSaveError) {
          const msg = userFacingUploadError(err.technical);
          errors.push(`${file.name}: ${msg}`);
          patchUploadItem(uploadId, {
            status: "save_failed",
            phase: "failed",
            progress: 95,
            error: msg,
            technicalDetails: err.technical,
            pendingSave: { ...err.pendingSave, failedStep: err.step },
          });
        } else if (err instanceof UploadBinaryError) {
          const msg = userFacingUploadError(err.technical);
          errors.push(`${file.name}: ${msg}`);
          patchUploadItem(uploadId, {
            status: "error",
            phase: "failed",
            error: msg,
            technicalDetails: err.technical,
          });
        } else {
          const msg = err instanceof Error ? err.message : "Upload failed";
          errors.push(`${file.name}: ${msg}`);
          patchUploadItem(uploadId, { status: "error", phase: "failed", error: msg });
        }
      }
    }

    if (uploaded.length) {
      setMedia((prev) => dedupeMedia([...prev, ...uploaded]));
      if (mediaType === "photo") {
        setPendingNewPhotoIds((prev) => [...prev, ...uploaded.map((u) => u.id)]);
      }
      toast.success(`${uploaded.length} file(s) uploaded`);
      router.refresh();
    }
    if (errors.length) {
      if (!uploaded.length) toast.error(errors[0]);
      else toast.warning(errors.join("; "));
    }

    setTimeout(() => {
      setUploadItems((prev) => prev.filter((item) => item.status === "uploading" || item.status === "save_failed"));
    }, 8000);
    e.target.value = "";
  }

  async function handleRetrySave(uploadId: string) {
    const item = uploadItems.find((i) => i.id === uploadId);
    if (!item?.pendingSave) return;

    patchUploadItem(uploadId, { status: "uploading", phase: "saving", progress: 96, error: undefined });
    try {
      const retryPayload = {
        ...item.pendingSave,
        skipStorageVerify: item.pendingSave.failedStep === "storage_verify",
      };
      const { asset } = await retryMediaSave(retryPayload, ({ phase, progress }) => {
        patchUploadItem(uploadId, { phase, progress, status: "uploading" });
      });
      const saved = asset as unknown as MediaAsset;
      setMedia((prev) => dedupeMedia([...prev, saved]));
      patchUploadItem(uploadId, { progress: 100, phase: "uploaded", status: "success", pendingSave: undefined });
      toast.success(`${item.fileName} saved`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      const failedStep = err instanceof UploadSaveError ? err.step : item.pendingSave.failedStep;
      patchUploadItem(uploadId, {
        status: "save_failed",
        phase: "failed",
        error: msg,
        pendingSave: { ...item.pendingSave, failedStep },
      });
      toast.error(msg);
    }
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
    if (res.ok) {
      const pc = await res.json();
      setProjectClients((prev) => [...prev, { ...pc, clients: client }]);
      setAddClientId(client.id);
      toast.success("Client created and linked to project");
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

  async function deleteMedia(id: string) {
    if (!confirm("Delete this file?")) return;
    await fetch(`/api/media/${id}`, { method: "DELETE", credentials: "include" });
    setMedia((m) => m.filter((a) => a.id !== id));
    toast.success("Deleted");
    router.refresh();
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

  function isClientVisibleMedia(asset: MediaAsset) {
    return asset.visibility !== "admin";
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
      body: JSON.stringify({ id, ...editMediaForm }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMedia((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setEditingMedia(null);
      toast.success("Video updated");
    }
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
    if (res.ok) {
      toast.success("Client added to project");
      setAddClientId("");
      router.refresh();
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

  const isUploading = uploadItems.some((i) => i.status === "uploading");
  const displayName = form.project_name.trim() || defaultProjectName(form.property_address, form.service_type);

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
            <Button variant="accent" size="sm" onClick={saveProject} disabled={saving} className="hidden md:inline-flex">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Link href={portalUrl} target="_blank">
              <Button variant="outline" size="sm"><Eye className="h-4 w-4" /> Client Page</Button>
            </Link>
          </div>
        </div>
      </div>

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
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleUpload(e, "photo")} disabled={isUploading} />
          </label>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted">Max {formatFileSize(FILE_SIZE_LIMITS.photo)} per image</p>
          {photos.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No photos yet</p>
          ) : (
            <AdminPhotoGrid
              photos={photos}
              isHero={isHero}
              onSetHero={setHeroMedia}
              onDelete={deleteMedia}
              onToggleVisibility={toggleMediaVisibility}
              onReorder={(reordered) => setMedia((prev) => {
                const others = prev.filter((m) => m.media_type !== "photo");
                return [...others, ...reordered];
              })}
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
              <input type="file" multiple accept={ALLOWED_VIDEO_MIME_TYPES.join(",")} className="hidden" onChange={(e) => handleUpload(e, "video")} disabled={isUploading} />
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
                  <iframe src={v.embed_url} className="h-full w-full" title={v.file_name} allowFullScreen />
                </div>
              )}
              {v.media_source !== "youtube" && <AdminVideoThumb asset={v} />}
              {editingMedia === v.id ? (
                <div className="space-y-2 p-3 border-t border-border">
                  <Input value={editMediaForm.file_name} onChange={(e) => setEditMediaForm({ ...editMediaForm, file_name: e.target.value })} placeholder="Title" />
                  {v.media_source === "youtube" && (
                    <Input value={editMediaForm.youtube_url} onChange={(e) => setEditMediaForm({ ...editMediaForm, youtube_url: e.target.value })} placeholder="YouTube URL" />
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="accent" onClick={() => saveMediaEdit(v.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingMedia(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <AssetRow name={v.file_name} badge={
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
                        setEditMediaForm({ file_name: v.file_name, youtube_url: v.youtube_url || "" });
                      }}><Pencil className="h-4 w-4" /></Button>
                    </div>
                  }
                  onDelete={() => deleteMedia(v.id)} />
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
            <AssetRow key={d.id} name={d.file_name}
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

      <Modal open={showShootCompleteModal} onClose={() => markShootComplete(false)} title="Shoot Complete?">
        <p className="text-sm text-muted mb-6">
          You uploaded new photos to this project. Is this project&apos;s shoot complete?
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" onClick={() => markShootComplete(true)}>
            Yes, mark shoot complete
          </Button>
          <Button variant="outline" onClick={() => markShootComplete(false)}>
            No, keep current status
          </Button>
        </div>
      </Modal>

      <CreateClientModal
        open={showCreateClient}
        onClose={() => setShowCreateClient(false)}
        onCreated={handleClientCreated}
      />

      {uploadItems.length > 0 && (
        <div className="fixed z-50 mx-auto max-w-md left-4 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] md:bottom-20">
          <UploadProgressList
            items={uploadItems}
            className="shadow-xl bg-white"
            onRetrySave={handleRetrySave}
          />
        </div>
      )}

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
}: {
  primaryClient: Client;
  primaryClientId: string;
  projectClients: { id: string; client_id: string; is_primary: boolean; clients?: Client }[];
  allClients: Pick<Client, "id" | "name" | "email" | "company">[];
  addClientId: string;
  onAddClientIdChange: (id: string) => void;
  onAddClient: () => void;
  onSetPrimary: (pcId: string, clientId: string) => void;
  onRemove: (pcId: string) => void;
  onCreateClient: () => void;
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
        {associated.length > 0 ? (
          <div className="space-y-2">
            {associated.map((pc) => {
              const client = pc.clients as Client | undefined;
              const displayName = client?.full_name || client?.name || "Client";
              const contact = client?.email || client?.phone;
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
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch(`/api/media/download/${asset.id}?thumb=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.url) setPosterUrl(d.url); });
  }, [asset.id]);

  async function play() {
    if (playing) return;
    const res = await fetch(`/api/media/download/${asset.id}`, { credentials: "include" });
    const d = await res.json();
    if (d.url) {
      setStreamUrl(d.url);
      setPlaying(true);
    }
  }

  if (playing && streamUrl) {
    return <video src={streamUrl} className="w-full max-h-40" controls playsInline poster={posterUrl ?? undefined} />;
  }

  return (
    <button
      type="button"
      onClick={play}
      className="relative flex w-full max-h-40 min-h-[5rem] items-center justify-center overflow-hidden rounded-lg bg-slate-900"
    >
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
      )}
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow">
        <Video className="ml-0.5 h-5 w-5 text-slate-900" />
      </div>
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
