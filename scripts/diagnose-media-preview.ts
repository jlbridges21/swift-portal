/**
 * Diagnose client media preview failure for a specific project.
 * Does not mutate data. Uses service role to mirror signing paths.
 *
 *   npx tsx scripts/diagnose-media-preview.ts
 */

import { createClient } from "@supabase/supabase-js";
import {
  signMediaThumbnailUrl,
  THUMB_SIGNED_TTL_SECONDS,
  TRANSFORM_MAX_SOURCE_BYTES,
} from "../src/lib/media-signed-thumbs";

const PROJECT_ID = "26e65643-74d1-4c34-b085-0711c6e4b97c";

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function headOrGet(url: string): Promise<{ status: number; contentType: string | null; bytes: number | null; errorBody?: string }> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type");
    let errorBody: string | undefined;
    if (!res.ok || (contentType && contentType.includes("json"))) {
      errorBody = buf.toString("utf8").slice(0, 500);
    }
    return {
      status: res.status,
      contentType,
      bytes: buf.length,
      errorBody,
    };
  } catch (e) {
    return {
      status: 0,
      contentType: null,
      bytes: null,
      errorBody: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("id, project_name, property_address, status, business_id, client_id")
    .eq("id", PROJECT_ID)
    .maybeSingle();
  if (pErr || !project) throw new Error(pErr?.message || "project not found");

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, status, payment_type, description")
    .eq("project_id", PROJECT_ID);

  const { data: assets, error: aErr } = await supabase
    .from("media_assets")
    .select(
      "id, file_path, thumbnail_url, media_type, media_source, mime_type, file_name, file_size, business_id, visibility, project_id"
    )
    .eq("project_id", PROJECT_ID)
    .order("created_at", { ascending: true });
  if (aErr) throw new Error(aErr.message);

  const list = assets ?? [];
  const photos = list.filter((a) => a.media_type === "photo");
  const bizId = project.business_id as string;

  const pathStats = {
    total: list.length,
    photos: photos.length,
    withThumb: photos.filter((a) => a.thumbnail_url).length,
    businessPrefixed: list.filter((a) =>
      String(a.file_path || "").startsWith(`${bizId}/`)
    ).length,
    legacyPath: list.filter(
      (a) => a.file_path && !String(a.file_path).startsWith(`${bizId}/`)
    ).length,
    over25mb: photos.filter((a) => (a.file_size ?? 0) > TRANSFORM_MAX_SOURCE_BYTES).length,
    nullSize: photos.filter((a) => a.file_size == null || a.file_size === 0).length,
  };

  console.log("=== PROJECT ===");
  console.log(JSON.stringify({ project, payments, pathStats }, null, 2));

  // Sample: first photo with thumb, first without, one large if any
  const samples: typeof photos = [];
  const withT = photos.find((a) => a.thumbnail_url);
  const withoutT = photos.find((a) => !a.thumbnail_url);
  const large = photos.find((a) => (a.file_size ?? 0) > TRANSFORM_MAX_SOURCE_BYTES);
  if (withT) samples.push(withT);
  if (withoutT && withoutT.id !== withT?.id) samples.push(withoutT);
  if (large && !samples.some((s) => s.id === large.id)) samples.push(large);
  if (!samples.length && photos[0]) samples.push(photos[0]);

  for (const asset of samples.slice(0, 3)) {
    console.log("\n=== SAMPLE ASSET ===");
    console.log({
      id: asset.id,
      file_name: asset.file_name,
      file_path: asset.file_path,
      thumbnail_url: asset.thumbnail_url,
      file_size: asset.file_size,
      over25mb: (asset.file_size ?? 0) > TRANSFORM_MAX_SOURCE_BYTES,
      pathShape: String(asset.file_path || "").startsWith(`${bizId}/`)
        ? "business-scoped"
        : "legacy",
    });

    // A) thumb path (signMediaThumbnailUrl) — what /api/media/thumbnails uses
    const thumbSigned = await signMediaThumbnailUrl(supabase, "project-media", asset);
    console.log("\n--- A) signMediaThumbnailUrl (batch thumbnails / ?thumb=1) ---");
    if (!thumbSigned) {
      console.log({ url: null, note: "signMediaThumbnailUrl returned null" });
    } else {
      console.log({ urlPrefix: thumbSigned.slice(0, 180) + "..." });
      const fetched = await headOrGet(thumbSigned);
      console.log({ fetch: fetched });
    }

    // B) preview=1 path — createSignedUrl with 1200 transform (download route forcePreview)
    console.log("\n--- B) createSignedUrl + transform 1200 (client ?preview=1) ---");
    const previewOpts = {
      transform: { width: 1200, height: 1200, resize: "contain" as const },
    };
    const { data: previewData, error: previewErr } = await supabase.storage
      .from("project-media")
      .createSignedUrl(asset.file_path, THUMB_SIGNED_TTL_SECONDS, previewOpts);
    console.log({
      signError: previewErr?.message ?? null,
      urlPrefix: previewData?.signedUrl
        ? previewData.signedUrl.slice(0, 180) + "..."
        : null,
    });
    if (previewData?.signedUrl) {
      const fetched = await headOrGet(previewData.signedUrl);
      console.log({ fetch: fetched });
    }

    // C) full original signed URL (admin unlocked / paid client)
    console.log("\n--- C) createSignedUrl NO transform (admin / paid) ---");
    const { data: fullData, error: fullErr } = await supabase.storage
      .from("project-media")
      .createSignedUrl(asset.file_path, THUMB_SIGNED_TTL_SECONDS);
    console.log({
      signError: fullErr?.message ?? null,
      urlPrefix: fullData?.signedUrl ? fullData.signedUrl.slice(0, 180) + "..." : null,
    });
    if (fullData?.signedUrl) {
      const fetched = await headOrGet(fullData.signedUrl);
      console.log({ fetch: fetched });
    }

    // D) if thumbnail_url set, sign that path alone
    if (asset.thumbnail_url) {
      console.log("\n--- D) createSignedUrl on thumbnail_url only ---");
      const { data: tData, error: tErr } = await supabase.storage
        .from("project-media")
        .createSignedUrl(asset.thumbnail_url, THUMB_SIGNED_TTL_SECONDS);
      console.log({
        signError: tErr?.message ?? null,
        urlPrefix: tData?.signedUrl ? tData.signedUrl.slice(0, 180) + "..." : null,
      });
      if (tData?.signedUrl) {
        const fetched = await headOrGet(tData.signedUrl);
        console.log({ fetch: fetched });
      }
    }
  }

  // Scope: other projects with outstanding vs paid
  console.log("\n=== SCOPE: other delivered projects ===");
  const { data: otherProjects } = await supabase
    .from("projects")
    .select("id, project_name, status, business_id")
    .eq("business_id", bizId)
    .in("status", ["delivered", "ready_for_review", "revisions", "complete", "completed"])
    .limit(30);

  for (const p of otherProjects ?? []) {
    const { data: pays } = await supabase
      .from("payments")
      .select("status, amount")
      .eq("project_id", p.id);
    const outstanding = (pays ?? []).filter(
      (x) => x.status === "pending" || x.status === "unpaid" || x.status === "due"
    );
    const { count } = await supabase
      .from("media_assets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", p.id)
      .eq("media_type", "photo");
    if ((count ?? 0) === 0) continue;
    console.log({
      id: p.id,
      name: p.project_name,
      status: p.status,
      photoCount: count,
      outstandingPayments: outstanding.length,
      paymentStatuses: (pays ?? []).map((x) => x.status),
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
