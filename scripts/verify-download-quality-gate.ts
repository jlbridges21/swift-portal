/**
 * Confirm Print + MLS downloads respect the download gate identically.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const JOY = "26e65643-74d1-4c34-b085-0711c6e4b97c";

for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error(m);
  console.log("OK:", m);
}

async function clientCookie(email: string): Promise<string> {
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  const hashed = linkData.properties?.hashed_token;
  if (!hashed) throw new Error("no hashed_token");
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: verified, error: vErr } = await userClient.auth.verifyOtp({
    token_hash: hashed,
    type: "email",
  });
  if (vErr || !verified.session) throw vErr ?? new Error("no session");
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
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

async function hit(cookie: string, mediaId: string, quality: string) {
  const res = await fetch(
    `http://127.0.0.1:3000/api/media/download/${mediaId}?file=1&quality=${quality}`,
    {
      headers: { Cookie: cookie },
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    }
  );
  await res.arrayBuffer().catch(() => null);
  return res.status;
}

async function main() {
  const { getAppSettings, saveAppSettings } = await import("../src/lib/app-settings");

  for (let i = 0; i < 40; i++) {
    try {
      await fetch("http://127.0.0.1:3000/");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const { data: joy } = await admin
    .from("projects")
    .select("id, status, client_id")
    .eq("id", JOY)
    .single();
  assert(joy?.status === "delivered", `Joy should be delivered, got ${joy?.status}`);

  const { data: joyClient } = await admin
    .from("profiles")
    .select("email")
    .eq("client_id", joy!.client_id)
    .maybeSingle();
  assert(joyClient?.email, "Joy client email");

  const { data: joyMedia } = await admin
    .from("media_assets")
    .select("id")
    .eq("project_id", JOY)
    .eq("media_type", "photo")
    .limit(1)
    .single();
  assert(joyMedia?.id, "Joy photo");

  const originalGate = (await getAppSettings(SWIFT)).payments.requireDeliveredForDownloads;
  const originalStatus = joy!.status;

  try {
    await saveAppSettings(
      { payments: { requireDeliveredForDownloads: true } },
      SWIFT_ADMIN,
      SWIFT
    );

    const cookie = await clientCookie(joyClient!.email);

    for (const q of ["print", "mls"] as const) {
      const status = await hit(cookie, joyMedia!.id, q);
      assert(status === 200, `gate ON + delivered → ${q} = ${status}`);
    }

    await admin.from("projects").update({ status: "ready_for_review" }).eq("id", JOY);

    for (const q of ["print", "mls"] as const) {
      const status = await hit(cookie, joyMedia!.id, q);
      assert(status === 403, `gate ON + non-delivered → ${q} = ${status}`);
    }

    await saveAppSettings(
      { payments: { requireDeliveredForDownloads: false } },
      SWIFT_ADMIN,
      SWIFT
    );

    for (const q of ["print", "mls"] as const) {
      const status = await hit(cookie, joyMedia!.id, q);
      assert(status === 200, `gate OFF + non-delivered → ${q} = ${status}`);
    }

    await admin.from("projects").update({ status: originalStatus }).eq("id", JOY);

    for (const q of ["print", "mls"] as const) {
      const status = await hit(cookie, joyMedia!.id, q);
      assert(status === 200, `gate OFF + delivered → ${q} = ${status}`);
    }

    console.log("\nOK verify-download-quality-gate");
  } finally {
    await admin.from("projects").update({ status: originalStatus }).eq("id", JOY);
    await saveAppSettings(
      { payments: { requireDeliveredForDownloads: originalGate } },
      SWIFT_ADMIN,
      SWIFT
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
