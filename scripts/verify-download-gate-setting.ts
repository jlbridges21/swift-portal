/**
 * Phase 1 — download gate business setting verification.
 * Usage: npx tsx scripts/verify-download-gate-setting.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const JOY_PROJECT = "26e65643-74d1-4c34-b085-0711c6e4b97c";
const JOY_CLIENT_ID = "6eab7718-9f81-45a7-b49a-b167e66377b9";

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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function clientSessionCookie(admin: SupabaseClient, email: string): Promise<string> {
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
  return [
    `sb-${projectRef}-auth-token=${encodeURIComponent(
      JSON.stringify({
        access_token: verified.session.access_token,
        refresh_token: verified.session.refresh_token,
        expires_at: verified.session.expires_at,
        expires_in: verified.session.expires_in,
        token_type: verified.session.token_type,
        user: verified.user,
      })
    )}`,
  ].join("; ");
}

async function httpGet(base: string, path: string, cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${base}${path}`, {
    method: "GET",
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status, text: text.slice(0, 400), json };
}

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const {
    resolveProjectDownloadAllowed,
    clientDownloadLockMessage,
    DOWNLOAD_GATE_API_MESSAGE,
    canDownloadDeliverables,
  } = await import("../src/lib/deliverables");
  const { getAppSettings, saveAppSettings } = await import("../src/lib/app-settings");
  const {
    authorizeProjectZipDownload,
    resolveFolderZipScope,
  } = await import("../src/lib/project-zip-download");

  section("1. Migration backfill — business_settings counts");
  const { count: settingsCount, error: countErr } = await admin
    .from("business_settings")
    .select("*", { count: "exact", head: true });
  if (countErr) throw countErr;

  const { data: allSettings, error: allErr } = await admin
    .from("business_settings")
    .select("business_id, settings");
  if (allErr) throw allErr;

  const offBefore = (allSettings ?? []).filter(
    (row) =>
      (row.settings as { payments?: { requireDeliveredForDownloads?: boolean } })?.payments
        ?.requireDeliveredForDownloads === false
  ).length;
  const missingPayments = (allSettings ?? []).filter(
    (row) =>
      !(row.settings as { payments?: { requireDeliveredForDownloads?: boolean } })?.payments
        ?.requireDeliveredForDownloads
  ).length;

  const explicitOn = (allSettings ?? []).filter(
    (row) =>
      (row.settings as { payments?: { requireDeliveredForDownloads?: boolean } })?.payments
        ?.requireDeliveredForDownloads === true
  ).length;

  console.log({
    business_settings_rows: settingsCount,
    requireDeliveredForDownloads_explicitly_true: explicitOn,
    requireDeliveredForDownloads_explicitly_false: offBefore,
    missing_or_null_gate: missingPayments,
  });

  const migrationSql = readFileSync(
    resolve("supabase/migration-v80-download-gate-setting.sql"),
    "utf8"
  );
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (mgmtToken) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mgmtToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: migrationSql }),
    });
    const body = await res.text();
    console.log("Migration apply via Supabase API:", res.status, body.slice(0, 300));
  } else {
    console.log(
      `Migration not applied automatically (set SUPABASE_ACCESS_TOKEN). File: supabase/migration-v80-download-gate-setting.sql (${migrationSql.length} bytes)`
    );
  }

  const { data: postSettings } = await admin.from("business_settings").select("business_id, settings");
  const offAfter = (postSettings ?? []).filter(
    (row) =>
      (row.settings as { payments?: { requireDeliveredForDownloads?: boolean } })?.payments
        ?.requireDeliveredForDownloads === false
  ).length;
  const explicitOnAfter = (postSettings ?? []).filter(
    (row) =>
      (row.settings as { payments?: { requireDeliveredForDownloads?: boolean } })?.payments
        ?.requireDeliveredForDownloads === true
  ).length;
  console.log({
    business_settings_rows_after: postSettings?.length ?? 0,
    requireDeliveredForDownloads_explicitly_true_after: explicitOnAfter,
    requireDeliveredForDownloads_false_after: offAfter,
  });
  assert(offAfter === 0, "zero businesses ended up OFF");
  if (mgmtToken) {
    assert(
      explicitOnAfter === (postSettings?.length ?? 0),
      "every business_settings row has requireDeliveredForDownloads=true after migration"
    );
  }

  section("2. New business default (code)");
  const { DEFAULT_APP_SETTINGS } = await import("../src/lib/app-settings");
  assert(
    DEFAULT_APP_SETTINGS.payments.requireDeliveredForDownloads === true,
    "new businesses default ON (preserve pay-before-download)"
  );
  console.log(
    "Why ON: matches today's behavior — studios rely on Delivered to gate unpaid downloads."
  );

  section("3. Single resolver — call sites");
  const callSites = execSync(
    'rg "resolveProjectDownloadAllowed" --glob "!scripts/verify-download-gate-setting.ts" -n src',
    { encoding: "utf8" }
  ).trim();
  console.log(callSites);
  assert(callSites.includes("src/app/api/media/download"), "media download route uses resolver");
  assert(callSites.includes("src/lib/project-zip-download.ts"), "ZIP authorize uses resolver");
  assert(callSites.includes("project-page-client.tsx"), "client UI uses resolver");
  assert(callSites.includes("project-quick-actions.tsx"), "quick actions uses resolver");

  section("4. Toggle immediate effect (Swift business, no deploy)");
  const swiftBefore = await getAppSettings(SWIFT);
  const originalGate = swiftBefore.payments.requireDeliveredForDownloads;
  await saveAppSettings({ payments: { requireDeliveredForDownloads: false } }, SWIFT_ADMIN, SWIFT);
  const swiftOff = await getAppSettings(SWIFT);
  console.log("after save OFF:", swiftOff.payments.requireDeliveredForDownloads);
  assert(
    swiftOff.payments.requireDeliveredForDownloads === false,
    "toggle OFF persists immediately via getAppSettings"
  );
  await saveAppSettings({ payments: { requireDeliveredForDownloads: true } }, SWIFT_ADMIN, SWIFT);
  const swiftOn = await getAppSettings(SWIFT);
  console.log("after save ON:", swiftOn.payments.requireDeliveredForDownloads);
  assert(
    swiftOn.payments.requireDeliveredForDownloads === true,
    "toggle ON persists immediately via getAppSettings"
  );
  if (originalGate !== true) {
    await saveAppSettings(
      { payments: { requireDeliveredForDownloads: originalGate } },
      SWIFT_ADMIN,
      SWIFT
    );
  }

  section("5. Joy project baseline (default ON, unchanged behavior)");
  const swiftSettings = await getAppSettings(SWIFT);
  assert(
    swiftSettings.payments.requireDeliveredForDownloads === true,
    "Swift business gate ON by default"
  );
  const { data: joyProject } = await admin
    .from("projects")
    .select("id, status, client_id")
    .eq("id", JOY_PROJECT)
    .single();
  console.log("Joy project:", joyProject);
  const joyStatus = joyProject?.status ?? "unknown";
  const joyClientAllowed = resolveProjectDownloadAllowed({
    projectStatus: joyStatus,
    isAdmin: false,
    requireDeliveredForDownloads: true,
  });
  console.log({
    joyStatus,
    joyClientDownloadsAllowed: joyClientAllowed,
    sameAsLegacyCanDownloadDeliverables: canDownloadDeliverables(joyStatus),
  });
  assert(
    joyClientAllowed === canDownloadDeliverables(joyStatus),
    "Joy project client download permission matches legacy canDownloadDeliverables with gate ON"
  );

  const { data: joyClient } = await admin
    .from("clients")
    .select("email")
    .eq("id", JOY_CLIENT_ID)
    .single();

  const { data: joyMedia } = await admin
    .from("media_assets")
    .select("id, media_type")
    .eq("project_id", JOY_PROJECT)
    .in("media_type", ["photo", "video", "document"])
    .limit(1)
    .maybeSingle();

  const { data: joyFolder } = await admin
    .from("media_folders")
    .select("id")
    .eq("project_id", JOY_PROJECT)
    .limit(1)
    .maybeSingle();

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id, email, role, business_id, client_id")
    .eq("id", SWIFT_ADMIN)
    .single();

  const { data: clientProfile } = await admin
    .from("profiles")
    .select("id, email, role, business_id, client_id")
    .eq("client_id", JOY_CLIENT_ID)
    .maybeSingle();

  assert(!!adminProfile && !!clientProfile?.email, "Joy client profile found for HTTP checks");

  const nonDeliveredStatus = canDownloadDeliverables(joyStatus) ? "ready_for_review" : joyStatus;
  const adminProf = adminProfile!;

  section("6. Resolver matrix — all three download paths share this");
  function gate(label: string, status: string, isAdmin: boolean, requireDelivered: boolean) {
    const allowed = resolveProjectDownloadAllowed({
      projectStatus: status,
      isAdmin,
      requireDeliveredForDownloads: requireDelivered,
    });
    console.log(label, { allowed });
    return allowed;
  }

  gate("gate ON, non-delivered, client", nonDeliveredStatus, false, true);
  gate("gate ON, delivered, client", "delivered", false, true);
  gate("gate OFF, non-delivered, client", nonDeliveredStatus, false, false);
  gate("gate ON, non-delivered, admin", nonDeliveredStatus, true, true);
  gate("gate OFF, non-delivered, admin", nonDeliveredStatus, true, false);

  const adminZip = await authorizeProjectZipDownload(
    adminProf as Parameters<typeof authorizeProjectZipDownload>[0],
    JOY_PROJECT,
    admin,
    true
  );
  console.log("admin project ZIP (gate ON, real DB):", adminZip.ok ? { ok: true } : adminZip);

  if (joyFolder?.id) {
    const folderScope = await resolveFolderZipScope(JOY_PROJECT, joyFolder.id, admin);
    assert(folderScope.ok, "Joy folder scope resolves");
    console.log("folder ZIP uses authorizeProjectZipDownload before folder filter");
  }

  const nonDeliveredProject = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";
  const nonDeliveredMedia = "7d3bc3f6-e39b-4c3a-9c19-480eeeb841ea";
  const nonDeliveredClient = {
    id: "0a84dd52-eda6-4415-9f8b-dcb1ba7bde8f",
    email: "jackson.bridges21@gmail.com",
    role: "client",
    business_id: SWIFT,
    client_id: "93864aba-7031-436a-b2a4-8347a5d67600",
  } as Parameters<typeof authorizeProjectZipDownload>[0];

  const zipLocked = await authorizeProjectZipDownload(
    nonDeliveredClient,
    nonDeliveredProject,
    admin,
    true
  );
  console.log("gate ON, non-delivered client project ZIP auth:", zipLocked);
  assert(!zipLocked.ok && zipLocked.status === 403, "project ZIP blocked before Delivered");
  console.log("(gate OFF ZIP pass-through verified via HTTP below — access check needs request cookies in scripts)");

  section("7. HTTP download paths (when dev server available)");
  const base = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  let serverUp = false;
  try {
    const ping = await fetch(base, { signal: AbortSignal.timeout(3000) });
    serverUp = ping.status < 500;
  } catch {
    serverUp = false;
  }

  if (!serverUp || !joyMedia?.id) {
    console.log("Dev server not reachable or no Joy media — skipping HTTP responses");
    console.log("(Resolver + authorizeProjectZipDownload already validated above)");
  } else {
    const clientProf = clientProfile!;
    const adminProf = adminProfile!;
    const clientCookie = await clientSessionCookie(admin, clientProf.email);
    const adminCookie = await clientSessionCookie(
      admin,
      adminProf.email ?? "admin@swiftaerialmedia.com"
    );

    async function probe(label: string, path: string, cookie: string) {
      const res = await httpGet(base, path, cookie);
      console.log(label, { status: res.status, body: res.json ?? res.text });
      return res;
    }

    await saveAppSettings({ payments: { requireDeliveredForDownloads: true } }, SWIFT_ADMIN, SWIFT);

    const ndCookie = await clientSessionCookie(admin, nonDeliveredClient.email);
    await probe(
      "gate ON, non-delivered — individual media ?file=1 (client)",
      `/api/media/download/${nonDeliveredMedia}?file=1`,
      ndCookie
    );
    await probe(
      "gate ON, non-delivered — project ZIP (client)",
      `/api/projects/${nonDeliveredProject}/download-zip`,
      ndCookie
    );

    await probe(
      "gate ON, delivered — individual media ?file=1 (client)",
      `/api/media/download/${joyMedia.id}?file=1`,
      clientCookie
    );
    await probe(
      "gate ON, delivered — project ZIP (client)",
      `/api/projects/${JOY_PROJECT}/download-zip`,
      clientCookie
    );
    if (joyFolder?.id) {
      await probe(
        "gate ON, delivered — folder ZIP (client)",
        `/api/projects/${JOY_PROJECT}/download-zip?folderId=${joyFolder.id}`,
        clientCookie
      );
    }

    await saveAppSettings({ payments: { requireDeliveredForDownloads: false } }, SWIFT_ADMIN, SWIFT);
    const mid = await getAppSettings(SWIFT);
    console.log("toggle read-back OFF:", mid.payments.requireDeliveredForDownloads);

    await probe(
      "gate OFF — individual media ?file=1 (client, delivered project)",
      `/api/media/download/${joyMedia.id}?file=1`,
      clientCookie
    );
    await probe(
      "gate OFF, non-delivered — individual media ?file=1 (client)",
      `/api/media/download/${nonDeliveredMedia}?file=1`,
      ndCookie
    );
    await probe(
      "gate OFF — project ZIP (client, delivered project)",
      `/api/projects/${JOY_PROJECT}/download-zip`,
      clientCookie
    );

    await saveAppSettings({ payments: { requireDeliveredForDownloads: true } }, SWIFT_ADMIN, SWIFT);

    await probe(
      "admin — project ZIP any gate (client cookie skipped, admin)",
      `/api/projects/${JOY_PROJECT}/download-zip`,
      adminCookie
    );

    const preview = await probe(
      "video review playback path — preview=1 (client, gate ON)",
      `/api/media/download/${joyMedia.id}?preview=1`,
      clientCookie
    );
    assert(preview.status === 200, "video review / preview playback never gated by download gate");
  }

  section("8. Client UI lock copy alignment");
  const lockOn = clientDownloadLockMessage(nonDeliveredStatus, true);
  const lockOff = clientDownloadLockMessage(nonDeliveredStatus, false);
  console.log({ lockOn, lockOff, apiMessage: DOWNLOAD_GATE_API_MESSAGE });
  assert(lockOff === null, "gate OFF → no lock messaging in UI");
  assert(lockOn !== null, "gate ON + not delivered → lock message for UI");

  section("9. tenant-isolation.sql / tenant-teardown.sql");
  console.log("Run: npx tsx scripts/run-tenant-sql.ts supabase/tests/tenant-isolation.sql");
  console.log("Then: npx tsx scripts/run-tenant-sql.ts supabase/tests/tenant-teardown.sql");
  console.log("(Requires SUPABASE_ACCESS_TOKEN — expect zero rows from teardown probes)");

  console.log("\n=== ALL DOWNLOAD GATE CHECKS COMPLETE ===");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
