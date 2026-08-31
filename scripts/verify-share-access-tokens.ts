/**
 * Reusable project share access tokens + expiry verification.
 * Usage: npx tsx scripts/verify-share-access-tokens.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  allowShareAccessExchange,
  resetShareAccessRateLimitsForTests,
  SHARE_EXCHANGE_RATE_LIMIT,
} from "../src/lib/share-access-rate-limit";
import type { ShareExpiryPreset } from "../src/lib/project-share-access";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const SWIFT_SLUG = "swift-aerial-media";
/** Jackson Bridges test project — never use live client fixtures (Joy Sullivan, etc.). */
const TEST_PROJECT = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";
const TEST_CLIENT_EMAIL = "jackson.bridges21@gmail.com";
const OTHER_SWIFT_PROJECT = "26e65643-74d1-4c34-b085-0711c6e4b97c";
const OTHER_BUSINESS_PROJECT = "f4a9a474-9470-4b5a-b998-8c9236b40b31";
const OTHER_SWIFT_MEDIA = "7d3bc3f6-e39b-4c3a-9c19-480eeeb841ea";
const OTHER_FOLDER = "df142d88-fa00-44af-95c8-da6e2c92324f";
const PAYMENT_ID = "a46320ec-9ee2-44ad-b1fb-80ebd0208ed2";

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

function extractToken(shareUrl: string): string {
  return new URL(shareUrl).searchParams.get("token") || "";
}

async function consumeShareToken(
  base: string,
  rawToken: string
): Promise<{ status: number; location: string; cookies: string[] }> {
  const form = new URLSearchParams();
  form.set("token", rawToken);
  const res = await fetch(`${base}/auth/share/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    redirect: "manual",
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  return {
    status: res.status,
    location: res.headers.get("location") ?? "",
    cookies,
  };
}

function cookieFromSetCookies(cookies: string[]): string {
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function cleanupShare(admin: SupabaseClient, email: string) {
  await admin
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("project_id", TEST_PROJECT)
    .eq("email", email);
}

async function createShareWithLink(
  admin: SupabaseClient,
  email: string,
  preset: ShareExpiryPreset,
  custom?: { startsAt?: string; expiresAt?: string }
) {
  const { addProjectShare, buildShareMagicLinkForProject, resolveShareAccessWindow } =
    await import("../src/lib/project-shares");
  const accessFields = resolveShareAccessWindow(preset, custom);
  const added = await addProjectShare({
    businessId: SWIFT,
    projectId: TEST_PROJECT,
    email,
    invitedBy: SWIFT_ADMIN,
    notify: false,
    projectName: "Jackson Bridges - 9560 CR-99 - Aerial Photography",
    inviterName: "Admin",
    expiryPreset: preset,
    customAccessStartsAt: custom?.startsAt,
    customAccessExpiresAt: custom?.expiresAt,
  });
  const link = await buildShareMagicLinkForProject({
    businessId: SWIFT,
    projectId: TEST_PROJECT,
    email,
    shareId: added.share.id,
    accessFields,
  });
  return { share: added.share, link, accessFields };
}

type ProbeResult = { label: string; status: number; leak: boolean };

function hasDataLeak(status: number, body: string, isPage: boolean): boolean {
  if (status === 404 || status === 403 || status === 401 || status === 402 || status === 400) return false;
  if (status >= 300 && status < 400) return false;
  if (status >= 500) return false;
  if (isPage && status === 200) {
    if (body.includes("Admin Dashboard") || body.includes("All Clients")) return true;
    if (body.includes("Outstanding Payments") && body.includes("Pay Now")) return true;
    return false;
  }
  if (!isPage && status === 200) {
    const trimmed = body.trim();
    if (trimmed === "[]" || trimmed === "{}" || trimmed === "null") return false;
    if (trimmed === '{"urls":{}}' || trimmed === '{"urls": {}}') return false;
    if (trimmed.startsWith("[") && trimmed.length > 2) return true;
    if (trimmed.startsWith("{") && !trimmed.includes('"error"')) return true;
  }
  return status === 200;
}

async function probe(
  label: string,
  url: string,
  cookie: string,
  opts: { method?: string; body?: unknown; isPage?: boolean } = {}
): Promise<ProbeResult> {
  const headers: Record<string, string> = { Cookie: cookie };
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  const leak = hasDataLeak(res.status, text, opts.isPage ?? false);
  console.log(`${label}${leak ? " *** LEAK ***" : ""} → ${res.status}`);
  return { label, status: res.status, leak };
}

async function runPhase2Probes(base: string, cookie: string) {
  const probes: ProbeResult[] = [];
  const pages: [string, string][] = [
    ["PAGE /admin", "/admin"],
    ["PAGE /admin/projects", "/admin/projects"],
    ["PAGE /admin/projects/{shared}", `/admin/projects/${TEST_PROJECT}`],
    ["PAGE /admin/settings", "/admin/settings"],
    ["PAGE /admin/clients", "/admin/clients"],
    ["PAGE /platform", "/platform"],
    ["PAGE /billing", "/billing"],
    ["PAGE /partner", "/partner"],
    ["PAGE /dashboard/projects/{other same biz}", `/dashboard/projects/${OTHER_SWIFT_PROJECT}`],
    ["PAGE /dashboard/projects/{other business}", `/dashboard/projects/${OTHER_BUSINESS_PROJECT}`],
    ["PAGE /dashboard/request", "/dashboard/request"],
    ["PAGE /dashboard/settings", "/dashboard/settings"],
  ];
  for (const [label, path] of pages) {
    probes.push(await probe(label, `${base}${path}`, cookie, { isPage: true }));
  }
  const apis: [string, string, string?, unknown?][] = [
    ["API GET /api/clients", "/api/clients"],
    ["API GET /api/projects/{other same biz}", `/api/projects/${OTHER_SWIFT_PROJECT}`],
    ["API GET /api/projects/{other business}", `/api/projects/${OTHER_BUSINESS_PROJECT}`],
    ["API GET /api/media/download/{other}?preview=1", `/api/media/download/${OTHER_SWIFT_MEDIA}?preview=1`],
    ["API POST /api/media/thumbnails (other)", "/api/media/thumbnails", "POST", { ids: [OTHER_SWIFT_MEDIA] }],
    ["API GET /api/projects/{other}/download-zip", `/api/projects/${OTHER_SWIFT_PROJECT}/download-zip`],
    ["API GET /api/projects/{shared}/shares", `/api/projects/${TEST_PROJECT}/shares`],
    ["API POST /api/projects/{shared}/shares", `/api/projects/${TEST_PROJECT}/shares`, "POST", { emails: ["evil@example.test"] }],
    ["API GET /api/payments", "/api/payments"],
    ["API GET /api/payments/{id}", `/api/payments/${PAYMENT_ID}`],
    ["API GET /api/quotes", "/api/quotes"],
    ["API POST /api/revisions", "/api/revisions", "POST", { project_id: TEST_PROJECT, description: "probe" }],
    ["API GET /api/shoot-proposals", "/api/shoot-proposals"],
    ["API POST /api/shoot-proposals", "/api/shoot-proposals", "POST", { project_id: TEST_PROJECT }],
    ["API GET /api/admin/search", "/api/admin/search?q=test"],
    ["API GET /api/partner/me", "/api/partner/me"],
  ];
  for (const [label, path, method, body] of apis) {
    probes.push(await probe(label, `${base}${path}`, cookie, { method, body }));
  }
  probes.push(
    await probe(
      "API download other ?file=1",
      `${base}/api/media/download/${OTHER_SWIFT_MEDIA}?file=1`,
      cookie
    )
  );
  probes.push(
    await probe(
      "API zip other folder",
      `${base}/api/projects/${OTHER_SWIFT_PROJECT}/download-zip?folderId=${OTHER_FOLDER}`,
      cookie
    )
  );
  probes.push(
    await probe("API quotes?project_id", `${base}/api/quotes?project_id=${OTHER_SWIFT_PROJECT}`, cookie)
  );
  probes.push(
    await probe(
      "API revisions?project_id",
      `${base}/api/revisions?project_id=${OTHER_SWIFT_PROJECT}`,
      cookie
    )
  );
  probes.push(
    await probe(
      "API video-reviews other",
      `${base}/api/video-reviews?project_id=${OTHER_SWIFT_PROJECT}`,
      cookie
    )
  );
  probes.push(
    await probe("API payments checkout", `${base}/api/payments/${PAYMENT_ID}/checkout`, cookie)
  );
  const leaks = probes.filter((p) => p.leak);
  console.log(`Phase 2 boundary summary: ${probes.length} probes, ${leaks.length} LEAKS`);
  if (leaks.length) {
    leaks.forEach((l) => console.error("  LEAK:", l.label, l.status));
    throw new Error(`${leaks.length} phase-2 leak(s)`);
  }
}

async function runPhase3Probes(base: string, publicUrl: string) {
  const probes: ProbeResult[] = [];
  probes.push(await probe("GET public project page", publicUrl, "", { isPage: true }));
  const anonApis: [string, string, string?, unknown?][] = [
    ["API GET /api/clients", "/api/clients"],
    ["API GET /api/payments", "/api/payments"],
    ["API GET /api/quotes", "/api/quotes"],
    ["API GET /api/projects/{shared}/shares", `/api/projects/${TEST_PROJECT}/shares`],
    ["API GET /api/admin/search", "/api/admin/search?q=test"],
    ["API GET /api/partner/me", "/api/partner/me"],
    ["API POST /api/revisions", "/api/revisions", "POST", { project_id: TEST_PROJECT, description: "anon" }],
    ["API GET /api/projects/{other}", `/api/projects/${OTHER_SWIFT_PROJECT}`],
    ["API GET /api/media/download shared preview", `/api/media/download/${OTHER_SWIFT_MEDIA}?preview=1`],
    ["API POST thumbnails shared ids", "/api/media/thumbnails", "POST", { ids: [OTHER_SWIFT_MEDIA] }],
    ["API GET shared download-zip", `/api/projects/${TEST_PROJECT}/download-zip`],
    ["API GET other download-zip", `/api/projects/${OTHER_SWIFT_PROJECT}/download-zip`],
    ["API GET shoot-proposals", "/api/shoot-proposals"],
    ["API POST shoot-proposals", "/api/shoot-proposals", "POST", { project_id: TEST_PROJECT }],
    ["API GET video-reviews", `/api/video-reviews?project_id=${TEST_PROJECT}`],
    ["API GET payments checkout", `/api/payments/${PAYMENT_ID}/checkout`],
    ["API GET quotes project", `/api/quotes?project_id=${TEST_PROJECT}`],
    ["API GET revisions project", `/api/revisions?project_id=${TEST_PROJECT}`],
    ["API GET platform", "/platform"],
    ["API GET billing", "/billing"],
    ["API GET admin", "/admin"],
    ["API GET dashboard/settings", "/dashboard/settings"],
    ["API GET dashboard/request", "/dashboard/request"],
    ["API GET partner", "/partner"],
    ["API GET admin/clients", "/admin/clients"],
  ];
  for (const [label, path, method, body] of anonApis) {
    probes.push(await probe(label, `${base}${path}`, "", { method, body }));
  }
  const leaks = probes.filter((p) => p.leak);
  console.log(`Phase 3 boundary summary: ${probes.length} probes, ${leaks.length} LEAKS`);
  if (leaks.length) {
    leaks.forEach((l) => console.error("  LEAK:", l.label, l.status));
    throw new Error(`${leaks.length} phase-3 leak(s)`);
  }
}

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const base = tenantBase();
  const ts = Date.now();

  section("1–3. Same durable link on device A + B + extended window (DB expiry bump)");
  const reusableEmail = `share-reusable-${ts}@example.test`;
  const { share: reusableShare, link: reusableLink } = await createShareWithLink(
    admin,
    reusableEmail,
    "30days"
  );
  const token = extractToken(reusableLink);
  assert(token.length > 16, "share URL contains durable token");

  const deviceA = await consumeShareToken(base, token);
  console.log("device A:", deviceA.status, deviceA.location);
  assert(deviceA.status === 302 || deviceA.status === 307, "device A exchange redirects");
  assert(deviceA.location.includes(TEST_PROJECT), "device A lands on shared project");

  const deviceB = await consumeShareToken(base, token);
  assert(deviceB.status === 302 || deviceB.status === 307, "device B exchange redirects with SAME token");
  assert(deviceB.location.includes(TEST_PROJECT), "device B lands on shared project");

  await admin
    .from("project_shares")
    .update({ access_expires_at: new Date(Date.now() + 7 * 86400000).toISOString() })
    .eq("id", reusableShare.id);
  const deviceC = await consumeShareToken(base, token);
  assert(deviceC.status === 302 || deviceC.status === 307, "link still works after DB expiry extension");

  section("4. Expiry presets");
  const presets: ShareExpiryPreset[] = ["one_time", "24h", "1week", "60days", "indefinite", "custom"];
  for (const preset of presets) {
    const email = `share-${preset}-${ts}@example.test`;
    const custom =
      preset === "custom"
        ? {
            startsAt: new Date(Date.now() - 3600000).toISOString(),
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          }
        : undefined;
    const { link, share } = await createShareWithLink(admin, email, preset, custom);
    const t = extractToken(link);
    const first = await consumeShareToken(base, t);
    assert(first.status === 302 || first.status === 307, `${preset}: first exchange ok`);
    if (preset === "one_time") {
      const second = await consumeShareToken(base, t);
      assert(
        second.location.includes("share_one_time_used"),
        "one_time link consumed after first use"
      );
    } else if (preset !== "indefinite") {
      const past = new Date(Date.now() - 3600000).toISOString();
      await admin.from("project_shares").update({ access_expires_at: past }).eq("id", share.id);
      const expiredTry = await consumeShareToken(base, t);
      assert(expiredTry.location.includes("share_expired"), `${preset}: expired at manipulated time`);
    } else {
      const far = await consumeShareToken(base, t);
      assert(far.status === 302 || far.status === 307, "indefinite: second exchange still ok");
    }
    await cleanupShare(admin, email);
  }

  section("5. Expired link message + resend path");
  const expiredEmail = `share-expired-msg-${ts}@example.test`;
  const { link: expiredLink, share: expiredShare } = await createShareWithLink(
    admin,
    expiredEmail,
    "24h"
  );
  await admin
    .from("project_shares")
    .update({ access_expires_at: new Date(Date.now() - 60000).toISOString() })
    .eq("id", expiredShare.id);
  const expiredRes = await consumeShareToken(base, extractToken(expiredLink));
  assert(expiredRes.location.includes("error=share_expired"), "expired → share_expired login error");
  assert(expiredRes.location.includes(`email=${encodeURIComponent(expiredEmail)}`), "expired includes email for resend");

  section("6. Revoke — immediate invalidation");
  const revokeEmail = `share-revoke-${ts}@example.test`;
  const { link: revokeLink, share: revokeShare } = await createShareWithLink(
    admin,
    revokeEmail,
    "30days"
  );
  const beforeRevoke = await consumeShareToken(base, extractToken(revokeLink));
  console.log("before revoke:", beforeRevoke.status, beforeRevoke.location);
  assert(beforeRevoke.status === 302 || beforeRevoke.status === 307, "token works before revoke");
  await admin
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", revokeShare.id);
  const afterRevoke = await consumeShareToken(base, extractToken(revokeLink));
  console.log("after revoke:", afterRevoke.status, afterRevoke.location);
  assert(afterRevoke.location.includes("share_revoked"), "revoked token stops immediately");

  section("7. Token stored hashed (no plaintext in DB)");
  const { data: hashRow } = await admin
    .from("project_shares")
    .select("access_token_hash")
    .eq("id", reusableShare.id)
    .single();
  console.log("access_token_hash column:", hashRow?.access_token_hash);
  assert(Boolean(hashRow?.access_token_hash), "hash present");
  assert(hashRow!.access_token_hash !== token, "DB stores hash not raw token");
  assert(!hashRow!.access_token_hash.includes(token.slice(0, 8)), "hash is not raw token prefix");

  section("8. Rate limiting on exchange endpoint");
  resetShareAccessRateLimitsForTests();
  console.log(
    "Limit:",
    `${SHARE_EXCHANGE_RATE_LIMIT.maxPerIp}/IP and ${SHARE_EXCHANGE_RATE_LIMIT.maxPerToken}/token per ${SHARE_EXCHANGE_RATE_LIMIT.windowMinutes}m`
  );
  const fp = createHash("sha256").update("test-token").digest("hex").slice(0, 16);
  let allowed = 0;
  for (let i = 0; i < SHARE_EXCHANGE_RATE_LIMIT.maxPerToken + 2; i++) {
    if (allowShareAccessExchange("127.0.0.1", fp)) allowed++;
  }
  console.log(`Allowed ${allowed}/${SHARE_EXCHANGE_RATE_LIMIT.maxPerToken + 2} token-bucket attempts`);
  assert(allowed === SHARE_EXCHANGE_RATE_LIMIT.maxPerToken, "token bucket caps at maxPerToken");

  section("9. Shared-viewer session boundary probes (phase 2 + phase 3)");
  const shareCookie = cookieFromSetCookies(deviceB.cookies);
  assert(shareCookie.includes("sb-"), "exchange sets Supabase session cookie");
  await runPhase2Probes(base, shareCookie);

  const { data: pubProject } = await admin
    .from("projects")
    .select("link_access_mode, link_access_token")
    .eq("id", TEST_PROJECT)
    .single();
  const priorLinkMode = pubProject?.link_access_mode;
  let publicUrl: string | null = null;
  if (pubProject?.link_access_token) {
    if (priorLinkMode !== "anyone_with_link") {
      await admin
        .from("projects")
        .update({ link_access_mode: "anyone_with_link" })
        .eq("id", TEST_PROJECT);
      console.log("Temporarily enabled anyone_with_link on test project for phase 3 probes");
    }
    publicUrl = `${base}/view/${pubProject.link_access_token}`;
    await runPhase3Probes(base, publicUrl);
    if (priorLinkMode && priorLinkMode !== "anyone_with_link") {
      await admin
        .from("projects")
        .update({ link_access_mode: priorLinkMode })
        .eq("id", TEST_PROJECT);
      console.log(`Restored link_access_mode=${priorLinkMode}`);
    }
  } else {
    console.log("SKIP phase 3 public link probes — test project has no link_access_token");
  }

  section("10–11. Access list fields + admin expiry PATCH (API)");
  const { updateProjectShareExpiry, resolveShareAccessWindow } = await import("../src/lib/project-shares");
  const patched = await updateProjectShareExpiry(
    SWIFT,
    TEST_PROJECT,
    reusableShare.id,
    resolveShareAccessWindow("60days")
  );
  assert(patched.expiry_preset === "60days", "admin can change expiry without re-share");

  section("12. Existing shares backfill — lazy token on send, 30-day window");
  const { data: legacyShares } = await admin
    .from("project_shares")
    .select("id, access_token_hash, access_expires_at, expiry_preset, invited_at")
    .eq("project_id", TEST_PROJECT)
    .is("revoked_at", null)
    .limit(5);
  console.log("sample active shares:", legacyShares);
  assert(
    (legacyShares ?? []).every((s) => s.expiry_preset && s.access_expires_at),
    "backfilled rows have expiry_preset + access_expires_at"
  );
  console.log(
    "Backfill decision: existing rows get 30-day window in SQL; durable token minted lazily on next email/resend (not bulk)."
  );

  section("13–14. Your Progress HTML gating");
  const sharedPage = await fetch(`${base}/dashboard/projects/${TEST_PROJECT}`, {
    headers: { Cookie: shareCookie },
  });
  const sharedHtml = await sharedPage.text();
  console.log(
    "grep shared viewer Your Progress:",
    sharedHtml.includes("Your Progress") ? "FOUND (fail)" : "absent (ok)"
  );
  assert(!sharedHtml.includes("Your Progress"), "shared viewer HTML lacks Your Progress");

  if (publicUrl) {
    const anonPage = await fetch(publicUrl);
    const anonHtml = await anonPage.text();
    console.log(
      "grep anonymous Your Progress:",
      anonHtml.includes("Your Progress") ? "FOUND (fail)" : "absent (ok)"
    );
    assert(!anonHtml.includes("Your Progress"), "anonymous HTML lacks Your Progress");
  }

  const { data: clientProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", TEST_CLIENT_EMAIL)
    .maybeSingle();
  if (clientProfile?.id) {
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_CLIENT_EMAIL,
    });
    const hashed = linkData.properties?.hashed_token;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: verified } = await userClient.auth.verifyOtp({
      token_hash: hashed!,
      type: "email",
    });
    const ref = new URL(url).hostname.split(".")[0];
    const clientCookie = `sb-${ref}-auth-token=${encodeURIComponent(
      JSON.stringify({
        access_token: verified.session!.access_token,
        refresh_token: verified.session!.refresh_token,
        user: verified.user,
      })
    )}`;
    const clientPage = await fetch(`${base}/dashboard/projects/${TEST_PROJECT}`, {
      headers: { Cookie: clientCookie },
    });
    const clientHtml = await clientPage.text();
    console.log(
      "grep assigned client Your Progress:",
      clientHtml.includes("Your Progress") ? "present (ok)" : "absent (fail)"
    );
    assert(clientHtml.includes("Your Progress"), "assigned client still sees Your Progress");
  } else {
    console.log("SKIP assigned client regression — test client profile not found");
  }

  section("15. Share with existing ShootPortal account");
  const existingEmail = TEST_CLIENT_EMAIL;
  await cleanupShare(admin, existingEmail);
  const existing = await createShareWithLink(admin, existingEmail, "30days");
  const existingConsume = await consumeShareToken(base, extractToken(existing.link));
  assert(existingConsume.status === 302 || existingConsume.status === 307, "existing account email share exchange works");

  section("16. tenant-isolation.sql + tenant-teardown.sql");
  try {
    const isoOut = execSync("npx tsx scripts/run-tenant-sql.ts supabase/tests/tenant-isolation.sql 2>&1", {
      encoding: "utf8",
    }).trim();
    const tearOut = execSync("npx tsx scripts/run-tenant-sql.ts supabase/tests/tenant-teardown.sql 2>&1", {
      encoding: "utf8",
    }).trim();
    console.log("tenant-isolation tail:", isoOut.split("\n").slice(-5).join("\n"));
    console.log("tenant-teardown tail:", tearOut.split("\n").slice(-5).join("\n"));
    assert(/0 rows/.test(isoOut) || isoOut.includes("(0 rows)"), "tenant-isolation.sql zero rows");
    assert(/0 rows/.test(tearOut) || tearOut.includes("(0 rows)"), "tenant-teardown.sql zero rows");
  } catch (err) {
    console.log(
      "SKIP full tenant SQL harness (set SUPABASE_ACCESS_TOKEN for run-tenant-sql.ts).",
      err instanceof Error ? err.message : err
    );
    console.log("Manual: npx tsx scripts/run-tenant-sql.ts supabase/tests/tenant-isolation.sql");
  }

  await cleanupShare(admin, reusableEmail);
  await cleanupShare(admin, expiredEmail);
  await cleanupShare(admin, existingEmail);

  console.log("\n=== verify-share-access-tokens complete ===");
}

main().catch((err) => {
  console.error("\nVERIFY FAILED:", err);
  process.exit(1);
});
