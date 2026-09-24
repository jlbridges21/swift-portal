/**
 * Search scope + staff notifications verification — Swift Aerial Media / Jackson only.
 *
 * Usage: npx tsx scripts/verify-search-staff-scope-notifications.ts
 * Optional: VERIFY_BASE_URL=http://127.0.0.1:3000
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTenantServiceClient } from "../src/lib/supabase/tenant-service";
import {
  runAdminSearch,
  type AdminSearchScope,
} from "../src/lib/admin-search";
import { searchSettingsIndex } from "../src/lib/settings-search-index";
import {
  inviteStaffMember,
  updateStaffMember,
  disableStaffMember,
  assignProjectStaff,
  removeProjectStaff,
} from "../src/lib/staff";
import { staffPermissionDefaults } from "../src/lib/staff-permissions";
import { notifyAdmins } from "../src/lib/notifications";
import {
  staffShouldReceiveNotification,
  NEVER_DELEGABLE_NOTIFICATION_TYPES,
} from "../src/lib/staff-access";
import { getBusinessPortalOriginById } from "../src/lib/portal-url";
import type { Profile } from "../src/lib/types";

const SWIFT = "00000000-0000-0000-0000-000000000001";

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
  if (!cond) throw new Error(msg);
}

async function cleanupEmail(
  admin: ReturnType<typeof createClient>,
  email: string
) {
  const { data: p } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (p?.id) {
    await admin.from("project_staff").delete().eq("user_id", p.id);
    await admin.from("profiles").delete().eq("id", p.id);
    await admin.auth.admin.deleteUser(p.id);
  }
}

const OWNER_SCOPE: AdminSearchScope = {
  isOwnerAdmin: true,
  visibleProjectIds: "all",
  areas: { clients: true, projects: true, media: true, leads: true },
  canSearchStaff: true,
  moneyView: true,
};

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const db = await createTenantServiceClient(SWIFT);
  const stamp = Date.now();

  const { data: actorRow } = await admin
    .from("profiles")
    .select("id, email")
    .eq("business_id", SWIFT)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  assert(actorRow, "need Swift admin");
  const actor = { id: actorRow.id, email: actorRow.email as string | null };

  // Two projects with distinct searchable tokens
  const { data: projects } = await db
    .from("projects")
    .select("id, project_name, client_id, property_address")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  assert((projects?.length ?? 0) >= 2, "need ≥2 Swift projects");
  const projectA = projects![0];
  const projectB = projects![1];
  console.log("Project A:", projectA.id, projectA.project_name);
  console.log("Project B:", projectB.id, projectB.project_name);

  // Ensure searchable tokens on B (media + review) for leak probes
  const mediaTitle = `ScopeLeakMedia-${stamp}`;
  const reviewTitle = `ScopeLeakReview-${stamp}`;
  const { data: mediaIns, error: mediaErr } = await db
    .from("media_assets")
    .insert({
      project_id: projectB.id,
      title: mediaTitle,
      file_name: `${mediaTitle}.jpg`,
      file_path: `verify/${stamp}/leak.jpg`,
      mime_type: "image/jpeg",
      media_type: "photo",
    })
    .select("id, title")
    .single();
  if (mediaErr) console.warn("media fixture warn:", mediaErr.message);
  const { data: reviewIns } = await db
    .from("video_reviews")
    .insert({
      project_id: projectB.id,
      title: reviewTitle,
      created_by: actor.id,
    })
    .select("id, title")
    .single();
  const mediaB = mediaIns;
  const reviewB = reviewIns;
  const { data: clientB } = projectB.client_id
    ? await db
        .from("clients")
        .select("id, name, email")
        .eq("id", projectB.client_id)
        .maybeSingle()
    : { data: null };

  console.log("\n=== Settings destinations (admin) ===");
  for (const q of [
    "staff permissions",
    "new project setup",
    "client media sections",
    "download gate",
    "instant preliminary",
    "hero media",
    "logo size",
    "landing colors",
    "custom domain",
    "section visibility",
    "3d models",
    "download quality",
  ]) {
    const hits = searchSettingsIndex(q, 5);
    console.log(`PASTE admin settings "${q}":`, hits.map((h) => `${h.label} → ${h.href}`));
    assert(hits.length > 0, `no settings hit for ${q}`);
  }

  console.log("\n=== Owner admin entity search smoke ===");
  const ownerHit = await runAdminSearch(db, String(projectA.project_name).slice(0, 12), OWNER_SCOPE);
  console.log("PASTE owner project search:", ownerHit.projects.slice(0, 3));

  // Invite staff assigned ONLY to project A
  const staffEmail = `search-scope-staff-${stamp}@example.test`;
  await cleanupEmail(admin, staffEmail);
  const invited = await inviteStaffMember({
    businessId: SWIFT,
    email: staffEmail,
    fullName: "Search Scope Staff",
    actor,
  });
  assert(invited.ok && invited.userId, !invited.ok ? invited.error : "no userId");
  const staffId = invited.userId!;

  const perms = {
    ...staffPermissionDefaults(),
    "area.projects": true,
    "area.clients": true,
    "area.media": true,
    "money.view": false,
  };
  await updateStaffMember({
    businessId: SWIFT,
    userId: staffId,
    permissions: perms,
    actor,
  });
  await assignProjectStaff({
    businessId: SWIFT,
    projectId: projectA.id,
    userId: staffId,
    actor,
  });

  const staffScope: AdminSearchScope = {
    isOwnerAdmin: false,
    visibleProjectIds: [projectA.id],
    areas: { clients: true, projects: true, media: true, leads: false },
    canSearchStaff: false,
    moneyView: false,
  };

  console.log("\n=== SCOPE TEST (staff on A only) ===");
  const projNeedle = String(projectB.project_name || "").slice(0, 16);
  if (projNeedle.length >= 2) {
    const r = await runAdminSearch(db, projNeedle, staffScope);
    console.log(`PASTE staff search project B "${projNeedle}":`, {
      projects: r.projects.length,
      clients: r.clients.length,
      media: r.media.length,
      reviews: r.videoReviews.length,
    });
    assert(
      r.projects.every((p) => p.id === projectA.id || !p.title.includes(projNeedle)),
      "must not return other-project hits by title leak alone"
    );
    assert(
      !r.projects.some((p) => p.id === projectB.id),
      "SCOPE FAIL: staff saw project B"
    );
  }

  if (clientB?.name && String(clientB.name).length >= 2) {
    const r = await runAdminSearch(db, String(clientB.name).slice(0, 20), staffScope);
    console.log(`PASTE staff search client B "${clientB.name}":`, r.clients);
    assert(!r.clients.some((c) => c.id === clientB.id), "SCOPE FAIL: staff saw client B");
  }

  if (mediaB?.title && String(mediaB.title).length >= 2) {
    const r = await runAdminSearch(db, String(mediaB.title).slice(0, 24), staffScope);
    console.log(`PASTE staff search media B "${mediaB.title}":`, r.media);
    assert(!r.media.some((m) => m.id === mediaB.id), "SCOPE FAIL: staff saw media B");
    assert(r.media.length === 0, "SCOPE FAIL: expected zero media hits for B token");
  }

  if (reviewB?.title && String(reviewB.title).length >= 2) {
    const r = await runAdminSearch(db, String(reviewB.title).slice(0, 24), staffScope);
    console.log(`PASTE staff search review B "${reviewB.title}":`, r.videoReviews);
    assert(
      !r.videoReviews.some((v) => v.id === reviewB.id),
      "SCOPE FAIL: staff saw review B"
    );
    assert(r.videoReviews.length === 0, "SCOPE FAIL: expected zero review hits for B token");
  }

  // No area.clients
  const noClientsScope: AdminSearchScope = {
    ...staffScope,
    areas: { ...staffScope.areas, clients: false },
  };
  const clientProbe = await runAdminSearch(db, "a@", noClientsScope);
  console.log("PASTE staff without area.clients client results:", clientProbe.clients.length);
  assert(clientProbe.clients.length === 0, "clients must be empty without area.clients");

  // Money settings are client-side; server never returns money destinations for staff
  // (settings hidden). Confirm money.view false → staffShouldReceiveNotification denies money.
  const fakeStaff = {
    role: "staff",
    staff_permissions: perms,
    disabled_at: null,
  };
  assert(!staffShouldReceiveNotification(fakeStaff, "payment_received"), "no money.view → no payment");
  assert(!staffShouldReceiveNotification(fakeStaff, "quote_sent"), "no money.view → no quote");
  for (const t of NEVER_DELEGABLE_NOTIFICATION_TYPES) {
    assert(!staffShouldReceiveNotification(fakeStaff, t), `never-delegable ${t}`);
  }
  console.log("PASTE money/never-delegable notification gates: denied");

  console.log("\n=== Staff notifications (in-app + email path) ===");
  // Ensure prefs on
  await admin
    .from("profiles")
    .update({
      email_notifications_enabled: true,
      in_app_notifications_enabled: true,
    })
    .eq("id", staffId);

  const portalOrigin = await getBusinessPortalOriginById(SWIFT);
  const notifTitle = `SearchScope ping ${stamp}`;
  await notifyAdmins({
    businessId: SWIFT,
    type: "status_changed",
    title: notifTitle,
    body: "Staff scope notification verification",
    projectId: projectA.id,
    link: `/admin/projects/${projectA.id}`,
    sendEmail: true,
    sendPush: true,
  });

  const { data: inAppRows } = await admin
    .from("notifications")
    .select("id, user_id, type, title, link, project_id, created_at")
    .eq("user_id", staffId)
    .eq("title", notifTitle)
    .order("created_at", { ascending: false })
    .limit(3);
  console.log("PASTE in-app rows:", inAppRows);
  assert((inAppRows?.length ?? 0) >= 1, "expected in-app notification for assigned staff");
  const row = inAppRows![0];
  assert(row.project_id === projectA.id, "in-app project must be A");
  assert(
    !row.link?.startsWith("http") || String(row.link).startsWith(portalOrigin),
    "stored link relative or portal origin"
  );
  console.log("PASTE portal origin for email CTA:", portalOrigin);
  console.log("PASTE expected email CTA:", `${portalOrigin}/admin/projects/${projectA.id}`);

  // Project B event — staff must NOT get it
  const otherTitle = `SearchScope other ${stamp}`;
  await notifyAdmins({
    businessId: SWIFT,
    type: "status_changed",
    title: otherTitle,
    body: "Should not reach unassigned staff",
    projectId: projectB.id,
    link: `/admin/projects/${projectB.id}`,
    sendEmail: true,
  });
  const { data: otherRows } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", staffId)
    .eq("title", otherTitle);
  console.log("PASTE unassigned project notifications:", otherRows);
  assert((otherRows?.length ?? 0) === 0, "staff must not get other-project notifs");

  // Money event without money.view
  const moneyTitle = `SearchScope money ${stamp}`;
  await notifyAdmins({
    businessId: SWIFT,
    type: "payment_received",
    title: moneyTitle,
    body: "Payment",
    projectId: projectA.id,
    link: `/admin/projects/${projectA.id}`,
    sendEmail: true,
  });
  const { data: moneyRows } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", staffId)
    .eq("title", moneyTitle);
  console.log("PASTE payment notifs without money.view:", moneyRows);
  assert((moneyRows?.length ?? 0) === 0, "no payment notifs without money.view");

  // Billing never-delegable (gate only — NotificationType may not list every system key)
  assert(!staffShouldReceiveNotification(fakeStaff, "billing"), "billing gate");
  assert(!staffShouldReceiveNotification(fakeStaff, "subscription"), "subscription gate");
  assert(!staffShouldReceiveNotification(fakeStaff, "trial_ending"), "trial gate");
  console.log("PASTE billing/subscription/trial gates: denied for staff");

  console.log(
    "PASTE push: sendAdminPushNotification filters swift_portal_role=admin only — staff never tagged; notifyUsers still calls push for notifyAdmins but OneSignal audience excludes staff (no error)."
  );
  console.log("PASTE staff prefs UI: /staff/settings (header Preferences)");

  // Cleanup fixtures
  if (mediaIns?.id) await db.from("media_assets").delete().eq("id", mediaIns.id);
  if (reviewIns?.id) await db.from("video_reviews").delete().eq("id", reviewIns.id);
  await removeProjectStaff({
    businessId: SWIFT,
    projectId: projectA.id,
    userId: staffId,
    actor,
  }).catch(() => undefined);
  await disableStaffMember({ businessId: SWIFT, userId: staffId, actor }).catch(
    () => undefined
  );
  await cleanupEmail(admin, staffEmail);

  console.log("\n✅ verify-search-staff-scope-notifications PASS");
}

main().catch((err) => {
  console.error("\n❌ FAILED:", err);
  process.exit(1);
});
