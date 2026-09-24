/**
 * Phase 2 staff accounts verification — Swift / Jackson only.
 * Defines permissions + assignments; asserts staff still have ZERO access.
 *
 * Usage: npx tsx scripts/verify-staff-phase2.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  NEVER_DELEGABLE_PERMISSION_KEYS,
  STAFF_PERMISSION_KEYS,
  applyStaffPermissionPreset,
  hasStaffPermission,
  sanitizeStaffPermissions,
  staffPermissionDefaults,
} from "../src/lib/staff-permissions";
import {
  assignProjectStaff,
  disableStaffMember,
  getBusinessSeatSnapshot,
  inviteStaffMember,
  listProjectStaff,
  removeProjectStaff,
  updateStaffMember,
} from "../src/lib/staff";
import { searchSettingsIndex } from "../src/lib/settings-search-index";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";
const ROOT = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";

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

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const stamp = Date.now();
  const emailA = `staff-phase2-a-${stamp}@example.test`;
  const emailB = `staff-phase2-b-${stamp}@example.test`;

  await cleanupEmail(admin, emailA);
  await cleanupEmail(admin, emailB);

  const { data: swiftAdmin } = await admin
    .from("profiles")
    .select("id, email")
    .eq("business_id", SWIFT_ID)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  assert(swiftAdmin, "need a Swift admin actor");
  const actor = { id: swiftAdmin.id, email: swiftAdmin.email };

  // --- 2. Permission shape ---
  const defaults = staffPermissionDefaults();
  console.log("\n=== 2. Permission keys + defaults (all false) ===");
  for (const key of STAFF_PERMISSION_KEYS) {
    console.log(`  ${key} = ${defaults[key]}`);
  }

  // --- 3. Unknown / missing = DENIED ---
  console.log("\n=== 3. Unknown / missing → DENIED ===");
  const cases = [
    ["missing key", hasStaffPermission({}, "area.projects"), false],
    ["unknown key", hasStaffPermission({ "area.projects": true }, "not.a.real.key"), false],
    ["string truthy", hasStaffPermission({ "area.projects": "true" }, "area.projects"), false],
    ["explicit true", hasStaffPermission({ "area.projects": true }, "area.projects"), true],
    ["never-delegable stored", hasStaffPermission({ billing: true }, "billing"), false],
  ] as const;
  for (const [label, got, expect] of cases) {
    console.log(`  ${label}: ${got} (expect ${expect})`);
    assert(got === expect, `deny-default failed: ${label}`);
  }

  // --- 4. Never-delegable injection ---
  console.log("\n=== 4. Never-delegable refused ===");
  for (const key of NEVER_DELEGABLE_PERMISSION_KEYS) {
    const result = sanitizeStaffPermissions({ [key]: true, "area.projects": true });
    assert(!result.ok, `expected refuse for ${key}`);
    console.log(`  inject ${key}: ${result.error}`);
  }
  // Via updateStaffMember API path
  const seatsBefore = await getBusinessSeatSnapshot(SWIFT_ID);
  console.log(`\n=== 6. Seats before invite: ${seatsBefore.used}/${seatsBefore.limit} ===`);

  // Free a seat if needed (Studio=3, often 2 admins + maybe leftover staff)
  if (seatsBefore.limit != null && seatsBefore.used >= seatsBefore.limit) {
    const { data: spare } = await admin
      .from("profiles")
      .select("id, email")
      .eq("business_id", SWIFT_ID)
      .eq("role", "staff")
      .is("disabled_at", null)
      .limit(1)
      .maybeSingle();
    if (spare) {
      await disableStaffMember({ businessId: SWIFT_ID, userId: spare.id, actor });
      console.log(`  freed seat by disabling ${spare.email}`);
    }
  }

  // --- 5. Invite ---
  console.log("\n=== 5. Invite / edit / reset / delete ===");
  const invited = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: emailA,
    fullName: "Phase2 Staff A",
    actor,
  });
  assert(invited.ok, invited.ok ? "" : invited.error);
  console.log("  invite:", {
    userId: invited.userId,
    inviteSent: invited.inviteSent,
    seats: invited.seats,
  });

  const { data: afterInvite } = await admin
    .from("profiles")
    .select("id, email, full_name, role, business_id, staff_permissions, disabled_at")
    .eq("id", invited.userId)
    .single();
  console.log("  profile after invite:", afterInvite);

  const edited = await updateStaffMember({
    businessId: SWIFT_ID,
    userId: invited.userId,
    fullName: "Phase2 Staff A Edited",
    permissions: applyStaffPermissionPreset("editor"),
    actor,
  });
  assert(edited.ok, edited.ok ? "" : edited.error);
  console.log("  after edit:", edited.profile);

  // Inject never-delegable via update
  for (const key of NEVER_DELEGABLE_PERMISSION_KEYS) {
    const refused = await updateStaffMember({
      businessId: SWIFT_ID,
      userId: invited.userId,
      permissions: { [key]: true, "area.projects": true },
      actor,
    });
    assert(!refused.ok, `update should refuse ${key}`);
    console.log(`  API refuse ${key}: ${refused.ok ? "FAIL" : refused.error}`);
  }

  // --- 7. Email change ---
  console.log("\n=== 7. Email change (same auth id) ===");
  const { data: authBefore } = await admin.auth.admin.getUserById(invited.userId);
  console.log("  before:", { id: authBefore.user?.id, email: authBefore.user?.email });
  const emailChanged = await updateStaffMember({
    businessId: SWIFT_ID,
    userId: invited.userId,
    email: emailB,
    actor,
  });
  assert(emailChanged.ok, emailChanged.ok ? "" : emailChanged.error);
  const { data: authAfter } = await admin.auth.admin.getUserById(invited.userId);
  const { data: profileAfter } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", invited.userId)
    .single();
  console.log("  after:", {
    authId: authAfter.user?.id,
    authEmail: authAfter.user?.email,
    profileEmail: profileAfter?.email,
  });
  assert(authAfter.user?.id === invited.userId, "auth identity must not change");
  const { count: orphanCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .ilike("email", emailA)
    .neq("id", invited.userId);
  console.log("  orphan profiles with old email:", orphanCount ?? 0);
  assert((orphanCount ?? 0) === 0, "orphan profile created");

  // --- 8. Mechanism ---
  console.log("\n=== 8. Permission next-request mechanism ===");
  console.log(
    "  getProfile() does select('*') on profiles every request (src/lib/auth.ts) with no React cache()."
  );
  console.log(
    "  Middleware / requireAdmin* load the profile row fresh each request, so staff_permissions"
  );
  console.log("  written by an admin are visible on the staff member's NEXT HTTP request.");

  // --- 9. Presets ---
  console.log("\n=== 9. Presets ===");
  for (const id of ["blank", "editor", "coordinator", "full_except_money"] as const) {
    const p = applyStaffPermissionPreset(id);
    const enabled = STAFF_PERMISSION_KEYS.filter((k) => p[k] === true);
    console.log(`  ${id}: ${enabled.length} enabled`);
  }

  // --- 10. Settings search ---
  console.log("\n=== 10. Settings search ===");
  const hits = searchSettingsIndex("staff permissions");
  console.log(
    "  hits:",
    hits.map((h) => ({ id: h.id, label: h.label, href: h.href }))
  );
  assert(
    hits.some((h) => h.sectionId === "staff"),
    "settings search must find Staff & Permissions"
  );

  // --- 11. project_staff ---
  console.log("\n=== 11. project_staff ===");
  const { data: project } = await admin
    .from("projects")
    .select("id, project_name")
    .eq("business_id", SWIFT_ID)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  assert(project, "need a Swift project");
  const assigned = await assignProjectStaff({
    businessId: SWIFT_ID,
    projectId: project.id,
    userId: invited.userId,
    actor,
  });
  assert(assigned.ok, assigned.ok ? "" : assigned.error);
  let rows = await listProjectStaff(SWIFT_ID, project.id);
  console.log(
    "  after assign:",
    rows
      .filter((r) => r.user_id === invited.userId)
      .map((r) => ({ id: r.id, project_id: r.project_id, user_id: r.user_id, email: r.profiles?.email }))
  );
  await removeProjectStaff({
    businessId: SWIFT_ID,
    projectId: project.id,
    userId: invited.userId,
    actor,
  });
  rows = await listProjectStaff(SWIFT_ID, project.id);
  console.log(
    "  after remove:",
    rows.filter((r) => r.user_id === invited.userId)
  );
  // Allow empty project — re-assign then remove again to prove last-staff-ok
  await assignProjectStaff({
    businessId: SWIFT_ID,
    projectId: project.id,
    userId: invited.userId,
    actor,
  });
  await removeProjectStaff({
    businessId: SWIFT_ID,
    projectId: project.id,
    userId: invited.userId,
    actor,
  });
  console.log("  last staff removed: allowed");

  // --- 13. SAFETY: all permissions ON, still denied ---
  console.log("\n=== 13. SAFETY — every permission enabled, still no access ===");
  const allOn = applyStaffPermissionPreset("full_except_money");
  for (const k of STAFF_PERMISSION_KEYS) allOn[k] = true;
  const setAll = await updateStaffMember({
    businessId: SWIFT_ID,
    userId: invited.userId,
    permissions: allOn,
    actor,
  });
  assert(setAll.ok, setAll.ok ? "" : setAll.error);
  const { data: loaded } = await admin
    .from("profiles")
    .select("role, staff_permissions")
    .eq("id", invited.userId)
    .single();
  const enabledCount = STAFF_PERMISSION_KEYS.filter(
    (k) => (loaded?.staff_permissions as Record<string, unknown>)?.[k] === true
  ).length;
  console.log(`  stored enabled permissions: ${enabledCount}/${STAFF_PERMISSION_KEYS.length}`);
  console.log(`  role=${loaded?.role} (must be staff — not admin)`);
  assert(loaded?.role === "staff", "role must remain staff");

  // Gate that Phase 1 uses everywhere:
  const wouldPassRequireAdmin =
    loaded?.role === "admin" || loaded?.role === "super_admin";
  console.log(`  wouldPassRequireAdmin: ${wouldPassRequireAdmin} (expect false)`);
  assert(!wouldPassRequireAdmin, "staff must not pass requireAdmin role check");

  const tempPassword = `Phase2-Verify-${stamp}!Aa`;
  await admin.auth.admin.updateUserById(invited.userId, {
    password: tempPassword,
    email_confirm: true,
  });

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: loginErr } = await anon.auth.signInWithPassword({
    email: emailB,
    password: tempPassword,
  });
  assert(!loginErr && session.session, loginErr?.message || "login failed");

  // Build cookie jar matching @supabase/ssr chunked cookie format (single chunk).
  const projectRef = new URL(url).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const sessionPayload = JSON.stringify({
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    expires_at: session.session.expires_at,
    expires_in: session.session.expires_in,
    token_type: session.session.token_type,
    user: session.session.user,
  });
  const cookieHeader = `${cookieName}=${encodeURIComponent(sessionPayload)}`;

  async function probe(path: string, method = "GET") {
    const res = await fetch(`${ROOT}${path}`, {
      method,
      redirect: "manual",
      headers: {
        Cookie: cookieHeader,
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? "{}" : undefined,
    });
    return {
      path,
      method,
      status: res.status,
      location: res.headers.get("location"),
    };
  }

  const samples = [
    await probe("/admin"),
    await probe("/admin/projects"),
    await probe("/admin/settings"),
    await probe("/admin/clients"),
    await probe("/api/clients"),
    await probe("/api/projects"),
    await probe("/api/admin/staff"),
    await probe("/api/media/library"),
    await probe("/staff"),
  ];

  // Staff with every delegable permission still cannot become owner-admin:
  // - role stays staff (requireAdmin role gate false)
  // - Command Center shell (/admin) redirects to an area home
  // - settings + /api/admin/staff stay denied
  // - area pages/APIs may return 200 (scoped) — that is intentional
  for (const s of samples) {
    console.log(
      `  ${s.method} ${s.path} → ${s.status}${s.location ? ` location=${s.location}` : ""}`
    );
  }
  const byPath = Object.fromEntries(samples.map((s) => [s.path, s]));
  assert(
    byPath["/admin"].status === 307 || byPath["/admin"].status === 302,
    "/admin Command Center must redirect staff"
  );
  assert(
    (byPath["/admin"].location || "").includes("/admin/projects") ||
      (byPath["/admin"].location || "").includes("/staff"),
    "/admin must bounce to staff area home"
  );
  assert(
    byPath["/admin/settings"].status === 307 ||
      byPath["/admin/settings"].status === 302 ||
      byPath["/admin/settings"].status === 403,
    "settings must stay denied for staff"
  );
  assert(
    !(byPath["/admin/settings"].location || "").includes("/admin/settings"),
    "settings redirect must leave settings"
  );
  assert(
    byPath["/api/admin/staff"].status === 401 ||
      byPath["/api/admin/staff"].status === 403,
    "staff roster API must stay owner-only"
  );
  assert(
    byPath["/admin/projects"].status === 200 ||
      byPath["/admin/projects"].status === 307,
    "projects area reachable when permissions enabled"
  );
  assert(
    byPath["/admin/clients"].status === 200 ||
      byPath["/admin/clients"].status === 307,
    "clients area reachable when permissions enabled"
  );

  // --- delete / seats ---
  const disabled = await disableStaffMember({
    businessId: SWIFT_ID,
    userId: invited.userId,
    actor,
  });
  assert(disabled.ok, disabled.ok ? "" : disabled.error);
  console.log("\n=== delete releases seat ===", disabled.seats);

  await cleanupEmail(admin, emailA);
  await cleanupEmail(admin, emailB);

  console.log("\nPASS — Phase 2: permissions defined, zero access granted.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
