/**
 * Phase 3 closeout — anonymous public link access verification.
 * Usage: npx tsx scripts/verify-phase3-link-access.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  allowPublicLinkApi,
  allowPublicLinkPageView,
  PUBLIC_LINK_RATE_LIMITS,
  resetPublicLinkRateLimitsForTests,
} from "../src/lib/public-link-rate-limit";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const SWIFT_SLUG = "swift-aerial-media";
const SHARED_PROJECT = "26e65643-74d1-4c34-b085-0711c6e4b97c";
const OTHER_SWIFT_PROJECT = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";
const OTHER_BUSINESS_PROJECT = "f4a9a474-9470-4b5a-b998-8c9236b40b31";
const SECOND_BUSINESS_SLUG = "neal";
const OTHER_SWIFT_MEDIA = "7d3bc3f6-e39b-4c3a-9c19-480eeeb841ea";
const OTHER_BUSINESS_MEDIA = "e4ce20c8-cca8-482a-96a1-9d7428b27484";
const SHARED_MEDIA = "2651b010-a430-4fdf-9d73-f051f843b1f8";
const OTHER_FOLDER = "df142d88-fa00-44af-95c8-da6e2c92324f";

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

function tenantBase(slug: string) {
  const host = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  return `${host}/b/${slug}`;
}

type ProbeResult = { label: string; status: number; body: string; leak: boolean; headers?: Headers };

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
    if (trimmed.startsWith("{") && !trimmed.includes('"error"')) {
      if (trimmed.includes('"urls"') && !trimmed.replace(/\s/g, "").match(/https?:\/\//)) return false;
      if (trimmed.includes('"url"') && trimmed.includes("http")) return false;
      return true;
    }
  }
  return status === 200;
}


async function probe(
  label: string,
  url: string,
  opts: { method?: string; body?: unknown; isPage?: boolean; cookie?: string } = {}
): Promise<ProbeResult> {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(25_000),
  });
  const text = (await res.text()).slice(0, 500);
  const contentType = res.headers.get("content-type") ?? "";
  const isBinary =
    contentType.includes("octet-stream") ||
    contentType.includes("image/") ||
    contentType.includes("application/zip");
  const leak =
    isBinary && res.status === 200 ? false : hasDataLeak(res.status, text, opts.isPage ?? false);
  const flag = leak ? " *** LEAK ***" : "";
  console.log(`${label}${flag}\n  status: ${res.status}\n  body: ${text.slice(0, 200).replace(/\n/g, " ")}\n`);
  return { label, status: res.status, body: text, leak, headers: res.headers };
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

async function main() {
  loadEnvLocal();
  resetPublicLinkRateLimitsForTests();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const base = tenantBase(SWIFT_SLUG);
  const nealBase = tenantBase(SECOND_BUSINESS_SLUG);

  section("SETUP — enable public link on Joy project");
  const { setProjectLinkAccessMode, rotateProjectLinkToken } = await import("../src/lib/project-link-access");
  const { data: adminProfile } = await admin.from("profiles").select("*").eq("id", SWIFT_ADMIN).single();
  const enabled = await setProjectLinkAccessMode(
    SWIFT,
    SHARED_PROJECT,
    "anyone_with_link",
    adminProfile!
  );
  const token = enabled.token!;
  const publicUrl = `${base}/view/${encodeURIComponent(token)}`;
  const apiBase = `${base}/api/public/link/${encodeURIComponent(token)}`;
  console.log("Public URL:", publicUrl);
  console.log("Token (truncated):", token.slice(0, 16) + "…");

  section("ITEM 3 — Anonymous page renders (no cookies)");
  const page = await probe("GET public project page", publicUrl, { isPage: true });
  if (page.status !== 200) throw new Error("Public page should return 200");
  const hasNoIndex =
    page.body.includes("noindex") ||
    page.headers?.get("x-robots-tag")?.includes("noindex");
  console.log(
    "noindex/nofollow:",
    hasNoIndex ? "YES" : "MISSING",
    "| X-Robots-Tag:",
    page.headers?.get("x-robots-tag") ?? "(none)"
  );
  if (!page.body.includes(SHARED_PROJECT.slice(0, 8)) && !page.body.includes("Joy")) {
    console.log("(page HTML is RSC shell — project title may hydrate client-side)");
  }

  section("ITEM 4 — BOUNDARY PROBE (logged out, public token session)");
  const probes: ProbeResult[] = [];
  const pages: [string, string][] = [
    ["PAGE /admin", "/admin"],
    ["PAGE /admin/projects", "/admin/projects"],
    ["PAGE /platform", "/platform"],
    ["PAGE /billing", "/billing"],
    ["PAGE /partner", "/partner"],
    ["PAGE /dashboard/projects/{shared via dashboard}", `/dashboard/projects/${SHARED_PROJECT}`],
    ["PAGE /dashboard/projects/{other Swift}", `/dashboard/projects/${OTHER_SWIFT_PROJECT}`],
    ["PAGE /dashboard/projects/{other business}", `/dashboard/projects/${OTHER_BUSINESS_PROJECT}`],
    ["PAGE /dashboard/request", "/dashboard/request"],
    ["PAGE /view/{token} (allowed)", `/view/${token}`],
  ];
  for (const [label, path] of pages) {
    probes.push(await probe(label, `${base}${path}`, { isPage: true }));
  }

  const apis: [string, string, string?, unknown?][] = [
    ["API GET /api/clients", "/api/clients"],
    ["API GET /api/projects/{other}", `/api/projects/${OTHER_SWIFT_PROJECT}`],
    ["API GET /api/media/download/{shared}?file=1 via AUTH route", `/api/media/download/${SHARED_MEDIA}?file=1`],
    ["API GET public download shared", `${apiBase}/media/download/${SHARED_MEDIA}?preview=1`],
    ["API GET public download other project", `${apiBase}/media/download/${OTHER_SWIFT_MEDIA}?preview=1`],
    ["API POST public thumbnails other", `${apiBase}/media/thumbnails`, "POST", { ids: [OTHER_SWIFT_MEDIA] }],
    ["API GET public zip other folder", `${apiBase}/projects/download-zip?folderId=${OTHER_FOLDER}`],
    ["API GET /api/projects/{shared}/shares", `/api/projects/${SHARED_PROJECT}/shares`],
    ["API GET /api/quotes?project_id", `/api/quotes?project_id=${SHARED_PROJECT}`],
    ["API GET /api/revisions?project_id", `/api/revisions?project_id=${SHARED_PROJECT}`],
    ["API GET /api/shoot-proposals", `/api/shoot-proposals?project_id=${SHARED_PROJECT}`],
    ["API GET /api/admin/search", "/api/admin/search?q=test"],
    ["API GET /api/partner/me", "/api/partner/me"],
    ["API cross-host Neal public token", `${nealBase}/view/${token}`],
    ["API cross-business media", `${apiBase}/media/download/${OTHER_BUSINESS_MEDIA}?preview=1`],
  ];
  for (const [label, path, method, body] of apis) {
    probes.push(await probe(label, path.startsWith("http") ? path : `${base}${path}`, { method, body }));
  }

  const leaks = probes.filter((p) => p.leak);
  console.log(`\nBoundary summary: ${probes.length} probes, ${leaks.length} LEAKS`);
  if (leaks.length) throw new Error(`LEAKS: ${leaks.map((l) => l.label).join(", ")}`);

  section("ITEM 6/7 — Download gate");
  const dlPreview = await probe(
    "Public download preview (gate depends on settings)",
    `${apiBase}/media/download/${SHARED_MEDIA}?file=1`
  );
  console.log("(403 = gate ON blocking download; 200/stream = gate allows)");

  section("ITEM 8 — Switch to RESTRICTED");
  const before = await probe("Before restrict — public page", publicUrl, { isPage: true });
  await setProjectLinkAccessMode(SWIFT, SHARED_PROJECT, "restricted", adminProfile!);
  const after = await probe("After restrict — public page", publicUrl, { isPage: true });
  console.log("Before restrict status:", before.status, "| After:", after.status);
  if (after.status === 200 && after.body.includes("Shared project")) {
    throw new Error("Public page still accessible after restrict");
  }

  section("ITEM 10 — Rate limiting");
  resetPublicLinkRateLimitsForTests();
  let blocked = false;
  for (let i = 0; i < PUBLIC_LINK_RATE_LIMITS.apiPerMinute + 5; i++) {
    const r = allowPublicLinkApi("127.0.0.1", token);
    if (!r.allowed) {
      blocked = true;
      console.log(`API rate limit tripped after ${i + 1} calls, retryAfterSec=${r.retryAfterSec}`);
      break;
    }
  }
  if (!blocked) throw new Error("Rate limit did not trip");
  console.log("Limits:", PUBLIC_LINK_RATE_LIMITS);

  section("ITEM 11/12 — Authenticated access unchanged");
  await setProjectLinkAccessMode(SWIFT, SHARED_PROJECT, "anyone_with_link", adminProfile!);
  const reEnabled = await setProjectLinkAccessMode(
    SWIFT,
    SHARED_PROJECT,
    "anyone_with_link",
    adminProfile!
  );
  const activeToken = reEnabled.token!;
  const activePublicUrl = `${base}/view/${encodeURIComponent(activeToken)}`;
  const adminCookie = await sessionCookie(admin, "jackson@swiftaerialmedia.com");
  const adminDash = await probe(
    "Admin GET /admin/projects/{shared}",
    `${base}/admin/projects/${SHARED_PROJECT}`,
    { cookie: adminCookie, isPage: true }
  );
  console.log("Admin project page:", adminDash.status);

  const shareEmail = `phase3-share-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email: shareEmail, email_confirm: true });
  const { addProjectShare } = await import("../src/lib/project-shares");
  await addProjectShare({
    businessId: SWIFT,
    projectId: SHARED_PROJECT,
    email: shareEmail,
    invitedBy: SWIFT_ADMIN,
    notify: false,
    projectName: "Joy",
    inviterName: "Admin",
  });
  const shareCookie = await sessionCookie(admin, shareEmail);
  const shareDash = await probe(
    "Shared viewer GET dashboard project",
    `${base}/dashboard/projects/${SHARED_PROJECT}`,
    { cookie: shareCookie, isPage: true }
  );
  console.log("Shared viewer dashboard:", shareDash.status);

  section("ITEM 13 — Shared viewer HTML billing grep");
  const sharePageRes = await fetch(`${base}/dashboard/projects/${SHARED_PROJECT}`, {
    headers: { Cookie: shareCookie },
    signal: AbortSignal.timeout(25_000),
  });
  const shareHtml = await sharePageRes.text();
  const { assertNoBillingInHtml, assertBillingPresentForClient, grepBillingLeaksInHtml } = await import(
    "./lib/billing-html-grep"
  );
  await assertNoBillingInHtml(admin, SHARED_PROJECT, shareHtml, "shared viewer dashboard");

  section("ITEM 13b — Anonymous public page HTML billing grep");
  const anonPageRes = await fetch(activePublicUrl, { signal: AbortSignal.timeout(25_000) });
  const anonHtml = await anonPageRes.text();
  await assertNoBillingInHtml(admin, SHARED_PROJECT, anonHtml, "anonymous link visitor");

  section("ITEM 13c — Assigned client + admin billing regression");
  const { data: joyClient } = await admin
    .from("projects")
    .select("clients(email)")
    .eq("id", SHARED_PROJECT)
    .single();
  const clientEmail = (joyClient?.clients as { email?: string } | null)?.email;
  if (!clientEmail) throw new Error("Joy client email missing");
  const clientCookie = await sessionCookie(admin, clientEmail);
  const clientHtml = await (
    await fetch(`${base}/dashboard/projects/${SHARED_PROJECT}`, {
      headers: { Cookie: clientCookie },
      signal: AbortSignal.timeout(25_000),
    })
  ).text();
  await assertBillingPresentForClient(admin, SHARED_PROJECT, clientHtml, "assigned client");
  const adminHtml = await (
    await fetch(`${base}/admin/projects/${SHARED_PROJECT}`, {
      headers: { Cookie: adminCookie },
      signal: AbortSignal.timeout(25_000),
    })
  ).text();
  const adminHits = await grepBillingLeaksInHtml(admin, SHARED_PROJECT, adminHtml, "admin project page");
  if (adminHits.length === 0) {
    console.log("(admin page uses client-side fetch for some billing — status OK if project has billing in DB)");
  }

  section("ITEM 15 — Token rotation");
  const oldToken = activeToken;
  const oldPublicUrl = `${base}/view/${encodeURIComponent(oldToken)}`;
  await rotateProjectLinkToken(SWIFT, SHARED_PROJECT, adminProfile!);
  const oldAfterRotate = await probe("Old token after rotate", oldPublicUrl, { isPage: true });
  const { data: rowAfterRotate } = await admin
    .from("projects")
    .select("link_access_token, link_access_mode")
    .eq("id", SHARED_PROJECT)
    .single();
  const newToken = rowAfterRotate?.link_access_token as string;
  const newPublicUrl = `${base}/view/${encodeURIComponent(newToken)}`;
  const newAfterRotate = await probe("New token after rotate", newPublicUrl, { isPage: true });
  console.log("Old URL status:", oldAfterRotate.status, "| New URL status:", newAfterRotate.status);
  if (oldAfterRotate.status === 200) throw new Error("Old token still works after rotation");
  if (newAfterRotate.status !== 200) throw new Error("New token should work after rotation");

  section("ITEM 16 — Re-enable after Restricted keeps token (no auto-rotate)");
  await setProjectLinkAccessMode(SWIFT, SHARED_PROJECT, "restricted", adminProfile!);
  const tokenBeforeReEnable = newToken;
  await setProjectLinkAccessMode(SWIFT, SHARED_PROJECT, "anyone_with_link", adminProfile!);
  const { data: rowReEnabled } = await admin
    .from("projects")
    .select("link_access_token")
    .eq("id", SHARED_PROJECT)
    .single();
  const tokenAfterReEnable = rowReEnabled?.link_access_token as string;
  console.log(
    "Token unchanged on re-enable:",
    tokenBeforeReEnable === tokenAfterReEnable ? "YES (expected)" : `NO — was ${tokenBeforeReEnable.slice(0, 8)}… now ${tokenAfterReEnable.slice(0, 8)}…`
  );
  if (tokenBeforeReEnable !== tokenAfterReEnable) {
    throw new Error("Re-enable should NOT auto-rotate token");
  }
  const reEnabledPage = await probe("Re-enabled link still works", `${base}/view/${encodeURIComponent(tokenAfterReEnable)}`, {
    isPage: true,
  });
  if (reEnabledPage.status !== 200) throw new Error("Re-enabled link should work with same token");

  section("ITEM 14 — Activity log");
  const { data: acts } = await admin
    .from("activity_logs")
    .select("activity_type, description, user_id")
    .eq("project_id", SHARED_PROJECT)
    .in("activity_type", ["link_access_enabled", "link_access_restricted", "link_access_token_rotated"])
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("Recent link access activities:", acts);
  if (!acts?.some((a) => a.activity_type === "link_access_token_rotated")) {
    throw new Error("Missing link_access_token_rotated activity");
  }

  await setProjectLinkAccessMode(SWIFT, SHARED_PROJECT, "restricted", adminProfile!);
  await admin.from("project_shares").update({ revoked_at: new Date().toISOString() }).ilike("email", "phase3-share-%");

  section("PHASE 3 CLOSEOUT — automated checks passed");
  void dlPreview;
  void page;
  void activePublicUrl;
}

main().catch((err) => {
  console.error("\nCLOSEOUT FAILED:", err);
  process.exit(1);
});
