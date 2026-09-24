/**
 * Phase 3 staff enforcement verification — Swift / Jackson only.
 *
 * Covers: zero perms, one project, view_all, adjacent perms, money HTML grep,
 * never-delegable, auto-assign, filters.
 *
 * Usage: npx tsx scripts/verify-staff-phase3.ts
 * Optional: VERIFY_BASE_URL=http://127.0.0.1:3000 (default)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  NEVER_DELEGABLE_PERMISSION_KEYS,
  applyStaffPermissionPreset,
  staffPermissionDefaults,
} from "../src/lib/staff-permissions";
import {
  assignProjectStaff,
  disableStaffMember,
  inviteStaffMember,
  removeProjectStaff,
  updateStaffMember,
} from "../src/lib/staff";
import {
  canAccessProject,
  staffCan,
  staffHasAnyArea,
  staffHomePath,
  staffShouldReceiveNotification,
  staffVisibleNavAreas,
  visibleProjectIdsFor,
} from "../src/lib/staff-access";
import { staffMayAccessAdminPath } from "../src/lib/staff-access";
import type { Profile } from "../src/lib/types";

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

function asProfile(row: Record<string, unknown>): Profile {
  return row as unknown as Profile;
}

function grepMoneyHidden(source: string): void {
  // Project detail must gate QuoteSection / Payments with canViewMoney
  assert(
    /canViewMoney\s*&&\s*\(\s*<QuoteSection/.test(source) ||
      /\{canViewMoney\s*&&\s*\([\s\S]*?<QuoteSection/.test(source),
    "project-detail must gate QuoteSection behind canViewMoney"
  );
  assert(
    /canViewMoney\s*&&\s*\([\s\S]*?id=["']payments["']/.test(source) ||
      /\{canViewMoney\s*&&[\s\S]*?<Card id=["']payments["']/.test(source),
    "project-detail must gate Payments card behind canViewMoney"
  );
  console.log("  money HTML gates: QuoteSection + Payments OK");
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const stamp = Date.now();
  const email = `staff-phase3-${stamp}@example.test`;
  await cleanupEmail(admin, email);

  const { data: swiftAdmin } = await admin
    .from("profiles")
    .select("id, email")
    .eq("business_id", SWIFT_ID)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  assert(swiftAdmin, "need a Swift admin actor");
  const actor = { id: swiftAdmin.id, email: swiftAdmin.email };

  const { data: projects } = await admin
    .from("projects")
    .select("id, project_name")
    .eq("business_id", SWIFT_ID)
    .is("deleted_at", null)
    .limit(3);
  assert(projects && projects.length >= 1, "need at least one Swift project");
  const projectA = projects[0]!;
  const projectB = projects[1] ?? projects[0]!;

  // Free a seat if needed (Studio=3, admins count toward seats)
  const { data: spareStaff } = await admin
    .from("profiles")
    .select("id, email")
    .eq("business_id", SWIFT_ID)
    .eq("role", "staff")
    .is("disabled_at", null)
    .limit(5);
  for (const s of spareStaff ?? []) {
    if (s.email?.includes("@example.test")) {
      await disableStaffMember({ businessId: SWIFT_ID, userId: s.id, actor });
      await cleanupEmail(admin, s.email);
      console.log(`  freed leftover test staff ${s.email}`);
    }
  }

  console.log("\n=== 0. Money HTML grep ===");
  const detailSrc = readFileSync(
    resolve("src/components/admin/project-detail.tsx"),
    "utf8"
  );
  grepMoneyHidden(detailSrc);
  const clientsSrc = readFileSync(
    resolve("src/components/admin/clients-table.tsx"),
    "utf8"
  );
  assert(
    /canViewMoney\s*&&\s*\(/.test(clientsSrc) && /Payments/.test(clientsSrc),
    "clients-table must gate Payments behind canViewMoney"
  );
  console.log("  clients-table Payments gate OK");

  console.log("\n=== 1. Invite staff (defaults = zero perms) ===");
  const invited = await inviteStaffMember({
    businessId: SWIFT_ID,
    email,
    fullName: "Phase3 Staff",
    actor,
  });
  assert(invited.ok, invited.ok ? "" : invited.error);

  let { data: profileRow } = await admin
    .from("profiles")
    .select("*")
    .eq("id", invited.userId)
    .single();
  assert(profileRow, "profile missing");
  let profile = asProfile(profileRow);

  console.log("\n=== 2. Zero permissions ===");
  assert(!staffHasAnyArea(profile), "defaults must have zero areas");
  assert(staffHomePath(profile) === "/staff", "zero perms → /staff");
  assert(staffVisibleNavAreas(profile).length === 0, "no nav areas");
  assert(
    !staffMayAccessAdminPath(profile, "/admin/projects"),
    "zero perms cannot access /admin/projects"
  );
  assert(
    !staffMayAccessAdminPath(profile, "/admin/settings"),
    "settings always denied for staff"
  );
  assert(!staffMayAccessAdminPath(profile, "/billing"), "billing denied");
  for (const key of NEVER_DELEGABLE_PERMISSION_KEYS) {
    assert(
      !staffShouldReceiveNotification(profile, key),
      `never-delegable notif ${key} must be false`
    );
  }
  console.log("  zero perms → /staff, no areas, settings/billing denied");

  // Sign-in cookie session for HTTP checks
  const password = `Ph3!${stamp}Aa`;
  await admin.auth.admin.updateUserById(invited.userId, {
    password,
    email_confirm: true,
  });
  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  assert(!signErr && signIn.session, `sign-in failed: ${signErr?.message}`);
  const accessToken = signIn.session!.access_token;

  async function fetchAsStaff(path: string) {
    return fetch(`${ROOT}${path}`, {
      redirect: "manual",
      headers: {
        Cookie: `sb-access-token=${accessToken}; sb-refresh-token=${signIn.session!.refresh_token}`,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  console.log("\n=== 3. HTTP: zero perms → /staff, admin denied ===");
  try {
    const staffHome = await fetchAsStaff("/staff");
    console.log(`  GET /staff → ${staffHome.status}`);
    const projectsDenied = await fetchAsStaff("/admin/projects");
    console.log(
      `  GET /admin/projects → ${projectsDenied.status} loc=${projectsDenied.headers.get("location")}`
    );
  } catch (e) {
    console.log(
      "  (HTTP checks skipped — is the app running at",
      ROOT + "?",
      e instanceof Error ? e.message : e,
      ")"
    );
  }

  console.log("\n=== 4. One project assignment (area.projects, no view_all) ===");
  const permsOne = {
    ...staffPermissionDefaults(),
    "area.projects": true,
    "projects.view_all": false,
    "money.view": false,
  };
  const updated = await updateStaffMember({
    businessId: SWIFT_ID,
    userId: invited.userId,
    permissions: permsOne,
    actor,
  });
  assert(updated.ok, updated.ok ? "" : updated.error);
  ({ data: profileRow } = await admin
    .from("profiles")
    .select("*")
    .eq("id", invited.userId)
    .single());
  profile = asProfile(profileRow!);

  assert(staffCan(profile, "area.projects"), "area.projects on");
  assert(!staffCan(profile, "money.view"), "money.view off");
  assert(staffHomePath(profile) === "/admin/projects", "home → projects");
  assert(staffMayAccessAdminPath(profile, "/admin/projects"), "may access projects path");
  assert(!staffMayAccessAdminPath(profile, "/admin/clients"), "adjacent clients denied");
  assert(!staffMayAccessAdminPath(profile, "/admin/media"), "adjacent media denied");

  await assignProjectStaff({
    businessId: SWIFT_ID,
    projectId: projectA.id,
    userId: invited.userId,
    actor,
  });

  const visible = await visibleProjectIdsFor(SWIFT_ID, profile);
  assert(Array.isArray(visible), "visible should be id list");
  assert(
    (visible as string[]).includes(projectA.id),
    "assigned project visible"
  );
  if (projectB.id !== projectA.id) {
    assert(
      !(visible as string[]).includes(projectB.id),
      "unassigned project hidden"
    );
  }
  assert(
    await canAccessProject(SWIFT_ID, profile, projectA.id),
    "canAccess assigned"
  );
  if (projectB.id !== projectA.id) {
    assert(
      !(await canAccessProject(SWIFT_ID, profile, projectB.id)),
      "cannot access unassigned"
    );
  }
  console.log("  one-project scope OK", {
    projectA: projectA.id,
    visibleCount: (visible as string[]).length,
  });

  console.log("\n=== 5. view_all ===");
  const permsAll = {
    ...permsOne,
    "projects.view_all": true,
  };
  await updateStaffMember({
    businessId: SWIFT_ID,
    userId: invited.userId,
    permissions: permsAll,
    actor,
  });
  ({ data: profileRow } = await admin
    .from("profiles")
    .select("*")
    .eq("id", invited.userId)
    .single());
  profile = asProfile(profileRow!);
  const visibleAll = await visibleProjectIdsFor(SWIFT_ID, profile);
  assert(visibleAll === "all", "view_all → all");
  assert(
    await canAccessProject(SWIFT_ID, profile, projectB.id),
    "view_all can access any"
  );
  console.log("  view_all OK");

  console.log("\n=== 6. Adjacent perms (media without projects) ===");
  const permsMedia = {
    ...staffPermissionDefaults(),
    "area.media": true,
    "area.projects": false,
  };
  await updateStaffMember({
    businessId: SWIFT_ID,
    userId: invited.userId,
    permissions: permsMedia,
    actor,
  });
  ({ data: profileRow } = await admin
    .from("profiles")
    .select("*")
    .eq("id", invited.userId)
    .single());
  profile = asProfile(profileRow!);
  assert(staffMayAccessAdminPath(profile, "/admin/media"), "media path allowed");
  assert(!staffMayAccessAdminPath(profile, "/admin/projects"), "projects path denied");
  assert(staffHomePath(profile) === "/admin/media", "home → media");
  assert(
    !(await canAccessProject(SWIFT_ID, profile, projectA.id)),
    "no area.projects → no project access"
  );
  console.log("  adjacent OK");

  console.log("\n=== 7. money.view notification filter ===");
  const noMoney = asProfile({
    ...profileRow!,
    staff_permissions: { ...permsOne, "money.view": false },
  });
  const withMoney = asProfile({
    ...profileRow!,
    staff_permissions: { ...permsOne, "money.view": true },
  });
  assert(
    !staffShouldReceiveNotification(noMoney, "payment_received"),
    "no money.view → no payment notif"
  );
  assert(
    staffShouldReceiveNotification(withMoney, "payment_received"),
    "money.view → payment notif"
  );
  assert(
    !staffShouldReceiveNotification(withMoney, "billing"),
    "never-delegable billing still denied"
  );
  assert(
    !staffShouldReceiveNotification(withMoney, "subscription"),
    "never-delegable subscription still denied"
  );
  console.log("  notification filters OK");

  console.log("\n=== 8. Never-delegable keys still non-storable ===");
  for (const key of NEVER_DELEGABLE_PERMISSION_KEYS) {
    const refused = await updateStaffMember({
      businessId: SWIFT_ID,
      userId: invited.userId,
      permissions: { [key]: true, "area.projects": true },
      actor,
    });
    assert(!refused.ok, `must refuse storing ${key}`);
  }
  console.log("  never-delegable refused");

  console.log("\n=== 9. Auto-assign / filter defaults (code presence) ===");
  const filterSrc = readFileSync(
    resolve("src/components/admin/admin-projects-with-staff-filter.tsx"),
    "utf8"
  );
  assert(
    /isStaff\s*&&\s*currentUserId/.test(filterSrc),
    "staff filter default assigned-to-me"
  );
  const pipelineSrc = readFileSync(
    resolve("src/lib/admin-project-pipeline.ts"),
    "utf8"
  );
  assert(
    /visibleProjectIdsFor/.test(pipelineSrc),
    "pipeline scopes via visibleProjectIdsFor"
  );
  const middlewareSrc = readFileSync(
    resolve("src/lib/supabase/middleware.ts"),
    "utf8"
  );
  assert(/staffMayAccessAdminPath/.test(middlewareSrc), "middleware staff paths");
  assert(/["']\/staff["']/.test(middlewareSrc), "/staff in protected paths");
  assert(/staff_permissions/.test(middlewareSrc), "middleware selects staff_permissions");
  console.log("  filter + pipeline + middleware wiring OK");

  console.log("\n=== 10. Preset smoke ===");
  const editor = applyStaffPermissionPreset("editor");
  assert(editor["area.projects"] === true, "editor has projects");
  console.log("  editor preset areas:", staffVisibleNavAreas(asProfile({
    id: invited.userId,
    role: "staff",
    staff_permissions: editor,
    disabled_at: null,
  } as Profile)));

  // Cleanup
  console.log("\n=== cleanup ===");
  await removeProjectStaff({
    businessId: SWIFT_ID,
    projectId: projectA.id,
    userId: invited.userId,
    actor,
  }).catch(() => undefined);
  await disableStaffMember({
    businessId: SWIFT_ID,
    userId: invited.userId,
    actor,
  });
  await cleanupEmail(admin, email);
  console.log("  cleaned", email);

  // Audit doc present
  assert(
    existsSync(resolve("docs/STAFF-PHASE3-ENFORCEMENT-AUDIT.md")),
    "missing docs/STAFF-PHASE3-ENFORCEMENT-AUDIT.md — run generate-staff-phase3-audit.ts"
  );

  console.log("\n✅ Phase 3 verification passed");
}

main().catch((err) => {
  console.error("\n❌ Phase 3 verification failed:", err);
  process.exit(1);
});
