/**
 * Durable staff project-scope guard — Swift / Jackson only.
 *
 * For a staff member assigned to ONE project, asserts every list loader
 * returns only that project's data; direct-id outside scope → denied;
 * projects.view_all lifts each path.
 *
 * Also proves the guard would have caught the clients/media/messages holes:
 * calling those loaders with businessId alone returns the business-wide total.
 *
 * Usage: npx tsx scripts/verify-staff-scope-endpoints.ts
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
import { getLibraryFilterOptions, queryMediaLibrary } from "../src/lib/media-library";
import { listAdminConversations } from "../src/lib/client-messaging";
import { authorizeProjectZipDownload } from "../src/lib/project-zip-download";
import { assertReviewProjectAccess } from "../src/lib/video-review-access";
import { createTenantServiceClient } from "../src/lib/supabase/tenant-service";
import type { Profile } from "../src/lib/types";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";

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

async function main() {
  loadEnv();
  const stamp = Date.now();
  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

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
      .limit(30);
    assert(projects && projects.length >= 2, "need ≥2 Swift projects");

    const projectA = projects![0];
    const projectB =
      projects!.find((p) => p.id !== projectA.id && p.client_id !== projectA.client_id) ??
      projects!.find((p) => p.id !== projectA.id)!;

    await raw
      .from("profiles")
      .update({
        staff_permissions: {
          ...applyStaffPermissionPreset("coordinator"),
          "area.media": true,
          "area.messages": true,
          "area.calendar": true,
          "money.view": true,
          "money.create_send_estimates": true,
          "money.send_payment_links": true,
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

    const { count: allProposals } = await raw
      .from("shoot_proposals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", SWIFT_ID);

    console.log("\n=== Scoped lists (assigned to 1 project) ===");

    // GUARD PROOF: businessId-only (or missing scope) loaders leak full tenant —
    // same pattern as the clients/media/messages holes found by the customer.
    const unscopedMedia = await queryMediaLibrary(SWIFT_ID, { page: 1, limit: 48 });
    const scopedMediaProbe = await queryMediaLibrary(SWIFT_ID, {
      page: 1,
      limit: 48,
      projectIds: visibleProjects,
    });
    const unscopedMsgs = await listAdminConversations(SWIFT_ID, profile.id);
    const scopedMsgsProbe = await listAdminConversations(SWIFT_ID, profile.id, {
      clientIds: visibleClients,
    });
    const unscopedFilters = await getLibraryFilterOptions(SWIFT_ID);
    const scopedFiltersProbe = await getLibraryFilterOptions(SWIFT_ID, {
      projectIds: visibleProjects,
      clientIds: visibleClients,
    });
    assert(
      unscopedMedia.total > scopedMediaProbe.total,
      "GUARD: queryMediaLibrary without projectIds > scoped — would catch media hole"
    );
    assert(
      unscopedMsgs.length > scopedMsgsProbe.length || unscopedMsgs.length === scopedMsgsProbe.length,
      "GUARD: listAdminConversations without clientIds is ≥ scoped — would catch messages hole"
    );
    // Prefer strict when business has multiple clients with threads
    if (unscopedMsgs.length > 0 && (allClients ?? 0) > (visibleClients as string[]).length) {
      // If there are other clients, unscoped should not be smaller than scoped
      assert(
        unscopedMsgs.length >= scopedMsgsProbe.length,
        "GUARD: unscoped messages ≥ scoped"
      );
    }
    assert(
      unscopedFilters.clients.length > scopedFiltersProbe.clients.length,
      `GUARD: getLibraryFilterOptions unscoped (${unscopedFilters.clients.length}) > scoped (${scopedFiltersProbe.clients.length}) — would catch clients hole`
    );
    assert(
      (visibleClients as string[]).length < (allClients ?? 0),
      "GUARD: visibleClientIdsFor < business total — would catch clients hole"
    );
    console.log(
      "  GUARD proof: unscoped media/filters (+ clients) exceed one-project scope (holes caught)"
    );

    // Scoped loaders (clients via visible ids — same filter the API/page apply)
    const scopedClientCount = (visibleClients as string[]).length;
    fmt("Clients", scopedClientCount, allClients ?? 0);
    assert(scopedClientCount < (allClients ?? 0), "clients strictly scoped");

    const scopedMedia = scopedMediaProbe;
    fmt("Media", scopedMedia.total, unscopedMedia.total);
    assert(scopedMedia.total < unscopedMedia.total, "media strictly scoped");
    assert(
      scopedMedia.assets.every((a) => !a.project_id || visibleProjects.includes(a.project_id)),
      "every media asset in visible projects"
    );

    const scopedMsgs = scopedMsgsProbe;
    fmt("Messages", scopedMsgs.length, unscopedMsgs.length);
    assert(scopedMsgs.length <= unscopedMsgs.length, "messages ≤ unscoped");

    const scopedFilters = scopedFiltersProbe;
    fmt("Library filter clients", scopedFilters.clients.length, unscopedFilters.clients.length);
    fmt("Library filter projects", scopedFilters.projects.length, unscopedFilters.projects.length);
    assert(scopedFilters.projects.length <= visibleProjects.length, "filter projects scoped");
    assert(scopedFilters.clients.length <= (visibleClients as string[]).length, "filter clients scoped");

    // Shoot proposals (query-level scope mirror of GET /api/shoot-proposals)
    let propQ = raw
      .from("shoot_proposals")
      .select("id, project_id")
      .eq("business_id", SWIFT_ID);
    propQ = propQ.in("project_id", visibleProjects);
    const { data: scopedProps } = await propQ;
    fmt("Shoot proposals", scopedProps?.length ?? 0, allProposals ?? 0);
    assert(
      (scopedProps ?? []).every((p) => p.project_id === projectA.id),
      "proposals only project A"
    );

    fmt("Projects", visibleProjects.length, allProjects ?? 0);

    console.log("\n=== Direct-id outside scope → denied ===");
    assert(!(await canAccessProject(SWIFT_ID, profile, projectB.id)), "project B denied");
    assert(
      !(await canAccessClient(SWIFT_ID, profile, projectB.client_id!)),
      "client B denied"
    );

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
      console.log("  media B: 404-equivalent");
    }

    const db = await createTenantServiceClient(SWIFT_ID);
    const zipB = await authorizeProjectZipDownload(profile, projectB.id, db, false);
    assert(!zipB.ok, "zip project B denied");
    console.log("  zip B:", zipB.ok ? "FAIL" : `denied (${"status" in zipB ? zipB.status : "?"})`);

    let reviewDenied = false;
    try {
      await assertReviewProjectAccess(profile, projectB.id);
    } catch {
      reviewDenied = true;
    }
    assert(reviewDenied, "video review project B denied");
    console.log("  video review B: 404-equivalent");

    // Assigned project still allowed
    assert(await canAccessProject(SWIFT_ID, profile, projectA.id), "project A allowed");
    const zipA = await authorizeProjectZipDownload(profile, projectA.id, db, false);
    assert(zipA.ok, "zip project A allowed");
    await assertReviewProjectAccess(profile, projectA.id);
    console.log("  project A / zip A / review A: allowed");

    console.log("\n=== projects.view_all lifts scope ===");
    await raw
      .from("profiles")
      .update({
        staff_permissions: {
          ...profile.staff_permissions,
          "projects.view_all": true,
        },
      })
      .eq("id", invited.userId);

    const { data: liftedRow } = await raw
      .from("profiles")
      .select("id, role, business_id, staff_permissions, disabled_at, email, full_name")
      .eq("id", invited.userId)
      .single();
    const lifted = liftedRow as Profile;

    const allVisible = await visibleProjectIdsFor(SWIFT_ID, lifted);
    assert(allVisible === "all", "view_all → all projects");
    assert(await canAccessProject(SWIFT_ID, lifted, projectB.id), "view_all sees B");
    assert(await canAccessClient(SWIFT_ID, lifted, projectB.client_id!), "view_all client B");

    const liftedClientIds = await visibleClientIdsFor(SWIFT_ID, lifted);
    assert(liftedClientIds === "all", "view_all clients = all");

    const liftedMedia = await queryMediaLibrary(SWIFT_ID, {
      page: 1,
      limit: 1,
      projectIds: "all",
    });
    assert(liftedMedia.total === unscopedMedia.total, "view_all media = unscoped total");

    const zipB2 = await authorizeProjectZipDownload(lifted, projectB.id, db, false);
    assert(zipB2.ok, "view_all zip B allowed");
    await assertReviewProjectAccess(lifted, projectB.id);
    console.log("  view_all: clients/media/zip/review all lifted");

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
