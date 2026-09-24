/**
 * Staff fixes verification — Swift / Jackson only.
 * 1) Removed staff hidden; re-invite reactivates
 * 2) Clients/media/messages scoped to assigned projects
 * 3) Admin promote + seats + owner protection
 *
 * Usage: npx tsx scripts/verify-staff-fixes-scope-admin.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  demoteAdminToStaff,
  disableStaffMember,
  getBusinessOwnerUserId,
  getBusinessSeatSnapshot,
  inviteStaffMember,
  listStaffMembers,
  listTeamMembers,
  promoteStaffToAdmin,
  assignProjectStaff,
} from "../src/lib/staff";
import {
  canAccessClient,
  canAccessMediaAsset,
  visibleClientIdsFor,
  visibleProjectIdsFor,
} from "../src/lib/staff-access";
import { queryMediaLibrary } from "../src/lib/media-library";
import { listAdminConversations } from "../src/lib/client-messaging";
import { applyStaffPermissionPreset } from "../src/lib/staff-permissions";
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

  const ownerId = await getBusinessOwnerUserId(SWIFT_ID);
  console.log("owner_user_id:", ownerId, "(earliest admin backfill / create)");
  assert(ownerId, "owner_user_id must be set");

  // Ensure Studio seats = 3
  const seats0 = await getBusinessSeatSnapshot(SWIFT_ID);
  console.log("admin seats snapshot:", seats0);
  assert(seats0.limit === 3, `Studio admin_seats should be 3, got ${seats0.limit}`);

  const emailA = `staff-fix-a-${stamp}@swift-test.local`;
  const createdIds: string[] = [];

  // --- 1. Invite, disable, hide, reactivate ---
  console.log("\n=== 1. Remove hides; re-invite reactivates ===");
  const invited = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: emailA,
    fullName: "Scope Test A",
    actor,
  });
  assert(invited.ok, invited.ok ? "" : invited.error);
  createdIds.push(invited.userId);

  const listed1 = await listStaffMembers(SWIFT_ID);
  assert(listed1.some((s) => s.id === invited.userId), "active list includes invitee");

  await disableStaffMember({ businessId: SWIFT_ID, userId: invited.userId, actor });
  const listed2 = await listStaffMembers(SWIFT_ID);
  assert(!listed2.some((s) => s.id === invited.userId), "disabled hidden from default list");

  const { data: disabledRow } = await raw
    .from("profiles")
    .select("id, email, role, disabled_at, business_id")
    .eq("id", invited.userId)
    .single();
  console.log("disabled row (still exists):", disabledRow);
  assert(disabledRow?.disabled_at, "disabled_at set");

  const withDisabled = await listStaffMembers(SWIFT_ID, { includeDisabled: true });
  assert(withDisabled.some((s) => s.id === invited.userId), "includeDisabled shows removed");

  const reinvited = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: emailA,
    fullName: "Scope Test A Again",
    actor,
  });
  assert(reinvited.ok, reinvited.ok ? "" : reinvited.error);
  assert(reinvited.userId === invited.userId, "same row reactivated");
  assert(reinvited.reinvited, "reinvited flag");
  const { data: reactivated } = await raw
    .from("profiles")
    .select("id, disabled_at, full_name")
    .eq("id", invited.userId)
    .single();
  console.log("reactivated:", reactivated);
  assert(!reactivated?.disabled_at, "disabled_at cleared");

  // --- 2-7. Scope clients/media/messages ---
  console.log("\n=== 2. Scope clients/media/messages ===");
  const { data: projects } = await raw
    .from("projects")
    .select("id, client_id, project_name")
    .eq("business_id", SWIFT_ID)
    .is("deleted_at", null)
    .limit(20);
  assert(projects && projects.length >= 2, "need ≥2 Swift projects");

  const projectA = projects![0];
  const projectB = projects!.find((p) => p.id !== projectA.id && p.client_id !== projectA.client_id) ??
    projects!.find((p) => p.id !== projectA.id)!;

  // Grant area perms + assign only project A
  await raw
    .from("profiles")
    .update({
      staff_permissions: {
        ...applyStaffPermissionPreset("coordinator"),
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

  const { data: staffProfile } = await raw
    .from("profiles")
    .select("id, role, business_id, staff_permissions, disabled_at, email, full_name")
    .eq("id", invited.userId)
    .single();
  const profile = staffProfile as Profile;

  const visibleProjects = await visibleProjectIdsFor(SWIFT_ID, profile);
  console.log("visible projects:", visibleProjects);
  assert(Array.isArray(visibleProjects) && visibleProjects.includes(projectA.id), "sees project A");
  assert(!(visibleProjects as string[]).includes(projectB.id), "does not see project B");

  const visibleClients = await visibleClientIdsFor(SWIFT_ID, profile);
  console.log("visible clients:", visibleClients);
  assert(Array.isArray(visibleClients), "client list scoped");

  const { count: allClientCount } = await raw
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("business_id", SWIFT_ID)
    .is("deleted_at", null);

  let scopedClientQuery = raw
    .from("clients")
    .select("id, name, email")
    .eq("business_id", SWIFT_ID)
    .is("deleted_at", null);
  if (Array.isArray(visibleClients) && visibleClients.length) {
    scopedClientQuery = scopedClientQuery.in("id", visibleClients);
  } else if (Array.isArray(visibleClients)) {
    scopedClientQuery = scopedClientQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: scopedClientRows } = await scopedClientQuery;
  const scopedClients = scopedClientRows ?? [];
  console.log("clients: scoped", scopedClients.length, "of business", allClientCount);
  assert(
    (allClientCount ?? 0) === 0 ||
      scopedClients.length < (allClientCount ?? 0) ||
      (allClientCount ?? 0) <= 1,
    "scoped < full (or tiny biz)"
  );
  for (const c of scopedClients) {
    assert((visibleClients as string[]).includes(c.id), `client ${c.id} in scope`);
  }

  // Outside client → canAccess false (404 semantics)
  const { data: allClientRows } = await raw
    .from("clients")
    .select("id")
    .eq("business_id", SWIFT_ID)
    .is("deleted_at", null)
    .limit(50);
  const outsideClient = (allClientRows ?? []).find(
    (c) => !(visibleClients as string[]).includes(c.id)
  );
  if (outsideClient) {
    assert(!(await canAccessClient(SWIFT_ID, profile, outsideClient.id)), "outside client denied");
    console.log("outside client 404-path:", outsideClient.id);
  }

  const allMedia = await queryMediaLibrary(SWIFT_ID, { page: 1, limit: 100, projectIds: "all" });
  const scopedMedia = await queryMediaLibrary(SWIFT_ID, {
    page: 1,
    limit: 100,
    projectIds: visibleProjects as string[],
  });
  console.log("media: scoped", scopedMedia.total, "of business", allMedia.total);
  for (const a of scopedMedia.assets) {
    if (a.project_id) {
      assert((visibleProjects as string[]).includes(a.project_id), `media ${a.id} on assigned project`);
    }
  }
  const outsideMedia = allMedia.assets.find(
    (a) => a.project_id && !(visibleProjects as string[]).includes(a.project_id)
  );
  if (outsideMedia) {
    assert(
      !(await canAccessMediaAsset(SWIFT_ID, profile, outsideMedia.project_id)),
      "outside media denied"
    );
    console.log("outside media 404-path:", outsideMedia.id);
  }

  const allThreads = await listAdminConversations(SWIFT_ID, invited.userId, { clientIds: "all" });
  const scopedThreads = await listAdminConversations(SWIFT_ID, invited.userId, {
    clientIds: visibleClients as string[],
  });
  console.log("messages: scoped", scopedThreads.length, "of business", allThreads.length);
  for (const t of scopedThreads) {
    assert((visibleClients as string[]).includes(t.client_id), `thread ${t.client_id} in scope`);
  }

  // view_all lifts
  await raw
    .from("profiles")
    .update({
      staff_permissions: {
        ...applyStaffPermissionPreset("coordinator"),
        "projects.view_all": true,
      },
    })
    .eq("id", invited.userId);
  const { data: viewAllProfile } = await raw
    .from("profiles")
    .select("id, role, business_id, staff_permissions, disabled_at")
    .eq("id", invited.userId)
    .single();
  const liftedClients = await visibleClientIdsFor(SWIFT_ID, viewAllProfile as Profile);
  assert(liftedClients === "all", "view_all lifts clients");
  console.log("view_all clients:", liftedClients);

  // --- Admin promote / seats / owner ---
  console.log("\n=== 3. Admin preset + seats + owner protect ===");
  // Reset view_all for promote test
  await raw
    .from("profiles")
    .update({ staff_permissions: applyStaffPermissionPreset("editor") })
    .eq("id", invited.userId);

  // Create enough admins to fill seats if needed
  const seatsBefore = await getBusinessSeatSnapshot(SWIFT_ID);
  console.log("seats before promote:", seatsBefore);

  // Demote any non-owner test admins from prior runs? Use fresh emails for co-admins
  const adminEmails: string[] = [];
  const adminIds: string[] = [];
  while ((await getBusinessSeatSnapshot(SWIFT_ID)).used < 3) {
    const e = `coadmin-${stamp}-${adminEmails.length}@swift-test.local`;
    const inv = await inviteStaffMember({
      businessId: SWIFT_ID,
      email: e,
      fullName: `CoAdmin ${adminEmails.length}`,
      actor,
    });
    assert(inv.ok, inv.ok ? "" : inv.error);
    createdIds.push(inv.userId);
    const promo = await promoteStaffToAdmin({
      businessId: SWIFT_ID,
      userId: inv.userId,
      actor,
    });
    assert(promo.ok, promo.ok ? "" : promo.error);
    adminEmails.push(e);
    adminIds.push(inv.userId);
    console.log("promoted", e, "seats", promo.seats);
  }

  const atCap = await getBusinessSeatSnapshot(SWIFT_ID);
  console.log("at admin cap:", atCap);
  assert(atCap.used === 3 && atCap.limit === 3, "3 of 3 admin seats");

  // Promote staff A should fail
  const refuse = await promoteStaffToAdmin({
    businessId: SWIFT_ID,
    userId: invited.userId,
    actor,
  });
  assert(!refuse.ok && refuse.code === "seat_limit", "third+ admin refused");
  console.log("seat refuse:", refuse.ok ? null : refuse.error);

  // Staff still unlimited — invite 10 while at cap
  const staffBulk: string[] = [];
  for (let i = 0; i < 10; i++) {
    const e = `staff-bulk-${stamp}-${i}@swift-test.local`;
    const inv = await inviteStaffMember({
      businessId: SWIFT_ID,
      email: e,
      fullName: `Bulk ${i}`,
      actor,
    });
    assert(inv.ok, inv.ok ? "" : inv.error);
    createdIds.push(inv.userId);
    staffBulk.push(inv.userId);
  }
  const seatsAfterStaff = await getBusinessSeatSnapshot(SWIFT_ID);
  console.log("after 10 staff invites, admin seats unchanged:", seatsAfterStaff);
  assert(seatsAfterStaff.used === 3, "staff do not consume admin seats");

  // Demote one co-admin → frees seat
  const demoteTarget = adminIds[0];
  const demoted = await demoteAdminToStaff({
    businessId: SWIFT_ID,
    userId: demoteTarget,
    actor,
  });
  assert(demoted.ok, demoted.ok ? "" : demoted.error);
  console.log("demoted:", demoted.ok ? demoted.profile : null, "seats", demoted.ok ? demoted.seats : null);
  assert(demoted.ok && demoted.profile.role === "staff", "role=staff");
  assert(demoted.ok && demoted.seats.used === 2, "seat freed");

  // Owner cannot be demoted/removed
  const ownerDemote = await demoteAdminToStaff({
    businessId: SWIFT_ID,
    userId: ownerId!,
    actor,
  });
  assert(!ownerDemote.ok && ownerDemote.code === "owner_protected", "owner demote refused");
  console.log("owner demote refuse:", ownerDemote.ok ? null : ownerDemote.error);

  const ownerRemove = await disableStaffMember({
    businessId: SWIFT_ID,
    userId: ownerId!,
    actor,
  });
  assert(!ownerRemove.ok && ownerRemove.code === "owner_protected", "owner remove refused");
  console.log("owner remove refuse:", ownerRemove.ok ? null : ownerRemove.error);

  // Promote staff A now that seat free — reaches admin
  const promoA = await promoteStaffToAdmin({
    businessId: SWIFT_ID,
    userId: invited.userId,
    actor,
  });
  assert(promoA.ok, promoA.ok ? "" : promoA.error);
  const { data: promoRow } = await raw
    .from("profiles")
    .select("id, role, business_id")
    .eq("id", invited.userId)
    .single();
  console.log("promoted A:", promoRow);
  assert(promoRow?.role === "admin", "role=admin");

  const team = await listTeamMembers(SWIFT_ID);
  assert(team.some((t) => t.id === invited.userId && t.role === "admin"), "admin in team list");

  // Cleanup
  console.log("\n=== Cleanup ===");
  for (const id of [...new Set([...createdIds, ...adminIds, ...staffBulk])]) {
    if (id === ownerId) continue;
    await raw.from("project_staff").delete().eq("user_id", id);
    await raw.from("profiles").delete().eq("id", id);
    await raw.auth.admin.deleteUser(id);
  }

  console.log("\nALL STAFF FIXES CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
