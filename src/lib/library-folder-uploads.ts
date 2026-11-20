/**
 * Guest uploads into a shared Media Library folder (v135 "Can upload").
 *
 * The share token is the only credential — no account, session or staff seat. Each file is a
 * two-step exchange, mirroring the signed-in uploader:
 *
 *   sign      Validate the file, pick a fresh object key under {businessId}/library/, mint a signed
 *             upload URL (the browser PUTs the bytes straight to storage) and seal an "upload
 *             ticket" binding (share, business, object key, file facts, expiry). The ticket is
 *             AES-GCM sealed, so a guest can't forge one for an object they didn't upload.
 *   complete  Re-resolve the share (revoked / expired / downgraded → refused), open the ticket,
 *             prove the object exists, create an unassigned media_assets row owned by the
 *             business, and add it to the folder with added_via_share_id for attribution.
 *
 * The ticket is what stops a guest from "completing" an existing object key (e.g. another
 * project's original) and so pulling it into a folder they can view.
 *
 * Uploads are photos and videos only. They land with project_id NULL and default visibility, so
 * they show in the folder's shared view and in the business's Media Library like any upload.
 */
import { logUploadStep } from "@/lib/upload/logger";
import { verifyStorageObject } from "@/lib/upload/storage-verify";
import { validateMediaFileBeforeUpload } from "@/lib/upload/validation";
import { ALLOWED_PHOTO_TYPES } from "@/lib/constants";
import { buildStoragePath, isTenantPrefixedStoragePath } from "@/lib/media-upload";
import type { ResolvedMediaShare } from "@/lib/media-shares";
import { sharedFolderTree } from "@/lib/library-folder-shares";
import { normalizeLibraryFolderName } from "@/lib/library-folder-types";
import { LibraryFolderError, createLibraryFolder } from "@/lib/library-folders";
import { notifyAdmins } from "@/lib/notifications";
import { openWithPurpose, sealWithPurpose } from "@/lib/purpose-cipher";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

const TICKET_PURPOSE = "sp-share-upload-ticket";
const TICKET_WHAT = "shared-folder upload tickets";
/** Long enough for a multi-GB video on a slow connection. */
const TICKET_TTL_MS = 24 * 60 * 60 * 1000;
const MEDIA_BUCKET = "project-media";

export type GuestUploadMediaType = "photo" | "video";

export class GuestUploadError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

type Ticket = {
  /** share id */
  s: string;
  /** business id */
  b: string;
  /** folder id */
  f: string;
  /** object key */
  p: string;
  t: GuestUploadMediaType;
  m: string;
  n: string;
  z: number;
  /** expires at (ms) */
  x: number;
};

function requireUploadShare(share: ResolvedMediaShare | null): asserts share is ResolvedMediaShare & {
  subject: { kind: "library_folder" };
} {
  if (!share || share.subject.kind !== "library_folder") throw new GuestUploadError("Not found.", 404);
  if (!share.allowUpload) throw new GuestUploadError("This link doesn't allow uploads.", 403);
}

/** The folder an upload lands in: the shared folder, or a folder beneath it. */
async function uploadTarget(share: ResolvedMediaShare, requested: unknown): Promise<string> {
  const tree = await sharedFolderTree(share);
  if (!tree) throw new GuestUploadError("Not found.", 404);
  if (requested == null || requested === "") return tree.rootId;
  if (typeof requested !== "string" || !tree.ids.includes(requested)) {
    throw new GuestUploadError("This folder isn't available anymore. Refresh the page.", 404);
  }
  return requested;
}

function sealTicket(t: Ticket): string {
  return sealWithPurpose(TICKET_PURPOSE, TICKET_WHAT, Buffer.from(JSON.stringify(t), "utf8"));
}

function openTicket(raw: unknown): Ticket | null {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  try {
    const t = JSON.parse(openWithPurpose(TICKET_PURPOSE, TICKET_WHAT, raw).toString("utf8")) as Ticket;
    return t && typeof t.p === "string" && typeof t.s === "string" ? t : null;
  } catch {
    return null;
  }
}

function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim();
  return (base || name).slice(0, 200);
}

export async function signGuestUpload(
  share: ResolvedMediaShare | null,
  input: { fileName?: unknown; mimeType?: unknown; fileSize?: unknown; mediaType?: unknown; folderId?: unknown }
): Promise<{ signedUrl: string; ticket: string; mimeType: string }> {
  requireUploadShare(share);
  const fileName = typeof input.fileName === "string" ? input.fileName.slice(0, 255) : "";
  const mimeType = typeof input.mimeType === "string" ? input.mimeType : "";
  const fileSize = typeof input.fileSize === "number" && Number.isFinite(input.fileSize) ? input.fileSize : -1;
  const mediaType = input.mediaType === "video" ? "video" : input.mediaType === "photo" ? "photo" : null;
  if (!fileName || !mediaType || fileSize <= 0) throw new GuestUploadError("Only photos and videos can be uploaded here.", 400);

  const validation = validateMediaFileBeforeUpload({ name: fileName, type: mimeType, size: fileSize } as File, mediaType);
  if (!validation.ok) throw new GuestUploadError(validation.error, 400);
  if (mediaType === "photo" && !ALLOWED_PHOTO_TYPES.includes(validation.mimeType)) {
    throw new GuestUploadError(`${fileName}: photos must be JPEG, PNG or WebP.`, 400);
  }

  // Upload into the shared folder, or a subfolder of it the guest is viewing (v136).
  const targetFolderId = await uploadTarget(share, input.folderId);
  const filePath = buildStoragePath({ businessId: share.businessId, projectId: null, fileName });
  const db = await createTenantServiceClient(share.businessId);
  const { data, error } = await db.raw.storage.from(MEDIA_BUCKET).createSignedUploadUrl(filePath);
  if (error || !data?.signedUrl) {
    console.error("[shared-upload/sign]", error?.message);
    throw new GuestUploadError("Couldn't prepare the upload. Please try again.", 502);
  }

  const ticket = sealTicket({
    s: share.shareId,
    b: share.businessId,
    f: targetFolderId,
    p: filePath,
    t: mediaType,
    m: validation.mimeType,
    n: fileName,
    z: fileSize,
    x: Date.now() + TICKET_TTL_MS,
  });
  return { signedUrl: data.signedUrl, ticket, mimeType: validation.mimeType };
}

async function ensureInFolder(
  db: Awaited<ReturnType<typeof createTenantServiceClient>>,
  folderId: string,
  assetId: string,
  shareId: string
) {
  const { data: existing } = await db
    .from("library_folder_items")
    .select("id")
    .eq("folder_id", folderId)
    .eq("media_asset_id", assetId)
    .maybeSingle();
  if (existing) return;
  const { error } = await db
    .from("library_folder_items")
    .insert({ folder_id: folderId, media_asset_id: assetId, added_by: null, added_via_share_id: shareId });
  if (error && error.code !== "23505") {
    console.error("[shared-upload/complete] folder insert", error.message);
    throw new GuestUploadError("Uploaded, but couldn't add it to the folder. Please try again.", 500);
  }
  await db.from("library_folders").update({ updated_at: new Date().toISOString() }).eq("id", folderId);
}

export async function completeGuestUpload(
  share: ResolvedMediaShare | null,
  input: { ticket?: unknown }
): Promise<{ id: string }> {
  requireUploadShare(share);
  const t = openTicket(input.ticket);
  if (
    !t ||
    t.s !== share.shareId ||
    t.b !== share.businessId ||
    t.x < Date.now() ||
    !isTenantPrefixedStoragePath(t.p, share.businessId)
  ) {
    throw new GuestUploadError("This upload expired. Please add the file again.", 400);
  }
  // Re-checked now: the subfolder may have been deleted or moved out since the file was signed.
  const folderId = await uploadTarget(share, t.f);

  const db = await createTenantServiceClient(share.businessId);
  const verify = await verifyStorageObject(db.raw, MEDIA_BUCKET, t.p, {
    projectId: null,
    fileName: t.n,
    fileSize: t.z,
    fileType: t.m,
    mediaType: t.t,
  });
  if (!verify.ok) throw new GuestUploadError("The file didn't finish uploading. Please try again.", 400);

  // Idempotent per object key: a retried save reuses the row it already made.
  const { data: existing } = await db.from("media_assets").select("id").eq("file_path", t.p).maybeSingle();
  let assetId = (existing?.id as string | undefined) ?? null;

  if (!assetId) {
    const { count } = await db.from("media_assets").select("id", { count: "exact", head: true }).is("project_id", null);
    const { data: asset, error } = await db
      .from("media_assets")
      .insert({
        project_id: null,
        file_name: t.n,
        file_path: t.p,
        storage_path: t.p,
        file_size: t.z,
        mime_type: t.m,
        media_type: t.t,
        media_source: "upload",
        display_order: count ?? 0,
        title: titleFromFileName(t.n),
        description: null,
        thumbnail_url: null,
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      const { data: raced } = await db.from("media_assets").select("id").eq("file_path", t.p).maybeSingle();
      assetId = (raced?.id as string | undefined) ?? null;
    } else if (error || !asset) {
      logUploadStep("error", { step: "database_insert", fileName: t.n, filePath: t.p, providerMessage: error?.message });
      throw new GuestUploadError("Couldn't save the upload. Please try again.", 500);
    } else {
      assetId = asset.id as string;
    }
  }
  if (!assetId) throw new GuestUploadError("Couldn't save the upload. Please try again.", 500);

  await ensureInFolder(db, folderId, assetId, share.shareId);
  logUploadStep("info", {
    step: "save_complete",
    fileName: t.n,
    filePath: t.p,
    details: { assetId, via: "shared_folder", shareId: share.shareId },
  });
  return { id: assetId };
}

/**
 * A guest with "Can upload" makes a folder inside the shared folder (or a subfolder of it they
 * are viewing). Same name rules as the portal; attributed to the share, never to a profile.
 * Guests can't rename, move or delete folders.
 */
export async function createGuestFolder(
  share: ResolvedMediaShare | null,
  input: { name?: unknown; folderId?: unknown }
): Promise<{ id: string; name: string }> {
  requireUploadShare(share);
  const parsed = normalizeLibraryFolderName(input.name);
  if ("error" in parsed) throw new GuestUploadError(parsed.error, 400);
  const parentId = await uploadTarget(share, input.folderId);
  try {
    const folder = await createLibraryFolder(share.businessId, parsed.name, null, parentId, share.shareId);
    return { id: folder.id, name: folder.name };
  } catch (err) {
    if (err instanceof LibraryFolderError) {
      throw new GuestUploadError(err.status === 503 ? "New folders can't be added here yet." : err.message, err.status === 503 ? 409 : err.status);
    }
    throw err;
  }
}

/** One in-app notice to the business per finished batch (the caller rate-limits). */
export async function notifyGuestUploads(
  share: ResolvedMediaShare | null,
  count: number,
  folderId?: unknown
): Promise<void> {
  requireUploadShare(share);
  const n = Math.max(1, Math.min(10_000, Math.floor(count)));
  let folder: { id: string; name: string } = share.subject.libraryFolder;
  if (typeof folderId === "string" && folderId !== folder.id) {
    const tree = await sharedFolderTree(share);
    const node = tree?.ids.includes(folderId) ? tree.nodes.find((x) => x.id === folderId) : undefined;
    if (node) folder = { id: node.id, name: node.name };
  }
  const who = share.email ?? "Someone with the folder link";
  try {
    await notifyAdmins({
      businessId: share.businessId,
      type: "deliverables_uploaded",
      title: `${n} new ${n === 1 ? "file" : "files"} in “${folder.name}”`,
      body: `${who} uploaded to your shared folder.`,
      link: `/admin/media/folders/${folder.id}`,
      sendEmail: false,
      sendPush: false,
    });
  } catch (err) {
    console.warn("[shared-upload] notify failed", err);
  }
}
