/**
 * Photo and folder sharing — security and behavior verification against a
 * running dev server. Uses ONLY the Jackson / 9560 CR-99 test project. Never
 * sends email (notify:false), and restores every row it touches.
 *
 * Usage: npm run test:photo-shares   (dev server on PENTEST_BASE_URL or :3000)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
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
// Random start so back-to-back runs don't inherit each other's per-IP limiter state.
let ipCounter = Math.floor(Math.random() * 250);
const freshIp = () => `${TEST_IP_PREFIX}${(ipCounter++ % 250) + 1}`;

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
/** Session cookie for an existing staff user (magic link minted and consumed server-side; no email sent). */
async function sessionCookie(admin: SupabaseClient, email: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr) throw linkErr;
  const hashed = linkData.properties?.hashed_token;
  if (!hashed) throw new Error("no hashed_token");
  const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: verified, error: vErr } = await userClient.auth.verifyOtp({ token_hash: hashed, type: "email" });
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
    const link = await shares.enableShareLink({ subject: shares.photoSubject(photoA),
      allowDownload: false,
      expiryPreset: "indefinite",
      actorId: null,
    });
    const L = link.rawToken!;
    const linkId = (await liveShareId(A.id, "link"))!;
    const email = await shares.createEmailShare({
      subject: shares.photoSubject(photoA),
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

    await shares.updateShare({ subject: shares.photoSubject(photoA), shareId: linkId, allowDownload: true, actorId: null });
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
      const bigLink = await shares.enableShareLink({ subject: shares.photoSubject(bigPhoto), allowDownload: false, expiryPreset: "indefinite", actorId: null });
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
    const otherPhotoParam = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${L}?variant=preview&photo=${B.id}`, ip);
    check(otherPhotoParam.status === 404, "photo token with photo={otherPhotoId} → 404", show(otherPhotoParam));
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
    await shares.revokeShare({ subject: shares.photoSubject(photoA), shareId: linkId, actorId: null });
    const rPage = await probe(`${tenant(SWIFT_SLUG)}/photo/${L}`, ip);
    const rPrev = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${L}?variant=preview`, ip);
    const rOrig = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${L}?variant=original`, ip);
    check(rPage.status === 404, "revoked link: page → 404", show(rPage));
    check(rPrev.status === 404, "revoked link: preview file → 404", show(rPrev));
    check(rOrig.status === 404, "revoked link: original file → 404", show(rOrig));
    console.log("       pasted:", show(rPrev));

    await shares.revokeShare({ subject: shares.photoSubject(photoA), shareId: emailId, actorId: null });
    const reFile = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${E}?variant=preview`, ip);
    check(reFile.status === 404, "revoked email share: file → 404", show(reFile));

    section("Rotation kills the old link");
    const l1 = (await shares.enableShareLink({ subject: shares.photoSubject(photoA), allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
    await liveShareId(A.id, "link");
    const l2 = (await shares.enableShareLink({ subject: shares.photoSubject(photoA), allowDownload: false, expiryPreset: "indefinite", actorId: null, rotate: true })).rawToken!;
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
    const m = (await shares.enableShareLink({ subject: shares.photoSubject(photoA), allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
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
    const f = (await shares.enableShareLink({ subject: shares.photoSubject(photoB2), allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
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
    const d = (await shares.enableShareLink({ subject: shares.photoSubject(tempPhoto), allowDownload: true, expiryPreset: "indefinite", actorId: null })).rawToken!;
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
    const g = (await shares.enableShareLink({ subject: shares.photoSubject(photoA), allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
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

    // ── Folder shares ──────────────────────────────────────────────────────
    const fpage = (t: string) => `${tenant(SWIFT_SLUG)}/folder/${t}`;
    const fimg = (t: string, photoId: string, variant: "thumb" | "preview" | "original" = "thumb") =>
      `${tenant(SWIFT_SLUG)}/api/public/photo/${t}?variant=${variant}&photo=${photoId}`;
    const isImage = (p: Probe) => p.status === 200 && (p.headers.get("content-type") ?? "").startsWith("image/") && p.body.length > 500;
    const newFolder = async (name: string, order: number) => {
      const { data, error } = await admin
        .from("media_folders")
        .insert({ business_id: SWIFT, project_id: JACKSON_PROJECT, name, display_order: order })
        .select("id")
        .single();
      if (error || !data) throw new Error(`folder insert failed: ${error?.message}`);
      createdFolderIds.push(data.id);
      return data.id as string;
    };
    const liveFolderShareId = async (folderId: string, kind: "link" | "email") => {
      const { data } = await admin
        .from("media_shares")
        .select("id")
        .eq("media_folder_id", folderId)
        .eq("kind", kind)
        .is("revoked_at", null)
        .maybeSingle();
      if (data?.id && !createdShareIds.includes(data.id)) createdShareIds.push(data.id);
      return data?.id as string | undefined;
    };
    const tempCopy = async (label: string, folderId: string | null, visibility: "client" | "admin") => {
      const path = `${SWIFT}/${JACKSON_PROJECT}/__folder-share-verify-${label}-${Date.now()}.jpg`;
      const { error } = await admin.storage.from("project-media").copy(A.file_path, path);
      if (error) throw new Error(`storage copy failed: ${error.message}`);
      tempStoragePaths.push(path);
      const { data, error: insErr } = await admin
        .from("media_assets")
        .insert({
          business_id: SWIFT,
          project_id: JACKSON_PROJECT,
          folder_id: folderId,
          file_name: `__folder-share-verify-${label}.jpg`,
          file_path: path,
          file_size: photoA.file_size,
          mime_type: photoA.mime_type ?? "image/jpeg",
          media_type: "photo",
          media_source: "upload",
          visibility,
          display_order: 99990,
        })
        .select("id")
        .single();
      if (insErr || !data) throw new Error(`temp asset insert failed: ${insErr?.message}`);
      tempAssetIds.push(data.id);
      return data.id as string;
    };
    const allVariants = async (t: string, photoId: string, probeIp: string) =>
      Promise.all((["thumb", "preview", "original"] as const).map((v) => probe(fimg(t, photoId, v), probeIp)));

    section("Folder share — setup on an EMPTY folder (no email sent)");
    const F1 = await newFolder("__folder-share-verify", 998);
    const F2 = await newFolder("__folder-share-verify-other", 997);
    let folder1 = (await shares.loadShareableFolder(SWIFT, F1))!;
    const FL = (await shares.enableShareLink({ subject: shares.folderSubject(folder1), allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
    const flId = (await liveFolderShareId(F1, "link"))!;
    const FE = (
      await shares.createEmailShare({ subject: shares.folderSubject(folder1), email: TEST_EMAIL, allowDownload: true, expiryPreset: "1week", actorId: null, notify: false })
    ).rawToken!;
    const feId = (await liveFolderShareId(F1, "email"))!;
    const { data: fRows } = await admin
      .from("media_shares")
      .select("id, access_token_hash, token_ciphertext, business_id, media_asset_id, media_folder_id, project_id, folder_id")
      .in("id", [flId, feId]);
    const flRow = fRows?.find((r) => r.id === flId);
    const feRow = fRows?.find((r) => r.id === feId);
    check(
      (fRows ?? []).length === 2 &&
        (fRows ?? []).every((r) => r.business_id === SWIFT && r.media_asset_id === null && r.media_folder_id === F1 && r.project_id === JACKSON_PROJECT),
      "folder shares: subject is the folder (no photo id), with business + project snapshot"
    );
    check(
      flRow?.access_token_hash === sha(FL) && !String(flRow?.token_ciphertext).includes(FL) && feRow?.access_token_hash === sha(FE) && feRow?.token_ciphertext == null,
      "folder tokens: SHA-256 hash only; link copy encrypted; email token unrecoverable"
    );
    ip = freshIp();
    const emptyPage = await probe(fpage(FL), ip);
    check(emptyPage.status === 200 && emptyPage.text.includes("No photos here yet"), "empty shared folder → 200 with empty state", show(emptyPage));
    check(
      !emptyPage.text.includes(projectBefore.project_name) && !emptyPage.text.includes(JACKSON_PROJECT) && !emptyPage.text.includes("Perdido Bay"),
      "folder page reveals no project name, project id, or other folder"
    );
    check((emptyPage.headers.get("x-robots-tag") ?? "").includes("noindex"), "folder page sends X-Robots-Tag noindex");
    check(emptyPage.text.includes('name="referrer" content="no-referrer"'), "folder page sets referrer no-referrer");
    const emptyCache = emptyPage.headers.get("cache-control") ?? "";
    check(emptyCache.includes("no-store") || (emptyCache.includes("no-cache") && emptyCache.includes("must-revalidate")), `folder page never reused from cache (${emptyCache})`);

    section("Folder share — photos added later are included at access time");
    const T1 = await tempCopy("upload", F1, "client");
    ip = freshIp();
    const afterUpload = await probe(fpage(FL), ip);
    check(afterUpload.status === 200 && afterUpload.text.includes(T1), "photo uploaded after sharing appears in the shared folder");
    check(!afterUpload.text.includes(`${SWIFT}/${JACKSON_PROJECT}/`), "folder page never exposes storage paths");
    const t1Thumb = await probe(fimg(FL, T1, "thumb"), ip);
    const t1Prev = await probe(fimg(FL, T1, "preview"), ip);
    check(isImage(t1Thumb) && isImage(t1Prev), "new photo: thumb + preview stream through the folder token", `${show(t1Thumb)} | ${show(t1Prev)}`);
    check((t1Thumb.headers.get("cache-control") ?? "").includes("no-store") && !t1Thumb.headers.get("location"), "folder image responses are proxied and no-store");
    const t1ViewOnly = await probe(fimg(FL, T1, "original"), ip);
    check(t1ViewOnly.status === 403, "view-only folder share: original download → 403", show(t1ViewOnly));
    console.log("       pasted:", show(t1ViewOnly));
    const t1Download = await probe(`${fimg(FE, T1, "original")}&quality=print`, ip);
    check(t1Download.status === 200 && (t1Download.headers.get("content-disposition") ?? "").startsWith("attachment"), "download folder share: original → 200 attachment", show(t1Download));
    await admin.from("media_assets").update({ folder_id: F1 }).eq("id", A.id);
    const withA = await probe(fpage(FE), ip);
    check(withA.text.includes(A.id) && isImage(await probe(fimg(FE, A.id), ip)), "photo moved INTO the folder is included on the next request");
    const hidden = await tempCopy("hidden", F1, "admin");
    const hiddenPage = await probe(fpage(FE), ip);
    const hiddenImg = await allVariants(FE, hidden, ip);
    check(!hiddenPage.text.includes(hidden) && hiddenImg.every((p) => p.status === 404), "photo hidden from the client is NOT exposed by a folder share (page + all variants 404)", hiddenImg.map(show).join(" | "));

    section("Folder share — never grants anything outside the folder");
    const otherFolderPhoto = await tempCopy("other-folder", F2, "client");
    const unfiled = await tempCopy("unfiled", null, "client");
    const { data: foreignPhoto } = await admin
      .from("media_assets")
      .select("id")
      .neq("business_id", SWIFT)
      .eq("media_type", "photo")
      .limit(1)
      .maybeSingle();
    ip = freshIp();
    const outsiders: [string, string][] = [
      [B.id, "photo in Perdido Bay (a different folder)"],
      [otherFolderPhoto, "photo in another folder"],
      [unfiled, "unfiled photo (General Photos)"],
      ...(foreignPhoto ? [[foreignPhoto.id, "another business's photo"] as [string, string]] : []),
    ];
    for (const [id, label] of outsiders) {
      const res = await allVariants(FE, id, ip);
      check(res.every((p) => p.status === 404), `download-enabled folder token → ${label}: thumb/preview/original all 404`, res.map(show).join(" | "));
      console.log(`       pasted (${label}):`, show(res[2]));
    }
    const pageNow = await probe(fpage(FE), ip);
    check(
      ![B.id, otherFolderPhoto, unfiled, "__folder-share-verify-other"].some((s) => pageNow.text.includes(s)),
      "folder page lists none of the outside photos or other folders"
    );
    const noPhotoParam = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${FE}?variant=preview`, ip);
    check(noPhotoParam.status === 404, "folder token without a photo id → 404", show(noPhotoParam));
    const badPhotoParam = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${FE}?variant=preview&photo=..%2F${B.id}`, ip);
    check(badPhotoParam.status === 404, "folder token with a malformed photo id → 404", show(badPhotoParam));
    const fAsPhoto = await probe(`${tenant(SWIFT_SLUG)}/photo/${FE}`, ip);
    check(fAsPhoto.status === 404, "folder token on /photo/{token} → 404", show(fAsPhoto));
    const fProjView = await probe(`${tenant(SWIFT_SLUG)}/view/${FE}`, ip);
    check(fProjView.status === 404, "folder token on project page /view/{token} → 404", show(fProjView));
    console.log("       pasted (project page):", show(fProjView));
    const fProjZip = await probe(`${tenant(SWIFT_SLUG)}/api/public/link/${FE}/projects/download-zip`, ip);
    check(fProjZip.status === 404, "folder token on project ZIP → 404", show(fProjZip));
    console.log("       pasted (project ZIP):", show(fProjZip));
    const fProjFolderZip = await probe(`${tenant(SWIFT_SLUG)}/api/public/link/${FE}/projects/download-zip?folder=${F1}`, ip);
    check(fProjFolderZip.status === 404, "folder token on project ZIP scoped to the shared folder → 404", show(fProjFolderZip));
    const fProjThumbs = await probe(`${tenant(SWIFT_SLUG)}/api/public/link/${FE}/media/thumbnails`, ip, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [T1, B.id, unfiled] }),
    });
    check(fProjThumbs.status === 404, "folder token on project thumbnails API → 404", show(fProjThumbs));
    const fProjMedia = await probe(`${tenant(SWIFT_SLUG)}/api/public/link/${FE}/media/download/${T1}`, ip);
    check(fProjMedia.status === 404, "folder token on project media download → 404", show(fProjMedia));
    const fLib = await probe(`${ORIGIN}/api/media/thumbnails`, ip, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${FE}` },
      body: JSON.stringify({ ids: [T1, B.id] }),
    });
    check([401, 403, 404].includes(fLib.status), "media library thumbnails with folder token as bearer → denied", show(fLib));
    console.log("       pasted (media library):", show(fLib));
    const fLibList = await probe(`${tenant(SWIFT_SLUG)}/api/media?project_id=${JACKSON_PROJECT}&token=${FE}`, ip);
    check([401, 403, 404].includes(fLibList.status), "media library list with folder token → denied", show(fLibList));
    const fLibDl = await probe(`${ORIGIN}/api/media/download/${T1}?token=${FE}`, ip);
    check([401, 403, 404].includes(fLibDl.status), "media library download with folder token → denied", show(fLibDl));
    const fOwner = await probe(`${ORIGIN}/api/media-folders/${F1}/shares`, ip);
    check(fOwner.status === 401, "owner folder share API without a session → 401", show(fOwner));
    const fFolders = await probe(`${tenant(SWIFT_SLUG)}/api/media-folders?project_id=${JACKSON_PROJECT}`, ip, { headers: { authorization: `Bearer ${FE}` } });
    check([401, 403, 404].includes(fFolders.status), "project folder list with folder token → denied", show(fFolders));

    section("Folder share — moving a photo OUT ends its access on the next request");
    await admin.from("media_assets").update({ folder_id: F2 }).eq("id", T1);
    ip = freshIp();
    const out = await allVariants(FE, T1, ip);
    check(out.every((p) => p.status === 404), "photo moved out: thumb/preview/original → 404", out.map(show).join(" | "));
    console.log("       pasted (moved out, thumb):   ", show(out[0]));
    console.log("       pasted (moved out, preview): ", show(out[1]));
    console.log("       pasted (moved out, original):", show(out[2]));
    const outPage = await probe(fpage(FE), ip);
    check(outPage.status === 200 && !outPage.text.includes(T1), "photo moved out no longer listed on the folder page");
    await admin.from("media_assets").update({ folder_id: F1 }).eq("id", T1);
    check(isImage(await probe(fimg(FE, T1), ip)), "moved back in → visible again (membership is evaluated live)");

    section("Folder share — rename keeps shares");
    await admin.from("media_folders").update({ name: "__folder-share-verify-renamed" }).eq("id", F1);
    const renamed = await probe(fpage(FE), ip);
    check(renamed.status === 200 && renamed.text.includes("__folder-share-verify-renamed") && isImage(await probe(fimg(FE, T1), ip)), "renamed folder: same token, new name, photos still served", show(renamed));
    folder1 = (await shares.loadShareableFolder(SWIFT, F1))!;

    section("Folder share — photo shared individually AND via its folder: access is the union");
    const photoAInF1 = (await shares.loadShareablePhoto(SWIFT, A.id))!;
    const PA = (await shares.enableShareLink({ subject: shares.photoSubject(photoAInF1), allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
    const paId = (await liveShareId(A.id, "link"))!;
    ip = freshIp();
    check(Boolean(PA && paId) && isImage(await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${PA}?variant=preview`, ip)), "photo A has its own working share inside the shared folder");
    const paOther = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${PA}?variant=thumb&photo=${T1}`, ip);
    check(paOther.status === 404, "photo token cannot reach other photos in the folder (photo=T1 → 404)", show(paOther));
    const paAsFolder = await probe(`${tenant(SWIFT_SLUG)}/folder/${PA}`, ip);
    check(paAsFolder.status === 404, "photo token on /folder/{token} → 404", show(paAsFolder));
    await shares.revokeShare({ subject: shares.folderSubject(folder1), shareId: flId, actorId: null });
    const aViaFolder = await probe(fimg(FL, A.id, "preview"), ip);
    const aViaPhoto = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${PA}?variant=preview`, ip);
    check(aViaFolder.status === 404 && isImage(aViaPhoto), "revoke FOLDER share → folder link 404, photo's own share still 200", `${show(aViaFolder)} | ${show(aViaPhoto)}`);
    await shares.revokeShare({ subject: shares.photoSubject(photoAInF1), shareId: paId, actorId: null });
    const aViaPhoto2 = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${PA}?variant=preview`, ip);
    const aViaFolderEmail = await probe(fimg(FE, A.id, "preview"), ip);
    check(aViaPhoto2.status === 404 && isImage(aViaFolderEmail), "revoke PHOTO share → photo link 404, folder (email) share still 200", `${show(aViaPhoto2)} | ${show(aViaFolderEmail)}`);

    section("Folder share — revoked: every photo inaccessible on the next request");
    ip = freshIp();
    const rfPage = await probe(fpage(FL), ip);
    const rfA = await allVariants(FL, A.id, ip);
    const rfT = await allVariants(FL, T1, ip);
    check(rfPage.status === 404, "revoked folder link: page → 404", show(rfPage));
    check([...rfA, ...rfT].every((p) => p.status === 404), "revoked folder link: thumb/preview/original for every photo → 404", [...rfA, ...rfT].map(show).join(" | "));
    console.log("       pasted (revoked, page):    ", show(rfPage));
    console.log("       pasted (revoked, original):", show(rfT[2]));

    section("Folder share — expired: every photo inaccessible on the next request");
    await admin.from("media_shares").update({ access_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", feId);
    ip = freshIp();
    const exPage = await probe(fpage(FE), ip);
    const exA = await allVariants(FE, A.id, ip);
    const exT = await allVariants(FE, T1, ip);
    check(exPage.status === 404 && [...exA, ...exT].every((p) => p.status === 404), "expired folder share: page + every photo variant → 404", [exPage, ...exA, ...exT].map(show).join(" | "));
    await admin.from("media_shares").update({ revoked_at: new Date().toISOString(), revoked_reason: "test" }).eq("id", feId);

    section("Folder share — rotation kills the old folder link");
    const r1 = (await shares.enableShareLink({ subject: shares.folderSubject(folder1), allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
    await liveFolderShareId(F1, "link");
    const r2 = (await shares.enableShareLink({ subject: shares.folderSubject(folder1), allowDownload: false, expiryPreset: "indefinite", actorId: null, rotate: true })).rawToken!;
    const r2Id = (await liveFolderShareId(F1, "link"))!;
    ip = freshIp();
    check((await probe(fimg(r1, T1), ip)).status === 404 && isImage(await probe(fimg(r2, T1), ip)), "old folder link after rotate → 404, new → 200");

    section("Folder share — deleting the folder fails closed; photos move to General Photos and lose access");
    const photoT1 = (await shares.loadShareablePhoto(SWIFT, T1))!;
    const PT = (await shares.enableShareLink({ subject: shares.photoSubject(photoT1), allowDownload: false, expiryPreset: "indefinite", actorId: null })).rawToken!;
    const ptId = (await liveShareId(T1, "link"))!;
    ip = freshIp();
    check(isImage(await probe(fimg(r2, A.id), ip)) && isImage(await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${PT}?variant=preview`, ip)), "before delete: folder link and T1's own share both work");
    const { error: delErr } = await admin.from("media_folders").delete().eq("id", F1);
    check(!delErr, "folder deleted", delErr?.message);
    const dPage = await probe(fpage(r2), ip);
    const dA = await allVariants(r2, A.id, ip);
    const dT = await allVariants(r2, T1, ip);
    check(dPage.status === 404 && [...dA, ...dT].every((p) => p.status === 404), "deleted folder: page + every former photo → 404", [dPage, ...dA, ...dT].map(show).join(" | "));
    console.log("       pasted (folder deleted, page):", show(dPage));
    const { data: dRow } = await admin.from("media_shares").select("revoked_at, revoked_reason, media_folder_id").eq("id", r2Id).single();
    check(Boolean(dRow?.revoked_at) && dRow?.revoked_reason === "folder_deleted" && dRow?.media_folder_id === null, "folder share row revoked with reason 'folder_deleted'", JSON.stringify(dRow));
    const { data: movedPhotos } = await admin.from("media_assets").select("id, folder_id").in("id", [A.id, T1]);
    check((movedPhotos ?? []).length === 2 && (movedPhotos ?? []).every((p) => p.folder_id === null), "the folder's photos moved to General Photos (not deleted)");
    const ptAfter = await probe(`${tenant(SWIFT_SLUG)}/api/public/photo/${PT}?variant=preview`, ip);
    const { data: ptRow } = await admin.from("media_shares").select("revoked_reason").eq("id", ptId).single();
    check(ptAfter.status === 404 && ptRow?.revoked_reason === "moved", "a photo's own share is also ended when its folder is deleted (existing 'moved' rule)", show(ptAfter));
    await admin.from("media_assets").update({ folder_id: JACKSON_FOLDER }).eq("id", A.id);

    section("Folder share — cross-tenant isolation");
    const folder2 = (await shares.loadShareableFolder(SWIFT, F2))!;
    const FX = (await shares.enableShareLink({ subject: shares.folderSubject(folder2), allowDownload: true, expiryPreset: "indefinite", actorId: null })).rawToken!;
    const fxId = (await liveFolderShareId(F2, "link"))!;
    ip = freshIp();
    check(isImage(await probe(fimg(FX, otherFolderPhoto), ip)), "control: Swift folder link on Swift host → 200");
    const xPage = await probe(`${tenant(OTHER_SLUG)}/folder/${FX}`, ip);
    const xFile = await probe(`${tenant(OTHER_SLUG)}/api/public/photo/${FX}?variant=original&photo=${otherFolderPhoto}`, ip);
    const xNoTenant = await probe(`${ORIGIN}/api/public/photo/${FX}?variant=preview&photo=${otherFolderPhoto}`, ip);
    check(xPage.status === 404 && xFile.status === 404 && xNoTenant.status === 404, "Swift folder token on another business's portal (page, file) and with no tenant → 404", [xPage, xFile, xNoTenant].map(show).join(" | "));
    console.log("       pasted (other business, page):", show(xPage));
    console.log("       pasted (other business, file):", show(xFile));
    const { data: foreignFolder } = await admin.from("media_folders").select("id").neq("business_id", SWIFT).limit(1).maybeSingle();
    if (foreignFolder) {
      check((await shares.loadShareableFolder(SWIFT, foreignFolder.id)) === null, "Swift tenant cannot load another business's folder for sharing");
      const { error: xErr, data: xRow } = await admin
        .from("media_shares")
        .insert({ business_id: SWIFT, media_folder_id: foreignFolder.id, kind: "link", access_token_hash: sha(`xf-${Date.now()}`), token_ciphertext: "v1.x.x.x" })
        .select("id")
        .maybeSingle();
      if (xRow?.id) await admin.from("media_shares").delete().eq("id", xRow.id);
      check(Boolean(xErr), "DB trigger rejects a share whose folder belongs to another business", xErr?.message);
    } else {
      console.log("  SKIP no other-business folder exists to test the DB trigger");
    }
    const { error: bothErr, data: bothRow } = await admin
      .from("media_shares")
      .insert({ business_id: SWIFT, media_folder_id: F2, media_asset_id: B.id, kind: "link", access_token_hash: sha(`xb-${Date.now()}`), token_ciphertext: "v1.x.x.x" })
      .select("id")
      .maybeSingle();
    if (bothRow?.id) await admin.from("media_shares").delete().eq("id", bothRow.id);
    check(Boolean(bothErr), "DB rejects a live share with both a photo and a folder subject", bothErr?.message);
    const { error: noneErr, data: noneRow } = await admin
      .from("media_shares")
      .insert({ business_id: SWIFT, kind: "link", access_token_hash: sha(`xn-${Date.now()}`), token_ciphertext: "v1.x.x.x" })
      .select("id")
      .maybeSingle();
    if (noneRow?.id) await admin.from("media_shares").delete().eq("id", noneRow.id);
    check(Boolean(noneErr), "DB rejects a live share with no subject", noneErr?.message);

    section("Folder share — owner API with a Swift admin session");
    const { data: adminProfile } = await admin.from("profiles").select("email").eq("id", SWIFT_ADMIN).single();
    const cookie = await sessionCookie(admin, adminProfile!.email as string);
    const ownerGet = await probe(`${tenant(SWIFT_SLUG)}/api/media-folders/${F2}/shares`, freshIp(), { headers: { cookie } });
    const ownerJson = ownerGet.status === 200 ? JSON.parse(ownerGet.text) : null;
    check(ownerGet.status === 200 && ownerJson?.state?.link?.id === fxId && String(ownerJson?.state?.link?.url ?? "").includes("/folder/"), "admin GET folder shares → 200 with the /folder/ link", show(ownerGet));
    check((ownerGet.headers.get("cache-control") ?? "").includes("no-store"), "owner folder share API is no-store");
    const ownerUpdate = await probe(`${tenant(SWIFT_SLUG)}/api/media-folders/${F2}/shares`, freshIp(), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ action: "update", shareId: fxId, allowDownload: false }),
    });
    check(ownerUpdate.status === 200 && JSON.parse(ownerUpdate.text)?.state?.link?.allow_download === false, "admin can switch the folder link to view-only", show(ownerUpdate));
    check((await probe(fimg(FX, otherFolderPhoto, "original"), freshIp())).status === 403, "…and the original download is then blocked → 403");
    const ownerWrongSubject = await probe(`${tenant(SWIFT_SLUG)}/api/media-folders/${F2}/shares`, freshIp(), {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ action: "revoke", shareId: flId }),
    });
    check(ownerWrongSubject.status === 404, "revoking another folder's share id through this folder → 404", show(ownerWrongSubject));
    if (foreignFolder) {
      const ownerForeign = await probe(`${tenant(SWIFT_SLUG)}/api/media-folders/${foreignFolder.id}/shares`, freshIp(), { headers: { cookie } });
      check(ownerForeign.status === 404, "admin GET another business's folder shares → 404", show(ownerForeign));
    }
    const ownerBadId = await probe(`${tenant(SWIFT_SLUG)}/api/media-folders/not-a-uuid/shares`, freshIp(), { headers: { cookie } });
    check(ownerBadId.status === 404, "malformed folder id → 404", show(ownerBadId));
    // Authenticated APIs take the tenant from the session's profile, not the host,
    // so a Swift admin on another host still only reaches Swift's own folder.
    const ownerOtherHost = await probe(`${tenant(OTHER_SLUG)}/api/media-folders/${F2}/shares`, freshIp(), { headers: { cookie } });
    const otherHostJson = ownerOtherHost.status === 200 ? JSON.parse(ownerOtherHost.text) : null;
    check(
      [401, 403, 404].includes(ownerOtherHost.status) || otherHostJson?.state?.link?.id === fxId,
      `Swift session on another business's host stays scoped to Swift (${ownerOtherHost.status})`,
      show(ownerOtherHost)
    );
    const summary = await probe(`${tenant(SWIFT_SLUG)}/api/projects/${JACKSON_PROJECT}/photo-shares`, freshIp(), { headers: { cookie } });
    const summaryJson = summary.status === 200 ? JSON.parse(summary.text) : null;
    check(Boolean(summaryJson?.folders?.[F2]?.link) && !("null" in (summaryJson?.summary ?? {})), "project summary reports the folder share separately from photo shares", show(summary));

    section("Folder share — activity logging");
    const { data: fLogs, error: fLogErr } = await admin
      .from("activity_logs")
      .select("activity_type, visibility")
      .eq("project_id", JACKSON_PROJECT)
      .in("activity_type", [
        "folder_shared",
        "folder_share_revoked",
        "folder_share_link_enabled",
        "folder_share_link_disabled",
        "folder_share_link_rotated",
        "folder_share_updated",
      ])
      .contains("metadata", { media_folder_id: F1 });
    if (fLogErr) console.log("       activity query error:", fLogErr.message);
    const fTypes = new Set((fLogs ?? []).map((l) => l.activity_type));
    check(
      ["folder_shared", "folder_share_link_enabled", "folder_share_link_disabled", "folder_share_link_rotated"].every((t) => fTypes.has(t)) &&
        (fLogs ?? []).every((l) => l.visibility === "admin"),
      `folder share events logged on the project, admin-only (${[...fTypes].join(", ")})`
    );
    const { data: fUpdLogs } = await admin.from("activity_logs").select("id").eq("activity_type", "folder_share_updated").contains("metadata", { share_id: fxId });
    check((fUpdLogs ?? []).length >= 1, "folder share update logged");

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
    const routeSrc = [
      "src/app/api/media/[id]/shares/route.ts",
      "src/app/api/media-folders/[id]/shares/route.ts",
      "src/lib/media-share-api.ts",
    ]
      .map((p) => readFileSync(resolve(p), "utf8"))
      .join("\n");
    check(!routeSrc.includes("rawToken"), "owner share APIs (photo + folder) never serialize an invite token");
    const folderViewerSrc = readFileSync(resolve("src/app/folder/[token]/page.tsx"), "utf8");
    check(!folderViewerSrc.includes("file_path") && !folderViewerSrc.includes("project_id"), "folder share page passes no storage path or project id to the browser");

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
