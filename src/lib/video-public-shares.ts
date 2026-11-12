/**
 * Public video sharing & embedding (migration v116, table video_public_shares).
 *
 * One row per video. A row grants anonymous playback of exactly ONE uploaded video
 * file — never the project, other media, the client, or any financial data — and is
 * independent of the project's own privacy and share settings.
 *
 * Playback: the watch/embed pages receive a short-lived signed Storage URL for the
 * single file (PLAYBACK_TTL_SECONDS). The browser streams it straight from Supabase's
 * CDN with native range requests (instant start, seeking, no full download, no Vercel
 * bandwidth). Every page load and every URL refresh re-validates the share, so turning
 * sharing off stops new playback immediately; an already-open player can keep the URL
 * it holds until it expires (at most PLAYBACK_TTL_SECONDS).
 *
 * Fail closed on every resolve: share disabled, wrong business host, business not active,
 * video deleted (CASCADE) or moved (trigger + snapshot check), project deleted, and for
 * client-enabled shares — client sharing turned off by the business, or the video hidden
 * from clients.
 *
 * All queries run through the tenant client, so a public id never resolves on another
 * business's portal.
 */
import { randomBytes } from "node:crypto";
import { getAppSettings } from "@/lib/app-settings";
import { logProjectActivity } from "@/lib/activity";
import { isClientVisibleMedia } from "@/lib/client-media";
import { resolveProjectDownloadAllowed } from "@/lib/deliverables";
import { resolveProjectRequireDelivered } from "@/lib/project-download-access";
import { normalizeStatus } from "@/lib/constants";
import { mediaDisplayName } from "@/lib/media-display-name";
import { logMediaEvent } from "@/lib/media-library";
import { clientMayAccessMediaSection, mediaSectionsFromProject } from "@/lib/project-media-sections";
import { resolveProjectAccess } from "@/lib/project-access";
import { buildPublicTenantUrlForBusiness } from "@/lib/project-link-access";
import { canAccessMediaAsset, isBusinessOperator, staffCan } from "@/lib/staff-access";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import type { TenantContext } from "@/lib/tenant";
import type { MediaVisibility, Profile } from "@/lib/types";
import {
  isWellFormedPublicVideoId,
  sanitizeEmbedOptions,
  type VideoEmbedOptions,
  type VideoPublicShareView,
  type VideoShareBlockedReason,
  type VideoShareStateResponse,
} from "@/lib/video-embed-options";

const BUCKET = "project-media";
/** Signed playback URL lifetime. Bounds how long a revoked share can keep playing in an open tab. */
export const PLAYBACK_TTL_SECONDS = 15 * 60;
/** Reuse a minted URL while at least this much lifetime remains (better browser/CDN cache reuse). */
const PLAYBACK_REUSE_MIN_REMAINING_MS = 10 * 60 * 1000;
const POSTER_TTL_SECONDS = 60 * 60;

const SHARE_COLUMNS =
  "id, business_id, media_asset_id, project_id, public_id, enabled, enabled_at, enabled_by, enabled_by_role, embed_settings, view_count, play_count, est_bytes, last_viewed_at";

const VIDEO_COLUMNS =
  "id, business_id, project_id, title, file_name, file_path, file_size, mime_type, media_type, media_source, thumbnail_url, width, height, duration_seconds, visibility";

type ShareRow = {
  id: string;
  business_id: string;
  media_asset_id: string;
  project_id: string | null;
  public_id: string;
  enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
  enabled_by_role: "business" | "client" | null;
  embed_settings: unknown;
  view_count: number;
  play_count: number;
  est_bytes: number;
  last_viewed_at: string | null;
};

export type ShareableVideo = {
  id: string;
  business_id: string;
  project_id: string | null;
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
  duration_seconds: number | null;
  visibility: string | null;
};

export class VideoShareError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export function isMissingVideoShareTable(message: string | undefined | null): boolean {
  return /video_public_share|does not exist|schema cache|42P01|PGRST205|Could not find the (table|function)/i.test(
    message ?? ""
  );
}

function isShareableVideo(asset: ShareableVideo | null): asset is ShareableVideo {
  return Boolean(asset && asset.media_type === "video" && asset.media_source !== "youtube" && asset.file_path);
}

function newPublicId(): string {
  // 128 bits, URL-safe, 22 chars.
  return randomBytes(16).toString("base64url");
}

export async function loadShareableVideo(businessId: string, mediaId: string): Promise<ShareableVideo | null> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db.from("media_assets").select(VIDEO_COLUMNS).eq("id", mediaId).maybeSingle();
  const asset = (data as ShareableVideo | null) ?? null;
  return isShareableVideo(asset) ? asset : null;
}

// ── Permissions ────────────────────────────────────────────────────────────

export type VideoShareActor = {
  profile: Profile;
  businessId: string;
  video: ShareableVideo;
  role: "business" | "client";
  canManage: boolean;
  blockedReason: VideoShareBlockedReason;
};

/**
 * Who may see / change public sharing for one video.
 *
 * Business side (owner admin, or staff who can access the video's project): may manage
 * when they hold the "anyone with the link" sharing permission (owners always do).
 *
 * Client side (the project's assigned client, or someone the project was shared with):
 * may always SEE an already-public link (it is public anyway). Only the project's
 * assigned client may turn sharing on/off, and only while the business allows client
 * video sharing and the project's downloads are unlocked (i.e. it is delivered).
 *
 * Returns null when the user may not see the video at all (callers answer 404).
 */
export async function resolveVideoShareActor(
  profile: Profile,
  tenant: TenantContext,
  mediaId: string
): Promise<VideoShareActor | null> {
  const businessId = tenant.businessId;
  const video = await loadShareableVideo(businessId, mediaId);
  if (!video || video.business_id !== businessId) return null;

  if (isBusinessOperator(profile)) {
    if (!(await canAccessMediaAsset(businessId, profile, video.project_id))) return null;
    const canManage = staffCan(profile, "sharing.anyone_with_link");
    return {
      profile,
      businessId,
      video,
      role: "business",
      canManage,
      blockedReason: canManage ? null : "no_permission",
    };
  }

  // Client side: must reach the video through its project, exactly like playback does.
  if (!video.project_id) return null;
  if (tenant.isSharedViewer && !(tenant.sharedProjectIds ?? []).includes(video.project_id)) return null;
  const access = await resolveProjectAccess(profile, video.project_id, { tenantBusinessId: businessId });
  if (!access.allowed) return null;
  if (!isClientVisibleMedia({ visibility: (video.visibility ?? undefined) as MediaVisibility | undefined })) return null;

  const db = await createTenantServiceClient(businessId);
  const { data: project } = await db
    .from("projects")
    .select(
      "status, client_section_photos, client_section_videos, client_section_tours, client_section_models, client_section_documents"
    )
    .eq("id", video.project_id)
    .maybeSingle();
  if (!project) return null;
  if (!clientMayAccessMediaSection(mediaSectionsFromProject(project), "video", false)) return null;

  const settings = await getAppSettings(businessId);
  let blockedReason: VideoShareBlockedReason = null;
  if (access.kind !== "assigned_client") blockedReason = "no_permission";
  else if (!settings.videoSharing.allowClientPublicSharing) blockedReason = "client_sharing_disabled";
  else if (
    !resolveProjectDownloadAllowed({
      projectStatus: normalizeStatus((project.status as string) ?? "new_request"),
      isAdmin: false,
      requireDeliveredForDownloads: await resolveProjectRequireDelivered(
        db,
        video.project_id,
        settings.payments.requireDeliveredForDownloads
      ),
    })
  ) {
    blockedReason = "not_delivered";
  }

  return { profile, businessId, video, role: "client", canManage: blockedReason === null, blockedReason };
}

// ── Owner/client-facing state ──────────────────────────────────────────────

async function loadShareRow(businessId: string, mediaId: string): Promise<{ row: ShareRow | null; available: boolean }> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("video_public_shares")
    .select(SHARE_COLUMNS)
    .eq("media_asset_id", mediaId)
    .maybeSingle();
  if (error) {
    if (isMissingVideoShareTable(error.message)) return { row: null, available: false };
    throw new VideoShareError("Couldn't load sharing. Please try again.", 500);
  }
  return { row: (data as ShareRow | null) ?? null, available: true };
}

export async function buildPublicVideoUrls(businessId: string, publicId: string) {
  const db = await createTenantServiceClient(businessId);
  const { data: biz } = await db.raw
    .from("businesses")
    .select("slug, custom_domain")
    .eq("id", businessId)
    .maybeSingle();
  const b = { slug: (biz?.slug as string) ?? "", custom_domain: (biz?.custom_domain as string | null) ?? null };
  const id = encodeURIComponent(publicId);
  const [watchUrl, embedBaseUrl] = await Promise.all([
    buildPublicTenantUrlForBusiness(businessId, b, `/v/${id}`),
    buildPublicTenantUrlForBusiness(businessId, b, `/embed/${id}`),
  ]);
  return { watchUrl, embedBaseUrl };
}

async function shareView(businessId: string, row: ShareRow): Promise<VideoPublicShareView> {
  const urls = await buildPublicVideoUrls(businessId, row.public_id);
  return {
    enabled: row.enabled,
    publicId: row.public_id,
    watchUrl: urls.watchUrl,
    embedBaseUrl: urls.embedBaseUrl,
    embedSettings: sanitizeEmbedOptions(row.embed_settings),
    enabledAt: row.enabled_at,
    enabledByRole: row.enabled_by_role,
    viewCount: Number(row.view_count) || 0,
    playCount: Number(row.play_count) || 0,
    estBytes: Number(row.est_bytes) || 0,
    lastViewedAt: row.last_viewed_at,
  };
}

export async function getVideoShareState(actor: VideoShareActor): Promise<VideoShareStateResponse> {
  const { row, available } = await loadShareRow(actor.businessId, actor.video.id);
  const settings = await getAppSettings(actor.businessId);
  let share = row ? await shareView(actor.businessId, row) : null;
  // Client-enabled shares stop playing while the business has client sharing off.
  if (share?.enabled && share.enabledByRole === "client" && !settings.videoSharing.allowClientPublicSharing) {
    share = { ...share, enabled: false };
  }
  // A client who can't manage sharing only learns the link when the video is public.
  if (share && !share.enabled && !actor.canManage) share = null;
  return {
    available,
    share,
    permissions: { canManage: actor.canManage, role: actor.role, blockedReason: actor.blockedReason },
    video: {
      title: mediaDisplayName(actor.video),
      width: actor.video.width,
      height: actor.video.height,
      durationSeconds: actor.video.duration_seconds,
    },
    businessName: settings.business.businessName.trim() || "your photographer",
  };
}

async function logShareEvent(
  actor: VideoShareActor,
  activityType: "video_public_share_enabled" | "video_public_share_disabled" | "video_public_share_reset",
  description: string,
  metadata: Record<string, unknown>
) {
  const { businessId, video, profile } = actor;
  await logMediaEvent({
    businessId,
    mediaAssetId: video.id,
    projectId: video.project_id,
    userId: profile.id,
    eventType: activityType,
    description,
    metadata: { ...metadata, by_role: actor.role },
  });
  if (video.project_id) {
    await logProjectActivity(activityType, description, {
      businessId,
      projectId: video.project_id,
      userId: profile.id,
      visibility: "admin",
      metadata: { media_asset_id: video.id, by_role: actor.role, ...metadata },
    });
  }
}

function requireManage(actor: VideoShareActor) {
  if (!actor.canManage) {
    const message =
      actor.blockedReason === "client_sharing_disabled"
        ? "Public sharing is managed by your photographer."
        : actor.blockedReason === "not_delivered"
          ? "Public sharing unlocks when this project is delivered."
          : "You don't have permission to change sharing for this video.";
    throw new VideoShareError(message, 403);
  }
}

export async function enableVideoShare(actor: VideoShareActor, embedSettings?: unknown): Promise<void> {
  requireManage(actor);
  const db = await createTenantServiceClient(actor.businessId);
  const { row, available } = await loadShareRow(actor.businessId, actor.video.id);
  if (!available) throw new VideoShareError("Public video sharing isn't set up yet. Please contact support.", 503);
  const now = new Date().toISOString();
  const patch = {
    enabled: true,
    enabled_at: now,
    enabled_by: actor.profile.id,
    enabled_by_role: actor.role,
    disabled_at: null,
    disabled_by: null,
    disabled_reason: null,
    project_id: actor.video.project_id,
    updated_at: now,
    ...(embedSettings !== undefined ? { embed_settings: sanitizeEmbedOptions(embedSettings) } : {}),
  };
  if (row) {
    // Already on. A business user re-enabling a client-enabled share takes it over, so it
    // keeps playing even if client sharing is later turned off.
    if (row.enabled && !(actor.role === "business" && row.enabled_by_role === "client")) return;
    const { error } = await db.from("video_public_shares").update(patch).eq("id", row.id);
    if (error) throw new VideoShareError("Couldn't turn on sharing. Please try again.", 500);
  } else {
    const { error } = await db.from("video_public_shares").insert({
      media_asset_id: actor.video.id,
      public_id: newPublicId(),
      ...patch,
    });
    if (error) {
      // Lost a race with another enable; the other request already created the row.
      if (error.code !== "23505") throw new VideoShareError("Couldn't turn on sharing. Please try again.", 500);
    }
  }
  await logShareEvent(
    actor,
    "video_public_share_enabled",
    `Made ${mediaDisplayName(actor.video)} public (anyone with the link can watch it)`,
    {}
  );
}

export async function disableVideoShare(actor: VideoShareActor): Promise<void> {
  requireManage(actor);
  const { row } = await loadShareRow(actor.businessId, actor.video.id);
  if (!row || !row.enabled) return;
  const db = await createTenantServiceClient(actor.businessId);
  const now = new Date().toISOString();
  const { error } = await db
    .from("video_public_shares")
    .update({
      enabled: false,
      disabled_at: now,
      disabled_by: actor.profile.id,
      disabled_reason: "turned_off",
      updated_at: now,
    })
    .eq("id", row.id);
  if (error) throw new VideoShareError("Couldn't turn off sharing. Please try again.", 500);
  forgetPlaybackUrl(row.id);
  await logShareEvent(
    actor,
    "video_public_share_disabled",
    `Turned off public sharing for ${mediaDisplayName(actor.video)}`,
    {}
  );
}

/** New public id: every link and embed published so far stops working. */
export async function resetVideoShareLink(actor: VideoShareActor): Promise<void> {
  requireManage(actor);
  const { row } = await loadShareRow(actor.businessId, actor.video.id);
  if (!row) throw new VideoShareError("This video isn't shared.", 404);
  const db = await createTenantServiceClient(actor.businessId);
  const { error } = await db
    .from("video_public_shares")
    .update({ public_id: newPublicId(), updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) throw new VideoShareError("Couldn't reset the link. Please try again.", 500);
  forgetPlaybackUrl(row.id);
  await logShareEvent(
    actor,
    "video_public_share_reset",
    `Reset the public link for ${mediaDisplayName(actor.video)}; old links and embeds no longer work`,
    {}
  );
}

export async function saveVideoEmbedSettings(actor: VideoShareActor, embedSettings: unknown): Promise<void> {
  requireManage(actor);
  const { row } = await loadShareRow(actor.businessId, actor.video.id);
  if (!row) return;
  const db = await createTenantServiceClient(actor.businessId);
  await db
    .from("video_public_shares")
    .update({ embed_settings: sanitizeEmbedOptions(embedSettings), updated_at: new Date().toISOString() })
    .eq("id", row.id);
}

/** Videos in a project that are publicly playable right now (badges). Empty before the migration. */
export async function getProjectPublicVideoIds(businessId: string, projectId: string): Promise<string[]> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from("video_public_shares")
    .select("media_asset_id, enabled_by_role")
    .eq("project_id", projectId)
    .eq("enabled", true);
  if (error) return [];
  const rows = (data as { media_asset_id: string; enabled_by_role: string | null }[] | null) ?? [];
  if (!rows.some((r) => r.enabled_by_role === "client")) return rows.map((r) => r.media_asset_id);
  const settings = await getAppSettings(businessId);
  return rows
    .filter((r) => r.enabled_by_role !== "client" || settings.videoSharing.allowClientPublicSharing)
    .map((r) => r.media_asset_id);
}

// ── Public resolution ──────────────────────────────────────────────────────

export type ResolvedPublicVideo = {
  shareId: string;
  businessId: string;
  publicId: string;
  video: ShareableVideo;
  title: string;
  embedSettings: VideoEmbedOptions;
};

/**
 * Resolve a public id for the business serving this request. Returns null for anything
 * that should not play — callers respond 404 / "unavailable" without detail.
 */
export async function resolvePublicVideo(publicId: string, hostBusinessId: string): Promise<ResolvedPublicVideo | null> {
  if (!hostBusinessId || !isWellFormedPublicVideoId(publicId)) return null;
  const db = await createTenantServiceClient(hostBusinessId);
  const { data, error } = await db
    .from("video_public_shares")
    .select(SHARE_COLUMNS)
    .eq("public_id", publicId)
    .maybeSingle();
  if (error) return null;
  const share = (data as ShareRow | null) ?? null;
  if (!share || !share.enabled || share.business_id !== hostBusinessId) return null;

  const { data: assetData } = await db
    .from("media_assets")
    .select(VIDEO_COLUMNS)
    .eq("id", share.media_asset_id)
    .maybeSingle();
  const video = (assetData as ShareableVideo | null) ?? null;
  if (!isShareableVideo(video)) return null;
  if ((video.project_id ?? null) !== (share.project_id ?? null)) return null;

  if (video.project_id) {
    const { data: project } = await db.from("projects").select("id, deleted_at").eq("id", video.project_id).maybeSingle();
    if (!project || project.deleted_at) return null;
  }

  // The business keeps the final say over client-enabled shares.
  if (share.enabled_by_role === "client") {
    const settings = await getAppSettings(hostBusinessId);
    if (!settings.videoSharing.allowClientPublicSharing) return null;
    if (!isClientVisibleMedia({ visibility: (video.visibility ?? undefined) as MediaVisibility | undefined })) return null;
  }

  return {
    shareId: share.id,
    businessId: hostBusinessId,
    publicId: share.public_id,
    video,
    title: mediaDisplayName(video),
    embedSettings: sanitizeEmbedOptions(share.embed_settings),
  };
}

// Signed playback URLs, reused briefly per share. Keyed by share id + path (share ids are
// globally unique UUIDs, so entries never cross businesses).
type CachedUrl = { url: string; expiresAt: number };
const playbackUrlCache = new Map<string, CachedUrl>();
const posterUrlCache = new Map<string, CachedUrl>();
const MAX_CACHED_URLS = 2000;

function cacheKey(shareId: string, path: string) {
  return `${shareId}:${path}`;
}

function forgetPlaybackUrl(shareId: string) {
  for (const key of playbackUrlCache.keys()) if (key.startsWith(`${shareId}:`)) playbackUrlCache.delete(key);
}

function prune(map: Map<string, CachedUrl>) {
  if (map.size < MAX_CACHED_URLS) return;
  const now = Date.now();
  for (const [k, v] of map) if (v.expiresAt - now < PLAYBACK_REUSE_MIN_REMAINING_MS) map.delete(k);
  if (map.size >= MAX_CACHED_URLS) map.clear();
}

async function signCached(
  map: Map<string, CachedUrl>,
  resolved: ResolvedPublicVideo,
  path: string,
  ttlSeconds: number
): Promise<CachedUrl | null> {
  const key = cacheKey(resolved.shareId, path);
  const hit = map.get(key);
  if (hit && hit.expiresAt - Date.now() >= PLAYBACK_REUSE_MIN_REMAINING_MS) return hit;
  const db = await createTenantServiceClient(resolved.businessId);
  const { data, error } = await db.raw.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) {
    console.error("[video-public-share] sign failed", { shareId: resolved.shareId, message: error?.message });
    return null;
  }
  prune(map);
  const entry = { url: data.signedUrl, expiresAt: Date.now() + ttlSeconds * 1000 };
  map.set(key, entry);
  return entry;
}

export type PublicVideoSource = {
  src: string;
  /** Epoch ms; the player refreshes before or when this passes. */
  expiresAt: number;
  poster: string | null;
  mimeType: string;
};

export async function getPublicVideoSource(resolved: ResolvedPublicVideo): Promise<PublicVideoSource | null> {
  const [src, poster] = await Promise.all([
    signCached(playbackUrlCache, resolved, resolved.video.file_path, PLAYBACK_TTL_SECONDS),
    resolved.video.thumbnail_url
      ? signCached(posterUrlCache, resolved, resolved.video.thumbnail_url, POSTER_TTL_SECONDS)
      : Promise.resolve(null),
  ]);
  if (!src) return null;
  return {
    src: src.url,
    expiresAt: src.expiresAt,
    poster: poster?.url ?? null,
    mimeType: resolved.video.mime_type || "video/mp4",
  };
}

export type PublicVideoActivity = "view" | "embed_view" | "play" | "bytes";

/** Best-effort analytics + egress metering. Never throws. */
export async function recordPublicVideoActivity(
  businessId: string,
  shareId: string,
  kind: PublicVideoActivity,
  bytes = 0
): Promise<void> {
  try {
    const db = await createTenantServiceClient(businessId);
    await db.raw.rpc("record_public_video_activity", {
      p_share_id: shareId,
      p_kind: kind,
      p_bytes: Math.max(0, Math.round(bytes)),
    });
  } catch {
    /* metering is best-effort */
  }
}

/**
 * Convert player-reported newly-buffered seconds into estimated bytes using the file's
 * average bitrate. Capped to one full file per report so a forged beacon can't inflate
 * a video's numbers by more than its own size.
 */
export function estimateBufferedBytes(video: Pick<ShareableVideo, "file_size" | "duration_seconds">, seconds: number, reportedDuration?: number): number {
  const size = Number(video.file_size) || 0;
  const duration = Number(video.duration_seconds) || (reportedDuration && reportedDuration > 0 ? reportedDuration : 0);
  if (size <= 0 || duration <= 0 || !Number.isFinite(seconds) || seconds <= 0) return 0;
  const capped = Math.min(seconds, duration);
  return Math.min(size, Math.round((capped / duration) * size));
}
