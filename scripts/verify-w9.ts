/**
 * Swift-only W-9 checks. Does not print the test taxpayer identification number.
 * Usage: VERIFY_BASE_URL=http://localhost:3000 npx tsx scripts/verify-w9.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import zlib from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { STAFF_PERMISSION_KEYS } from "../src/lib/staff-permissions";
import { W9_FIELDS } from "../src/lib/w9-fields";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const JANET = "1345a0de-adb1-4795-a981-e6014b3cf42e";
const ROOT = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const TIN_DIGITS = "123456789";
const TIN_DASHED = "123-45-6789";
const DEV_LOG = "/Users/jlbridges21/.cursor/projects/Users-jlbridges21-Desktop-coding-swift-portal-v2/terminals/938921.txt";

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

function hasTin(value: string): boolean {
  return value.includes(TIN_DASHED) || value.includes(TIN_DIGITS);
}

function sessionCookie(
  url: string,
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    expires_in?: number;
    token_type?: string;
    user: unknown;
  }
) {
  const projectRef = new URL(url).hostname.split(".")[0];
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  return `sb-${projectRef}-auth-token=${encodeURIComponent(payload)}; sp_path_tenant=swift-aerial-media`;
}

async function signIn(url: string, anonKey: string, email: string, password: string) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await anon.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw new Error(signed.error?.message || "login failed");
  return sessionCookie(url, signed.data.session);
}

function userIdFromCookie(cookie: string): string | null {
  const match = cookie.match(/sb-[^=]+-auth-token=([^;]+)/);
  if (!match) return null;
  try {
    const payload = JSON.parse(decodeURIComponent(match[1])) as { user?: { id?: string } };
    return payload.user?.id || null;
  } catch {
    return null;
  }
}

async function pdfFields(buf: Buffer): Promise<Record<string, string>> {
  const pdf = await PDFDocument.load(buf);
  const form = pdf.getForm();
  const out: Record<string, string> = {};
  for (const [key, name] of Object.entries(W9_FIELDS)) {
    try {
      out[key] = form.getTextField(name).getText() ?? "";
    } catch {
      try {
        out[key] = form.getCheckBox(name).isChecked() ? "checked" : "unchecked";
      } catch {
        out[key] = "MISSING";
      }
    }
  }
  return out;
}

function pdfPlainText(buf: Buffer): string {
  const parts: string[] = [];
  const marker = Buffer.from("stream");
  let i = 0;
  while ((i = buf.indexOf(marker, i)) >= 0) {
    let start = i + marker.length;
    if (buf[start] === 0x0d) start += 1;
    if (buf[start] === 0x0a) start += 1;
    const end = buf.indexOf(Buffer.from("endstream"), start);
    if (end < 0) break;
    try {
      const inflated = zlib.inflateSync(buf.subarray(start, end)).toString("latin1");
      parts.push(
        inflated.replace(/<([0-9A-Fa-f]+)>/g, (_, hex: string) => Buffer.from(hex, "hex").toString("latin1"))
      );
    } catch {
      // Not a flate stream.
    }
    i = end + 9;
  }
  return parts.join("\n");
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = Date.now();
  const password = `W9-Probe-${stamp}!Aa`;
  const adminEmail = `w9-admin-${stamp}@example.test`;
  const staffEmail = `w9-staff-${stamp}@example.test`;
  const clientEmail = `w9-client-${stamp}@example.test`;
  const shareEmail = `w9-share-${stamp}@example.test`;
  const platformEmail = `w9-platform-${stamp}@example.test`;
  const created: string[] = [];
  let probeClientId = "";
  let originalSettings: Record<string, unknown> | null = null;
  let linkState: { link_access_mode: string | null; link_access_token: string | null } | null = null;
  const startedAt = new Date().toISOString();

  const { data: settingsRow, error: settingsReadError } = await admin
    .from("business_settings")
    .select("settings")
    .eq("business_id", SWIFT)
    .single();
  if (settingsReadError || !settingsRow) throw new Error(settingsReadError?.message || "settings");
  originalSettings = structuredClone(settingsRow.settings) as Record<string, unknown>;
  const business = (originalSettings.business ?? {}) as Record<string, string>;
  const line1 = (business.businessName || business.portalName || "Swift Aerial Media").slice(0, 120);

  try {
    const { data: project } = await admin.from("projects").select("id, link_access_mode, link_access_token").eq("id", JANET).eq("business_id", SWIFT).single();
    assert(project, "Janet project missing");
    linkState = { link_access_mode: project.link_access_mode, link_access_token: project.link_access_token };

    const users = await Promise.all([
      admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true }),
      admin.auth.admin.createUser({ email: staffEmail, password, email_confirm: true }),
      admin.auth.admin.createUser({ email: clientEmail, password, email_confirm: true }),
      admin.auth.admin.createUser({ email: platformEmail, password, email_confirm: true }),
    ]);
    for (const user of users) {
      if (!user.data.user) throw new Error(user.error?.message || "createUser failed");
      created.push(user.data.user.id);
    }
    const [adminUser, staffUser, clientUser, platformUser] = users.map((user) => user.data.user!.id);
    const everyPerm: Record<string, boolean | number> = { v: 1, "w9.generate": true };
    for (const key of STAFF_PERMISSION_KEYS) everyPerm[key] = true;

    const { data: probeClient, error: clientErr } = await admin
      .from("clients")
      .insert({ business_id: SWIFT, name: "W-9 probe", email: clientEmail })
      .select("id")
      .single();
    if (clientErr || !probeClient) throw new Error(clientErr?.message || "client");
    probeClientId = probeClient.id as string;
    const { error: linkErr } = await admin.from("project_clients").insert({ business_id: SWIFT, project_id: JANET, client_id: probeClientId });
    if (linkErr) throw new Error(linkErr.message);

    await admin.from("profiles").update({ role: "admin", business_id: SWIFT, client_id: null, full_name: "W-9 admin" }).eq("id", adminUser);
    await admin.from("profiles").update({
      role: "staff",
      business_id: SWIFT,
      client_id: null,
      full_name: "W-9 staff",
      staff_permissions: everyPerm,
    }).eq("id", staffUser);
    await admin.from("profiles").update({ role: "client", business_id: SWIFT, client_id: probeClientId, full_name: "W-9 probe" }).eq("id", clientUser);
    await admin.from("profiles").update({ role: "super_admin", business_id: null, client_id: null, full_name: "W-9 platform" }).eq("id", platformUser);

    const adminCookie = await signIn(url, anonKey, adminEmail, password);
    const staffCookie = await signIn(url, anonKey, staffEmail, password);
    const clientCookie = await signIn(url, anonKey, clientEmail, password);
    const platformCookie = await signIn(url, anonKey, platformEmail, password);

    const current = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/settings`, { headers: { Cookie: adminCookie } });
    const currentBody = (await current.json()) as { settings?: Record<string, unknown>; error?: string };
    assert(current.ok && currentBody.settings, `settings get ${current.status}`);
    const tax = {
      name: line1,
      disregardedEntityName: "Disregarded Probe LLC",
      federalTaxClassification: "llc",
      llcTaxClassification: "S",
      otherClassification: "",
      foreignPartners: true,
      exemptPayeeCode: "5",
      fatcaExemptionCode: "A",
      address: "1 Example Street",
      cityStateZip: "Test City, TS 00000",
      accountNumbers: "TEST-ACCT",
    };
    const saveRes = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/settings`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { ...currentBody.settings, tax } }),
    });
    const saveText = await saveRes.text();
    console.log("ITEM2_SAVE_STATUS", saveRes.status);
    console.log("ITEM2_SAVE_HAS_TIN", hasTin(saveText));
    const saved = JSON.parse(saveText) as { settings?: { tax?: unknown }; error?: string };
    console.log("ITEM2_RESPONSE_TAX", JSON.stringify(saved.settings?.tax ?? saved.error));

    const tinSave = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/settings`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: { ...currentBody.settings, tax: { ...tax, name: TIN_DASHED, tin: TIN_DASHED, ssn: TIN_DIGITS } },
      }),
    });
    const tinSaveText = await tinSave.text();
    console.log("ITEM3_SETTINGS_VALIDATION", tinSave.status, hasTin(tinSaveText), tinSaveText.slice(0, 240));

    const { data: stored } = await admin.from("business_settings").select("settings").eq("business_id", SWIFT).single();
    const storedTax = (stored?.settings as { tax?: unknown } | null)?.tax;
    console.log("ITEM2_STORED_TAX", JSON.stringify(storedTax));
    console.log("ITEM2_STORED_HAS_TIN", hasTin(JSON.stringify(stored?.settings ?? "")));

    const validation = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/w9/download`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        tin: TIN_DASHED,
        tinKind: "ssn",
        signatureMode: "typed",
        attestation: false,
        typedName: "Test Signer",
      }),
    });
    const validationText = await validation.text();
    console.log("ITEM3_VALIDATION", validation.status, hasTin(validationText), validationText.slice(0, 300));

    await admin.from("w9_form_templates").update({ active: false }).eq("active", true);
    const generatedFail = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/w9/download`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ tin: TIN_DASHED, tinKind: "ssn", signatureMode: "blank" }),
    });
    const generatedFailText = await generatedFail.text();
    console.log("ITEM3_GENERATE_FAIL", generatedFail.status, hasTin(generatedFailText), generatedFailText.slice(0, 300));

    const official = readFileSync("/tmp/fw9.pdf");
    async function upload(bytes: Uint8Array, revision: string, cookie: string) {
      const body = new FormData();
      body.set("revision", revision);
      body.set("file", new Blob([bytes], { type: "application/pdf" }), "fw9.pdf");
      const res = await fetch(`${ROOT}/b/swift-aerial-media/api/platform/w9-template`, {
        method: "POST",
        headers: { Cookie: cookie },
        body,
      });
      const text = await res.text();
      return { status: res.status, text };
    }
    const uploaded = await upload(official, "Rev. March 2024", platformCookie);
    console.log("ITEM4_UPLOAD", uploaded.status, uploaded.text.slice(0, 400));
    assert(uploaded.status === 200, "official upload failed");

    const emptyPdf = await PDFDocument.create();
    emptyPdf.addPage([612, 792]);
    const emptyForm = emptyPdf.getForm();
    for (const name of Object.values(W9_FIELDS)) {
      if (name === W9_FIELDS.accountNumbers) continue;
      emptyForm.createTextField(name);
    }
    const refused = await upload(await emptyPdf.save(), "Missing account numbers", platformCookie);
    console.log("ITEM5_REFUSAL", refused.status, refused.text.slice(0, 1200));

    const second = await upload(official, "Probe rollback", platformCookie);
    assert(second.status === 200, "second upload failed");
    const templates = await admin.from("w9_form_templates").select("id, revision_label, active, created_at").order("created_at", { ascending: true });
    const first = (templates.data ?? []).find((row) => row.revision_label === "Rev. March 2024");
    assert(first, "first template missing");
    const rollback = await fetch(`${ROOT}/b/swift-aerial-media/api/platform/w9-template`, {
      method: "PATCH",
      headers: { Cookie: platformCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ id: first.id }),
    });
    const rollbackText = await rollback.text();
    console.log("ITEM6_ROLLBACK", rollback.status, rollbackText.slice(0, 500));

    async function download(signature: Record<string, unknown>) {
      const before = await admin.from("w9_send_files").select("send_id");
      const res = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/w9/download`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tin: TIN_DASHED, tinKind: "ssn", ...signature }),
      });
      const bytes = Buffer.from(await res.arrayBuffer());
      const after = await admin.from("w9_send_files").select("send_id");
      return { status: res.status, contentType: res.headers.get("content-type"), bytes, before: before.data?.length ?? -1, after: after.data?.length ?? -1 };
    }

    const typed = await download({ signatureMode: "typed", attestation: true, typedName: "Test Signer" });
    const blank = await download({ signatureMode: "blank" });
    console.log("ITEM7_TYPED_STATUS", typed.status, typed.contentType, "files", typed.before, typed.after);
    console.log("ITEM7_BLANK_STATUS", blank.status, blank.contentType, "files", blank.before, blank.after);
    if (typed.status === 200) {
      console.log("ITEM7_TYPED_FIELDS", JSON.stringify(await pdfFields(typed.bytes)));
      const typedText = pdfPlainText(typed.bytes);
      console.log("ITEM7_TYPED_SIGNATURE", typedText.includes("Test Signer"), "DATE", /09\/30\/2026|9\/30\/2026/.test(typedText));
      console.log("ITEM7_TYPED_HAS_TIN_TEXT", hasTin(typedText));
    } else {
      console.log("ITEM7_TYPED_BODY", typed.bytes.toString("utf8").slice(0, 300));
    }
    if (blank.status === 200) {
      console.log("ITEM7_BLANK_FIELDS", JSON.stringify(await pdfFields(blank.bytes)));
      console.log("ITEM7_BLANK_SIGNATURE", pdfPlainText(blank.bytes).includes("Test Signer"));
    } else {
      console.log("ITEM7_BLANK_BODY", blank.bytes.toString("utf8").slice(0, 300));
    }
    console.log("ITEM8_DOWNLOAD_STORAGE", typed.before, typed.after, blank.before, blank.after);

    const filesBeforeSend = await admin.from("w9_send_files").select("send_id, business_id");
    const send = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/w9`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        tin: TIN_DASHED,
        tinKind: "ssn",
        signatureMode: "blank",
        clientId: probeClientId,
      }),
    });
    const sendText = await send.text();
    console.log("ITEM9_SEND", send.status, hasTin(sendText), sendText.slice(0, 500));
    const sent = JSON.parse(sendText) as { downloadUrl?: string };
    const token = sent.downloadUrl?.split("/w9/")[1] ?? "";
    const { data: emailRows } = await admin
      .from("email_events")
      .select("recipient, email_type, event_type, metadata, resend_email_id, created_at")
      .eq("business_id", SWIFT)
      .eq("recipient", clientEmail)
      .order("created_at", { ascending: false })
      .limit(3);
    console.log("ITEM9_EMAIL_EVENTS", JSON.stringify(emailRows));
    const resendId = emailRows?.[0]?.resend_email_id as string | undefined;
    if (resendId && process.env.RESEND_API_KEY) {
      const emailRes = await fetch(`https://api.resend.com/emails/${resendId}`, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      const emailJson = (await emailRes.json()) as { html?: string; subject?: string; to?: unknown; attachments?: unknown };
      const html = emailJson.html ?? "";
      console.log("ITEM9_RESEND", emailRes.status, "subject", emailJson.subject, "attachments", emailJson.attachments ?? null);
      console.log("ITEM9_EMAIL_HTML", html.slice(0, 2500));
      console.log("ITEM9_EMAIL_HAS_TIN", hasTin(html), "HAS_ATTACHMENT_TAG", /attachment/i.test(html));
    }

    const { data: cipherRows } = await admin.from("w9_send_files").select("send_id, business_id, ciphertext").eq("business_id", SWIFT);
    const cipher = (cipherRows ?? []).map((row) => ({
      send_id: row.send_id,
      business_id: row.business_id,
      length: String(row.ciphertext ?? "").length,
      prefix: String(row.ciphertext ?? "").slice(0, 180),
      hasTin: hasTin(String(row.ciphertext ?? "")),
    }));
    console.log("ITEM10_CIPHER", JSON.stringify(cipher));
    console.log("ITEM8_FILES_BEFORE_SEND", JSON.stringify(filesBeforeSend.data));

    const staffLink = await fetch(`${ROOT}/b/swift-aerial-media/w9/${token}`, { headers: { Cookie: staffCookie } });
    const staffLinkText = await staffLink.text();
    console.log("ITEM17_STAFF_LINK", staffLink.status, hasTin(staffLinkText), staffLinkText.slice(0, 200));
    const afterStaff = await admin.from("w9_send_files").select("send_id").eq("business_id", SWIFT);
    console.log("ITEM17_FILES_AFTER_STAFF", afterStaff.data?.length);

    const anonDownload = await fetch(`${ROOT}/b/swift-aerial-media/w9/${token}`);
    console.log("ITEM11_FRESH", anonDownload.status, anonDownload.headers.get("content-type"), anonDownload.headers.get("cache-control"), anonDownload.headers.get("x-robots-tag"));
    const anonAgain = await fetch(`${ROOT}/b/swift-aerial-media/w9/${token}`);
    const anonAgainText = await anonAgain.text();
    console.log("ITEM11_SECOND", anonAgain.status, anonAgainText.slice(0, 200));
    const afterDownload = await admin.from("w9_send_files").select("send_id").eq("business_id", SWIFT);
    console.log("ITEM11_FILES_AFTER_DOWNLOAD", JSON.stringify(afterDownload.data));

    const expireSend = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/w9`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ tin: TIN_DASHED, tinKind: "ein", signatureMode: "blank", clientId: probeClientId }),
    });
    const expireBody = (await expireSend.json()) as { downloadUrl?: string };
    const expireToken = expireBody.downloadUrl?.split("/w9/")[1] ?? "";
    const { data: expireRow } = await admin.from("w9_sends").select("id").eq("recipient_email", clientEmail).is("downloaded_at", null).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).single();
    await admin.from("w9_sends").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", expireRow?.id ?? "");
    const expiredHit = await fetch(`${ROOT}/b/swift-aerial-media/w9/${expireToken}`);
    const expiredText = await expiredHit.text();
    const stillThere = await admin.from("w9_send_files").select("send_id").eq("send_id", expireRow?.id ?? "");
    console.log("ITEM11_EXPIRED", expiredHit.status, expiredText.slice(0, 200), "file_still_there", stillThere.data?.length ?? 0);

    process.env.CRON_SECRET = "w9-probe-cron";
    const cronMod = await import("../src/app/api/cron/w9-purge/route");
    const cronRes = await cronMod.GET(new Request("http://localhost/api/cron/w9-purge", { headers: { authorization: "Bearer w9-probe-cron" } }));
    const cronJson = await cronRes.json();
    const afterPurge = await admin.from("w9_send_files").select("send_id").eq("send_id", expireRow?.id ?? "");
    console.log("ITEM12_CRON", cronRes.status, JSON.stringify(cronJson), "file_after", afterPurge.data?.length ?? 0);
    const openCron = await fetch(`${ROOT}/b/swift-aerial-media/api/cron/w9-purge`);
    console.log("ITEM12_HTTP_NO_SECRET", openCron.status);

    const revokeSend = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/w9`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ tin: TIN_DASHED, tinKind: "ssn", signatureMode: "blank", clientId: probeClientId }),
    });
    assert(revokeSend.ok, "history send failed");
    const history = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/w9`, { headers: { Cookie: adminCookie } });
    const historyText = await history.text();
    console.log("ITEM14_HISTORY", history.status, hasTin(historyText));
    console.log("ITEM14_HISTORY_BODY", historyText.slice(0, 1800));
    const historyJson = JSON.parse(historyText) as { sends?: { id: string; revoked_at: string | null; downloaded_at: string | null }[] };
    const active = (historyJson.sends ?? []).find((row) => !row.revoked_at && !row.downloaded_at);
    if (active) {
      const revoked = await fetch(`${ROOT}/b/swift-aerial-media/api/admin/w9/${active.id}/revoke`, { method: "POST", headers: { Cookie: adminCookie } });
      const revokedText = await revoked.text();
      const fileGone = await admin.from("w9_send_files").select("send_id").eq("send_id", active.id);
      console.log("ITEM14_REVOKE", revoked.status, revokedText.slice(0, 200), "file", fileGone.data?.length ?? 0);
    }

    const { data: logRows } = await admin
      .from("w9_sends")
      .select("id, client_id, recipient_email, sender_user_id, expires_at, downloaded_at, revoked_at, created_at")
      .eq("business_id", SWIFT)
      .eq("recipient_email", clientEmail);
    console.log("ITEM15_SEND_ROWS", JSON.stringify(logRows));
    console.log("ITEM15_ROWS_HAVE_TIN", hasTin(JSON.stringify(logRows)));

    const { data: activity } = await admin
      .from("activity_logs")
      .select("id, activity_type, title, description, metadata, created_at")
      .eq("business_id", SWIFT)
      .gte("created_at", startedAt);
    console.log("ITEM3_ACTIVITY", JSON.stringify(activity ?? []).slice(0, 1500), "HAS_TIN", hasTin(JSON.stringify(activity ?? [])));

    const { data: freshSettings } = await admin.from("business_settings").select("settings").eq("business_id", SWIFT).single();
    const mutable = structuredClone(freshSettings?.settings) as { business?: { country?: string } };
    if (!mutable.business) mutable.business = {};
    mutable.business.country = "Canada";
    await admin.from("business_settings").update({ settings: mutable }).eq("business_id", SWIFT);
    const canada = await fetch(`${ROOT}/b/swift-aerial-media/admin/settings`, { headers: { Cookie: adminCookie }, redirect: "follow" });
    const canadaHtml = await canada.text();
    console.log("ITEM16_CANADA", canada.status, "tax_heading", canadaHtml.includes("Tax information"), "generate", canadaHtml.includes("Generate W-9"), "w9_field", canadaHtml.includes("w9-name"));
    mutable.business.country = "";
    await admin.from("business_settings").update({ settings: mutable }).eq("business_id", SWIFT);

    async function api(path: string, cookie: string, init?: RequestInit) {
      const res = await fetch(`${ROOT}/b/swift-aerial-media${path}`, {
        ...init,
        headers: { Cookie: cookie, ...(init?.headers ?? {}) },
      });
      const text = await res.text();
      return { status: res.status, text: text.slice(0, 180), hasTin: hasTin(text) };
    }
    console.log("ITEM17_STAFF_HISTORY", JSON.stringify(await api("/api/admin/w9", staffCookie)));
    console.log("ITEM17_STAFF_DOWNLOAD", JSON.stringify(await api("/api/admin/w9/download", staffCookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tin: TIN_DASHED, tinKind: "ssn", signatureMode: "blank" }),
    })));
    console.log("ITEM17_STAFF_SEND", JSON.stringify(await api("/api/admin/w9", staffCookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tin: TIN_DASHED, tinKind: "ssn", signatureMode: "blank", clientId: probeClientId }),
    })));
    console.log("ITEM17_STAFF_SETTINGS_API", JSON.stringify(await api("/api/admin/settings", staffCookie)));
    const staffHtml = await fetch(`${ROOT}/b/swift-aerial-media/admin/settings`, { headers: { Cookie: staffCookie }, redirect: "follow" });
    const staffHtmlText = await staffHtml.text();
    console.log("ITEM17_STAFF_HTML", staffHtml.status, staffHtml.url, "tax_heading", staffHtmlText.includes("Tax information"), "generate", staffHtmlText.includes("Generate W-9"), "w9_field", staffHtmlText.includes("w9-name"));

    const clientProject = await fetch(`${ROOT}/b/swift-aerial-media/dashboard/projects/${JANET}`, { headers: { Cookie: clientCookie }, redirect: "follow" });
    const clientProjectHtml = await clientProject.text();
    console.log("ITEM18_CLIENT", clientProject.status, "tax", clientProjectHtml.includes("Tax information"), "w9", /W-9|w9-name|Generate W-9/.test(clientProjectHtml));

    const { addProjectShare, buildShareMagicLinkForProject, resolveShareAccessWindow } = await import("../src/lib/project-shares");
    const accessFields = resolveShareAccessWindow("30days");
    const added = await addProjectShare({
      businessId: SWIFT,
      projectId: JANET,
      email: shareEmail,
      invitedBy: SWIFT_ADMIN,
      notify: false,
      projectName: "W-9 probe",
      inviterName: "Admin",
      expiryPreset: "30days",
    });
    const magic = await buildShareMagicLinkForProject({
      businessId: SWIFT,
      projectId: JANET,
      email: shareEmail,
      shareId: added.share.id,
      accessFields,
    });
    const shareToken = new URL(magic).searchParams.get("token") || "";
    const form = new URLSearchParams();
    form.set("token", shareToken);
    const exchange = await fetch(`${ROOT}/b/swift-aerial-media/auth/share/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      redirect: "manual",
    });
    const shareCookie = `${(exchange.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ")}; sp_path_tenant=swift-aerial-media`;
    const shareUserId = userIdFromCookie(shareCookie);
    if (shareUserId) created.push(shareUserId);
    const sharePage = await fetch(`${ROOT}/b/swift-aerial-media/dashboard/projects/${JANET}`, { headers: { Cookie: shareCookie }, redirect: "follow" });
    const shareHtml = await sharePage.text();
    console.log("ITEM18_SHARE", sharePage.status, "tax", shareHtml.includes("Tax information"), "w9", /W-9|Generate W-9/.test(shareHtml));

    const anonToken = `w9-anon-${stamp}`;
    await admin.from("projects").update({ link_access_mode: "anyone_with_link", link_access_token: anonToken }).eq("id", JANET).eq("business_id", SWIFT);
    const anonPage = await fetch(`${ROOT}/b/swift-aerial-media/view/${anonToken}`);
    const anonHtml = await anonPage.text();
    console.log("ITEM18_ANON", anonPage.status, "tax", anonHtml.includes("Tax information"), "w9", /W-9|Generate W-9/.test(anonHtml));
    console.log("ITEM18_CLIENT_API", JSON.stringify(await api("/api/admin/w9", clientCookie)));
    console.log("ITEM18_ANON_API", JSON.stringify(await api("/api/admin/w9", "")));

    const devLog = readFileSync(DEV_LOG, "utf8");
    const devSlice = devLog.slice(Math.max(0, devLog.length - 400_000));
    console.log("ITEM3_DEV_LOG_HAS_TIN", hasTin(devSlice));

    console.log("ITEM13_DECISIONS", JSON.stringify({
      expiryDays: 7,
      download: "single",
      signIn: "unguessable token, no portal account required",
      countrySource: "business address country when set, otherwise Stripe account country",
    }));
    console.log("ITEM19_PRIVACY", "Add the stored W-9 identity fields (name, disregarded entity, classification, LLC letter, line 3b, exempt payee code, FATCA code, address, city/state/ZIP, optional account numbers) and the encrypted PDF kept until first download, revoke, or 7 days. State that the taxpayer identification number is not stored.");
  } finally {
    if (originalSettings) {
      await admin.from("business_settings").update({ settings: originalSettings }).eq("business_id", SWIFT);
    }
    if (linkState) {
      await admin.from("projects").update(linkState).eq("id", JANET).eq("business_id", SWIFT);
    }
    if (probeClientId) {
      await admin.from("w9_sends").delete().eq("business_id", SWIFT).eq("client_id", probeClientId);
      await admin.from("project_clients").delete().eq("business_id", SWIFT).eq("client_id", probeClientId);
      await admin.from("clients").delete().eq("business_id", SWIFT).eq("id", probeClientId);
    }
    await admin.from("project_shares").delete().eq("business_id", SWIFT).eq("email", shareEmail);
    const { data: templateRows } = await admin.from("w9_form_templates").select("id, revision_label, active");
    const officialRow = (templateRows ?? []).find((row) => row.revision_label === "Rev. March 2024");
    if (officialRow && !officialRow.active) {
      await admin.from("w9_form_templates").update({ active: false }).eq("active", true);
      await admin.from("w9_form_templates").update({ active: true }).eq("id", officialRow.id);
    }
    await admin.from("w9_form_templates").delete().eq("active", false);
    for (const id of created) {
      await admin.auth.admin.deleteUser(id);
    }
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const user of listed.data.users ?? []) {
      if (user.email?.startsWith("w9-") && user.email.endsWith("@example.test")) {
        await admin.auth.admin.deleteUser(user.id);
      }
    }
    const { count } = await admin.from("w9_send_files").select("send_id", { count: "exact", head: true }).eq("business_id", SWIFT);
    console.log("CLEANUP_SWIFT_W9_FILES", count ?? 0);
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : "failed";
  console.error("VERIFY_W9_FAILED", message.includes(TIN_DASHED) || message.includes(TIN_DIGITS) ? "error contained the test TIN" : message);
  process.exit(1);
});
