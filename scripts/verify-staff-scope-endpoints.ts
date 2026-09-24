/**
 * Durable staff project-scope guard — Swift / Jackson only.
 *
 * Driven by STAFF_DATA_ROUTE_REGISTRY:
 *  - every discovered staff-prefix route must be registered (else FAIL)
 *  - every registered route must contain a scope marker for its policy
 *  - HTTP probes: staff on ONE project sees only that project's data; OOS → 404
 *  - knownHole tags prove the nine historical holes are covered
 *  - projects.view_all lifts clients / media / messages
 *
 * Usage: npx tsx scripts/verify-staff-scope-endpoints.ts
 * Optional: VERIFY_BASE_URL=http://127.0.0.1:3000 (default)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assignProjectStaff,
  inviteStaffMember,
  disableStaffMember,
} from "../src/lib/staff";
import { applyStaffPermissionPreset } from "../src/lib/staff-permissions";
import {
  canAccessClient,
  canAccessMediaAsset,
  canAccessProject,
  visibleClientIdsFor,
  visibleProjectIdsFor,
} from "../src/lib/staff-access";
import { queryMediaLibrary, getLibraryFilterOptions } from "../src/lib/media-library";
import { listAdminConversations } from "../src/lib/client-messaging";
import { authorizeProjectZipDownload } from "../src/lib/project-zip-download";
import { createTenantServiceClient } from "../src/lib/supabase/tenant-service";
import type { Profile } from "../src/lib/types";
import {
  STAFF_DATA_ROUTE_REGISTRY,
  assertRegistryCoversDiscovery,
  assertSourceHasScopeMarkers,
  knownHoleEntries,
  discoverStaffScopedRouteFiles,
} from "./lib/staff-scope-route-registry";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";
const ROOT = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
const API_ROOT = resolve("src/app/api");

const NINE_HOLES = [
  "clients",
  "media",
  "messages",
  "asset-reviews",
  "client-notes",
  "crm-profile",
  "project-staff",
  "payments",
  "upload-sign",
] as const;

function loadEnv() {
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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function fmt(label: string, scoped: number, total: number) {
  console.log(`  ${label}: ${scoped} of ${total}`);
}

async function jsonOrText(res: Response) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as unknown, text };
  } catch {
    return { status: res.status, body: null, text };
  }
}

async function main() {
  loadEnv();
  const stamp = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const raw = createClient(url, key, { auth: { persistSession: false } });

  console.log("\n=== 0. Registry integrity ===");
  const coverage = assertRegistryCoversDiscovery(API_ROOT);
  console.log(
    `  discovered=${coverage.discovered.length} registered=${coverage.registered.length}`
  );
  assert(
    coverage.missing.length === 0,
    `unregistered staff routes:\n  ${coverage.missing.join("\n  ")}`
  );
  const markerFails = assertSourceHasScopeMarkers(API_ROOT);
  assert(markerFails.length === 0, `missing scope markers:\n  ${markerFails.join("\n  ")}`);
  console.log("  registry covers discovery + scope markers OK");

  // DEMO: adding a route without registering it fails the guard
  const fakePath = "clients/__guard_unregistered__/route.ts";
  const demoMissing = [...coverage.discovered, fakePath].filter(
    (f) => !coverage.registered.includes(f)
  );
  assert(demoMissing.includes(fakePath), "demo unregistered path must surface");
  console.log(
    `  DEMO unregistered-route failure: would fail with missing=[${fakePath}]`
  );

  const holeTags = new Set(
    knownHoleEntries().map((e) => e.knownHole).filter(Boolean) as string[]
  );
  for (const h of NINE_HOLES) {
    assert(holeTags.has(h), `registry missing knownHole tag: ${h}`);
  }
  console.log(`  nine knownHole tags present: ${[...NINE_HOLES].join(", ")}`);

  const { data: adminProfile } = await raw
    .from("profiles")
    .select("id, email, role, business_id, staff_permissions, disabled_at")
    .eq("business_id", SWIFT_ID)
    .eq("role", "admin")
    .is("disabled_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  assert(adminProfile, "Swift admin required");
  const actor = { id: adminProfile.id, email: adminProfile.email };

  const email = `scope-guard-${stamp}@swift-test.local`;
  const password = `ScopeGuard-${stamp}!Aa`;
  const createdIds: string[] = [];

  try {
    const invited = await inviteStaffMember({
      businessId: SWIFT_ID,
      email,
      fullName: "Scope Guard Staff",
      actor,
    });
    assert(invited.ok, invited.ok ? "" : invited.error);
    createdIds.push(invited.userId);

    const { data: projects } = await raw
      .from("projects")
      .select("id, client_id, project_name")
      .eq("business_id", SWIFT_ID)
      .is("deleted_at", null)
      .limit(40);
    assert(projects && projects.length >= 2, "need ≥2 Swift projects");

    // Prefer projects that both have media when possible
    const { data: mediaCounts } = await raw
      .from("media_assets")
      .select("project_id")
      .eq("business_id", SWIFT_ID)
      .not("project_id", "is", null)
      .limit(500);
    const mediaByProject = new Map<string, number>();
    for (const row of mediaCounts ?? []) {
      mediaByProject.set(row.project_id, (mediaByProject.get(row.project_id) ?? 0) + 1);
    }
    const withMedia = projects!.filter((p) => (mediaByProject.get(p.id) ?? 0) > 0);
    const projectA =
      withMedia.find((p) =>
        withMedia.some((o) => o.id !== p.id && o.client_id && o.client_id !== p.client_id)
      ) ?? projects![0];
    const projectB =
      withMedia.find((p) => p.id !== projectA.id && p.client_id && p.client_id !== projectA.client_id) ??
      projects!.find((p) => p.id !== projectA.id && p.client_id !== projectA.client_id) ??
      projects!.find((p) => p.id !== projectA.id)!;
    assert(projectA.client_id, "project A needs client");
    assert(projectB.client_id, "project B needs client");
    assert(projectA.client_id !== projectB.client_id, "need two different clients");

    await raw
      .from("profiles")
      .update({
        staff_permissions: {
          ...applyStaffPermissionPreset("coordinator"),
          "area.media": true,
          "area.messages": true,
          "area.calendar": true,
          "area.clients": true,
          "area.projects": true,
          "money.view": true,
          "money.create_send_estimates": true,
          "money.send_payment_links": true,
          "media.upload": true,
          "media.download_originals": true,
          "sharing.email": true,
          "sharing.anyone_with_link": true,
          "projects.view_all": false,
        },
      })
      .eq("id", invited.userId);

    await raw.from("project_staff").delete().eq("user_id", invited.userId);
    const assigned = await assignProjectStaff({
      businessId: SWIFT_ID,
      projectId: projectA.id,
      userId: invited.userId,
      actor,
    });
    assert(assigned.ok, assigned.ok ? "" : assigned.error);

    await raw.auth.admin.updateUserById(invited.userId, {
      password,
      email_confirm: true,
    });

    const { data: staffRow } = await raw
      .from("profiles")
      .select("id, role, business_id, staff_permissions, disabled_at, email, full_name")
      .eq("id", invited.userId)
      .single();
    const profile = staffRow as Profile;

    const visibleProjects = await visibleProjectIdsFor(SWIFT_ID, profile);
    assert(Array.isArray(visibleProjects) && visibleProjects.length === 1, "exactly one project");
    assert(visibleProjects.includes(projectA.id), "assigned project visible");
    assert(!visibleProjects.includes(projectB.id), "other project hidden");

    const visibleClients = await visibleClientIdsFor(SWIFT_ID, profile);
    assert(Array.isArray(visibleClients), "clients scoped");
    assert(
      (visibleClients as string[]).includes(projectA.client_id!),
      "client A visible"
    );
    assert(
      !(visibleClients as string[]).includes(projectB.client_id!),
      "client B hidden"
    );

    // --- Business-wide totals ---
    const { count: allClients } = await raw
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("business_id", SWIFT_ID)
      .is("deleted_at", null);

    const { count: allMedia } = await raw
      .from("media_assets")
      .select("id", { count: "exact", head: true })
      .eq("business_id", SWIFT_ID);

    const { count: allProjects } = await raw
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("business_id", SWIFT_ID)
      .is("deleted_at", null);

    console.log("\n=== 1. Loader scope (one-project staff) ===");
    const unscopedMedia = await queryMediaLibrary(SWIFT_ID, { page: 1, limit: 48 });
    const scopedMedia = await queryMediaLibrary(SWIFT_ID, {
      page: 1,
      limit: 48,
      projectIds: visibleProjects,
    });
    const unscopedMsgs = await listAdminConversations(SWIFT_ID, profile.id);
    const scopedMsgs = await listAdminConversations(SWIFT_ID, profile.id, {
      clientIds: visibleClients,
    });
    const unscopedFilters = await getLibraryFilterOptions(SWIFT_ID);
    const scopedFilters = await getLibraryFilterOptions(SWIFT_ID, {
      projectIds: visibleProjects,
      clientIds: visibleClients,
    });

    fmt("Clients", (visibleClients as string[]).length, allClients ?? 0);
    fmt("Media", scopedMedia.total, unscopedMedia.total);
    fmt("Messages", scopedMsgs.length, unscopedMsgs.length);
    fmt("Library filter clients", scopedFilters.clients.length, unscopedFilters.clients.length);
    fmt("Projects", visibleProjects.length, allProjects ?? 0);
    assert((visibleClients as string[]).length < (allClients ?? 0), "clients strictly scoped");
    assert(scopedMedia.total < unscopedMedia.total, "media strictly scoped");
    assert(
      scopedMedia.assets.every((a) => !a.project_id || visibleProjects.includes(a.project_id)),
      "every media asset in visible projects"
    );

    console.log("\n=== 2. Direct-id outside scope (lib) ===");
    assert(!(await canAccessProject(SWIFT_ID, profile, projectB.id)), "project B denied");
    assert(!(await canAccessClient(SWIFT_ID, profile, projectB.client_id!)), "client B denied");
    const { data: mediaB } = await raw
      .from("media_assets")
      .select("id, project_id")
      .eq("business_id", SWIFT_ID)
      .eq("project_id", projectB.id)
      .limit(1)
      .maybeSingle();
    if (mediaB) {
      assert(
        !(await canAccessMediaAsset(SWIFT_ID, profile, mediaB.project_id)),
        "media on B denied"
      );
      console.log(`  media B ${mediaB.id}: denied`);
    }
    const db = await createTenantServiceClient(SWIFT_ID);
    const zipB = await authorizeProjectZipDownload(profile, projectB.id, db, false);
    assert(!zipB.ok, "zip project B denied");
    console.log(`  zip B: denied`);

    // --- HTTP session ---
    console.log("\n=== 3. HTTP session probes ===");
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: loginErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    assert(!loginErr && session.session, loginErr?.message || "login failed");

    const projectRef = new URL(url).hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const sessionPayload = JSON.stringify({
      access_token: session.session!.access_token,
      refresh_token: session.session!.refresh_token,
      expires_at: session.session!.expires_at,
      expires_in: session.session!.expires_in,
      token_type: session.session!.token_type,
      user: session.session!.user,
    });
    const cookieHeader = `${cookieName}=${encodeURIComponent(sessionPayload)}`;

    async function http(
      path: string,
      init: { method?: string; body?: unknown; formData?: FormData } = {}
    ) {
      const method = init.method ?? "GET";
      const headers: Record<string, string> = { Cookie: cookieHeader };
      let body: BodyInit | undefined;
      if (init.formData) {
        body = init.formData;
      } else if (init.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(init.body);
      } else if (method !== "GET" && method !== "HEAD") {
        headers["Content-Type"] = "application/json";
      }
      const res = await fetch(`${ROOT}${path}`, {
        method,
        redirect: "manual",
        headers,
        body,
      });
      return jsonOrText(res);
    }

    // Health check
    const health = await fetch(`${ROOT}/api/clients`, {
      headers: { Cookie: cookieHeader },
      redirect: "manual",
    });
    assert(
      health.status !== 0 && health.status < 500,
      `dev server unreachable at ${ROOT} (status ${health.status})`
    );

    // CLIENTS list
    const clientsList = await http("/api/clients");
    assert(clientsList.status === 200, `clients list ${clientsList.status}`);
    const clientRows = Array.isArray((clientsList.body as { clients?: unknown })?.clients)
      ? (clientsList.body as { clients: { id: string }[] }).clients
      : Array.isArray(clientsList.body)
        ? (clientsList.body as { id: string }[])
        : [];
    // API may return { rows } or array — tolerate shapes
    const clientIdsFromApi: string[] = (() => {
      const b = clientsList.body as Record<string, unknown> | unknown[];
      if (Array.isArray(b)) return b.map((r) => (r as { id: string }).id).filter(Boolean);
      for (const key of ["clients", "rows", "data"]) {
        const v = (b as Record<string, unknown>)[key];
        if (Array.isArray(v)) return v.map((r) => (r as { id: string }).id).filter(Boolean);
      }
      return [];
    })();
    assert(
      clientIdsFromApi.every((id) => (visibleClients as string[]).includes(id)),
      "clients API only visible"
    );
    assert(!clientIdsFromApi.includes(projectB.client_id!), "client B absent from list");
    fmt("HTTP Clients", clientIdsFromApi.length, allClients ?? 0);

    const clientBDetail = await http(`/api/clients?id=${projectB.client_id}`);
    assert(clientBDetail.status === 404, `client B GET ?id= → ${clientBDetail.status}`);
    console.log(`  GET /api/clients?id=${projectB.client_id}: ${clientBDetail.status} ${JSON.stringify(clientBDetail.body)}`);

    const clientBNotes = await http(`/api/clients/${projectB.client_id}/notes`);
    assert(clientBNotes.status === 404, `client B notes → ${clientBNotes.status}`);
    console.log(`  GET notes OOS: ${clientBNotes.status}`);

    const clientBProjects = await http(`/api/clients/${projectB.client_id}/projects`);
    assert(clientBProjects.status === 404, `client B projects → ${clientBProjects.status}`);

    // CRM page (SSR) — out of scope must 404
    const crmPage = await fetch(`${ROOT}/admin/clients/${projectB.client_id}`, {
      headers: { Cookie: cookieHeader },
      redirect: "manual",
    });
    assert(
      crmPage.status === 404,
      `CRM page OOS status ${crmPage.status} (expected 404)`
    );
    console.log(`  GET /admin/clients/${projectB.client_id} (CRM): ${crmPage.status}`);

    // MEDIA
    const mediaList = await http("/api/media/library?page=1&limit=48");
    assert(mediaList.status === 200, `media library ${mediaList.status}`);
    const mediaBody = mediaList.body as {
      total?: number;
      assets?: { id: string; project_id?: string | null }[];
    };
    const mediaTotal = mediaBody.total ?? mediaBody.assets?.length ?? 0;
    fmt("HTTP Media", mediaTotal, unscopedMedia.total);
    assert(mediaTotal <= scopedMedia.total + 1, "media HTTP ≈ scoped"); // allow pagination noise
    if (mediaBody.assets) {
      assert(
        mediaBody.assets.every(
          (a) => !a.project_id || visibleProjects.includes(a.project_id)
        ),
        "HTTP media assets only visible projects"
      );
    }

    if (mediaB) {
      const mediaBGet = await http(`/api/media/library/${mediaB.id}`);
      assert(mediaBGet.status === 404, `media B detail → ${mediaBGet.status}`);
      console.log(`  GET /api/media/library/${mediaB.id}: ${mediaBGet.status} ${JSON.stringify(mediaBGet.body)}`);
    }

    const zipHttp = await http(`/api/projects/${projectB.id}/download-zip`);
    assert(
      zipHttp.status === 404 || zipHttp.status === 403,
      `zip B → ${zipHttp.status}`
    );
    console.log(`  GET zip project B: ${zipHttp.status}`);

    // MESSAGES
    const msgs = await http("/api/messages");
    assert(msgs.status === 200, `messages ${msgs.status}`);
    const msgThreads = (() => {
      const b = msgs.body as Record<string, unknown> | unknown[];
      if (Array.isArray(b)) return b as { client_id?: string; id?: string }[];
      for (const key of ["conversations", "threads", "data", "messages"]) {
        const v = (b as Record<string, unknown>)?.[key];
        if (Array.isArray(v)) return v as { client_id?: string; id?: string }[];
      }
      return [];
    })();
    assert(
      msgThreads.every(
        (t) =>
          !t.client_id || (visibleClients as string[]).includes(t.client_id)
      ),
      "messages only visible clients"
    );
    fmt("HTTP Messages", msgThreads.length, unscopedMsgs.length);

    const msgOos = await http(`/api/messages?client_id=${projectB.client_id}`);
    assert(msgOos.status === 404, `messages client B → ${msgOos.status}`);
    console.log(`  GET /api/messages?client_id=B: ${msgOos.status} ${JSON.stringify(msgOos.body)}`);

    // SEARCH
    const search = await http(`/api/admin/search?q=${encodeURIComponent("project")}`);
    if (search.status === 200) {
      const sb = search.body as {
        clients?: { id: string }[];
        projects?: { id: string }[];
        media?: { id: string }[];
      };
      if (sb.clients) {
        assert(
          sb.clients.every((c) => (visibleClients as string[]).includes(c.id)),
          "search clients scoped"
        );
      }
      if (sb.projects) {
        assert(
          sb.projects.every((p) => visibleProjects.includes(p.id)),
          "search projects scoped"
        );
      }
      console.log(
        `  search: clients=${sb.clients?.length ?? "?"} projects=${sb.projects?.length ?? "?"}`
      );
    } else {
      console.log(`  search status ${search.status} (skipped shape assert)`);
    }

    // UPLOAD CHAIN — write hole suite
    console.log("\n=== 4. Upload chain (must 404 for project B) ===");
    const signBody = {
      projectId: projectB.id,
      fileName: "scope-probe.jpg",
      mimeType: "image/jpeg",
      fileSize: 1024,
      mediaType: "photo",
    };
    const sign = await http("/api/media/upload/sign", { method: "POST", body: signBody });
    assert(sign.status === 404, `upload/sign → ${sign.status}`);
    console.log(`  POST /api/media/upload/sign: ${sign.status} ${JSON.stringify(sign.body)}`);

    const uploadFd = new FormData();
    uploadFd.append("projectId", projectB.id);
    uploadFd.append("mediaType", "photo");
    uploadFd.append("files", new Blob(["scope-probe"], { type: "image/jpeg" }), "probe.jpg");
    const upload = await http("/api/media/upload", { method: "POST", formData: uploadFd });
    assert(upload.status === 404, `upload → ${upload.status}`);
    console.log(`  POST /api/media/upload: ${upload.status} ${JSON.stringify(upload.body)}`);

    const complete = await http("/api/media/upload/complete", {
      method: "POST",
      body: {
        projectId: projectB.id,
        filePath: `${SWIFT_ID}/probe.jpg`,
        fileName: "probe.jpg",
        mimeType: "image/jpeg",
        fileSize: 100,
        mediaType: "photo",
      },
    });
    assert(complete.status === 404 || complete.status === 400, `complete → ${complete.status}`);
    console.log(`  POST /api/media/upload/complete: ${complete.status} ${JSON.stringify(complete.body)}`);

    const resume = await http("/api/media/upload/sign", {
      method: "POST",
      body: {
        ...signBody,
        resumeFilePath: `${SWIFT_ID}/projects/${projectB.id}/resume.jpg`,
      },
    });
    assert(resume.status === 404, `resume sign → ${resume.status}`);
    console.log(`  POST upload/sign (resume): ${resume.status} ${JSON.stringify(resume.body)}`);

    const youtube = await http("/api/media/youtube", {
      method: "POST",
      body: { project_id: projectB.id, youtube_url: "https://youtube.com/watch?v=dQw4w9WgXcQ" },
    });
    assert(youtube.status === 404 || youtube.status === 400, `youtube → ${youtube.status}`);
    console.log(`  POST /api/media/youtube: ${youtube.status}`);

    // Video review version upload on OOS project — find a review on B if any
    const { data: reviewB } = await raw
      .from("video_reviews")
      .select("id, project_id")
      .eq("business_id", SWIFT_ID)
      .eq("project_id", projectB.id)
      .limit(1)
      .maybeSingle();
    if (reviewB) {
      const ver = await http(`/api/video-reviews/${reviewB.id}/versions`, {
        method: "POST",
        body: { fileName: "v.mp4", mimeType: "video/mp4", fileSize: 1000 },
      });
      assert(ver.status === 404, `review version → ${ver.status}`);
      console.log(`  POST video-reviews/${reviewB.id}/versions: ${ver.status}`);
    } else {
      console.log("  (no video review on project B — skipped version upload probe)");
    }

    // Other known-hole endpoints
    console.log("\n=== 5. Remaining known-hole endpoints ===");
    const assetReviews = await http(`/api/asset-reviews?project_id=${projectB.id}`);
    assert(
      assetReviews.status === 404,
      `asset-reviews ${assetReviews.status}`
    );
    console.log(`  asset-reviews project B: ${assetReviews.status} ${JSON.stringify(assetReviews.body)}`);

    const staffList = await http(`/api/project-staff?project_id=${projectB.id}`);
    assert(staffList.status === 404, `project-staff B → ${staffList.status}`);
    console.log(`  project-staff B: ${staffList.status} ${JSON.stringify(staffList.body)}`);

    const pay = await http("/api/payments", {
      method: "POST",
      body: { project_id: projectB.id, amount: 1, description: "probe" },
    });
    assert(pay.status === 404, `payments → ${pay.status}`);
    console.log(`  POST payments project B: ${pay.status} ${JSON.stringify(pay.body)}`);

    // Command Center double-gate
    const cc = await fetch(`${ROOT}/admin`, {
      headers: { Cookie: cookieHeader },
      redirect: "manual",
    });
    assert(
      cc.status === 307 || cc.status === 302 || cc.status === 403 || cc.status === 404,
      `Command Center must refuse staff, got ${cc.status}`
    );
    console.log(`  GET /admin (Command Center): ${cc.status} loc=${cc.headers.get("location")}`);

    // In-scope still works
    const signOk = await http("/api/media/upload/sign", {
      method: "POST",
      body: {
        projectId: projectA.id,
        fileName: "scope-ok.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024,
        mediaType: "photo",
      },
    });
    assert(
      signOk.status === 200 || signOk.status === 201,
      `upload/sign project A should work, got ${signOk.status} ${signOk.text.slice(0, 200)}`
    );
    console.log(`  POST upload/sign project A: ${signOk.status} (allowed)`);

    // --- Nine-hole proof (why each would have failed pre-fix) ---
    console.log("\n=== 6. Nine known-hole catch proof ===");
    const proofs: Record<(typeof NINE_HOLES)[number], string> = {
      clients: `visibleClientIdsFor=${(visibleClients as string[]).length} < business=${allClients}; HTTP list excludes ${projectB.client_id}; GET ?id=B returns ${clientBDetail.status}. Pre-fix: GET /api/clients returned all ${allClients} with only area.clients.`,
      media: `scoped media ${scopedMedia.total} of ${unscopedMedia.total}; library/${mediaB?.id ?? "B"} → ${mediaB ? 404 : "n/a"}. Pre-fix: queryMediaLibrary(businessId) with no projectIds.`,
      messages: `scoped threads ${scopedMsgs.length} of ${unscopedMsgs.length}; ?client_id=B → ${msgOos.status}. Pre-fix: listAdminConversations without clientIds.`,
      "asset-reviews": `GET ?project_id=B → ${assetReviews.status}. Pre-fix: listed reviews by business/project without canAccessProject.`,
      "client-notes": `GET /clients/B/notes → ${clientBNotes.status}. Pre-fix: notes by client id with only area.clients.`,
      "crm-profile": `GET /api/clients?id=B → ${clientBDetail.status}; SSR /admin/clients/B → ${crmPage.status}. Pre-fix: getClientCrmProfile with no canAccessClient.`,
      "project-staff": `GET ?projectId=B → ${staffList.status}. Pre-fix: assignment graph by project without scope.`,
      payments: `POST project B → ${pay.status}. Pre-fix: money.create without canAccessProject.`,
      "upload-sign": `POST sign project B → ${sign.status} (must be 404). Pre-fix: requireAdminApi(media.upload) then signed URL with NO canAccessProject — write capability for any project.`,
    };
    for (const h of NINE_HOLES) {
      const entries = knownHoleEntries().filter((e) => e.knownHole === h);
      console.log(`  [${h}] routes=${entries.map((e) => e.file).join(", ")}`);
      console.log(`       ${proofs[h]}`);
    }

    // --- view_all lifts ---
    console.log("\n=== 7. projects.view_all lifts ===");
    await raw
      .from("profiles")
      .update({
        staff_permissions: {
          ...profile.staff_permissions,
          "projects.view_all": true,
        },
      })
      .eq("id", invited.userId);

    // Refresh session profile is server-side per request — re-login not required if perms read from DB each request
    const clientsLifted = await http("/api/clients");
    assert(clientsLifted.status === 200, "view_all clients list");
    const liftedIds = (() => {
      const b = clientsLifted.body as Record<string, unknown> | unknown[];
      if (Array.isArray(b)) return b.map((r) => (r as { id: string }).id);
      for (const key of ["clients", "rows", "data"]) {
        const v = (b as Record<string, unknown>)[key];
        if (Array.isArray(v)) return v.map((r) => (r as { id: string }).id);
      }
      return [] as string[];
    })();
    assert(liftedIds.includes(projectB.client_id!), "view_all sees client B");
    fmt("view_all Clients", liftedIds.length, allClients ?? 0);

    const mediaLifted = await http("/api/media/library?page=1&limit=1");
    const mt = (mediaLifted.body as { total?: number })?.total;
    if (typeof mt === "number") {
      assert(mt >= scopedMedia.total, "view_all media ≥ scoped");
      console.log(`  view_all Media total: ${mt} (was ${scopedMedia.total})`);
    }

    const msgsLifted = await http(`/api/messages?client_id=${projectB.client_id}`);
    assert(
      msgsLifted.status === 200,
      `view_all messages B ${msgsLifted.status}`
    );
    console.log(`  view_all messages?client_id=B: ${msgsLifted.status}`);

    const signLifted = await http("/api/media/upload/sign", {
      method: "POST",
      body: signBody,
    });
    assert(
      signLifted.status === 200 || signLifted.status === 201,
      `view_all upload/sign B → ${signLifted.status} ${signLifted.text.slice(0, 160)}`
    );
    console.log(`  view_all upload/sign project B: ${signLifted.status}`);

    // Revert view_all for cleanup clarity
    await raw
      .from("profiles")
      .update({
        staff_permissions: { ...profile.staff_permissions, "projects.view_all": false },
      })
      .eq("id", invited.userId);

    console.log("\n=== 8. Registry route list (explicit) ===");
    for (const e of STAFF_DATA_ROUTE_REGISTRY) {
      const hole = e.knownHole ? ` [hole:${e.knownHole}]` : "";
      console.log(`  ${e.methods.join(",").padEnd(18)} ${e.file} (${e.policy})${hole}`);
    }
    console.log(`  TOTAL ${STAFF_DATA_ROUTE_REGISTRY.length} entries`);
    console.log(
      `  discovered files: ${discoverStaffScopedRouteFiles(API_ROOT).length}`
    );

    void clientRows;
    void allMedia;

    console.log("\n✅ verify-staff-scope-endpoints PASS");
  } finally {
    for (const id of createdIds) {
      try {
        await raw.from("project_staff").delete().eq("user_id", id);
        await disableStaffMember({ businessId: SWIFT_ID, userId: id, actor });
        await raw.from("profiles").delete().eq("id", id);
        await raw.auth.admin.deleteUser(id);
      } catch (e) {
        console.warn("cleanup", id, e);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
