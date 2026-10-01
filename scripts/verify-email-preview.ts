/**
 * Swift-only checks for the email preview. Does not send mail.
 * Usage: VERIFY_BASE_URL=http://localhost:3000 npx tsx scripts/verify-email-preview.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assembleClientEmailPresentation, renderDeliverablesEmailPreviewHtml } from "../src/lib/client-email-notifications";
import { composeBrandedEmailHtml } from "../src/lib/email";
import { getAppSettings } from "../src/lib/app-settings";
import { businessPortalHref, getBusinessPortalOriginById } from "../src/lib/portal-url";
import { resolveEmailLogoSrc } from "../src/lib/email-templates";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const ROOT = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const BASE = `${ROOT}/b/swift-aerial-media`;
const PREVIEW = `${BASE}/api/admin/email/preview`;
const STAMP = Date.now();

function loadEnv() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sessionCookie(url: string, session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user: unknown;
}) {
  const projectRef = new URL(url).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token=${encodeURIComponent(JSON.stringify(session))}; sp_path_tenant=swift-aerial-media`;
}

async function magicCookie(admin: ReturnType<typeof createClient>, email: string) {
  const { data: linkData, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !linkData.properties?.hashed_token) throw new Error(error?.message || "link");
  const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: verified, error: otpErr } = await userClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (otpErr || !verified.session) throw new Error(otpErr?.message || "otp");
  return sessionCookie(process.env.NEXT_PUBLIC_SUPABASE_URL!, verified.session);
}

function sliceOf(html: string) {
  const header = html.match(/<td style="background:[^"]+;border-radius:20px[^"]*">/)?.[0] ?? "";
  const img = html.match(/<img src="[^"]+" alt="[^"]*"/)?.[0] ?? "";
  const button = html.match(/<td style="border-radius:14px;background:[^"]+;">/)?.[0] ?? "";
  const footer = html.match(/<a href="[^"]+" style="color:[^"]+;">Open [^<]+<\/a>/)?.[0] ?? "";
  return { header, img, button, footer, bytes: html.length };
}

async function eventCount(admin: ReturnType<typeof createClient>) {
  const { count, error } = await admin
    .from("email_events")
    .select("id", { count: "exact", head: true })
    .eq("business_id", SWIFT);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function main() {
  loadEnv();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const created: string[] = [];
  let probeClientId: string | null = null;

  try {
    const before = await eventCount(admin);
    const { data: adminProfile } = await admin.from("profiles").select("email").eq("id", SWIFT_ADMIN).single();
    const adminEmail = adminProfile?.email as string;
    assert(adminEmail, "swift admin email");
    const adminCookie = await magicCookie(admin, adminEmail);
    writeFileSync("/tmp/email-preview-admin-cookie.txt", adminCookie, { mode: 0o600 });

    const settings = await getAppSettings(SWIFT);
    const portalUrl = await getBusinessPortalOriginById(SWIFT);
    const path = "/dashboard";
    const presentation = assembleClientEmailPresentation(settings, {
      eventType: "deliverables_uploaded",
      eventKey: "deliverables_ready",
      title: "New media — Sample project",
      message: "Photos have been added to your project.",
      url: path,
      projectName: "Sample project",
      projectStatus: "ready_for_review",
      resolvedUrl: await businessPortalHref(SWIFT, path),
      brandNames: {
        businessName: settings.business.businessName,
        portalName: settings.business.portalName,
      },
    });
    const sentHtml = composeBrandedEmailHtml({
      settings,
      portalUrl,
      title: presentation.title,
      body: presentation.body,
      projectName: "Sample project",
      secondaryInfo: presentation.secondaryInfo,
      ctaLabel: presentation.ctaUrl ? presentation.ctaLabel : undefined,
      ctaUrl: presentation.ctaUrl,
      progressStep: presentation.progressStep,
    });
    const directHtml = await renderDeliverablesEmailPreviewHtml(SWIFT);

    const savedDraft = {
      primaryColor: settings.business.brandPrimaryColor,
      accentColor: settings.business.brandAccentColor,
      emailLogoUrl: settings.business.emailLogoUrl ?? "",
      logoUrl: settings.business.logoUrl ?? "",
      businessName: settings.business.businessName,
      portalName: settings.business.portalName,
      footerText: settings.email.footerText,
    };
    const previewRes = await fetch(PREVIEW, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify(savedDraft),
    });
    const previewHtml = await previewRes.text();
    assert(previewRes.status === 200, `preview status ${previewRes.status}`);
    assert(previewRes.headers.get("content-type")?.includes("text/html"), "preview content type");
    assert(previewHtml === sentHtml, "preview HTML differs from the send renderer");
    assert(previewHtml === directHtml, "preview HTML differs from renderDeliverablesEmailPreviewHtml");
    writeFileSync("/tmp/email-preview-sent.html", sentHtml);
    writeFileSync("/tmp/email-preview-http.html", previewHtml);
    console.log("ITEM5_BYTE_IDENTICAL", true);
    console.log("ITEM5_SEND", JSON.stringify(sliceOf(sentHtml)));
    console.log("ITEM5_PREVIEW", JSON.stringify(sliceOf(previewHtml)));

    const unsaved = await fetch(PREVIEW, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ ...savedDraft, primaryColor: "#FF00AA" }),
    });
    const unsavedHtml = await unsaved.text();
    assert(unsaved.status === 200, `unsaved color status ${unsaved.status}`);
    assert(unsavedHtml.includes("background:#FF00AA;border-radius:20px"), "unsaved primary missing from header");
    assert(!sentHtml.includes("#FF00AA"), "saved send HTML picked up the unsaved color");
    console.log("ITEM6_UNSAVED_HEADER", unsavedHtml.includes("background:#FF00AA;border-radius:20px"));

    const bare = await fetch(PREVIEW, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ ...savedDraft, emailLogoUrl: "", logoUrl: "" }),
    });
    const bareHtml = await bare.text();
    const fallbackSrc = resolveEmailLogoSrc({
      emailLogoUrl: "",
      logoUrl: "",
      portalUrl,
    }).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    assert(bare.status === 200, `empty logo status ${bare.status}`);
    assert(bareHtml.includes(`src="${fallbackSrc}"`), "empty logo did not use the platform fallback");
    console.log("ITEM9_FALLBACK_SRC", fallbackSrc);
    console.log("ITEM9_MATCHES_RESOLVER", bareHtml.includes(`src="${fallbackSrc}"`));

    const anon = await fetch(PREVIEW, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(savedDraft),
    });
    console.log("ITEM12_ANON", anon.status, await anon.text());

    const staffEmail = `email-preview-staff-${STAMP}@example.com`;
    const clientEmail = `email-preview-client-${STAMP}@example.com`;
    const staffUser = await admin.auth.admin.createUser({ email: staffEmail, email_confirm: true });
    const clientUser = await admin.auth.admin.createUser({ email: clientEmail, email_confirm: true });
    assert(staffUser.data.user && clientUser.data.user, staffUser.error?.message || clientUser.error?.message || "create");
    created.push(staffUser.data.user.id, clientUser.data.user.id);
    const { data: probeClient, error: clientErr } = await admin
      .from("clients")
      .insert({ business_id: SWIFT, name: "Email preview probe", email: clientEmail })
      .select("id")
      .single();
    if (clientErr || !probeClient) throw new Error(clientErr?.message || "client");
    probeClientId = probeClient.id as string;
    const staffUpdate = await admin.from("profiles").update({
      role: "staff",
      business_id: SWIFT,
      client_id: null,
      full_name: "Email preview staff",
    }).eq("id", staffUser.data.user.id);
    if (staffUpdate.error) throw new Error(staffUpdate.error.message);
    const clientUpdate = await admin.from("profiles").update({
      role: "client",
      business_id: SWIFT,
      client_id: probeClientId,
      full_name: "Email preview client",
    }).eq("id", clientUser.data.user.id);
    if (clientUpdate.error) throw new Error(clientUpdate.error.message);

    const staffCookie = await magicCookie(admin, staffEmail);
    const clientCookie = await magicCookie(admin, clientEmail);
    const staffRes = await fetch(PREVIEW, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify(savedDraft),
    });
    const clientRes = await fetch(PREVIEW, {
      method: "POST",
      headers: { Cookie: clientCookie, "Content-Type": "application/json" },
      body: JSON.stringify(savedDraft),
    });
    console.log("ITEM12_STAFF", staffRes.status, await staffRes.text());
    console.log("ITEM12_CLIENT", clientRes.status, await clientRes.text());

    const invalid = await fetch(`${BASE}/api/admin/email`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "not-a-send" }),
    });
    console.log("ITEM11_INVALID_ACTION", invalid.status, await invalid.text());

    const after = await eventCount(admin);
    console.log("ITEM8_EMAIL_EVENTS", JSON.stringify({ before, after, delta: after - before }));
    assert(after === before, "email_events changed");
  } finally {
    if (probeClientId) {
      await admin.from("clients").delete().eq("id", probeClientId).eq("business_id", SWIFT);
    }
    for (const id of created) {
      await admin.auth.admin.deleteUser(id);
    }
    const leftover = await admin
      .from("profiles")
      .select("id")
      .in("id", created.length ? created : ["00000000-0000-0000-0000-000000000000"]);
    console.log("PROBE_PROFILES_LEFT", (leftover.data ?? []).length);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
