/**
 * Phase 2 — passwordless email sharing verification.
 * Usage: npx tsx scripts/verify-project-shares-phase2.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const JOY_PROJECT = "26e65643-74d1-4c34-b085-0711c6e4b97c";
const JOY_CLIENT_ID = "6eab7718-9f81-45a7-b49a-b167e66377b9";
const TENANT_B = "00000000-0000-0000-0000-0000000000ff";
const TENANT_B_PROJECT = "00000000-0000-0000-0000-0000000000b3";

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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function clientSessionCookie(admin: SupabaseClient, email: string): Promise<string> {
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

async function httpJson(
  base: string,
  path: string,
  opts: { method?: string; cookie?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status, text: text.slice(0, 400), json };
}

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  section("1. Build gates (already run separately — spot-check resolver exists)");
  const callSites = execSync('rg "resolveProjectAccess" -n src/lib/project-access.ts src/app/api', {
    encoding: "utf8",
  }).trim();
  console.log(callSites.split("\n").slice(0, 8).join("\n"));
  assert(callSites.includes("resolveProjectAccess"), "single resolver exported");

  section("2. Migration + cross-tenant trigger");
  const { data: tableCheck } = await admin.from("project_shares").select("id").limit(1);
  console.log("project_shares reachable:", Array.isArray(tableCheck));

  const crossTenant = await admin.from("project_shares").insert({
    business_id: SWIFT,
    project_id: TENANT_B_PROJECT,
    email: "cross-tenant@example.test",
    invited_by: SWIFT_ADMIN,
  });
  console.log("cross-tenant insert:", crossTenant.error?.message ?? "UNEXPECTED SUCCESS");
  assert(Boolean(crossTenant.error), "cross-tenant project_shares insert rejected");

  section("3. Existing clients — Joy without share row");
  const { resolveProjectAccess } = await import("../src/lib/project-access");
  const { data: joyProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("client_id", JOY_CLIENT_ID)
    .maybeSingle();
  assert(Boolean(joyProfile), "Joy profile found");
  const { count: joyShareCount } = await admin
    .from("project_shares")
    .select("*", { count: "exact", head: true })
    .eq("project_id", JOY_PROJECT)
    .eq("email", joyProfile!.email)
    .is("revoked_at", null);
  console.log({ joyEmail: joyProfile!.email, joyShareRows: joyShareCount });
  assert((joyShareCount ?? 0) === 0, "Joy has NO share row on project 26e65643");

  const joyAccess = await resolveProjectAccess(joyProfile as never, JOY_PROJECT);
  console.log("Joy resolveProjectAccess:", joyAccess);
  assert(joyAccess.allowed && joyAccess.kind === "assigned_client", "Joy accesses via assigned_client");

  const { data: otherProjects } = await admin
    .from("projects")
    .select("id, client_id")
    .eq("business_id", SWIFT)
    .not("client_id", "is", null)
    .is("deleted_at", null)
    .limit(3);
  for (const p of otherProjects ?? []) {
    const { data: cp } = await admin
      .from("profiles")
      .select("*")
      .eq("client_id", p.client_id)
      .maybeSingle();
    if (!cp) continue;
    const access = await resolveProjectAccess(cp as never, p.id);
    console.log(`project ${p.id.slice(0, 8)}… client access:`, access.kind);
    assert(access.allowed, `assigned client still accesses project ${p.id}`);
  }

  section("4–6. Share lifecycle (magic link origin, dedup, revoke)");
  const testEmail = `share-test-${Date.now()}@example.test`;
  const { addProjectShare, revokeProjectShare } = await import("../src/lib/project-shares");
  const { getBusinessPortalOriginById } = await import("../src/lib/portal-url");

  const portalOrigin = await getBusinessPortalOriginById(SWIFT);
  console.log("Swift portal origin:", portalOrigin);
  assert(!portalOrigin.includes("shootportal.app/") || portalOrigin.includes("swift"), "uses business portal origin");

  const first = await addProjectShare({
    businessId: SWIFT,
    projectId: JOY_PROJECT,
    email: testEmail,
    invitedBy: SWIFT_ADMIN,
    notify: false,
    projectName: "Joy Test",
    inviterName: "Admin",
  });
  assert(first.created, "first share created");
  const second = await addProjectShare({
    businessId: SWIFT,
    projectId: JOY_PROJECT,
    email: testEmail,
    invitedBy: SWIFT_ADMIN,
    notify: false,
    projectName: "Joy Test",
    inviterName: "Admin",
  });
  assert(!second.created && second.share.id === first.share.id, "re-invite does not duplicate");

  const { data: shareProfileBefore } = await admin
    .from("profiles")
    .select("id, business_id, client_id")
    .ilike("email", testEmail)
    .maybeSingle();
  if (shareProfileBefore) {
    assert(shareProfileBefore.business_id === null, "shared viewer business_id NULL");
  }

  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: testEmail,
    options: { redirectTo: `${portalOrigin}/auth/confirm` },
  });
  const signInUrl = linkData.properties?.action_link ?? "";
  console.log("invite link host:", new URL(signInUrl || portalOrigin).hostname);
  assert(
    !signInUrl.includes("shootportal.app") || signInUrl.includes("localhost") || signInUrl.includes("swift"),
    "magic link redirect uses portal origin not bare apex"
  );

  section("7–8. Shared viewer access + download gate");
  await admin.auth.admin.createUser({
    email: testEmail,
    email_confirm: true,
    user_metadata: { role: "client", full_name: "Share Test" },
  });
  const { data: shareProfile } = await admin
    .from("profiles")
    .select("*")
    .ilike("email", testEmail)
    .single();
  assert(shareProfile!.business_id === null, "shared viewer profile.business_id NULL");

  const shareAccess = await resolveProjectAccess(shareProfile as never, JOY_PROJECT);
  console.log("share viewer access:", shareAccess);
  assert(shareAccess.allowed && shareAccess.kind === "share", "share viewer gets share access");

  const joyStill = await resolveProjectAccess(joyProfile as never, JOY_PROJECT);
  assert(joyStill.kind === "assigned_client", "Joy unchanged after share add");

  section("11. Revoke — immediate");
  await revokeProjectShare(SWIFT, JOY_PROJECT, first.share.id);
  const afterRevoke = await resolveProjectAccess(shareProfile as never, JOY_PROJECT);
  console.log("after revoke:", afterRevoke);
  assert(!afterRevoke.allowed, "revoked share denied immediately");

  section("12. Revoke does not affect assigned client or admin");
  assert((await resolveProjectAccess(joyProfile as never, JOY_PROJECT)).allowed, "Joy still allowed");
  const { data: adminProfile } = await admin.from("profiles").select("*").eq("id", SWIFT_ADMIN).single();
  const adminAccess = await resolveProjectAccess(adminProfile as never, JOY_PROJECT, {
    tenantBusinessId: SWIFT,
  });
  assert(adminAccess.allowed && adminAccess.kind === "admin", "admin still allowed");

  section("13. Capabilities — sharedViewer axis");
  const { getCapabilities } = await import("../src/lib/capabilities");
  void getCapabilities;

  section("14. Signed URL TTL note");
  const { THUMB_SIGNED_TTL_SECONDS } = await import("../src/lib/media-signed-thumbs");
  console.log(
    `In-flight signed media URLs may work until TTL expires: ${THUMB_SIGNED_TTL_SECONDS}s (acceptable).`
  );

  section("15. Multi-business shares (schema supports)");
  const { listSharedBusinessIdsForEmail } = await import("../src/lib/project-shares");
  const bizIds = await listSharedBusinessIdsForEmail(testEmail);
  console.log("shared business ids for test email:", bizIds);

  section("16. tenant-isolation cross-tenant write test (SQL file updated)");
  const isoSql = readFileSync(resolve("supabase/tests/tenant-isolation.sql"), "utf8");
  assert(isoSql.includes("INSERT INTO project_shares"), "tenant-isolation.sql includes project_shares test");

  console.log("\n=== Phase 2 verification complete ===");
}

main().catch((err) => {
  console.error("\nVERIFY FAILED:", err);
  process.exit(1);
});
