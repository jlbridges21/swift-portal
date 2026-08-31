/**
 * Video poster thumbnail verification.
 * Usage: npx tsx scripts/verify-video-thumbnails.ts
 *
 * Requires dev server for HTTP probes: npm run dev
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chooseVideoPosterSeekSeconds } from "../src/lib/upload/video-thumbnail";
import { buildThumbnailStoragePath } from "../src/lib/media-upload";
import { signMediaThumbnailUrl } from "../src/lib/media-signed-thumbs";
import { pickDownloadableAssets } from "../src/lib/project-zip-download";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const JOY_PROJECT = "26e65643-74d1-4c34-b085-0711c6e4b97c";
const OTHER_PROJECT = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";
const SWIFT_SLUG = "swift-aerial-media";

function loadEnvLocal() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function section(title: string) {
  console.log(`\n${"=".repeat(72)}\n${title}\n${"=".repeat(72)}`);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log("OK:", msg);
}

function tenantBase() {
  const host = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  return `${host}/b/${SWIFT_SLUG}`;
}

async function sessionCookie(admin: SupabaseClient, email: string): Promise<string> {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const hashed = linkData.properties?.hashed_token;
  if (!hashed) throw new Error(`no hashed_token for ${email}`);

  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: verified, error: vErr } = await userClient.auth.verifyOtp({
    token_hash: hashed,
    type: "email",
  });
  if (vErr || !verified.session) throw vErr ?? new Error("no session");

  const projectRef = new URL(url).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      expires_at: verified.session.expires_at,
      expires_in: verified.session.expires_in,
      token_type: verified.session.token_type,
      user: verified.user,
    })
  )}`;
}

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const base = tenantBase();

  section("Frame seek rule");
  console.log("5s clip primary:", chooseVideoPosterSeekSeconds(5, "primary"), "fallback:", chooseVideoPosterSeekSeconds(5, "fallback"));
  console.log("30s clip primary:", chooseVideoPosterSeekSeconds(30, "primary"), "fallback:", chooseVideoPosterSeekSeconds(30, "fallback"));
  assert(chooseVideoPosterSeekSeconds(5, "primary") === 0.5, "short clip uses 10% seek");
  assert(chooseVideoPosterSeekSeconds(30, "primary") === 1, "long clip uses ~1s seek");

  section("Storage path tenant prefix");
  const samplePath = `${SWIFT}/${JOY_PROJECT}/1234-test-video.mp4`;
  const thumbPath = buildThumbnailStoragePath(samplePath, "webp");
  console.log("thumb path:", thumbPath);
  assert(thumbPath.startsWith(`${SWIFT}/`), "thumbnail path is tenant-prefixed");
  assert(thumbPath.endsWith("-thumb.webp"), "sibling -thumb key");

  section("signMediaThumbnailUrl — video with stored thumb");
  const fakeThumb = `${SWIFT}/${JOY_PROJECT}/fake-thumb.webp`;
  const signed = await signMediaThumbnailUrl(admin, "project-media", {
    id: "00000000-0000-0000-0000-000000000099",
    file_path: samplePath,
    thumbnail_url: fakeThumb,
    media_type: "video",
    media_source: "upload",
    mime_type: "video/mp4",
    file_name: "test.mp4",
    file_size: 1000,
    business_id: SWIFT,
  });
  console.log("signed (null if object missing in storage):", signed ? signed.slice(0, 80) + "…" : null);
  const signedSrc = readFileSync(resolve("src/lib/media-signed-thumbs.ts"), "utf8");
  assert(
    !signedSrc.includes('media_type === "video" || asset.media_type === "document"'),
    "video no longer excluded before thumbnail_url signing"
  );

  const photoOnlyTransform = await signMediaThumbnailUrl(admin, "project-media", {
    id: "00000000-0000-0000-0000-000000000098",
    file_path: samplePath,
    thumbnail_url: null,
    media_type: "video",
    media_source: "upload",
    mime_type: "video/mp4",
    file_name: "test.mp4",
    file_size: 1000,
    business_id: SWIFT,
  });
  assert(photoOnlyTransform === null, "video without stored thumb does not use transform fallback");

  section("ZIP — thumbnails not included");
  const zipAssets = pickDownloadableAssets(
    [
      {
        id: "a",
        file_path: samplePath,
        file_name: "v.mp4",
        media_type: "video",
        display_order: 0,
        thumbnail_url: thumbPath,
        media_source: "upload",
      } as never,
    ],
    true
  );
  assert(zipAssets.length === 1 && zipAssets[0].file_path === samplePath, "ZIP uses original file_path only");
  assert(!JSON.stringify(zipAssets).includes("-thumb"), "ZIP payload excludes thumb keys");

  section("Existing video without thumbnail — API returns null, not error");
  const { data: legacyVideo } = await admin
    .from("media_assets")
    .select("id, thumbnail_url, media_type, media_source")
    .eq("project_id", JOY_PROJECT)
    .eq("media_type", "video")
    .neq("media_source", "youtube")
    .is("thumbnail_url", null)
    .limit(1)
    .maybeSingle();

  const { data: adminProfile } = await admin.from("profiles").select("email").eq("role", "admin").limit(1).single();
  const adminCookie = await sessionCookie(admin, adminProfile!.email!);

  if (legacyVideo?.id) {
    const legacyRes = await fetch(`${base}/api/media/download/${legacyVideo.id}?thumb=1`, {
      headers: { Cookie: adminCookie },
    });
    const legacyJson = await legacyRes.json();
    console.log("Legacy video thumb response:", legacyRes.status, legacyJson);
    assert(legacyRes.status === 200 && legacyJson.url === null, "legacy video without thumb returns url:null");
  } else {
    console.log("(no legacy video without thumbnail in Joy project — skip)");
  }

  section("Cross-project thumb denial");
  const { data: otherVideo } = await admin
    .from("media_assets")
    .select("id, project_id, thumbnail_url")
    .eq("project_id", OTHER_PROJECT)
    .eq("media_type", "video")
    .not("thumbnail_url", "is", null)
    .limit(1)
    .maybeSingle();

  const { data: joyClient } = await admin
    .from("projects")
    .select("clients(email)")
    .eq("id", JOY_PROJECT)
    .single();
  const clientEmail = (joyClient?.clients as { email?: string } | null)?.email;
  if (clientEmail && otherVideo?.id) {
    const clientCookie = await sessionCookie(admin, clientEmail);
    const cross = await fetch(`${base}/api/media/download/${otherVideo.id}?thumb=1`, {
      headers: { Cookie: clientCookie },
    });
    const crossText = await cross.text();
    console.log("Client cross-project thumb:", cross.status, crossText.slice(0, 120));
    assert(cross.status === 403 || cross.status === 404, "client cannot fetch other project video thumb");
  } else {
    console.log("(skip cross-project — missing client or video with thumb on other project)");
  }

  section("Video with stored thumbnail row (if any)");
  const { data: withThumb } = await admin
    .from("media_assets")
    .select("id, file_path, thumbnail_url, media_type, business_id, mime_type, file_name, file_size")
    .eq("project_id", JOY_PROJECT)
    .eq("media_type", "video")
    .not("thumbnail_url", "is", null)
    .limit(1)
    .maybeSingle();

  if (withThumb) {
    console.log("Sample row:", JSON.stringify(withThumb, null, 2));
    const thumbRes = await fetch(`${base}/api/media/download/${withThumb.id}?thumb=1`, {
      headers: { Cookie: adminCookie },
    });
    const thumbJson = await thumbRes.json();
    console.log("Thumb API:", thumbRes.status, thumbJson.url ? "url present" : thumbJson);
    assert(thumbRes.status === 200 && !!thumbJson.url, "stored video thumb returns signed URL");
    assert(String(withThumb.thumbnail_url).startsWith(`${SWIFT}/`), "DB thumbnail_url is tenant-prefixed");
  } else {
    console.log("No Joy project video with thumbnail_url yet — upload an MP4 in admin to populate.");
  }

  console.log("\nVideo thumbnail verification complete.");
  console.log("\nManual / browser checks still needed:");
  console.log("- Upload MP4 → poster generated (~400px long edge, WebP ~15–40KB typical)");
  console.log("- HEVC/MOV decode failure → upload succeeds, placeholder shown");
  console.log("- Admin grid + client gallery + version pills show posters");
  console.log("- YouTube links use img.youtube.com poster until play");
  console.log("- Existing videos without thumbnails keep placeholder");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
