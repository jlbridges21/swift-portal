/**
 * Hit POST /api/media/thumbnails as admin with real Jackson photo ids.
 * Usage: npx tsx scripts/probe-admin-thumbnails-http.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SWIFT_SLUG = "swift-aerial-media";
const ADMIN_EMAIL = "jackson@swiftaerialmedia.com";
const PROJECT = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";

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
  console.log("ids count:", ids.length);

  const cookie = await sessionCookie(admin, ADMIN_EMAIL);
  const bases = [
    `http://127.0.0.1:3000/b/${SWIFT_SLUG}`,
    `http://127.0.0.1:3000`,
    `http://localhost:3000/b/${SWIFT_SLUG}`,
  ];

  for (const base of bases) {
    const endpoint = `${base}/api/media/thumbnails`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(60_000),
      redirect: "manual",
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
    const urls =
      body && typeof body === "object" && body !== null && "urls" in body
        ? (body as { urls: Record<string, string | null> }).urls
        : null;
    const nullCount = urls
      ? Object.values(urls).filter((u) => !u).length
      : null;
    const urlCount = urls ? Object.keys(urls).length : 0;
    console.log(
      JSON.stringify(
        {
          endpoint,
          status: res.status,
          contentType: res.headers.get("content-type"),
          urlCount,
          nullCount,
          bodyPreview:
            typeof body === "string"
              ? body.slice(0, 500)
              : {
                  error: (body as { error?: string })?.error,
                  sample: urls
                    ? Object.fromEntries(
                        Object.entries(urls)
                          .slice(0, 3)
                          .map(([k, v]) => [k, v ? `${String(v).slice(0, 80)}…` : null])
                      )
                    : body,
                },
        },
        null,
        2
      )
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
