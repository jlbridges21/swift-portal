/**
 * Client photo favorites ("hearts") — per client, per photo, per project (migration v122).
 *
 * Separate from `media_assets.is_favorite`, which is the business's own Media Library star.
 * Server-only: reads/writes go through the tenant service client after the caller has been
 * authorized. Every reader degrades to "no favorites" until the table exists.
 */
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

export type ClientFavoriteRow = {
  media_asset_id: string;
  client_id: string;
  created_at: string;
};

/** Lightweight client info for the business view (who liked what). */
export type ClientFavoriteClient = { id: string; name: string };

export type ProjectClientFavorites = {
  /** False until migration v122 is applied — the UI hides the feature instead of erroring. */
  available: boolean;
  rows: ClientFavoriteRow[];
};

const TABLE = "client_photo_favorites";

export function isClientFavoritesTableMissing(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /client_photo_favorites/.test(error.message ?? "");
}

/** Every client's favorites on a project (business view). */
export async function listProjectClientFavorites(
  businessId: string,
  projectId: string
): Promise<ProjectClientFavorites> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from(TABLE)
    .select("media_asset_id, client_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) {
    if (!isClientFavoritesTableMissing(error)) console.warn("[client-favorites] list failed", error.message);
    return { available: !isClientFavoritesTableMissing(error), rows: [] };
  }
  return { available: true, rows: (data ?? []) as ClientFavoriteRow[] };
}

/** One client's favorite photo ids on a project (client portal). */
export async function listClientFavoriteIds(
  businessId: string,
  projectId: string,
  clientId: string
): Promise<{ available: boolean; ids: string[] }> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db
    .from(TABLE)
    .select("media_asset_id")
    .eq("project_id", projectId)
    .eq("client_id", clientId);
  if (error) {
    if (!isClientFavoritesTableMissing(error)) console.warn("[client-favorites] client list failed", error.message);
    return { available: !isClientFavoritesTableMissing(error), ids: [] };
  }
  return { available: true, ids: (data ?? []).map((r) => (r as { media_asset_id: string }).media_asset_id) };
}

/** Add or remove one client's like. Idempotent in both directions. */
export async function setClientFavorite(params: {
  businessId: string;
  projectId: string;
  clientId: string;
  userId: string;
  mediaAssetId: string;
  favorite: boolean;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = await createTenantServiceClient(params.businessId);
  if (params.favorite) {
    const { error } = await db.from(TABLE).upsert(
      {
        business_id: params.businessId,
        project_id: params.projectId,
        media_asset_id: params.mediaAssetId,
        client_id: params.clientId,
        user_id: params.userId,
      },
      { onConflict: "media_asset_id,client_id", ignoreDuplicates: true }
    );
    if (error) {
      return isClientFavoritesTableMissing(error)
        ? { ok: false, status: 503, error: "Favorites aren't available yet." }
        : { ok: false, status: 500, error: "Couldn't save your favorite." };
    }
    return { ok: true };
  }
  const { error } = await db
    .from(TABLE)
    .delete()
    .eq("media_asset_id", params.mediaAssetId)
    .eq("client_id", params.clientId);
  if (error) {
    return isClientFavoritesTableMissing(error)
      ? { ok: false, status: 503, error: "Favorites aren't available yet." }
      : { ok: false, status: 500, error: "Couldn't remove your favorite." };
  }
  return { ok: true };
}
