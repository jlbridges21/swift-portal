/**
 * Shared-viewer video review comment UI + API verification (Jackson Bridges test project only).
 * Usage: npx tsx scripts/verify-shared-viewer-comments.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const SWIFT_SLUG = "swift-aerial-media";
const TEST_PROJECT = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";
const TEST_CLIENT_EMAIL = "jackson.bridges21@gmail.com";
const TEST_REVIEW = "ed52d70a-b94b-4e6b-9e9e-74bd396d56b5";

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

function tenantBase() {
  const host = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  return `${host}/b/${SWIFT_SLUG}`;
}

function extractToken(shareUrl: string): string {
  return new URL(shareUrl).searchParams.get("token") || "";
}

function cookieFromSetCookies(cookies: string[]): string {
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function consumeShareToken(base: string, rawToken: string) {
  const form = new URLSearchParams();
  form.set("token", rawToken);
  const res = await fetch(`${base}/auth/share/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    redirect: "manual",
  });
  return {
    status: res.status,
    location: res.headers.get("location") ?? "",
    cookies: res.headers.getSetCookie?.() ?? [],
  };
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
  const shareEmail = `share-comment-ui-${ts}@example.test`;

  const { addProjectShare, buildShareMagicLinkForProject, resolveShareAccessWindow } =
    await import("../src/lib/project-shares");
  const accessFields = resolveShareAccessWindow("30days");
  const added = await addProjectShare({
    businessId: SWIFT,
    projectId: TEST_PROJECT,
    email: shareEmail,
    invitedBy: SWIFT_ADMIN,
    notify: false,
    projectName: "Jackson Bridges - 9560 CR-99 - Aerial Photography",
    inviterName: "Admin",
    expiryPreset: "30days",
  });
  const link = await buildShareMagicLinkForProject({
    businessId: SWIFT,
    projectId: TEST_PROJECT,
    email: shareEmail,
    shareId: added.share.id,
    accessFields,
  });
  const token = extractToken(link);
  const consumed = await consumeShareToken(base, token);
  const shareCookie = cookieFromSetCookies(consumed.cookies);
  console.log("share exchange:", consumed.status, consumed.location);

  const { data: version } = await admin
    .from("video_review_versions")
    .select("id")
    .eq("review_id", TEST_REVIEW)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version?.id) throw new Error("No review version on test project");

  section("1. Shared viewer project HTML — review entry, no financials/progress");
  const projectPage = await fetch(`${base}/dashboard/projects/${TEST_PROJECT}`, {
    headers: { Cookie: shareCookie },
  });
  const projectHtml = await projectPage.text();
  console.log("project page status:", projectPage.status);
  console.log('grep "Open review":', projectHtml.includes("Open review") ? "present (ok)" : "absent (fail)");
  console.log('grep "Your Progress":', projectHtml.includes("Your Progress") ? "FOUND (fail)" : "absent (ok)");
  console.log('grep "Payments":', projectHtml.includes("Payments") ? "FOUND (fail)" : "absent (ok)");
  console.log('grep "Quote":', /Quote|Estimate|Proposal/i.test(projectHtml) ? "FOUND (fail)" : "absent (ok)");
  if (!projectHtml.includes("Open review")) throw new Error("shared viewer missing review entry on project page");
  if (projectHtml.includes("Your Progress")) throw new Error("shared viewer sees Your Progress");

  section("2. Shared viewer review page — Add comment visible");
  const reviewPage = await fetch(
    `${base}/dashboard/projects/${TEST_PROJECT}/reviews/${TEST_REVIEW}`,
    { headers: { Cookie: shareCookie } }
  );
  const reviewHtml = await reviewPage.text();
  console.log("review page status:", reviewPage.status);
  console.log('grep "Add comment":', reviewHtml.includes("Add comment") ? "present (ok)" : "absent (fail)");
  if (!reviewHtml.includes("Add comment")) throw new Error("shared viewer review page missing Add comment");

  section("3. Shared viewer POST comment + reply (no notification re-test)");
  const commentBody = `Share viewer verify ${ts}`;
  const commentRes = await fetch(`${base}/api/video-reviews/${TEST_REVIEW}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: shareCookie },
    body: JSON.stringify({
      version_id: version.id,
      body: commentBody,
      timestamp_seconds: 1.5,
    }),
  });
  const commentText = await commentRes.text();
  console.log("POST comment:", commentRes.status, commentText.slice(0, 240));
  if (commentRes.status !== 201) throw new Error("comment POST failed");
  const commentJson = JSON.parse(commentText);
  console.log("author_name:", commentJson.author_name);
  if (!commentJson.author_name || commentJson.author_name === "Unknown") {
    throw new Error("comment not attributed to shared viewer");
  }

  const replyRes = await fetch(`${base}/api/video-reviews/${TEST_REVIEW}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: shareCookie },
    body: JSON.stringify({
      parent_comment_id: commentJson.id,
      body: `Reply verify ${ts}`,
    }),
  });
  const replyText = await replyRes.text();
  console.log("POST reply:", replyRes.status, replyText.slice(0, 240));
  if (replyRes.status !== 201) throw new Error("reply POST failed");

  section("4. Shared viewer cannot resolve (server 403)");
  const resolveRes = await fetch(
    `${base}/api/video-reviews/${TEST_REVIEW}/comments/${commentJson.id}/resolve`,
    { method: "POST", headers: { Cookie: shareCookie } }
  );
  const resolveText = await resolveRes.text();
  console.log("POST resolve:", resolveRes.status, resolveText.slice(0, 240));
  if (resolveRes.status !== 403) throw new Error("shared viewer resolve should be 403");

  section("5. Anonymous public link — Sign in to comment + redirect hash");
  const { data: pubProject } = await admin
    .from("projects")
    .select("link_access_token, link_access_mode")
    .eq("id", TEST_PROJECT)
    .single();
  if (!pubProject?.link_access_token) throw new Error("test project missing link_access_token");
  const priorMode = pubProject.link_access_mode;
  if (priorMode !== "anyone_with_link") {
    await admin.from("projects").update({ link_access_mode: "anyone_with_link" }).eq("id", TEST_PROJECT);
  }
  const anonPage = await fetch(`${base}/view/${pubProject.link_access_token}`);
  const anonHtml = await anonPage.text();
  console.log("anonymous page status:", anonPage.status);
  console.log(
    'grep "Sign in to comment":',
    anonHtml.includes("Sign in to comment") ? "present (ok)" : "absent (fail)"
  );
  const redirectMatch = anonHtml.match(/redirect=%2Fview%2F[^&"]+%23video/);
  console.log("login redirect includes #video:", redirectMatch ? "yes (ok)" : "no (fail)");
  if (!anonHtml.includes("Sign in to comment")) throw new Error("anonymous page missing Sign in to comment");
  if (priorMode !== "anyone_with_link") {
    await admin.from("projects").update({ link_access_mode: priorMode }).eq("id", TEST_PROJECT);
  }

  section("6. Assigned client + admin regressions (Jackson project)");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ref = new URL(url).hostname.split(".")[0];

  for (const [label, email] of [
    ["assigned client", TEST_CLIENT_EMAIL],
  ] as const) {
    const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: verified } = await userClient.auth.verifyOtp({
      token_hash: linkData.properties!.hashed_token!,
      type: "email",
    });
    const cookie = `sb-${ref}-auth-token=${encodeURIComponent(
      JSON.stringify({
        access_token: verified!.session!.access_token,
        refresh_token: verified!.session!.refresh_token,
        user: verified!.user,
      })
    )}`;
    const html = await (
      await fetch(`${base}/dashboard/projects/${TEST_PROJECT}`, { headers: { Cookie: cookie } })
    ).text();
    console.log(`${label} Your Progress:`, html.includes("Your Progress") ? "present (ok)" : "absent");
    console.log(`${label} Open review:`, html.includes("Open review") ? "present (ok)" : "absent");
  }

  await admin
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", added.share.id);

  console.log("\n=== verify-shared-viewer-comments complete ===");
}

main().catch((err) => {
  console.error("\nVERIFY FAILED:", err);
  process.exit(1);
});
