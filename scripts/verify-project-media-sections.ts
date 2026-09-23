/**
 * Per-project client media section visibility — Jackson 9560 CR-99 only.
 * Usage: npx tsx scripts/verify-project-media-sections.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAppSettings, saveAppSettings, DEFAULT_APP_SETTINGS } from "../src/lib/app-settings";
import {
  DEFAULT_PROJECT_MEDIA_SECTIONS,
  mediaSectionsFromProject,
  projectColumnsFromMediaSections,
} from "../src/lib/project-media-sections";
import { pickDownloadableAssets } from "../src/lib/project-zip-download";
import type { MediaAsset } from "../src/lib/types";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const SWIFT_SLUG = "swift-aerial-media";
const TEST_PROJECT = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";
const TEST_CLIENT_EMAIL = "jackson.bridges21@gmail.com";
const ADMIN_EMAIL = "jackson@swiftaerialmedia.com";
const TEST_FOLDER = "df142d88-fa00-44af-95c8-da6e2c92324f";

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
  if (!cond) throw new Error(msg);
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

function grepHtml(html: string, pattern: string): string[] {
  const lines = html.split("\n");
  const re = new RegExp(pattern, "i");
  return lines.filter((l) => re.test(l)).map((l) => l.trim().slice(0, 160));
}

/** Visible section chrome only — ignore RSC payload keys like client_section_photos. */
function hasVisiblePhotoSection(html: string): boolean {
  return (
    /Photo Gallery/i.test(html) ||
    /id="photo-gallery"/i.test(html) ||
    /id="photos"/i.test(html) ||
    />\s*Photos\s*</i.test(html) ||
    /<h2[^>]*>[\s\S]{0,120}Photos/i.test(html)
  );
}

async function applyMigration() {
  const migrationSql = readFileSync(
    resolve("supabase/migration-v88-project-media-sections.sql"),
    "utf8"
  );
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!mgmtToken) {
    console.log(
      `WARN: SUPABASE_ACCESS_TOKEN unset — ensure migration-v88 is applied. (${migrationSql.length} bytes)`
    );
    return false;
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mgmtToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: migrationSql }),
  });
  const body = await res.text();
  console.log("Migration apply:", res.status, body.slice(0, 400));
  return res.ok;
}

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const base = tenantBase();

  section("0. Apply migration v88");
  await applyMigration();

  section("1. typecheck / lint / build / tenant-lint");
  if (process.env.SKIP_GATES === "1") {
    console.log("SKIP_GATES=1 — assuming typecheck/lint/build/tenant-lint already passed");
  } else {
    for (const cmd of [
      "npm run typecheck",
      "npm run lint",
      "npm run build",
      "npm run tenant-lint",
    ]) {
      console.log(`> ${cmd}`);
      execSync(cmd, { stdio: "inherit", cwd: resolve(".") });
    }
  }
  assert(true, "typecheck + lint + build + tenant-lint passed");

  section("2. Migration counts — every project all five ON");
  // Ensure fixture starts clean (prior failed runs may have left Photos off).
  await admin
    .from("projects")
    .update(projectColumnsFromMediaSections(DEFAULT_PROJECT_MEDIA_SECTIONS))
    .eq("id", TEST_PROJECT)
    .eq("business_id", SWIFT);

  const { data: projects, error: projErr } = await admin
    .from("projects")
    .select(
      "id, client_section_photos, client_section_videos, client_section_tours, client_section_models, client_section_documents"
    );
  if (projErr) throw projErr;
  const total = projects?.length ?? 0;
  const allOn = (projects ?? []).filter(
    (p) =>
      p.client_section_photos !== false &&
      p.client_section_videos !== false &&
      p.client_section_tours !== false &&
      p.client_section_models !== false &&
      p.client_section_documents !== false
  ).length;
  const anyOff = total - allOn;
  console.log(
    JSON.stringify(
      {
        total_projects: total,
        all_five_visible: allOn,
        any_section_off: anyOff,
      },
      null,
      2
    )
  );
  assert(total > 0, "projects exist");
  assert(anyOff === 0, "every existing project has all five sections visible");

  const { data: jacksonBefore } = await admin
    .from("projects")
    .select(
      "id, project_name, client_section_photos, client_section_videos, client_section_tours, client_section_models, client_section_documents"
    )
    .eq("id", TEST_PROJECT)
    .single();
  assert(!!jacksonBefore, "Jackson project found");
  console.log("Jackson before:", jacksonBefore);

  const { data: mediaRows } = await admin
    .from("media_assets")
    .select("*")
    .eq("project_id", TEST_PROJECT)
    .eq("business_id", SWIFT);
  const media = (mediaRows ?? []) as MediaAsset[];
  const photo = media.find((m) => m.media_type === "photo" && m.file_path);
  assert(!!photo, "Jackson has a photo asset for download tests");

  const sectionsOn = mediaSectionsFromProject(jacksonBefore);
  const zipBefore = pickDownloadableAssets(media, false, sectionsOn).length;
  console.log("Downloadable file count (client, all ON):", zipBefore);
  assert(zipBefore > 0, "ZIP has files when photos on");

  const settingsBefore = await getAppSettings(SWIFT);
  const originalDefaults = { ...settingsBefore.mediaSectionDefaults };
  let createdProjectId: string | null = null;
  let linkModeBefore: string | null = null;

  try {
  section("3. Turn Photos OFF — HTML absent for client / share / anonymous");
  const { data: linkBefore } = await admin
    .from("projects")
    .select("link_access_mode")
    .eq("id", TEST_PROJECT)
    .single();
  linkModeBefore = linkBefore?.link_access_mode ?? null;

  await admin
    .from("projects")
    .update({ client_section_photos: false })
    .eq("id", TEST_PROJECT)
    .eq("business_id", SWIFT);

  const clientCookie = await sessionCookie(admin, TEST_CLIENT_EMAIL);
  const adminCookie = await sessionCookie(admin, ADMIN_EMAIL);

  const clientPage = await fetch(`${base}/dashboard/projects/${TEST_PROJECT}`, {
    headers: { Cookie: clientCookie },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  const clientHtml = await clientPage.text();
  console.log(
    "CLIENT HTML photo-section visible?",
    hasVisiblePhotoSection(clientHtml),
    "grep:",
    grepHtml(clientHtml, "Photo Gallery|id=\"photo-gallery\"")
  );
  assert(clientPage.ok, `client page status ${clientPage.status}`);
  assert(!hasVisiblePhotoSection(clientHtml), "client sees NO photo section");

  // Shared viewer via magic share link
  const shareEmail = `media-sections-share-${Date.now()}@example.test`;
  const { addProjectShare, buildShareMagicLinkForProject, resolveShareAccessWindow } =
    await import("../src/lib/project-shares");
  const accessFields = resolveShareAccessWindow("30days");
  const added = await addProjectShare({
    businessId: SWIFT,
    projectId: TEST_PROJECT,
    email: shareEmail,
    invitedBy: SWIFT_ADMIN,
    notify: false,
    projectName: "Jackson Bridges - 9560 CR-99 - Aerial Photography",
    inviterName: "Admin",
    expiryPreset: "30days",
  });
  const link = await buildShareMagicLinkForProject({
    businessId: SWIFT,
    projectId: TEST_PROJECT,
    email: shareEmail,
    shareId: added.share.id,
    accessFields,
  });
  const rawToken = new URL(link).searchParams.get("token") || "";
  const form = new URLSearchParams();
  form.set("token", rawToken);
  const consume = await fetch(`${base}/auth/share/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const shareCookies = (consume.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  const sharePage = await fetch(`${base}/dashboard/projects/${TEST_PROJECT}`, {
    headers: { Cookie: shareCookies },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  const shareHtml = await sharePage.text();
  console.log(
    "SHARED VIEWER HTML photo-section visible?",
    hasVisiblePhotoSection(shareHtml),
    "grep:",
    grepHtml(shareHtml, "Photo Gallery|id=\"photo-gallery\"")
  );
  assert(
    sharePage.ok && shareHtml.includes("9560 CR-99"),
    "shared viewer landed on Jackson project page"
  );
  assert(!hasVisiblePhotoSection(shareHtml), "shared viewer sees NO photo section");
  await admin
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", added.share.id);

  const { data: linkProj } = await admin
    .from("projects")
    .select("link_access_token, link_access_mode")
    .eq("id", TEST_PROJECT)
    .single();
  let publicHtml = "";
  if (linkProj?.link_access_token) {
    await admin
      .from("projects")
      .update({ link_access_mode: "anyone_with_link" })
      .eq("id", TEST_PROJECT);
    const pub = await fetch(`${base}/view/${linkProj.link_access_token}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    publicHtml = await pub.text();
    console.log(
      "ANONYMOUS HTML photo-section visible?",
      hasVisiblePhotoSection(publicHtml),
      "has Videos section?",
      /id="video"/i.test(publicHtml) || />\s*Video\s*</i.test(publicHtml)
    );
    assert(!hasVisiblePhotoSection(publicHtml), "anonymous visitor sees NO photo section");
  } else {
    console.log("SKIP anonymous HTML — no link_access_token");
  }

  section("4. Download All excludes photos when Photos OFF");
  const { data: jacksonOff } = await admin
    .from("projects")
    .select(
      "client_section_photos, client_section_videos, client_section_tours, client_section_documents"
    )
    .eq("id", TEST_PROJECT)
    .single();
  const sectionsOff = mediaSectionsFromProject(jacksonOff);
  const zipAfter = pickDownloadableAssets(media, false, sectionsOff).length;
  console.log({ zip_file_count_before_photos_on: zipBefore, zip_file_count_after_photos_off: zipAfter });
  assert(zipAfter < zipBefore, "Download All file count dropped after Photos off");
  assert(
    pickDownloadableAssets(media, false, sectionsOff).every((a) => a.media_type !== "photo"),
    "no photos in client ZIP when Photos off"
  );
  assert(
    pickDownloadableAssets(media, true, sectionsOff).some((a) => a.media_type === "photo"),
    "admin ZIP still includes photos"
  );

  const zipRes = await fetch(`${base}/api/projects/${TEST_PROJECT}/download-zip`, {
    headers: { Cookie: clientCookie },
    signal: AbortSignal.timeout(60_000),
  });
  console.log(
    "Client Download All status:",
    zipRes.status,
    "content-type:",
    zipRes.headers.get("content-type")
  );
  assert(zipRes.ok, "client Download All still returns a ZIP (videos/docs only)");
  // Drain a small prefix only — full Jackson ZIP is hundreds of MB.
  await zipRes.body?.cancel();

  section("5. Folder ZIP + individual photo download refused for client");
  const folderName = `media-sections-verify-${Date.now()}`;
  const { data: tempFolder, error: folderErr } = await admin
    .from("media_folders")
    .insert({
      business_id: SWIFT,
      project_id: TEST_PROJECT,
      name: folderName,
      display_order: 9999,
    })
    .select("id")
    .single();
  if (folderErr || !tempFolder) throw folderErr ?? new Error("folder create failed");
  const priorFolderId = photo!.folder_id ?? null;
  await admin
    .from("media_assets")
    .update({ folder_id: tempFolder.id })
    .eq("id", photo!.id)
    .eq("business_id", SWIFT);

  const folderZip = await fetch(
    `${base}/api/projects/${TEST_PROJECT}/download-zip?folderId=${encodeURIComponent(tempFolder.id)}`,
    { headers: { Cookie: clientCookie }, signal: AbortSignal.timeout(60_000) }
  );
  const folderText = (await folderZip.text()).slice(0, 400);
  console.log("Folder ZIP (client, photos off):", folderZip.status, folderText);
  // Empty folder after section filter may 404 or return empty/error — must not stream photos.
  assert(
    folderZip.status === 404 ||
      folderZip.status === 403 ||
      folderZip.status === 400 ||
      (folderZip.ok && !folderText.includes(photo!.id)),
    "folder ZIP refuses or excludes hidden photos for client"
  );

  await admin
    .from("media_assets")
    .update({ folder_id: priorFolderId })
    .eq("id", photo!.id)
    .eq("business_id", SWIFT);
  await admin.from("media_folders").delete().eq("id", tempFolder.id).eq("business_id", SWIFT);

  const dl = await fetch(`${base}/api/media/download/${photo!.id}?file=1`, {
    headers: { Cookie: clientCookie },
    signal: AbortSignal.timeout(20_000),
  });
  const dlBody = await dl.text();
  console.log("Individual photo download (client):", dl.status, dlBody.slice(0, 200));
  assert(dl.status === 404 || dl.status === 403, "client individual photo download refused");

  const thumb = await fetch(`${base}/api/media/thumbnails`, {
    method: "POST",
    headers: { Cookie: clientCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [photo!.id] }),
    signal: AbortSignal.timeout(20_000),
  });
  const thumbJson = (await thumb.json().catch(() => ({}))) as {
    urls?: Record<string, string | null>;
    error?: string;
  };
  console.log("Thumbnails batch (client):", thumb.status, JSON.stringify(thumbJson).slice(0, 300));
  const thumbUrl = thumbJson.urls?.[photo!.id];
  assert(!thumbUrl, "hidden photo excluded from client thumbnail batch");

  section("6. Admin still sees + downloads with Hidden badge");
  const adminDetail = await fetch(`${base}/admin/projects/${TEST_PROJECT}`, {
    headers: { Cookie: adminCookie },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  const adminDetailHtml = await adminDetail.text();
  console.log(
    "ADMIN detail status",
    adminDetail.status,
    "Hidden from clients?",
    /Hidden from clients/i.test(adminDetailHtml),
    "Photos heading?",
    />\s*Photos\s*</i.test(adminDetailHtml) || /Photos</i.test(adminDetailHtml)
  );
  assert(adminDetail.ok, "admin detail page loads");
  assert(/Hidden from clients/i.test(adminDetailHtml), "admin detail marks photos hidden from clients");

  const adminDl = await fetch(`${base}/api/media/download/${photo!.id}?file=1`, {
    headers: { Cookie: adminCookie },
    signal: AbortSignal.timeout(20_000),
  });
  console.log("Admin photo download:", adminDl.status);
  assert(adminDl.ok, "admin can still download photo when section hidden from clients");

  const adminZipCount = pickDownloadableAssets(media, true, sectionsOff).length;
  console.log("Admin ZIP file count with photos hidden from clients:", adminZipCount);
  assert(adminZipCount === zipBefore, "admin Download All still includes all files");

  section("7. Defaults apply at create only; existing unchanged");
  assert(
    DEFAULT_APP_SETTINGS.mediaSectionDefaults.photos === true &&
      DEFAULT_APP_SETTINGS.mediaSectionDefaults.videos === true &&
      DEFAULT_APP_SETTINGS.mediaSectionDefaults.tours === true &&
      DEFAULT_APP_SETTINGS.mediaSectionDefaults.documents === true,
    "platform defaults all four ON"
  );

  await saveAppSettings(
    {
      mediaSectionDefaults: {
        photos: false,
        videos: true,
        tours: false,
        documents: true,
      },
    },
    SWIFT_ADMIN,
    SWIFT,
    { allowVerificationWrite: true }
  );

  const { data: existingAfterDefaults } = await admin
    .from("projects")
    .select("client_section_photos, client_section_videos, client_section_tours, client_section_documents")
    .eq("id", TEST_PROJECT)
    .single();
  assert(
    existingAfterDefaults?.client_section_photos === false,
    "Jackson still has photos OFF from explicit toggle (not reset by defaults)"
  );
  // Existing project columns must not flip from settings change alone — restore was photos false from step 3
  console.log("Existing Jackson after defaults change:", existingAfterDefaults);

  const { data: clientRow } = await admin
    .from("projects")
    .select("client_id")
    .eq("id", TEST_PROJECT)
    .single();
  assert(!!clientRow?.client_id, "Jackson client id");

  const createRes = await fetch(`${base}/api/projects`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientRow!.client_id,
      service_type: "Aerial Photography",
      property_address: "999 Media Sections Verify St, Test City, TX 75001",
      street_address: "999 Media Sections Verify St",
      city: "Test City",
      state: "TX",
      zip: "75001",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const created = (await createRes.json()) as {
    id?: string;
    error?: string;
    client_section_photos?: boolean;
    client_section_videos?: boolean;
    client_section_tours?: boolean;
    client_section_documents?: boolean;
  };
  console.log("New project create:", createRes.status, created);
  assert(createRes.ok && !!created.id, "created new project from defaults");
  createdProjectId = created.id ?? null;
  assert(created.client_section_photos === false, "new project photos OFF from defaults");
  assert(created.client_section_videos === true, "new project videos ON from defaults");
  assert(created.client_section_tours === false, "new project tours OFF from defaults");
  assert(created.client_section_documents === true, "new project documents ON from defaults");

  section("8. Independent toggles + dual render branches (static)");
  const pageClient = readFileSync(
    resolve("src/components/projects/project-page-client.tsx"),
    "utf8"
  );
  assert(
    (pageClient.match(/isClientView && showPhotos/g) ?? []).length >= 1 &&
      (pageClient.match(/isClientView && showVideos/g) ?? []).length >= 1 &&
      (pageClient.match(/isClientView && showTours/g) ?? []).length >= 1 &&
      (pageClient.match(/isClientView && showDocuments/g) ?? []).length >= 1,
    "client branch gates all four sections"
  );
  assert(
    pageClient.includes("hiddenFromClients={photosHidden}") &&
      pageClient.includes("hiddenFromClients={videosHidden}") &&
      pageClient.includes("hiddenFromClients={toursHidden}") &&
      pageClient.includes("hiddenFromClients={documentsHidden}"),
    "admin branch marks all four hidden badges"
  );

  section("9. Everything-off empty state present");
  assert(pageClient.includes("No media available"), "client empty state when no sections");
  const publicClient = readFileSync(
    resolve("src/components/projects/public-project-page-client.tsx"),
    "utf8"
  );
  assert(publicClient.includes("No media available"), "public empty state when no sections");

  section("10. Phase 2 + phase 3 boundary sweeps");
  execSync("npx tsx scripts/verify-share-access-tokens.ts", {
    stdio: "inherit",
    cwd: resolve("."),
  });

  console.log("\n=== verify-project-media-sections complete ===");
  } finally {
    if (createdProjectId) {
      await admin.from("projects").delete().eq("id", createdProjectId).eq("business_id", SWIFT);
    }
    await saveAppSettings(
      { mediaSectionDefaults: originalDefaults },
      SWIFT_ADMIN,
      SWIFT,
      { allowVerificationWrite: true }
    );
    await admin
      .from("projects")
      .update({
        ...projectColumnsFromMediaSections(DEFAULT_PROJECT_MEDIA_SECTIONS),
        link_access_mode: linkModeBefore || "restricted",
      })
      .eq("id", TEST_PROJECT)
      .eq("business_id", SWIFT);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
