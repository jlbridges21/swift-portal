/**
 * Homepage hero media picked from the business's ShootPortal media (server only).
 * Only the exact photo/video saved as the hero is ever served publicly.
 */
import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import { parseImageSize, redirectTo, signMediaImage, signVideo } from "@/lib/marketing/media";
import type { EligibleMediaRow } from "@/lib/marketing/server";

const COLUMNS =
  "id, media_type, media_source, file_name, file_path, file_size, thumbnail_url, title, alt_text, width, height, youtube_url, embed_url, visibility, mime_type";

export async function loadBusinessMediaRow(db: TenantServiceClient, id: string): Promise<EligibleMediaRow | null> {
  const { data } = await db.from("media_assets").select(COLUMNS).eq("id", id).maybeSingle();
  const row = data as EligibleMediaRow | null;
  if (!row || (row.media_type !== "photo" && row.media_type !== "video")) return null;
  return row;
}

/** Redirect to a short-lived, size-capped signed URL (image / poster) or the video stream. */
export async function serveHeroMedia(businessId: string, id: string, request: Request, cache: "public" | "private"): Promise<Response> {
  const notFound = () => Response.json({ error: "Not found." }, { status: 404 });
  const db = await createTenantServiceClient(businessId);
  const row = await loadBusinessMediaRow(db, id);
  if (!row) return notFound();
  const url = new URL(request.url);
  if (url.searchParams.get("play") === "1") {
    const signed = await signVideo(db, row);
    return signed ? redirectTo(signed, "private") : notFound();
  }
  const signed = await signMediaImage(db, row, parseImageSize(url.searchParams.get("s")));
  return signed ? redirectTo(signed, cache) : notFound();
}
