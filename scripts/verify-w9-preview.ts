/**
 * Swift-only checks for the W-9 preview and the client-record send action.
 * Does not print a taxpayer identification number.
 * Usage: VERIFY_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/verify-w9-preview.ts
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
const CLIENT = "93864aba-7031-436a-b2a4-8347a5d67600";
const ROOT = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";
const BASE = `${ROOT}/b/swift-aerial-media`;
const TIN_DIGITS = "123456789";
const TIN_DASHED = "123-45-6789";

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

function pdfPlainText(buf: Uint8Array): string {
  const bytes = Buffer.from(buf);
  const parts: string[] = [];
  const marker = Buffer.from("stream");
  let i = 0;
  while ((i = bytes.indexOf(marker, i)) >= 0) {
    let start = i + marker.length;
    if (bytes[start] === 0x0d) start += 1;
    if (bytes[start] === 0x0a) start += 1;
    const end = bytes.indexOf(Buffer.from("endstream"), start);
    if (end < 0) break;
    try {
      const inflated = zlib.inflateSync(bytes.subarray(start, end)).toString("latin1");
      parts.push(inflated.replace(/<([0-9A-Fa-f]+)>/g, (_, hex: string) => Buffer.from(hex, "hex").toString("latin1")));
    } catch {
      parts.push(bytes.subarray(start, end).toString("latin1"));
    }
    i = end + 9;
  }
  return parts.join("\n");
}

async function fieldText(bytes: Uint8Array, name: string): Promise<string> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getForm().getTextField(name).getText() ?? "";
}

async function main() {
  loadEnv();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: adminProfile } = await admin.from("profiles").select("email").eq("id", SWIFT_ADMIN).single();
  const adminEmail = adminProfile?.email as string;
  assert(adminEmail, "swift admin email");
  const adminCookie = await magicCookie(admin, adminEmail);

  const beforeFiles = await admin.from("w9_send_files").select("send_id", { count: "exact", head: true }).eq("business_id", SWIFT);
  const beforeTemplates = await admin.from("w9_form_templates").select("id", { count: "exact", head: true });
  let beforeObjects = "unavailable";
  const objects = await admin.schema("storage").from("objects").select("name").ilike("name", "%w9%");
  if (!objects.error) beforeObjects = JSON.stringify((objects.data ?? []).map((row) => row.name));
  console.log("STORAGE_BEFORE", JSON.stringify({
    w9_send_files: beforeFiles.count,
    w9_form_templates: beforeTemplates.count,
    storage_objects: beforeObjects,
  }));

  const current = await fetch(`${BASE}/api/admin/settings`, { headers: { Cookie: adminCookie } });
  const currentBody = (await current.json()) as { settings?: Record<string, unknown> };
  assert(current.ok && currentBody.settings, "settings");
  const original = structuredClone(currentBody.settings);
  const tax = {
    name: "Preview Aerial LLC",
    disregardedEntityName: "Disregarded Probe LLC",
    federalTaxClassification: "llc",
    llcTaxClassification: "S",
    otherClassification: "",
    foreignPartners: false,
    exemptPayeeCode: "5",
    fatcaExemptionCode: "A",
    address: "1 Example Street",
    cityStateZip: "Test City, TS 00000",
    accountNumbers: "TEST-ACCT",
  };
  const stamp = Date.now();
  let staffId: string | null = null;
  let sendId: string | null = null;
  try {
    const save = await fetch(`${BASE}/api/admin/settings`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { ...currentBody.settings, tax } }),
    });
    assert(save.ok, `save tax ${save.status}`);

    const previewBody = { tax, signatureMode: "typed", typedName: "Preview Signer" };
    const preview = await fetch(`${BASE}/api/admin/w9/preview`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify(previewBody),
    });
    const previewBytes = new Uint8Array(await preview.arrayBuffer());
    const previewText = pdfPlainText(previewBytes);
    console.log("PREVIEW", preview.status, preview.headers.get("content-type"), "signature", previewText.includes("Preview Signer"));
    assert(preview.status === 200, "preview 200");
    assert(previewText.includes("Preview Signer"), "typed signature is in the preview");
    assert((await fieldText(previewBytes, W9_FIELDS.name)) === tax.name, "preview name");
    assert((await fieldText(previewBytes, W9_FIELDS.llcLetter)) === "S", "preview llc letter");
    assert((await fieldText(previewBytes, W9_FIELDS.ssn1)) === "", "preview ssn empty");
    assert((await fieldText(previewBytes, W9_FIELDS.ssn2)) === "", "preview ssn2 empty");
    assert((await fieldText(previewBytes, W9_FIELDS.ssn3)) === "", "preview ssn3 empty");
    assert((await fieldText(previewBytes, W9_FIELDS.ein1)) === "", "preview ein empty");
    assert((await fieldText(previewBytes, W9_FIELDS.ein2)) === "", "preview ein2 empty");

    const blank = await fetch(`${BASE}/api/admin/w9/preview`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ tax, signatureMode: "blank", typedName: "Preview Signer" }),
    });
    const blankText = pdfPlainText(new Uint8Array(await blank.arrayBuffer()));
    console.log("PREVIEW_BLANK", blank.status, "signaturePresent", blankText.includes("Preview Signer"));
    assert(blank.ok && !blankText.includes("Preview Signer"), "blank signature is absent");

    const leaked = await fetch(`${BASE}/api/admin/w9/preview`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ ...previewBody, tin: TIN_DASHED, tinKind: "ssn", ssn: TIN_DIGITS }),
    });
    const leakedText = await leaked.text();
    console.log("PREVIEW_TIN_REJECTED", leaked.status, "hasTin", hasTin(leakedText), leakedText.slice(0, 180));
    assert(leaked.status === 400 && !hasTin(leakedText), "preview refuses a TIN without echoing it");

    const download = await fetch(`${BASE}/api/admin/w9/download`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        tin: TIN_DIGITS,
        tinKind: "ssn",
        signatureMode: "typed",
        attestation: true,
        typedName: "Preview Signer",
      }),
    });
    const downloadBytes = new Uint8Array(await download.arrayBuffer());
    const downloadText = pdfPlainText(downloadBytes);
    console.log("DOWNLOAD", download.status, "signature", downloadText.includes("Preview Signer"));
    assert(download.ok, "download");
    const shared = [W9_FIELDS.name, W9_FIELDS.disregardedEntityName, W9_FIELDS.address, W9_FIELDS.cityStateZip, W9_FIELDS.accountNumbers, W9_FIELDS.exemptPayeeCode, W9_FIELDS.fatcaCode, W9_FIELDS.llcLetter] as const;
    for (const field of shared) {
      const left = await fieldText(previewBytes, field);
      const right = await fieldText(downloadBytes, field);
      assert(left === right, `field mismatch ${field}`);
    }
    assert((await fieldText(downloadBytes, W9_FIELDS.ssn1)) === TIN_DIGITS.slice(0, 3), "download wrote ssn");
    console.log("PDF_FIELDS_MATCH", true);

    const afterPreviewFiles = await admin.from("w9_send_files").select("send_id", { count: "exact", head: true }).eq("business_id", SWIFT);
    const afterTemplates = await admin.from("w9_form_templates").select("id", { count: "exact", head: true });
    const afterObjects = await admin.schema("storage").from("objects").select("name").ilike("name", "%w9%");
    console.log("STORAGE_AFTER", JSON.stringify({
      w9_send_files: afterPreviewFiles.count,
      w9_form_templates: afterTemplates.count,
      storage_objects: afterObjects.error ? "unavailable" : JSON.stringify((afterObjects.data ?? []).map((row) => row.name)),
    }));
    assert(afterPreviewFiles.count === beforeFiles.count, "preview wrote a send file");

    const { data: send, error: sendErr } = await admin.from("w9_sends").insert({
      business_id: SWIFT,
      client_id: CLIENT,
      recipient_email: "w9-history-probe@example.test",
      sender_user_id: SWIFT_ADMIN,
      token_hash: `preview-probe-${stamp}`,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }).select("id").single();
    if (sendErr || !send) throw new Error(sendErr?.message || "history row");
    sendId = send.id as string;
    const history = await fetch(`${BASE}/api/admin/w9?clientId=${CLIENT}`, { headers: { Cookie: adminCookie } });
    const historyBody = await history.text();
    console.log("CLIENT_HISTORY", history.status, historyBody.includes("w9-history-probe@example.test"), historyBody.includes("Link") || historyBody.includes("expires_at"));
    assert(history.ok && historyBody.includes("w9-history-probe@example.test"), "client history");
    const revoked = await fetch(`${BASE}/api/admin/w9/${sendId}/revoke`, { method: "POST", headers: { Cookie: adminCookie } });
    console.log("REVOKE", revoked.status);
    assert(revoked.ok, "revoke");

    const staffEmail = `w9-preview-staff-${stamp}@example.test`;
    const created = await admin.auth.admin.createUser({ email: staffEmail, email_confirm: true });
    if (!created.data.user) throw new Error(created.error?.message || "staff");
    staffId = created.data.user.id;
    const everyPerm: Record<string, boolean | number> = { v: 1 };
    for (const key of STAFF_PERMISSION_KEYS) everyPerm[key] = true;
    await admin.from("profiles").update({
      role: "staff",
      business_id: SWIFT,
      staff_permissions: everyPerm,
      full_name: "W-9 preview staff",
    }).eq("id", staffId);
    const staffCookie = await magicCookie(admin, staffEmail);
    const staffPage = await fetch(`${BASE}/admin/clients/${CLIENT}`, { headers: { Cookie: staffCookie } });
    const staffHtml = (await staffPage.text()).replace(/<script[\s\S]*?<\/script>/gi, "");
    console.log("STAFF_HTML", staffPage.status, {
      send: staffHtml.includes("Send W-9"),
      panel: staffHtml.includes("data-w9-client-panel"),
      history: staffHtml.includes("w9-history-probe") || staffHtml.includes("No W-9 links"),
      tax: staffHtml.includes("Tax information"),
    });
    const staffPreview = await fetch(`${BASE}/api/admin/w9/preview`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify(previewBody),
    });
    const staffHistory = await fetch(`${BASE}/api/admin/w9?clientId=${CLIENT}`, { headers: { Cookie: staffCookie } });
    const staffSend = await fetch(`${BASE}/api/admin/w9`, {
      method: "POST",
      headers: { Cookie: staffCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: CLIENT, tin: TIN_DIGITS, tinKind: "ssn", signatureMode: "blank" }),
    });
    console.log("STAFF_API", JSON.stringify({
      preview: staffPreview.status,
      history: staffHistory.status,
      send: staffSend.status,
      sendBodyHasTin: hasTin(await staffSend.text()),
    }));

    const canada = await fetch(`${BASE}/api/admin/settings`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          ...currentBody.settings,
          tax,
          business: { ...(currentBody.settings.business as object), country: "Canada" },
        },
      }),
    });
    assert(canada.ok, "canada save");
    const canadaSettings = await fetch(`${BASE}/admin/settings#settings-tax`, { headers: { Cookie: adminCookie } });
    const canadaSettingsHtml = (await canadaSettings.text()).replace(/<script[\s\S]*?<\/script>/gi, "");
    const canadaClient = await fetch(`${BASE}/admin/clients/${CLIENT}`, { headers: { Cookie: adminCookie } });
    const canadaClientHtml = (await canadaClient.text()).replace(/<script[\s\S]*?<\/script>/gi, "");
    const canadaHits = {
      settingsTax: canadaSettingsHtml.includes("Tax information"),
      settingsPreview: canadaSettingsHtml.includes("W-9 preview"),
      clientSend: canadaClientHtml.includes("Send W-9"),
      clientPanel: canadaClientHtml.includes("data-w9-client-panel"),
    };
    console.log("CANADA", canadaHits);
    assert(!canadaHits.settingsTax && !canadaHits.settingsPreview && !canadaHits.clientSend && !canadaHits.clientPanel, "canada still shows W-9");
    assert(!staffHtml.includes("Send W-9") && !staffHtml.includes("data-w9-client-panel"), "staff html shows W-9");
    assert(staffPreview.status === 404 && staffHistory.status === 404 && staffSend.status === 404, "staff api");
  } finally {
    await fetch(`${BASE}/api/admin/settings`, {
      method: "PATCH",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ settings: original }),
    });
    if (sendId) await admin.from("w9_sends").delete().eq("id", sendId);
    if (staffId) await admin.auth.admin.deleteUser(staffId);
    const leftover = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const user of leftover.data.users ?? []) {
      if (user.email?.startsWith("w9-preview-staff-") && user.email.endsWith("@example.test")) {
        await admin.auth.admin.deleteUser(user.id);
      }
    }
    console.log("RESTORED");
  }
}

main().catch((err) => {
  console.error("VERIFY_W9_PREVIEW_FAILED", err instanceof Error ? err.message : "failed");
  process.exit(1);
});
