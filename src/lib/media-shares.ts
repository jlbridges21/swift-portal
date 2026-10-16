/**
 * Single-photo sharing.
 *
 * A share authorizes exactly one photo. Two kinds:
 *   - email: one row per recipient, raw token emailed once and never returned
 *     to the inviter. No account or session is created.
 *   - link:  "anyone with the link"; the raw token is kept encrypted so the
 *     owner can copy it again. At most one active link per photo.
 *
 * Tokens are stored as SHA-256 hashes. Every request re-validates the row
 * against the live photo: revoked/expired shares, deleted photos (cascade),
 * photos moved to another folder or project (trigger + snapshot check) and
 * deleted projects all fail closed.
 *
 * Lookups always run through the tenant client for the request host's
 * business, so a token can never resolve on another business's portal.
 */
import { getAppSettings } from "@/lib/app-settings";
import { logProjectActivity } from "@/lib/activity";
import { sendBrandedEmail } from "@/lib/email";
import { logMediaEvent } from "@/lib/media-library";
import {
  isMediaShareExpiryPreset,
  type MediaInviteResult,
  type MediaLinkShareView,
  type MediaPersonShareView,
  type MediaShareExpiryPreset,
  type MediaShareState,
  type PhotoShareSummary,
} from "@/lib/media-share-types";
import { buildPublicTenantUrlForBusiness } from "@/lib/project-link-access";
import { generateRawShareAccessToken, hashShareAccessToken } from "@/lib/project-share-access";
import { resolveShareAccessWindow, validateShareAccessWindow } from "@/lib/project-share-expiry";
import { openWithPurpose, sealWithPurpose } from "@/lib/purpose-cipher";
import { isValidShareEmail, normalizeShareEmail } from "@/lib/share-email-parse";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

const LINK_CIPHER_PURPOSE = "sp-media-share-link";
const LINK_CIPHER_WHAT = "photo share links";
const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_INVITES_PER_REQUEST = 20;

const SHARE_COLUMNS =
  "id, business_id, media_asset_id, project_id, folder_id, kind, email, allow_download, access_mode, access_starts_at, access_expires_at, expiry_preset, created_at, notified_at, last_accessed_at, view_count, revoked_at, token_ciphertext";

type MediaShareRow = {
  id: string;
  business_id: string;
  media_asset_id: string;
  project_id: string | null;
  folder_id: string | null;
  kind: "email" | "link";
  email: string | null;
  allow_download: boolean;
  access_mode: "reusable";
  access_starts_at: string | null;
  access_expires_at: string | null;
  expiry_preset: MediaShareExpiryPreset;
  created_at: string;
  notified_at: string | null;
  last_accessed_at: string | null;
  view_count: number;
  revoked_at: string | null;
  token_ciphertext: string | null;
};

export type ShareablePhoto = {
  id: string;
  business_id: string;
  project_id: string | null;
  folder_id: string | null;
  title: string | null;
  file_name: string | null;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  media_type: string;
  media_source: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
};

const PHOTO_COLUMNS =
  "id, business_id, project_id, folder_id, title, file_name, file_path, file_size, mime_type, media_type, media_source, thumbnail_url, width, height";

export class MediaShareError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function isShareablePhoto(asset: ShareablePhoto | null): asset is ShareablePhoto {
  return Boolean(
    asset && asset.media_type === "photo" && asset.media_source !== "youtube" && asset.file_path
  );
}

/** Photo in this business that can be shared, or null. */
export async function loadShareablePhoto(
  businessId: string,
  mediaId: string
): Promise<ShareablePhoto | null> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db.from("media_assets").select(PHOTO_COLUMNS).eq("id", mediaId).maybeSingle();
  const asset = (data as ShareablePhoto | null) ?? null;
  return isShareablePhoto(asset) ? asset : null;
}

function sealLinkToken(rawToken: string): string {
  return sealWithPurpose(LINK_CIPHER_PURPOSE, LINK_CIPHER_WHAT, Buffer.from(rawToken, "utf8"));
}

function openLinkToken(ciphertext: string): string | null {
  try {
    return openWithPurpose(LINK_CIPHER_PURPOSE, LINK_CIPHER_WHAT, ciphertext).toString("utf8");
  } catch {
    return null;
  }
}

export function buildMediaSharePath(rawToken: string): string {
  return `/photo/${encodeURIComponent(rawToken)}`;
}

export async function buildMediaShareUrl(businessId: string, rawToken: string): Promise<string> {
  const db = await createTenantServiceClient(businessId);
  const { data: biz } = await db.raw
    .from("businesses")
    .select("slug, custom_domain")
    .eq("id", businessId)
    .maybeSingle();
  return buildPublicTenantUrlForBusiness(
    businessId,
    { slug: (biz?.slug as string) ?? "", custom_domain: (biz?.custom_domain as string | null) ?? null },
    buildMediaSharePath(rawToken)
  );
}

function windowFor(preset: MediaShareExpiryPreset) {
  const fields = resolveShareAccessWindow(preset);
  return {
    access_mode: "reusable" as const,
    access_starts_at: fields.access_starts_at,
    access_expires_at: fields.access_expires_at,
    expiry_preset: preset,
  };
}

function isLive(row: MediaShareRow): boolean {
  return validateShareAccessWindow({ ...row, one_time_used_at: null }).ok;
}

async function activeSharesFor(businessId: string, mediaId: string): Promise<MediaShareRow[]> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("media_shares")
    .select(SHARE_COLUMNS)
    .eq("media_asset_id", mediaId)
    .is("revoked_at", null)
    .order("created_at", { ascending: true });
  return (data as MediaShareRow[] | null) ?? [];
}

async function logShareEvent(
  photo: ShareablePhoto,
  actorId: string | null,
  activityType: string,
  description: string,
  metadata: Record<string, unknown>
) {
  await logMediaEvent({
    businessId: photo.business_id,
    mediaAssetId: photo.id,
    projectId: photo.project_id,
    userId: actorId,
    eventType: activityType,
    description,
    metadata,
  });
  if (photo.project_id) {
    await logProjectActivity(activityType, description, {
      businessId: photo.business_id,
      projectId: photo.project_id,
      userId: actorId,
      visibility: "admin",
      metadata: { media_asset_id: photo.id, ...metadata },
    });
  }
}

function photoLabel(photo: ShareablePhoto): string {
  return photo.title?.trim() || photo.file_name?.trim() || "a photo";
}

// ── Owner-facing state ─────────────────────────────────────────────────────

export async function getMediaShareState(businessId: string, mediaId: string): Promise<MediaShareState> {
  const rows = (await activeSharesFor(businessId, mediaId)).filter(isLive);
  const linkRow = rows.find((r) => r.kind === "link") ?? null;
  let link: MediaLinkShareView | null = null;
  if (linkRow) {
    const raw = linkRow.token_ciphertext ? openLinkToken(linkRow.token_ciphertext) : null;
    link = {
      id: linkRow.id,
      allow_download: linkRow.allow_download,
      expiry_preset: linkRow.expiry_preset,
      access_expires_at: linkRow.access_expires_at,
      created_at: linkRow.created_at,
      last_accessed_at: linkRow.last_accessed_at,
      view_count: linkRow.view_count,
      url: raw ? await buildMediaShareUrl(businessId, raw) : null,
    };
  }
  const people: MediaPersonShareView[] = rows
    .filter((r) => r.kind === "email" && r.email)
    .map((r) => ({
      id: r.id,
      email: r.email as string,
      allow_download: r.allow_download,
      expiry_preset: r.expiry_preset,
      access_expires_at: r.access_expires_at,
      created_at: r.created_at,
      last_accessed_at: r.last_accessed_at,
      view_count: r.view_count,
      notified_at: r.notified_at,
    }));
  return { link, people };
}

/** Live share counts per photo in a project (grid badges). */
export async function getProjectPhotoShareSummary(
  businessId: string,
  projectId: string
): Promise<Record<string, PhotoShareSummary>> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("media_shares")
    .select("media_asset_id, kind, revoked_at, access_mode, access_starts_at, access_expires_at")
    .eq("project_id", projectId)
    .is("revoked_at", null);
  const summary: Record<string, PhotoShareSummary> = {};
  for (const row of (data as MediaShareRow[] | null) ?? []) {
    if (!isLive(row)) continue;
    const entry = (summary[row.media_asset_id] ??= { link: false, people: 0 });
    if (row.kind === "link") entry.link = true;
    else entry.people += 1;
  }
  return summary;
}

// ── People (email) ─────────────────────────────────────────────────────────

async function sendPhotoShareEmail(photo: ShareablePhoto, email: string, rawToken: string) {
  const settings = await getAppSettings(photo.business_id);
  const businessName = settings.business.businessName.trim() || "Your photographer";
  const url = await buildMediaShareUrl(photo.business_id, rawToken);
  return sendBrandedEmail({
    businessId: photo.business_id,
    to: email,
    subject: `${businessName} shared a photo with you`,
    title: "A photo was shared with you",
    body: `${businessName} shared a photo with you. This link was sent only to you — please don't forward it.`,
    ctaLabel: "View photo",
    ctaUrl: url,
    emailType: "photo_share_invite",
  });
}

export type CreateEmailShareResult = {
  result: MediaInviteResult;
  /** Raw token, for the email only. Never return this from an API route. */
  rawToken: string | null;
};

/**
 * Invite one recipient. `notify: false` skips the email (tests only) — the
 * caller then holds the only copy of the raw token.
 */
export async function createEmailShare(input: {
  photo: ShareablePhoto;
  email: string;
  allowDownload: boolean;
  expiryPreset: MediaShareExpiryPreset;
  actorId: string | null;
  notify: boolean;
}): Promise<CreateEmailShareResult> {
  const email = normalizeShareEmail(input.email);
  if (!isValidShareEmail(email)) {
    return { result: { email, status: "invalid", error: "Not a valid email address." }, rawToken: null };
  }

  const db = await createTenantServiceClient(input.photo.business_id);
  const existing = (await activeSharesFor(input.photo.business_id, input.photo.id)).find(
    (r) => r.kind === "email" && r.email === email
  );
  if (existing && isLive(existing)) {
    return { result: { email, status: "already_shared" }, rawToken: null };
  }
  if (existing) {
    await db
      .from("media_shares")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: "expired" })
      .eq("id", existing.id);
  }

  const rawToken = generateRawShareAccessToken();
  const { data: row, error } = await db
    .from("media_shares")
    .insert({
      media_asset_id: input.photo.id,
      project_id: input.photo.project_id,
      folder_id: input.photo.folder_id,
      kind: "email",
      email,
      access_token_hash: hashShareAccessToken(rawToken),
      allow_download: input.allowDownload,
      created_by: input.actorId,
      ...windowFor(input.expiryPreset),
    })
    .select("id")
    .single();
  if (error || !row) {
    if (error?.code === "23505") return { result: { email, status: "already_shared" }, rawToken: null };
    throw new MediaShareError("Could not share this photo. Please try again.", 500);
  }

  await logShareEvent(input.photo, input.actorId, "photo_shared", `Shared ${photoLabel(input.photo)} with ${email}`, {
    share_id: row.id,
    kind: "email",
    allow_download: input.allowDownload,
    expiry_preset: input.expiryPreset,
  });

  if (!input.notify) {
    return { result: { email, status: "invited" }, rawToken };
  }

  const sent = await sendPhotoShareEmail(input.photo, email, rawToken);
  if (!sent.sent) {
    return {
      result: { email, status: "notify_failed", error: sent.error ?? "The email could not be sent." },
      rawToken,
    };
  }
  await db.from("media_shares").update({ notified_at: new Date().toISOString() }).eq("id", row.id);
  return { result: { email, status: "invited" }, rawToken };
}

export async function invitePeopleToPhoto(input: {
  photo: ShareablePhoto;
  emails: string[];
  allowDownload: boolean;
  expiryPreset: MediaShareExpiryPreset;
  actorId: string | null;
}): Promise<MediaInviteResult[]> {
  const unique = [...new Set(input.emails.map(normalizeShareEmail).filter(Boolean))];
  if (unique.length === 0) throw new MediaShareError("Add at least one email address.", 400);
  if (unique.length > MAX_INVITES_PER_REQUEST) {
    throw new MediaShareError(`Invite up to ${MAX_INVITES_PER_REQUEST} people at a time.`, 400);
  }
  const results: MediaInviteResult[] = [];
  for (const email of unique) {
    const { result } = await createEmailShare({ ...input, email, notify: true });
    results.push(result);
  }
  return results;
}

/** Issue a fresh token for an email share and email it; the old link stops working. */
export async function resendEmailShare(input: {
  photo: ShareablePhoto;
  shareId: string;
  actorId: string | null;
}): Promise<MediaInviteResult> {
  const share = (await activeSharesFor(input.photo.business_id, input.photo.id)).find(
    (r) => r.id === input.shareId && r.kind === "email"
  );
  if (!share?.email || !isLive(share)) throw new MediaShareError("Share not found.", 404);

  const db = await createTenantServiceClient(input.photo.business_id);
  const rawToken = generateRawShareAccessToken();
  const { error } = await db
    .from("media_shares")
    .update({ access_token_hash: hashShareAccessToken(rawToken) })
    .eq("id", share.id)
    .is("revoked_at", null);
  if (error) throw new MediaShareError("Could not resend the invite.", 500);

  const sent = await sendPhotoShareEmail(input.photo, share.email, rawToken);
  if (!sent.sent) {
    return { email: share.email, status: "notify_failed", error: sent.error ?? "The email could not be sent." };
  }
  await db.from("media_shares").update({ notified_at: new Date().toISOString() }).eq("id", share.id);
  await logShareEvent(input.photo, input.actorId, "photo_share_updated", `Resent photo invite to ${share.email}`, {
    share_id: share.id,
    action: "resend",
  });
  return { email: share.email, status: "invited" };
}

// ── Anyone with the link ───────────────────────────────────────────────────

export async function enablePhotoLink(input: {
  photo: ShareablePhoto;
  allowDownload: boolean;
  expiryPreset: MediaShareExpiryPreset;
  actorId: string | null;
  /** Revoke the current link first and issue a new URL. */
  rotate?: boolean;
}): Promise<{ rawToken: string | null }> {
  const db = await createTenantServiceClient(input.photo.business_id);
  const current = (await activeSharesFor(input.photo.business_id, input.photo.id)).find(
    (r) => r.kind === "link"
  );
  if (current && isLive(current) && !input.rotate) return { rawToken: null };
  if (current) {
    await db
      .from("media_shares")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: input.actorId,
        revoked_reason: input.rotate ? "rotated" : "expired",
      })
      .eq("id", current.id);
  }

  const rawToken = generateRawShareAccessToken();
  const { data: row, error } = await db
    .from("media_shares")
    .insert({
      media_asset_id: input.photo.id,
      project_id: input.photo.project_id,
      folder_id: input.photo.folder_id,
      kind: "link",
      access_token_hash: hashShareAccessToken(rawToken),
      token_ciphertext: sealLinkToken(rawToken),
      allow_download: input.allowDownload,
      created_by: input.actorId,
      ...windowFor(input.expiryPreset),
    })
    .select("id")
    .single();
  if (error || !row) throw new MediaShareError("Could not create the link. Please try again.", 500);

  const rotated = Boolean(input.rotate && current);
  await logShareEvent(
    input.photo,
    input.actorId,
    rotated ? "photo_share_link_rotated" : "photo_share_link_enabled",
    rotated
      ? `Reset the share link for ${photoLabel(input.photo)}; the old link no longer works`
      : `Turned on "anyone with the link" for ${photoLabel(input.photo)}`,
    { share_id: row.id, kind: "link", allow_download: input.allowDownload, expiry_preset: input.expiryPreset }
  );
  return { rawToken };
}

// ── Updates and revocation ─────────────────────────────────────────────────

export async function updatePhotoShare(input: {
  photo: ShareablePhoto;
  shareId: string;
  allowDownload?: boolean;
  expiryPreset?: MediaShareExpiryPreset;
  actorId: string | null;
}): Promise<void> {
  const share = (await activeSharesFor(input.photo.business_id, input.photo.id)).find(
    (r) => r.id === input.shareId
  );
  if (!share) throw new MediaShareError("Share not found.", 404);

  const patch: Record<string, unknown> = {};
  if (typeof input.allowDownload === "boolean") patch.allow_download = input.allowDownload;
  if (input.expiryPreset) Object.assign(patch, windowFor(input.expiryPreset));
  if (Object.keys(patch).length === 0) return;

  const db = await createTenantServiceClient(input.photo.business_id);
  const { error } = await db.from("media_shares").update(patch).eq("id", share.id).is("revoked_at", null);
  if (error) throw new MediaShareError("Could not update sharing.", 500);

  const who = share.kind === "link" ? "the share link" : share.email;
  const changes = [
    typeof input.allowDownload === "boolean"
      ? input.allowDownload
        ? "can download the original"
        : "view only"
      : null,
    input.expiryPreset ? `expiry ${input.expiryPreset}` : null,
  ].filter(Boolean);
  await logShareEvent(
    input.photo,
    input.actorId,
    "photo_share_updated",
    `Updated sharing for ${photoLabel(input.photo)} (${who}): ${changes.join(", ")}`,
    { share_id: share.id, kind: share.kind, ...patch }
  );
}

export async function revokePhotoShare(input: {
  photo: ShareablePhoto;
  shareId: string;
  actorId: string | null;
}): Promise<void> {
  const share = (await activeSharesFor(input.photo.business_id, input.photo.id)).find(
    (r) => r.id === input.shareId
  );
  if (!share) throw new MediaShareError("Share not found.", 404);

  const db = await createTenantServiceClient(input.photo.business_id);
  const { error } = await db
    .from("media_shares")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: input.actorId,
      revoked_reason: share.kind === "link" ? "link_disabled" : "revoked",
    })
    .eq("id", share.id)
    .is("revoked_at", null);
  if (error) throw new MediaShareError("Could not stop sharing.", 500);

  await logShareEvent(
    input.photo,
    input.actorId,
    share.kind === "link" ? "photo_share_link_disabled" : "photo_share_revoked",
    share.kind === "link"
      ? `Turned off the share link for ${photoLabel(input.photo)}`
      : `Removed ${share.email}'s access to ${photoLabel(input.photo)}`,
    { share_id: share.id, kind: share.kind }
  );
}

// ── Public resolution ──────────────────────────────────────────────────────

export type ResolvedPhotoShare = {
  shareId: string;
  businessId: string;
  kind: "email" | "link";
  /** Recipient for email shares — for logging only, never sent to the browser. */
  email: string | null;
  allowDownload: boolean;
  photo: ShareablePhoto;
};

export function isWellFormedShareToken(token: string): boolean {
  return RAW_TOKEN_PATTERN.test(token);
}

/**
 * Resolve a raw token for the business serving this request. Returns null for
 * anything that should not grant access — callers respond 404 without detail.
 */
export async function resolvePhotoShareToken(
  rawToken: string,
  hostBusinessId: string
): Promise<ResolvedPhotoShare | null> {
  if (!hostBusinessId || !isWellFormedShareToken(rawToken)) return null;

  const db = await createTenantServiceClient(hostBusinessId);
  const { data } = await db
    .from("media_shares")
    .select(SHARE_COLUMNS)
    .eq("access_token_hash", hashShareAccessToken(rawToken))
    .maybeSingle();
  const share = (data as MediaShareRow | null) ?? null;
  if (!share || share.business_id !== hostBusinessId || !isLive(share)) return null;

  const { data: assetData } = await db
    .from("media_assets")
    .select(PHOTO_COLUMNS)
    .eq("id", share.media_asset_id)
    .maybeSingle();
  const photo = (assetData as ShareablePhoto | null) ?? null;
  if (!isShareablePhoto(photo)) return null;
  if ((photo.project_id ?? null) !== (share.project_id ?? null)) return null;
  if ((photo.folder_id ?? null) !== (share.folder_id ?? null)) return null;

  if (photo.project_id) {
    const { data: project } = await db
      .from("projects")
      .select("id, deleted_at")
      .eq("id", photo.project_id)
      .maybeSingle();
    if (!project || project.deleted_at) return null;
  }

  return {
    shareId: share.id,
    businessId: hostBusinessId,
    kind: share.kind,
    email: share.kind === "email" ? share.email : null,
    allowDownload: share.allow_download,
    photo,
  };
}

export async function recordPhotoShareView(businessId: string, shareId: string): Promise<void> {
  try {
    const db = await createTenantServiceClient(businessId);
    await db.raw.rpc("media_share_record_view", { p_share_id: shareId });
  } catch {
    /* view counts are best-effort */
  }
}

export function parseMediaShareExpiry(value: unknown): MediaShareExpiryPreset {
  return isMediaShareExpiryPreset(value) ? value : "indefinite";
}
