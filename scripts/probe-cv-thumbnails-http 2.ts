/**
 * Probe /api/media/thumbnails for the 37-photo Creative Visuals project.
 * Usage: npx tsx scripts/probe-cv-thumbnails-http.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CV_SLUG = "creative-visuals-drone-photo";
const SWIFT_SLUG = "swift-aerial-media";
const CV_ADMIN = "cvdroneandphoto@gmail.com";
const SWIFT_ADMIN = "jackson@swiftaerialmedia.com";
const PROJECT = "91a4783d-d3b7-455c-9400-2f7d2098a21f";

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

async function probe(
  label: string,
  base: string,
  cookie: string,
  ids: string[]
) {
  const endpoint = `${base}/api/media/thumbnails`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ ids }),
    signal: AbortSignal.timeout(120_000),
    redirect: "manual",
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep */
  }
  const urls =
    parsed && typeof parsed === "object" && parsed !== null && "urls" in parsed
      ? (parsed as { urls: Record<string, string | null> }).urls
      : null;
  const nullCount = urls ? Object.values(urls).filter((u) => !u).length : null;
  console.log(
    JSON.stringify(
      {
        label,
        endpoint,
        status: res.status,
        urlCount: urls ? Object.keys(urls).length : 0,
        nullCount,
        error:
          parsed && typeof parsed === "object" && parsed !== null && "error" in parsed
            ? (parsed as { error: string }).error
            : null,
        bodyBytes: text.length,
      },
      null,
      2
    )
  );
  if (res.status !== 200) {
    console.log("FULL_BODY:", text.slice(0, 2000));
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await admin
    .from("media_assets")
    .select("id")
    .eq("project_id", PROJECT)
    .eq("media_type", "photo")
    .order("display_order");
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.id as string);
  console.log("photo ids:", ids.length);

  const cvCookie = await sessionCookie(admin, CV_ADMIN);
  const swiftCookie = await sessionCookie(admin, SWIFT_ADMIN);

  await probe(
    "CV admin on CV tenant path (correct)",
    `http://127.0.0.1:3000/b/${CV_SLUG}`,
    cvCookie,
    ids
  );
  await probe(
    "CV admin on root path (no /b/slug)",
    `http://127.0.0.1:3000`,
    cvCookie,
    ids
  );
  await probe(
    "Swift admin on Swift path requesting CV asset ids (cross-tenant)",
    `http://127.0.0.1:3000/b/${SWIFT_SLUG}`,
    swiftCookie,
    ids
  );
  await probe(
    "Swift admin on CV tenant path (impersonation-like host)",
    `http://127.0.0.1:3000/b/${CV_SLUG}`,
    swiftCookie,
    ids
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
