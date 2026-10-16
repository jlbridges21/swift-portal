/**
 * Single-photo sharing — security and behavior verification against a running
 * dev server. Uses ONLY the Jackson / 9560 CR-99 test project. Never sends
 * email (notify:false), and restores every row it touches.
 *
 * Usage: npm run test:photo-shares   (dev server on PENTEST_BASE_URL or :3000)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_SLUG = "swift-aerial-media";
const OTHER_SLUG = "vtx";
const JACKSON_PROJECT = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";
const JACKSON_FOLDER = "64da772d-f023-49e9-8fb0-dd03c17ecd92";
const TEST_EMAIL = "photo-share-verify@example.com";
const TEST_IP_PREFIX = "203.0.113.";

function loadEnvLocal() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

let failures = 0;
function check(cond: boolean, msg: string, detail?: string) {
  if (cond) console.log("  PASS", msg);
  else {
    failures += 1;
    console.log("  FAIL", msg, detail ? `\n       ${detail}` : "");
  }
}
function section(title: string) {
  console.log(`\n── ${title}`);
}

const ORIGIN = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const tenant = (slug: string) => `${ORIGIN}/b/${slug}`;
let ipCounter = 10;
const freshIp = () => `${TEST_IP_PREFIX}${ipCounter++}`;

type Probe = { status: number; headers: Headers; body: Buffer; text: string };
async function probe(url: string, ip: string, init?: RequestInit): Promise<Probe> {
  const res = await fetch(url, {
    redirect: "manual",
    ...init,
    headers: { "x-forwarded-for": ip, ...(init?.headers ?? {}) },
  });
  const body = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") ?? "";
  const text = type.includes("json") || type.includes("html") || type.includes("text") ? body.toString("utf8") : "";
  return { status: res.status, headers: res.headers, body, text };
}
const show = (p: Probe) => `${p.status} ${p.headers.get("content-type") ?? ""} ${p.text.slice(0, 140).replace(/\s+/g, " ")}`;

async function main() {
  loadEnvLocal();
  const admin: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const shares = await import("../src/lib/media-shares");

  const { data: photos } = await admin
    .from("media_assets")
    .select("id, file_path, folder_id, download_count, last_downloaded_at")
    .eq("business_id", SWIFT)
    .eq("project_id", JACKSON_PROJECT)
    .eq("media_type", "photo")
    .eq("folder_id", JACKSON_FOLDER)
    .order("display_order")
    .limit(2);
  if (!photos || photos.length < 2) throw new Error("Need two Jackson photos in the Perdido Bay folder");
  const [A, B] = photos;

  const { data: projectBefore } = await admin
    .from("projects")
    .select("project_name, link_access_mode, link_access_token, link_access_view_count, link_access_enabled_at")
    .eq("id", JACKSON_PROJECT)
    .single();
  if (!projectBefore) throw new Error("Jackson project missing");

  const createdShareIds: string[] = [];
  const createdFolderIds: string[] = [];
  const tempAssetIds: string[] = [];
  const tempStoragePaths: string[] = [];

  const photoA = await shares.loadShareablePhoto(SWIFT, A.id);
  const photoB = await shares.loadShareablePhoto(SWIFT, B.id);
  if (!photoA || !photoB) throw new Error("Jackson photos not shareable");

  async function liveShareId(mediaId: string, kind: "link" | "email") {
    const { data } = await admin
      .from("media_shares")
      .select("id")
      .eq("media_asset_id", mediaId)
      .eq("kind", kind)
      .is("revoked_at", null)
      .maybeSingle();
    if (data?.id && !createdShareIds.includes(data.id)) createdShareIds.push(data.id);
    return data?.id as string | undefined;
  }

  try {
    section("Setup — create a link share and an email share for photo A (no email sent)");
    const link = await shares.enablePhotoLink({
      photo: photoA,
      allowDownload: false,
      expiryPreset: "indefinite",
      actorId: null,
    });
    const L = link.rawToken!;
    const linkId = (await liveShareId(A.id, "link"))!;
    const email = await shares.createEmailShare({
      photo: photoA,
      email: TEST_EMAIL,
      allowDownload: false,
      expiryPreset: "1week",
      actorId: null,
      notify: false,
    });
    const E = email.rawToken!;
    const emailId = (await liveShareId(A.id, "email"))!;
    check(Boolean(L && E && linkId && emailId), "link + email shares created");

    const { data: rows } = await admin
      .from("media_shares")
      .select("id, access_token_hash, token_ciphertext, business_id, folder_id, project_id")
      .in("id", [linkId, emailId]);
    const linkRow = rows?.find((r) => r.id === linkId);
    const emailRow = rows?.find((r) => r.id === emailId);
    const sha = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");
    check(linkRow?.access_token_hash === sha(L), "link token stored only as SHA-256 hash");
    check(Boolean(linkRow?.token_ciphertext) && !String(linkRow?.token_ciphertext).includes(L), "link token ciphertext is encrypted, not plaintext");
    check(emailRow?.access_token_hash === sha(E) && emailRow?.token_ciphertext == null, "email token: hash only, no recoverable copy");
    check(linkRow?.business_id === SWIFT && linkRow?.folder_id === JACKSON_FOLDER && linkRow?.project_id === JACKSON_PROJECT, "share carries business_id + project/folder snapshot");
    check(L.length === 43 && E.length === 43, "tokens are 256-bit base64url (43 chars)");

    section("Anonymous viewer — link share");
    let ip = freshIp();
    const page = await probe(`${tenant(SWIFT_SLUG)}/photo/${L}`, ip);
    check(page.status === 200, "GET /photo/{link token} → 200", show(page));
    check(!page.text.includes(projectBefore.project_name) && !page.text.includes("Perdido Bay") && !page.text.includes(A.id), "page reveals no project name, folder, or asset id");
    check((page.headers.get("x-robots-tag") ?? "").includes("noindex"), "page sends X-Robots-Tag noindex");
    const pageCache = page.headers.get("cache-control") ?? "";
    check(
      pageCache.includes("no-store") || (pageCache.includes("no-cache") && pageCache.includes("must-revalidate")),
      `page is never reused from cache (${pageCache})`
    );
    check(page.text.includes('name="referrer" content="no-referrer"'), "page sets referrer no-referrer");

    const preview = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${L}?variant=preview`, ip);
    check(preview.status === 200 && (preview.headers.get("content-type") ?? "").startsWith("image/") && preview.body.length > 1000, "preview bytes stream (200 image/*)", show(preview));
    check(!preview.headers.get("location"), "preview is proxied — no redirect to a storage URL");
    check((preview.headers.get("cache-control") ?? "").includes("no-store"), "preview is no-store");
    const viewOnly = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${L}?variant=original`, ip);
    check(viewOnly.status === 403, "view-only share: original download → 403", show(viewOnly));

    const { data: counted } = await admin.from("media_shares").select("view_count, last_accessed_at").eq("id", linkId).single();
    check((counted?.view_count ?? 0) >= 1 && Boolean(counted?.last_accessed_at), "page view counted on the share");

    await shares.updatePhotoShare({ photo: photoA, shareId: linkId, allowDownload: true, actorId: null });
    const original = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${L}?variant=original&quality=print`, ip);
    check(original.status === 200 && (original.headers.get("content-disposition") ?? "").startsWith("attachment"), "download enabled: original → 200 attachment", show(original));
    check((original.headers.get("cache-control") ?? "").includes("no-store"), "original download is no-store");

    section("Anonymous viewer — email share (recipient token)");
    ip = freshIp();
    const ePage = await probe(`${tenant(SWIFT_SLUG)}/photo/${E}`, ip);
    check(ePage.status === 200, "GET /photo/{email token} → 200", show(ePage));
    check(!ePage.text.includes(TEST_EMAIL), "page does not echo the recipient email");
    const ePrev = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${E}?variant=preview`, ip);
    check(ePrev.status === 200, "email token preview → 200", show(ePrev));
    const eOrig = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${E}?variant=original`, ip);
    check(eOrig.status === 403, "email share is view-only by default → 403 on original", show(eOrig));

    section("View-only preview never serves an oversize original");
    const { TRANSFORM_MAX_SOURCE_BYTES } = await import("../src/lib/media-signed-thumbs");
    const { data: big } = await admin
      .from("media_assets")
      .select("id, file_size")
      .eq("business_id", SWIFT)
      .eq("project_id", JACKSON_PROJECT)
      .eq("media_type", "photo")
      .gt("file_size", TRANSFORM_MAX_SOURCE_BYTES)
      .order("file_size", { ascending: false })
      .limit(1)
      .maybeSingle();
    const bigPhoto = big ? await shares.loadShareablePhoto(SWIFT, big.id) : null;
    if (!big || !bigPhoto) {
      check(false, `needs a Jackson photo larger than ${TRANSFORM_MAX_SOURCE_BYTES} bytes`);
    } else {
      const bigLink = await shares.enablePhotoLink({ photo: bigPhoto, allowDownload: false, expiryPreset: "indefinite", actorId: null });
      await liveShareId(big.id, "link");
      const bigPrev = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${bigLink.rawToken}?variant=preview`, freshIp());
      const sharp = (await import("sharp")).default;
      const meta = bigPrev.status === 200 ? await sharp(bigPrev.body).metadata() : null;
      check(
        bigPrev.status === 200 && Math.max(meta?.width ?? Infinity, meta?.height ?? Infinity) <= 2048 && bigPrev.body.length < Number(big.file_size) / 4,
        `${Math.round(Number(big.file_size) / 1048576)}MB original → preview ${meta?.width}×${meta?.height}, ${bigPrev.body.length} bytes`,
        show(bigPrev)
      );
    }

    section("Negative — the token authorizes exactly one photo");
    ip = freshIp();
    const withOtherId = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${L}?variant=preview&id=${B.id}&media=${B.id}`, ip);
    check(withOtherId.status === 200 && withOtherId.body.equals(preview.body), "extra id params are ignored — still photo A's bytes");
    const otherPath = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${L}/${B.id}`, ip);
    check(otherPath.status === 404, "GET /api/public/photo/{token}/{otherPhotoId} → 404", show(otherPath));
    const projView = await probe(`${tenant(SWIFT_SLUG)}/view/${L}`, ip);
    check(projView.status === 404, "photo token on project page /view/{token} → 404", show(projView));
    const projThumbs = await probe(`${tenant(SWIFT_SLUG)}/api/public/link/${L}/media/thumbnails`, ip, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [A.id, B.id] }),
    });
    check(projThumbs.status === 404, "photo token on project thumbnails API → 404", show(projThumbs));
    const projZip = await probe(`${tenant(SWIFT_SLUG)}/api/public/link/${L}/projects/download-zip`, ip);
    check(projZip.status === 404, "photo token on project ZIP API → 404", show(projZip));
    const projMedia = await probe(`${tenant(SWIFT_SLUG)}/api/public/link/${L}/media/download/${B.id}`, ip);
    check(projMedia.status === 404, "photo token on project media download (photo B) → 404", show(projMedia));
    const libThumbs = await probe(`${ORIGIN}/api/media/thumbnails`, ip, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${L}` },
      body: JSON.stringify({ ids: [B.id] }),
    });
    check([401, 403, 404].includes(libThumbs.status), "media library thumbnails with token as bearer → denied", show(libThumbs));
    const libDownload = await probe(`${ORIGIN}/api/media/download/${B.id}?token=${L}`, ip);
    check([401, 403, 404].includes(libDownload.status), "media library download for photo B with token → denied", show(libDownload));
    const libShares = await probe(`${ORIGIN}/api/media/${A.id}/shares`, ip);
    check(libShares.status === 401, "owner share API without a session → 401", show(libShares));
    const projShares = await probe(`${ORIGIN}/api/projects/${JACKSON_PROJECT}/photo-shares`, ip);
    check(projShares.status === 401, "project share summary without a session → 401", show(projShares));

    section("Negative — another business / no tenant");
    ip = freshIp();
    const otherBizPage = await probe(`${tenant(OTHER_SLUG)}/photo/${L}`, ip);
    check(otherBizPage.status === 404, "Swift token on another business's portal (page) → 404", show(otherBizPage));
    const otherBizFile = await probe(`${tenant(OTHER_SLUG)}/api/public/photo/${L}?variant=preview`, ip);
    check(otherBizFile.status === 404, "Swift token on another business's portal (file) → 404", show(otherBizFile));
    const noTenant = await probe(`${ORIGIN}/api/public/photo/${L}?variant=preview`, ip);
    check(noTenant.status === 404, "no tenant host (platform origin) → 404", show(noTenant));

    const { data: foreign } = await admin
      .from("media_assets")
      .select("id, business_id, project_id")
      .neq("business_id", SWIFT)
      .eq("media_type", "photo")
      .limit(1)
      .maybeSingle();
    if (foreign) {
      check((await shares.loadShareablePhoto(SWIFT, foreign.id)) === null, "Swift tenant cannot load another business's photo for sharing");
      const { error: crossErr, data: crossRow } = await admin
        .from("media_shares")
        .insert({ business_id: SWIFT, media_asset_id: foreign.id, kind: "link", access_token_hash: sha(`x-${Date.now()}`), token_ciphertext: "v1.x.x.x" })
        .select("id")
        .maybeSingle();
      if (crossRow?.id) await admin.from("media_shares").delete().eq("id", crossRow.id);
      check(Boolean(crossErr), "DB trigger rejects a share whose photo belongs to another business", crossErr?.message);
    }

    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: anonRows, error: anonErr } = await anon.from("media_shares").select("id").limit(1);
    check(Boolean(anonErr) || (anonRows ?? []).length === 0, "anon key cannot read media_shares", anonErr?.message);
    const { data: bucket } = await admin.storage.getBucket("project-media");
    check(bucket?.public === false, "project-media bucket is private");

    section("Signed storage URLs are bound to one object");
    const { data: signedA } = await admin.storage.from("project-media").createSignedUrl(A.file_path, 60);
    const signed = new URL(signedA!.signedUrl);
    const swapped = new URL(signed.toString());
    swapped.pathname = signed.pathname.replace(encodeURI(A.file_path), encodeURI(B.file_path));
    const swappedRes = await fetch(swapped.toString());
    check(swappedRes.status >= 400, `photo A's signed URL token cannot fetch photo B (${swappedRes.status})`);
    const listRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/project-media`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        authorization: `Bearer ${signed.searchParams.get("token")}`,
      },
      body: JSON.stringify({ prefix: A.file_path.split("/").slice(0, 2).join("/") }),
    });
    const listBody = await listRes.text();
    check(listRes.status >= 400 || listBody.trim() === "[]", `signed URL token as bearer lists nothing (${listRes.status} ${listBody.slice(0, 40)})`);
    check(preview.headers.get("location") === null && !preview.text.includes("token="), "share responses never hand a signed URL to the browser");

    section("Revocation takes effect on the next request (page and file)");
    ip = freshIp();
    await shares.revokePhotoShare({ photo: photoA, shareId: linkId, actorId: null });
    const rPage = await probe(`${tenant(SWIFT_SLUG)}/photo/${L}`, ip);
    const rPrev = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${L}?variant=preview`, ip);
    const rOrig = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${L}?variant=original`, ip);
    check(rPage.status === 404, "revoked link: page → 404", show(rPage));
    check(rPrev.status === 404, "revoked link: preview file → 404", show(rPrev));
    check(rOrig.status === 404, "revoked link: original file → 404", show(rOrig));
    console.log("       pasted:", show(rPrev));

    await shares.revokePhotoShare({ photo: photoA, shareId: emailId, actorId: null });
    const reFile = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${E}?variant=preview`, ip);
    check(reFile.status === 404, "revoked email share: file → 404", show(reFile));

    section("Rotation kills the old link");
    const l1 = (await shares.enablePhotoLink({ photo: photoA, allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
    await liveShareId(A.id, "link");
    const l2 = (await shares.enablePhotoLink({ photo: photoA, allowDownload: false, expiryPreset: "indefinite", actorId: null, rotate: true })).rawToken!;
    const l2Id = (await liveShareId(A.id, "link"))!;
    ip = freshIp();
    check((await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${l1}?variant=preview`, ip)).status === 404, "old link after rotate → 404");
    check((await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${l2}?variant=preview`, ip)).status === 200, "new link after rotate → 200");

    section("Expired share fails closed");
    await admin.from("media_shares").update({ access_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", l2Id);
    const exp = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${l2}?variant=preview`, ip);
    check(exp.status === 404, "expired link → 404", show(exp));
    await admin.from("media_shares").update({ revoked_at: new Date().toISOString(), revoked_reason: "test" }).eq("id", l2Id);

    section("Moving the photo revokes its shares");
    const m = (await shares.enablePhotoLink({ photo: photoA, allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
    const mId = (await liveShareId(A.id, "link"))!;
    ip = freshIp();
    check((await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${m}?variant=preview`, ip)).status === 200, "share works before move");
    await admin.from("media_assets").update({ folder_id: null }).eq("id", A.id);
    const moved = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${m}?variant=preview`, ip);
    await admin.from("media_assets").update({ folder_id: JACKSON_FOLDER }).eq("id", A.id);
    const { data: movedRow } = await admin.from("media_shares").select("revoked_reason").eq("id", mId).single();
    check(moved.status === 404, "photo moved to General Photos → 404", show(moved));
    check(movedRow?.revoked_reason === "moved", "share row revoked with reason 'moved'");
    const back = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${m}?variant=preview`, ip);
    check(back.status === 404, "moving the photo back does not revive the share");

    section("Deleting the folder revokes shares of its photos");
    const { data: folder } = await admin
      .from("media_folders")
      .insert({ business_id: SWIFT, project_id: JACKSON_PROJECT, name: "__photo-share-verify", display_order: 999 })
      .select("id")
      .single();
    createdFolderIds.push(folder!.id);
    await admin.from("media_assets").update({ folder_id: folder!.id }).eq("id", B.id);
    const photoB2 = (await shares.loadShareablePhoto(SWIFT, B.id))!;
    const f = (await shares.enablePhotoLink({ photo: photoB2, allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
    await liveShareId(B.id, "link");
    check((await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${f}?variant=preview`, ip)).status === 200, "share works inside the folder");
    await admin.from("media_folders").delete().eq("id", folder!.id);
    const folderGone = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${f}?variant=preview`, ip);
    check(folderGone.status === 404, "folder deleted → 404", show(folderGone));
    await admin.from("media_assets").update({ folder_id: JACKSON_FOLDER }).eq("id", B.id);

    section("Deleting the photo fails closed (temporary hidden copy)");
    const tempPath = `${SWIFT}/${JACKSON_PROJECT}/__photo-share-verify-${Date.now()}.jpg`;
    const { error: copyErr } = await admin.storage.from("project-media").copy(A.file_path, tempPath);
    if (copyErr) throw new Error(`storage copy failed: ${copyErr.message}`);
    tempStoragePaths.push(tempPath);
    const { data: temp } = await admin
      .from("media_assets")
      .insert({
        business_id: SWIFT,
        project_id: JACKSON_PROJECT,
        folder_id: JACKSON_FOLDER,
        file_name: "__photo-share-verify.jpg",
        file_path: tempPath,
        file_size: photoA.file_size,
        mime_type: photoA.mime_type ?? "image/jpeg",
        media_type: "photo",
        media_source: "upload",
        visibility: "admin",
        display_order: 99999,
      })
      .select("id")
      .single();
    tempAssetIds.push(temp!.id);
    const tempPhoto = (await shares.loadShareablePhoto(SWIFT, temp!.id))!;
    const d = (await shares.enablePhotoLink({ photo: tempPhoto, allowDownload: true, expiryPreset: "indefinite", actorId: null })).rawToken!;
    const dId = (await liveShareId(temp!.id, "link"))!;
    check((await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${d}?variant=preview`, ip)).status === 200, "share of temp photo works (even though hidden from client)");
    await admin.from("media_assets").delete().eq("id", temp!.id);
    await admin.storage.from("project-media").remove([tempPath]);
    tempAssetIds.length = 0;
    tempStoragePaths.length = 0;
    const deleted = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${d}?variant=original`, ip);
    check(deleted.status === 404, "photo deleted → 404 (file)", show(deleted));
    const { data: cascade } = await admin.from("media_shares").select("id").eq("id", dId).maybeSingle();
    check(!cascade, "share row removed with the photo (ON DELETE CASCADE)");

    section("Failed-lookup limiter blocks token guessing per IP");
    const guessIp = freshIp();
    const g = (await shares.enablePhotoLink({ photo: photoA, allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
    await liveShareId(A.id, "link");
    for (let i = 0; i < 20; i++) {
      await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${"B".repeat(42)}${i % 10}?variant=preview`, guessIp);
    }
    const blocked = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${g}?variant=preview`, guessIp);
    check(blocked.status === 429, "after 20 misses the IP is blocked, even with a valid token → 429", show(blocked));
    const otherIp = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${g}?variant=preview`, freshIp());
    check(otherIp.status === 200, "other IPs are unaffected");

    section("Activity logging");
    const { data: logs } = await admin
      .from("activity_logs")
      .select("activity_type, visibility")
      .eq("project_id", JACKSON_PROJECT)
      .in("activity_type", ["photo_shared", "photo_share_link_enabled", "photo_share_link_disabled", "photo_share_revoked", "photo_share_link_rotated", "photo_share_updated"])
      .contains("metadata", { share_id: linkId });
    check((logs ?? []).length >= 2 && (logs ?? []).every((l) => l.visibility === "admin"), "share events logged on the project, admin-only");

    section("Historic bugs");
    const signSrc = readFileSync(resolve("src/app/api/media/upload/sign/route.ts"), "utf8");
    check(
      signSrc.indexOf("canAccessProject(") > 0 && signSrc.indexOf("canAccessProject(") < signSrc.indexOf("createSignedUploadUrl"),
      "upload sign route checks project access before minting a signed upload URL"
    );
    const signAnon = await probe(`${ORIGIN}/api/media/upload/sign`, freshIp(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: JACKSON_PROJECT, fileName: "x.jpg", mimeType: "image/jpeg", fileSize: 10, mediaType: "photo" }),
    });
    check(signAnon.status === 401 || signAnon.status === 403, "upload sign without a session → denied", show(signAnon));
    const viewerSrc = readFileSync(resolve("src/components/photos/photo-share-viewer.tsx"), "utf8");
    check(!viewerSrc.includes("/api/media/thumbnails") && !viewerSrc.includes("media-thumb-client"), "photo share viewer never calls the authenticated thumbnail API");
    const publicClient = readFileSync(resolve("src/components/projects/public-project-page-client.tsx"), "utf8");
    check(publicClient.includes("/api/public/link/"), "public project page uses the public-link thumbnail endpoint");
    const routeSrc = readFileSync(resolve("src/app/api/media/[id]/shares/route.ts"), "utf8");
    check(!routeSrc.includes("rawToken"), "owner share API never serializes an invite token");

    section("Project-level sharing unchanged");
    const pToken = projectBefore.link_access_token as string | null;
    if (pToken) {
      ip = freshIp();
      const restricted = await probe(`${tenant(SWIFT_SLUG)}/view/${pToken}`, ip);
      check(projectBefore.link_access_mode !== "anyone_with_link" ? restricted.status === 404 : restricted.status === 200, `project link in '${projectBefore.link_access_mode}' mode behaves as before (${restricted.status})`);
      await admin.from("projects").update({ link_access_mode: "anyone_with_link" }).eq("id", JACKSON_PROJECT);
      try {
        const open = await probe(`${tenant(SWIFT_SLUG)}/view/${pToken}`, ip);
        check(open.status === 200, "project link (temporarily on) → 200", show(open));
        const thumbs = await probe(`${tenant(SWIFT_SLUG)}/api/public/link/${pToken}/media/thumbnails`, ip, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: [A.id] }),
        });
        check(thumbs.status === 200 && thumbs.text.includes(A.id), "anonymous project thumbnails work without a session (historic bug)", show(thumbs));
        const photoTokenAsProject = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${pToken}?variant=preview`, ip);
        check(photoTokenAsProject.status === 404, "project link token is not a photo token → 404");
      } finally {
        await admin
          .from("projects")
          .update({
            link_access_mode: projectBefore.link_access_mode,
            link_access_view_count: projectBefore.link_access_view_count,
            link_access_enabled_at: projectBefore.link_access_enabled_at,
          })
          .eq("id", JACKSON_PROJECT);
      }
    } else {
      console.log("  SKIP project has no link token");
    }
  } finally {
    section("Cleanup");
    for (const id of tempAssetIds) await admin.from("media_assets").delete().eq("id", id);
    if (tempStoragePaths.length) await admin.storage.from("project-media").remove(tempStoragePaths);
    for (const id of createdFolderIds) await admin.from("media_folders").delete().eq("id", id);
    await admin.from("media_assets").update({ folder_id: JACKSON_FOLDER }).in("id", [A.id, B.id]);
    await admin
      .from("media_assets")
      .update({ download_count: A.download_count, last_downloaded_at: A.last_downloaded_at })
      .eq("id", A.id);
    const ids = [...new Set(createdShareIds)];
    if (ids.length) {
      for (const id of ids) {
        await admin.from("activity_logs").delete().eq("project_id", JACKSON_PROJECT).contains("metadata", { share_id: id });
        await admin.from("media_asset_events").delete().contains("metadata", { share_id: id });
      }
      await admin.from("media_shares").delete().in("id", ids);
    }
    await admin
      .from("media_downloads")
      .delete()
      .eq("business_id", SWIFT)
      .like("ip_address", `${TEST_IP_PREFIX}%`);
    const { data: after } = await admin
      .from("projects")
      .select("link_access_mode, link_access_view_count")
      .eq("id", JACKSON_PROJECT)
      .single();
    const { count: folderPhotos } = await admin
      .from("media_assets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", JACKSON_PROJECT)
      .eq("folder_id", JACKSON_FOLDER)
      .eq("media_type", "photo");
    console.log(
      `  restored: link mode=${after?.link_access_mode} views=${after?.link_access_view_count}; Perdido Bay photos=${folderPhotos}; removed ${ids.length} test shares`
    );
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll photo-share checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
