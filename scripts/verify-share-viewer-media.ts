/**
 * Capture share-viewer media failures (run before/after fix).
 * Usage: npx tsx scripts/verify-share-viewer-media.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const JOY_PROJECT = "26e65643-74d1-4c34-b085-0711c6e4b97c";
const SHARED_MEDIA = "2651b010-a430-4fdf-9d73-f051f843b1f8";
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
  const email = `share-debug-${Date.now()}@example.test`;

  console.log("\n=== STEP 1 — Fresh share viewer ===");
  console.log("email:", email);

  const { addProjectShare } = await import("../src/lib/project-shares");
  await addProjectShare({
    businessId: SWIFT,
    projectId: JOY_PROJECT,
    email,
    invitedBy: SWIFT_ADMIN,
    notify: false,
    projectName: "Joy Sullivan Project",
    inviterName: "Admin",
  });

  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${base}/auth/confirm` },
  });
  const magicUrl = linkData?.properties?.action_link ?? "(no action_link)";
  console.log("\nMagic link URL (truncated):", String(magicUrl).slice(0, 140) + "…");

  const cookie = await sessionCookie(admin, email);
  const { data: profile } = await admin.from("profiles").select("role, business_id").eq("email", email).single();
  console.log("profile after OTP:", profile);

  const previewRes = await fetch(`${base}/api/media/download/${SHARED_MEDIA}?preview=1`, {
    headers: { Cookie: cookie },
  });
  const previewBody = await previewRes.text();
  console.log("\nGET ?preview=1:", previewRes.status, previewBody.slice(0, 220));

  const thumbRes = await fetch(`${base}/api/media/thumbnails`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [SHARED_MEDIA] }),
  });
  const thumbBody = await thumbRes.text();
  console.log("POST /api/media/thumbnails:", thumbRes.status, thumbBody.slice(0, 220));

  const fileRes = await fetch(`${base}/api/media/download/${SHARED_MEDIA}?file=1`, {
    headers: { Cookie: cookie },
  });
  console.log("GET ?file=1:", fileRes.status, fileRes.headers.get("content-type"), "bytes:", (await fileRes.arrayBuffer()).byteLength);

  const pageRes = await fetch(`${base}/dashboard/projects/${JOY_PROJECT}`, {
    headers: { Cookie: cookie },
  });
  console.log("GET project page:", pageRes.status, "bytes:", (await pageRes.text()).length);

  const resendRes = await fetch(`${base}/api/auth/resend-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  console.log("\nPOST resend-link:", resendRes.status, await resendRes.text());

  const { data: shareRow } = await admin
    .from("project_shares")
    .select("last_accessed_at")
    .eq("email", email)
    .eq("project_id", JOY_PROJECT)
    .maybeSingle();
  console.log("last_accessed_at after media access:", shareRow?.last_accessed_at ?? null);

  await admin
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", email);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
