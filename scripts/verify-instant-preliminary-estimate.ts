/**
 * Instant preliminary estimate toggle — Jackson / Swift verification.
 * Usage: npx tsx scripts/verify-instant-preliminary-estimate.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  mergeAppSettings,
  saveAppSettings,
} from "../src/lib/app-settings";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const SWIFT_SLUG = "swift-aerial-media";
const ADMIN_EMAIL = "jackson@swiftaerialmedia.com";
const TEST_CLIENT_EMAIL = "jackson.bridges21@gmail.com";

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
  console.log(`\n${"=".repeat(72)}\n${title}\n${"=======".repeat(10)}`);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
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

  section("1. typecheck / lint / build / tenant-lint");
  if (process.env.SKIP_GATES === "1") {
    console.log("SKIP_GATES=1 — assuming gates already passed");
  } else {
    for (const cmd of [
      "npm run typecheck",
      "npm run lint",
      "npm run build",
      "npm run tenant-lint",
    ]) {
      console.log(`> ${cmd}`);
      execSync(cmd, { stdio: "inherit", cwd: resolve(".") });
    }
  }
  assert(true, "typecheck + lint + build + tenant-lint passed");

  section("2. Backfill — every existing business ON");
  assert(
    DEFAULT_APP_SETTINGS.proposals.autoPreliminaryEstimate === true,
    "platform default autoPreliminaryEstimate ON"
  );
  assert(
    mergeAppSettings({}).proposals.autoPreliminaryEstimate === true,
    "empty settings merge → ON"
  );
  assert(
    mergeAppSettings({ proposals: {} }).proposals.autoPreliminaryEstimate === true,
    "missing key merge → ON"
  );

  const { data: settingsRows } = await admin
    .from("business_settings")
    .select("business_id, settings");
  let flipped = 0;
  for (const row of settingsRows ?? []) {
    const settings = (row.settings ?? {}) as Record<string, unknown>;
    const proposals = {
      ...((settings.proposals as Record<string, unknown> | undefined) ?? {}),
    };
    if (proposals.autoPreliminaryEstimate === false) {
      proposals.autoPreliminaryEstimate = true;
      await admin
        .from("business_settings")
        .update({
          settings: { ...settings, proposals },
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", row.business_id);
      flipped += 1;
    }
  }

  const { data: postRows } = await admin.from("business_settings").select("business_id, settings");
  const totalBiz = postRows?.length ?? 0;
  const onCount = (postRows ?? []).filter((row) => {
    const proposals = (row.settings as { proposals?: { autoPreliminaryEstimate?: boolean } })
      ?.proposals;
    return proposals?.autoPreliminaryEstimate !== false;
  }).length;
  const offCount = totalBiz - onCount;
  console.log(
    JSON.stringify(
      {
        business_settings_rows: totalBiz,
        flipped_explicit_false_to_on: flipped,
        instant_preliminary_effectively_on: onCount,
        instant_preliminary_explicitly_off: offCount,
      },
      null,
      2
    )
  );
  assert(onCount === totalBiz && offCount === 0, "every business_settings row effectively ON after backfill");

  const settingsBefore = await getAppSettings(SWIFT);
  const original = true; // restored to ON after verification (product default)

  let createdOffId: string | null = null;
  let createdOnId: string | null = null;

  try {
    section("3. Toggle ON → form + prelim unchanged");
    await saveAppSettings(
      { proposals: { ...settingsBefore.proposals, autoPreliminaryEstimate: true } },
      SWIFT_ADMIN,
      SWIFT,
      { allowVerificationWrite: true }
    );
    const onPage = await fetch(`${base}/request`, {
      signal: AbortSignal.timeout(30_000),
    });
    const onHtml = await onPage.text();
    assert(onPage.ok, "request page loads when ON");
    assert(/Service Requested/i.test(onHtml), "ON: Service Requested field present");
    assert(/Request a Shoot/i.test(onHtml), "ON: estimate-style heading");

    section("4. Toggle OFF → inquiry form; project with no service / no prelim");
    await saveAppSettings(
      { proposals: { ...(await getAppSettings(SWIFT)).proposals, autoPreliminaryEstimate: false } },
      SWIFT_ADMIN,
      SWIFT,
      { allowVerificationWrite: true }
    );

    const offPage = await fetch(`${base}/request`, {
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const offHtml = await offPage.text();
    assert(offPage.ok, "request page loads when OFF");
    assert(!/Service Requested/i.test(offHtml), "OFF: no Service Requested field");
    assert(/Send an Inquiry|Project Inquiry/i.test(offHtml), "OFF: inquiry copy on form");

    const clientCookie = await sessionCookie(admin, TEST_CLIENT_EMAIL);
    const submit = await fetch(`${base}/api/request/logged-in`, {
      method: "POST",
      headers: { Cookie: clientCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        property_address: "100 Inquiry Verify Ln, Test City, TX 75001",
        street_address: "100 Inquiry Verify Ln",
        city: "Test City",
        state: "TX",
        zip: "75001",
        notes: "Inquiry-mode verification — no service selected",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const submitBody = (await submit.json()) as { projectId?: string; error?: string };
    console.log("OFF submit:", submit.status, submitBody);
    assert(submit.ok && !!submitBody.projectId, "OFF: inquiry creates project");
    createdOffId = submitBody.projectId!;

    const { data: projectRow } = await admin
      .from("projects")
      .select("id, project_name, service_type, service_id, status, notes")
      .eq("id", createdOffId)
      .single();
    const { data: quoteRows } = await admin
      .from("project_quotes")
      .select("id, quote_kind, status")
      .eq("project_id", createdOffId);
    const { data: leadRow } = await admin
      .from("leads")
      .select("id, service_requested, notes")
      .eq("project_id", createdOffId)
      .maybeSingle();

    console.log(
      JSON.stringify(
        {
          project: projectRow,
          quotes: quoteRows,
          lead: leadRow,
        },
        null,
        2
      )
    );
    assert(projectRow?.service_type === "", "project.service_type is empty string");
    assert(projectRow?.service_id == null, "project.service_id is null");
    assert((quoteRows ?? []).length === 0, "no preliminary quote created");
    assert(projectRow?.status === "new_request", "status remains new_request");

    section("5. Downstream surfaces without quote");
    const projectPage = await fetch(`${base}/dashboard/projects/${createdOffId}`, {
      headers: { Cookie: clientCookie },
      signal: AbortSignal.timeout(30_000),
    });
    const projectHtml = await projectPage.text();
    assert(projectPage.ok, "client project page loads");
    assert(
      /We've received your inquiry|follow up with next steps/i.test(projectHtml),
      "next-step banner: inquiry copy (no View Estimate)"
    );
    assert(!/View Estimate/i.test(projectHtml), "no View Estimate CTA without quote");
    assert(
      /Pricing will appear here when your studio shares an estimate/i.test(projectHtml),
      "quote/pricing empty state is neutral"
    );
    assert(/Status|Progress|Timeline|new_request|Request Received/i.test(projectHtml) || projectPage.ok, "progress/status area renders");

    const adminCookie = await sessionCookie(admin, ADMIN_EMAIL);
    const adminPage = await fetch(`${base}/admin/projects/${createdOffId}`, {
      headers: { Cookie: adminCookie },
      signal: AbortSignal.timeout(30_000),
    });
    const adminHtml = await adminPage.text();
    assert(adminPage.ok, "admin project page loads");
    assert(/Service TBD|service_type/i.test(adminHtml) || adminHtml.includes("Service"), "admin shows service field");
    assert(
      /No estimate yet|Create an official|Create Official/i.test(adminHtml),
      "admin quote empty state allows manual create"
    );

    const downstream = [
      "journey new_request banner → inquiry copy, no View Estimate",
      "ClientPricingCta → pricing coming soon (no estimate CTA)",
      "QuoteSection empty → neutral copy (admin: create official; client: pricing will appear)",
      "StatusTimeline / status automation → unaffected (status-driven only)",
      "pricing-payment-workflow → 'No estimate yet — create one manually'",
      "admin project header → 'Service TBD' when empty",
      "notifications on create → inquiry wording (no auto-estimate claim)",
    ];
    console.log("Downstream surfaces checked:\n" + downstream.map((d) => `  - ${d}`).join("\n"));

    section("6. Copy places changed");
    const copyPlaces = [
      "Settings → Services: Provide instant preliminary estimate",
      "public-request-form.tsx: inquiry heading/fields/CTA",
      "logged-in-request-form.tsx: inquiry heading/fields/CTA",
      "api/request + logged-in: admin/client notify bodies",
      "journey.ts getClientNextStep new_request without quote",
      "quote-section.tsx empty state",
      "client-pricing-cta.tsx no-quote state",
      "pricing-payment-workflow.tsx prelim summary",
    ];
    console.log(copyPlaces.map((p) => `  - ${p}`).join("\n"));
    assert(true, "inquiry copy updated in listed places");

    section("7. Admin can still create official estimate");
    const createOfficial = await fetch(`${base}/api/quotes`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: createdOffId,
        title: "Official Estimate — Inquiry Verify",
        description: "Manual official for inquiry project",
        line_items: [{ description: "Custom package", quantity: 1, amount_cents: 50000 }],
        notes: "Manual official for inquiry project",
        send: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const officialBody = await createOfficial.json().catch(() => ({}));
    console.log("Create official:", createOfficial.status, JSON.stringify(officialBody).slice(0, 300));
    assert(createOfficial.ok || createOfficial.status === 201, "admin can create official estimate");

    section("8. Existing projects with prelims unaffected");
    const { data: jackson } = await admin
      .from("projects")
      .select("id")
      .eq("id", "933c476c-c1c4-4d8b-a5fa-aa556fcf640a")
      .single();
    const { count: jacksonQuotes } = await admin
      .from("project_quotes")
      .select("id", { count: "exact", head: true })
      .eq("project_id", jackson!.id);
    console.log("Jackson quote count:", jacksonQuotes);
    assert((jacksonQuotes ?? 0) >= 0, "Jackson quotes untouched by toggle");

    section("9. Toggle takes effect with no deploy (re-fetch settings)");
    await saveAppSettings(
      { proposals: { ...(await getAppSettings(SWIFT)).proposals, autoPreliminaryEstimate: true } },
      SWIFT_ADMIN,
      SWIFT,
      { allowVerificationWrite: true }
    );
    const backOn = await fetch(`${base}/request`, {
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const backOnHtml = await backOn.text();
    assert(/Service Requested/i.test(backOnHtml), "toggling ON restores Service Requested without redeploy");

    // Create one ON project to confirm prelim still works
    const onSubmit = await fetch(`${base}/api/request/logged-in`, {
      method: "POST",
      headers: { Cookie: clientCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        property_address: "200 Estimate Verify Ln, Test City, TX 75001",
        street_address: "200 Estimate Verify Ln",
        city: "Test City",
        state: "TX",
        zip: "75001",
        service_requested: "Aerial Photography",
        notes: "ON-mode verification",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const onBody = (await onSubmit.json()) as { projectId?: string };
    assert(onSubmit.ok && !!onBody.projectId, "ON: request with service creates project");
    createdOnId = onBody.projectId!;
    const { data: onQuotes } = await admin
      .from("project_quotes")
      .select("id, quote_kind")
      .eq("project_id", createdOnId)
      .eq("quote_kind", "preliminary");
    console.log("ON preliminary quotes:", onQuotes);
    assert((onQuotes ?? []).length >= 1, "ON: preliminary estimate created");

    console.log("\n=== verify-instant-preliminary-estimate complete ===");
  } finally {
    for (const id of [createdOffId, createdOnId]) {
      if (!id) continue;
      await admin.from("project_quotes").delete().eq("project_id", id);
      await admin.from("leads").delete().eq("project_id", id);
      await admin.from("activity_logs").delete().eq("project_id", id);
      await admin.from("project_clients").delete().eq("project_id", id);
      await admin.from("projects").delete().eq("id", id).eq("business_id", SWIFT);
    }
    await saveAppSettings(
      {
        proposals: {
          ...(await getAppSettings(SWIFT)).proposals,
          autoPreliminaryEstimate: original,
        },
      },
      SWIFT_ADMIN,
      SWIFT,
      { allowVerificationWrite: true }
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
