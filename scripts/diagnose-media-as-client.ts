/**
 * Reproduce storage signing as the project's client (Joy Sullivan).
 *   npx tsx scripts/diagnose-media-as-client.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const CLIENT_ID = "6eab7718-9f81-45a7-b49a-b167e66377b9";
  const ASSET_PATH =
    "00000000-0000-0000-0000-000000000001/26e65643-74d1-4c34-b085-0711c6e4b97c/1787531695810-0b24694a-PheonixEast-2052-62-thumb.webp";

  const { data: client, error: cErr } = await admin
    .from("clients")
    .select("id, email, user_id, business_id")
    .eq("id", CLIENT_ID)
    .single();
  if (cErr || !client) throw new Error(cErr?.message || "no client");
  console.log("client", client);

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, role, business_id, client_id")
    .eq("id", client.user_id)
    .maybeSingle();
  console.log("profile", profile);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: client.email,
  });
  if (linkErr) throw linkErr;
  const hashed = linkData.properties?.hashed_token;
  if (!hashed) throw new Error("no hashed_token");

  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: verified, error: vErr } = await userClient.auth.verifyOtp({
    token_hash: hashed,
    type: "email",
  });
  if (vErr) throw vErr;
  console.log("session", { userId: verified.user?.id, email: verified.user?.email });

  const { data: bid, error: bidErr } = await userClient.rpc("current_business_id");
  console.log("current_business_id", { bid, error: bidErr?.message });
  const { data: cid, error: cidErr } = await userClient.rpc("get_user_client_id");
  console.log("get_user_client_id", { cid, error: cidErr?.message });

  const { data: listed, error: listErr } = await userClient.storage
    .from("project-media")
    .list("00000000-0000-0000-0000-000000000001/26e65643-74d1-4c34-b085-0711c6e4b97c", {
      limit: 3,
    });
  console.log("storage.list", { count: listed?.length ?? 0, error: listErr?.message, sample: listed?.[0]?.name });

  const { data: signed, error: signErr } = await userClient.storage
    .from("project-media")
    .createSignedUrl(ASSET_PATH, 120);
  console.log("createSignedUrl thumb as client", {
    error: signErr?.message,
    urlPrefix: signed?.signedUrl?.slice(0, 160) ?? null,
  });
  if (signed?.signedUrl) {
    const res = await fetch(signed.signedUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    console.log("fetch thumb", {
      status: res.status,
      contentType: res.headers.get("content-type"),
      bytes: buf.length,
      bodyStart: buf.slice(0, 80).toString("utf8"),
    });
  }

  const orig = ASSET_PATH.replace("-thumb.webp", ".jpg");
  const { data: preview, error: pErr } = await userClient.storage
    .from("project-media")
    .createSignedUrl(orig, 120, {
      transform: { width: 1200, height: 1200, resize: "contain" },
    });
  console.log("createSignedUrl preview transform as client", {
    error: pErr?.message,
    urlPrefix: preview?.signedUrl?.slice(0, 160) ?? null,
  });
  if (preview?.signedUrl) {
    const res = await fetch(preview.signedUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    console.log("fetch preview", {
      status: res.status,
      contentType: res.headers.get("content-type"),
      bytes: buf.length,
      bodyStart: buf.slice(0, 120).toString("utf8"),
    });
  }

  // Legacy-shaped path if any exist on this project
  const { data: legacy } = await admin
    .from("media_assets")
    .select("id, file_path, thumbnail_url")
    .eq("project_id", "26e65643-74d1-4c34-b085-0711c6e4b97c")
    .not("file_path", "like", "00000000-0000-0000-0000-000000000001/%")
    .limit(1);
  console.log("legacy assets on project", legacy);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
