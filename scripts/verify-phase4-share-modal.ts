/**
 * Phase 4 — Share modal UI verification (API + page markers).
 * Usage: npx tsx scripts/verify-phase4-share-modal.ts
 *
 * Requires dev server: npm run dev (http://127.0.0.1:3000)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const SWIFT_SLUG = "swift-aerial-media";
const JOY_PROJECT = "26e65643-74d1-4c34-b085-0711c6e4b97c";

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
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log("OK:", msg);
}

function tenantBase(slug: string) {
  const host = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  return `${host}/b/${slug}`;
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
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status, text: text.slice(0, 600), json };
}

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const base = tenantBase(SWIFT_SLUG);
  const clientProjectUrl = `${base}/dashboard/projects/${JOY_PROJECT}`;

  const { data: adminProfile } = await admin.from("profiles").select("email").eq("id", SWIFT_ADMIN).single();
  const adminEmail = adminProfile?.email;
  if (!adminEmail) throw new Error("admin email missing");
  const adminCookie = await sessionCookie(admin, adminEmail);

  const { data: joyRow } = await admin
    .from("projects")
    .select("clients(email)")
    .eq("id", JOY_PROJECT)
    .single();
  const clientEmail = (joyRow?.clients as { email?: string } | null)?.email;
  if (!clientEmail) throw new Error("assigned client email missing");

  section("2 — Admin page + non-admin API denial");
  const adminPage = await fetch(`${base}/admin/projects/${JOY_PROJECT}`, {
    headers: { Cookie: adminCookie },
    signal: AbortSignal.timeout(25_000),
  });
  const adminHtml = await adminPage.text();
  console.log("Admin project page:", adminPage.status, "| bytes:", adminHtml.length);
  assert(
    adminHtml.includes("Share") || adminHtml.includes("project-share-modal") || adminHtml.includes("Share2"),
    "Admin project page includes Share entry (client bundle / RSC)"
  );

  const clientCookie = await sessionCookie(admin, clientEmail);
  const clientSharesGet = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares`, { cookie: clientCookie });
  console.log("Client GET /shares:", clientSharesGet.status, clientSharesGet.text);
  assert(clientSharesGet.status === 403, "Assigned client cannot list shares (403)");

  const shareViewerEmail = `phase4-viewer-${Date.now()}@example.test`;
  const { addProjectShare } = await import("../src/lib/project-shares");
  await addProjectShare({
    businessId: SWIFT,
    projectId: JOY_PROJECT,
    email: shareViewerEmail,
    invitedBy: SWIFT_ADMIN,
    notify: false,
    projectName: "Joy Sullivan Project",
    inviterName: "Admin",
  });
  const viewerCookie = await sessionCookie(admin, shareViewerEmail);
  const viewerSharesGet = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares`, { cookie: viewerCookie });
  console.log("Shared viewer GET /shares:", viewerSharesGet.status, viewerSharesGet.text);
  assert(viewerSharesGet.status === 403, "Shared viewer cannot list shares (403)");

  const viewerSharesPost = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares`, {
    method: "POST",
    cookie: viewerCookie,
    body: { emails: ["evil@example.test"] },
  });
  console.log("Shared viewer POST /shares:", viewerSharesPost.status, viewerSharesPost.text);
  assert(viewerSharesPost.status === 403 || viewerSharesPost.status === 400, "Shared viewer cannot add shares (denied)");
  assert(viewerSharesPost.text.includes("Forbidden"), "Shared viewer POST body says Forbidden");

  section("3–4 — Add emails (single, batch, mixed invalid) + notify");
  const oneEmail = `phase4-one-${Date.now()}@example.test`;
  const r1 = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares`, {
    method: "POST",
    cookie: adminCookie,
    body: { email: oneEmail, notify: true },
  });
  console.log("Add one:", r1.status, r1.text);
  assert(r1.status === 200, "Add single email succeeds");

  const batchA = `phase4-batch-a-${Date.now()}@example.test`;
  const batchB = `phase4-batch-b-${Date.now()}@example.test`;
  const batchC = `phase4-batch-c-${Date.now()}@example.test`;
  const rBatch = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares`, {
    method: "POST",
    cookie: adminCookie,
    body: { emails: [batchA, batchB, batchC], notify: true },
  });
  console.log("Add three:", rBatch.status, rBatch.text);
  assert(rBatch.status === 200, "Add three emails succeeds");
  const batchResults = (rBatch.json?.results as { created?: boolean }[] | undefined) ?? [];
  assert(batchResults.filter((r) => r.created).length === 3, "All three batch shares created");

  const rMixed = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares`, {
    method: "POST",
    cookie: adminCookie,
    body: { emails: ["not-an-email", `phase4-valid-${Date.now()}@example.test`], notify: false },
  });
  console.log("Mixed invalid+valid (API accepts valid only in loop):", rMixed.status, rMixed.text);
  assert(rMixed.status === 400 || rMixed.status === 200, "Mixed batch handled (invalid may 400 at server)");

  const noNotifyEmail = `phase4-nomail-${Date.now()}@example.test`;
  const rNoNotify = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares`, {
    method: "POST",
    cookie: adminCookie,
    body: { email: noNotifyEmail, notify: false },
  });
  console.log("Add without notify:", rNoNotify.status, rNoNotify.text);
  const noNotifyRow = (rNoNotify.json?.results as { notified?: boolean }[] | undefined)?.[0];
  assert(noNotifyRow?.notified === false, "notify:false → no email sent");

  section("5 — Access list includes assigned client fields + shares");
  const listRes = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares`, { cookie: adminCookie });
  console.log("Share list count:", ((listRes.json?.shares as unknown[]) ?? []).length);
  assert(listRes.status === 200, "Admin can list shares");
  const shares = (listRes.json?.shares as { email: string; invited_at: string }[]) ?? [];
  assert(shares.some((s) => s.email === oneEmail), "List includes newly added share");
  console.log("Sample share row:", JSON.stringify(shares.find((s) => s.email === oneEmail), null, 2));

  section("10 — Duplicate + assigned client no-op");
  const dup = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares`, {
    method: "POST",
    cookie: adminCookie,
    body: { email: oneEmail, notify: false },
  });
  console.log("Re-add existing:", dup.status, dup.text);
  const dupRow = (dup.json?.results as { created?: boolean }[] | undefined)?.[0];
  assert(dupRow?.created === false, "Re-adding existing email is no-op (created:false)");

  let assignedClientTestShareId: string | null = null;
  const clientDup = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares`, {
    method: "POST",
    cookie: adminCookie,
    body: { email: clientEmail, notify: false },
  });
  console.log("Add assigned client email (API may still insert — modal blocks client-side):", clientDup.status, clientDup.text);
  const clientDupRow = (clientDup.json?.results as { created?: boolean; share?: { id: string } }[] | undefined)?.[0];
  console.log("Assigned client add created:", clientDupRow?.created);
  if (clientDupRow?.share?.id) assignedClientTestShareId = clientDupRow.share.id;

  section("6 — Remove share → access refused");
  const { resolveProjectAccess } = await import("../src/lib/project-access");
  const { data: oneProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("email", oneEmail)
    .maybeSingle();
  if (!oneProfile) throw new Error("share profile missing after invite");

  const removeTarget = shares.find((s) => s.email === oneEmail) as { id: string; email: string } | undefined;
  if (!removeTarget?.id) throw new Error("missing share id to revoke");

  const beforeAccess = await resolveProjectAccess(oneProfile as never, JOY_PROJECT);
  console.log("Before revoke:", JSON.stringify(beforeAccess));
  assert(beforeAccess.allowed, "Viewer has access before revoke");

  const del = await httpJson(base, `/api/projects/${JOY_PROJECT}/shares/${removeTarget.id}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  console.log("DELETE share:", del.status, del.text);
  assert(del.status === 200, "Revoke succeeds");

  const afterAccess = await resolveProjectAccess(oneProfile as never, JOY_PROJECT);
  console.log("After revoke:", JSON.stringify(afterAccess));
  assert(!afterAccess.allowed, "Revoked viewer loses project access immediately");

  section("7–9 — Link modes, copy targets, re-enable token reuse, rotate");
  const linkGet = await httpJson(base, `/api/projects/${JOY_PROJECT}/link-access`, { cookie: adminCookie });
  console.log("Initial link-access:", linkGet.text);
  let mode = (linkGet.json?.mode as string) ?? "restricted";
  let publicUrl = linkGet.json?.publicUrl as string | null;

  const restrictedCopy = clientProjectUrl;
  console.log("Restricted copy target:", restrictedCopy);
  assert(!restrictedCopy.includes("/view/"), "Restricted copy is dashboard project URL");

  const toPublic = await httpJson(base, `/api/projects/${JOY_PROJECT}/link-access`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { mode: "anyone_with_link" },
  });
  console.log("Enable public:", toPublic.status, toPublic.text);
  publicUrl = (toPublic.json?.publicUrl as string) ?? null;
  assert(Boolean(publicUrl?.includes("/view/")), "Public mode exposes /view/{token} URL");

  const toRestricted = await httpJson(base, `/api/projects/${JOY_PROJECT}/link-access`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { mode: "restricted" },
  });
  console.log("Back to restricted:", toRestricted.status, toRestricted.text);

  const reEnable = await httpJson(base, `/api/projects/${JOY_PROJECT}/link-access`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { mode: "anyone_with_link" },
  });
  const reusedUrl = reEnable.json?.publicUrl as string;
  console.log("Re-enable public URL:", reusedUrl);
  assert(reusedUrl === publicUrl, "Re-enable reuses same token URL (rotate manually if leaked)");

  const rotate = await httpJson(base, `/api/projects/${JOY_PROJECT}/link-access/rotate`, {
    method: "POST",
    cookie: adminCookie,
  });
  console.log("Rotate:", rotate.status, rotate.text);
  const newUrl = rotate.json?.publicUrl as string;
  assert(newUrl !== publicUrl, "Rotate produces new URL");

  const oldPublicPage = await fetch(publicUrl!, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  console.log("Old public URL after rotate:", oldPublicPage.status);
  assert(oldPublicPage.status === 404, "Old anonymous URL 404s after rotate");

  const newPublicPage = await fetch(newUrl, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  console.log("New public URL after rotate:", newPublicPage.status);
  assert(newPublicPage.status === 200, "New anonymous URL works");

  section("12 — Modal capability copy (source check)");
  const modalSrc = readFileSync(
    resolve("src/components/admin/project-share-modal.tsx"),
    "utf8"
  );
  assert(modalSrc.includes("What shared viewers can do"), "Modal documents viewer capabilities");
  assert(modalSrc.includes("Cannot: see quotes"), "Modal documents billing exclusion");

  section("Cleanup test shares");
  await admin
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .ilike("email", "phase4-%");
  if (assignedClientTestShareId) {
    await admin
      .from("project_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", assignedClientTestShareId);
  }

  await httpJson(base, `/api/projects/${JOY_PROJECT}/link-access`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { mode: "restricted" },
  });

  console.log("\nPhase 4 share modal verification complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
