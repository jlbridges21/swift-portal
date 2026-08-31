/**
 * Full share-viewer E2E after media signing fix.
 * Usage: npx tsx scripts/verify-share-viewer-e2e.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const JOY_PROJECT = "26e65643-74d1-4c34-b085-0711c6e4b97c";
const PHOTO = "2651b010-a430-4fdf-9d73-f051f843b1f8";
const SHARED_REVIEW = "717f25b2-4d3d-4c86-853a-cbaf263a50a5";
const SHARED_VERSION = "90a62b1b-0baa-41db-98b2-9acb70fbcae1";
const SWIFT_SLUG = "swift-aerial-media";

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

function tenantBase() {
  const host = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  return `${host}/b/${SWIFT_SLUG}`;
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
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const base = tenantBase();
  const { addProjectShare, buildShareMagicLinkForProject } = await import("../src/lib/project-shares");

  // --- Fresh email full flow ---
  const freshEmail = `share-e2e-fresh-${Date.now()}@example.test`;
  console.log("\n=== Fresh email E2E ===", freshEmail);
  await addProjectShare({
    businessId: SWIFT,
    projectId: JOY_PROJECT,
    email: freshEmail,
    invitedBy: SWIFT_ADMIN,
    notify: false,
    projectName: "Joy Sullivan Project",
    inviterName: "Admin",
  });

  const { data: beforeTouch } = await admin
    .from("project_shares")
    .select("last_accessed_at")
    .eq("email", freshEmail)
    .eq("project_id", JOY_PROJECT)
    .single();
  console.log("last_accessed_at before any media:", beforeTouch?.last_accessed_at ?? null);

  const confirmUrl = await buildShareMagicLinkForProject({
    businessId: SWIFT,
    projectId: JOY_PROJECT,
    email: freshEmail,
  });
  console.log("Confirm URL host:", new URL(confirmUrl).host);
  console.log("Confirm path:", new URL(confirmUrl).pathname);

  const interstitial = await fetch(confirmUrl, { redirect: "manual" });
  console.log("GET /auth/confirm:", interstitial.status);

  const cookie = await sessionCookie(admin, freshEmail);

  const preview = await fetch(`${base}/api/media/download/${PHOTO}?preview=1`, {
    headers: { Cookie: cookie },
  });
  console.log("GET photo preview:", preview.status, (await preview.text()).slice(0, 120));

  const thumbs = await fetch(`${base}/api/media/thumbnails`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [PHOTO] }),
  });
  const thumbJson = (await thumbs.json()) as { urls?: Record<string, string | null> };
  console.log("POST thumbnails:", thumbs.status, thumbJson.urls?.[PHOTO] ? "signed URL ok" : "null");

  const { data: mediaRows } = await admin
    .from("media_assets")
    .select("id, media_type")
    .eq("project_id", JOY_PROJECT)
    .eq("media_type", "video")
    .limit(1);
  const videoId = mediaRows?.[0]?.id as string | undefined;
  if (videoId) {
    const videoPreview = await fetch(`${base}/api/media/download/${videoId}?preview=1`, {
      headers: { Cookie: cookie },
    });
    console.log("GET video preview:", videoPreview.status, (await videoPreview.text()).slice(0, 120));
  } else {
    console.log("GET video preview: skipped (no video on project)");
  }

  const download = await fetch(`${base}/api/media/download/${PHOTO}?file=1`, {
    headers: { Cookie: cookie },
  });
  console.log("GET photo download:", download.status, download.headers.get("content-type"));

  const comment = await fetch(`${base}/api/video-reviews/${SHARED_REVIEW}/comments`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      version_id: SHARED_VERSION,
      body: "Share viewer E2E comment",
      timestamp_seconds: 1,
    }),
  });
  console.log("POST video comment:", comment.status, (await comment.text()).slice(0, 120));

  const page = await fetch(`${base}/dashboard/projects/${JOY_PROJECT}`, { headers: { Cookie: cookie } });
  console.log("GET project page:", page.status);

  const { data: afterTouch } = await admin
    .from("project_shares")
    .select("last_accessed_at")
    .eq("email", freshEmail)
    .eq("project_id", JOY_PROJECT)
    .single();
  console.log("last_accessed_at after successful media:", afterTouch?.last_accessed_at ?? null);

  // --- Expired / reused link ---
  console.log("\n=== Expired / reused link ===");
  const { data: link1 } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: freshEmail,
    options: { redirectTo: `${base}/auth/confirm` },
  });
  const hash1 = link1.properties?.hashed_token;
  if (hash1) {
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const c = createClient(url, anon, { auth: { persistSession: false } });
    const first = await c.auth.verifyOtp({ token_hash: hash1, type: "email" });
    console.log("First OTP verify:", first.error ? first.error.message : "ok");
    const second = await c.auth.verifyOtp({ token_hash: hash1, type: "email" });
    console.log("Second OTP verify (reuse):", second.error?.message ?? "unexpected ok");
  }

  const resend = await fetch(`${base}/api/auth/resend-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: freshEmail }),
  });
  const resendJson = (await resend.json()) as { message?: string };
  console.log("POST resend-link:", resend.status, resendJson.message);

  const newConfirm = await buildShareMagicLinkForProject({
    businessId: SWIFT,
    projectId: JOY_PROJECT,
    email: freshEmail,
  });
  const inter2 = await fetch(newConfirm, { redirect: "manual" });
  console.log("GET new confirm link:", inter2.status);

  // --- Existing ShootPortal account ---
  console.log("\n=== Existing account share ===");
  const { data: existingClient } = await admin
    .from("profiles")
    .select("email")
    .eq("business_id", SWIFT)
    .eq("role", "client")
    .not("client_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (existingClient?.email) {
    const existingEmail = String(existingClient.email).toLowerCase();
    await addProjectShare({
      businessId: SWIFT,
      projectId: JOY_PROJECT,
      email: existingEmail,
      invitedBy: SWIFT_ADMIN,
      notify: false,
      projectName: "Joy Sullivan Project",
      inviterName: "Admin",
    });
    const existingCookie = await sessionCookie(admin, existingEmail);
    const existingPreview = await fetch(`${base}/api/media/download/${PHOTO}?preview=1`, {
      headers: { Cookie: existingCookie },
    });
    console.log("Existing client preview:", existingPreview.status);
    await admin
      .from("project_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("email", existingEmail)
      .eq("project_id", JOY_PROJECT);
  } else {
    console.log("No assigned client found — skipped");
  }

  await admin
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", freshEmail);

  console.log("\n=== share-viewer E2E complete ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
