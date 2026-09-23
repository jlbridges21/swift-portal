/**
 * Prove read-only impersonation allows batch READ POSTs and still blocks writes.
 * Usage: npx tsx scripts/verify-impersonation-readonly-posts.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  IMPERSONATION_TTL_SECONDS,
  SA_BUSINESS_CONTEXT_COOKIE,
  signImpersonationCookie,
} from "../src/lib/platform-session";
import {
  IMPERSONATION_READONLY_CODE,
  READ_ONLY_POST_EXEMPT_PATHS,
} from "../src/lib/impersonation-readonly";

const SA_EMAIL = "jackson+platform@swiftaerialmedia.com";
const CV_SLUG = "creative-visuals-drone-photo";
const CV_PROJECT = "91a4783d-d3b7-455c-9400-2f7d2098a21f";
const BASE = process.env.VERIFY_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";

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

async function call(
  label: string,
  cookie: string,
  method: string,
  path: string,
  body?: unknown
) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
    redirect: "manual",
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep text */
  }
  console.log(`\n=== ${label} ===`);
  console.log(`${method} ${path} → HTTP ${res.status}`);
  console.log(
    typeof parsed === "string"
      ? parsed.slice(0, 400)
      : JSON.stringify(parsed, null, 2).slice(0, 800)
  );
  return { status: res.status, parsed, text };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  assert(url && service, "missing supabase env");

  console.log("Allowlist exact paths:", [...READ_ONLY_POST_EXEMPT_PATHS]);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: biz } = await admin
    .from("businesses")
    .select("id, slug")
    .eq("slug", CV_SLUG)
    .maybeSingle();
  assert(biz?.id, `business ${CV_SLUG} not found`);

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("email", SA_EMAIL)
    .maybeSingle();
  assert(profile?.role === "super_admin", `${SA_EMAIL} must be super_admin`);

  const { data: assets } = await admin
    .from("media_assets")
    .select("id")
    .eq("project_id", CV_PROJECT)
    .eq("media_type", "photo")
    .limit(3);
  assert(assets?.length, "need photo assets on CV project");
  const ids = assets.map((a) => a.id as string);

  const authCookie = await sessionCookie(admin, SA_EMAIL);
  const exp = Math.floor(Date.now() / 1000) + IMPERSONATION_TTL_SECONDS;
  const roCookie = signImpersonationCookie({
    businessId: biz.id as string,
    allowWrites: false,
    exp,
  });
  const rwCookie = signImpersonationCookie({
    businessId: biz.id as string,
    allowWrites: true,
    exp,
  });
  const cookieRo = `${authCookie}; ${SA_BUSINESS_CONTEXT_COOKIE}=${roCookie}`;
  const cookieRw = `${authCookie}; ${SA_BUSINESS_CONTEXT_COOKIE}=${rwCookie}`;

  // 1) Read-only POST thumbs must succeed
  const thumbs = await call(
    "read-only: POST /api/media/thumbnails (expect 200)",
    cookieRo,
    "POST",
    "/api/media/thumbnails",
    { ids }
  );
  assert(thumbs.status === 200, `thumbs expected 200, got ${thumbs.status}`);
  const urls =
    thumbs.parsed && typeof thumbs.parsed === "object" && "urls" in thumbs.parsed
      ? (thumbs.parsed as { urls: Record<string, string | null> }).urls
      : null;
  assert(urls && Object.keys(urls).length > 0, "thumbs returned no urls");
  const signed = Object.values(urls).filter((u) => typeof u === "string" && u.startsWith("http"));
  assert(signed.length > 0, "thumbs returned no signed URLs");

  // 2) Promo preview must succeed (read-only POST)
  const promo = await call(
    "read-only: POST /api/billing/promo-preview (expect 200)",
    cookieRo,
    "POST",
    "/api/billing/promo-preview",
    { promoCode: "NOPE1234", planKey: "starter", interval: "monthly" }
  );
  assert(promo.status === 200 || promo.status === 400, `promo-preview unexpected ${promo.status}`);
  assert(
    !(
      promo.parsed &&
      typeof promo.parsed === "object" &&
      "code" in promo.parsed &&
      (promo.parsed as { code?: string }).code === IMPERSONATION_READONLY_CODE
    ),
    "promo-preview wrongly blocked by read-only guard"
  );

  // 3) Genuine writes must 403
  const writes: Array<{ label: string; method: string; path: string; body?: unknown }> = [
    {
      label: "edit project",
      method: "PATCH",
      path: `/api/projects/${CV_PROJECT}`,
      body: { title: "should-not-write" },
    },
    {
      label: "upload sign",
      method: "POST",
      path: "/api/media/upload/sign",
      body: {
        projectId: CV_PROJECT,
        fileName: "x.jpg",
        contentType: "image/jpeg",
        fileSize: 10,
      },
    },
    {
      label: "delete asset",
      method: "DELETE",
      path: `/api/media/${ids[0]}`,
    },
    {
      label: "send message",
      method: "POST",
      path: `/api/projects/${CV_PROJECT}/messages`,
      body: { body: "should-not-send" },
    },
    {
      label: "create payment",
      method: "POST",
      path: "/api/payments",
      body: { project_id: CV_PROJECT, amount_cents: 100, description: "should-not-create" },
    },
  ];

  for (const w of writes) {
    const r = await call(`read-only BLOCK: ${w.label}`, cookieRo, w.method, w.path, w.body);
    assert(r.status === 403, `${w.label} expected 403, got ${r.status}`);
    const code =
      r.parsed && typeof r.parsed === "object" && "code" in r.parsed
        ? (r.parsed as { code?: string }).code
        : undefined;
    assert(code === IMPERSONATION_READONLY_CODE, `${w.label} missing ${IMPERSONATION_READONLY_CODE}`);
  }

  // 4) Allow writes restores mutating path (we only prove middleware no longer 403s with that code —
  //    handler may still validate body and return 4xx for other reasons).
  const allowWritesProbe = await call(
    "allow-writes: PATCH project (must NOT be impersonation_readonly)",
    cookieRw,
    "PATCH",
    `/api/projects/${CV_PROJECT}`,
    { title: "should-not-persist-probe" }
  );
  assert(
    !(
      allowWritesProbe.parsed &&
      typeof allowWritesProbe.parsed === "object" &&
      "code" in allowWritesProbe.parsed &&
      (allowWritesProbe.parsed as { code?: string }).code === IMPERSONATION_READONLY_CODE
    ),
    "allow-writes still hit impersonation_readonly"
  );
  assert(
    allowWritesProbe.status !== 403 ||
      !(
        allowWritesProbe.parsed &&
        typeof allowWritesProbe.parsed === "object" &&
        "error" in allowWritesProbe.parsed &&
        String((allowWritesProbe.parsed as { error?: unknown }).error).includes("read-only")
      ),
    "allow-writes still returned read-only 403"
  );

  console.log("\nverify-impersonation-readonly-posts: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
