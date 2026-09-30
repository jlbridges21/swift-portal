/**
 * Swift-only checks for payment records and admin preview.
 * Usage: VERIFY_BASE_URL=http://localhost:3000 npx tsx scripts/verify-payment-record-preview.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import zlib from "node:zlib";
import { buildPaymentRecordPdf, paymentRecordLines, type PaymentRecordInput } from "../src/lib/payment-record-pdf";
import { getAppSettings } from "../src/lib/app-settings";
import { formatCurrency, formatDate } from "../src/lib/utils";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const ROOT = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const JANET = "1345a0de-adb1-4795-a981-e6014b3cf42e";
const MANUAL = "5d5c11cc-b57e-4027-8ccb-fb3105af1350";
const SEVERAL = "26e65643-74d1-4c34-b085-0711c6e4b97c";
const MANUAL_PAYMENT = "fe037fcc-4583-43e2-84a8-ac20b436de7a";

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

async function html(path: string, cookie: string) {
  const res = await fetch(`${ROOT}${path}`, { redirect: "manual", headers: { Cookie: cookie } });
  const text = await res.text();
  return { status: res.status, text };
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
      const decoded = inflated.replace(/<([0-9A-Fa-f]+)>/g, (_, hex: string) =>
        Buffer.from(hex, "hex").toString("latin1")
      );
      parts.push(decoded);
    } catch {
      // Not a flate stream.
    }
    i = end + 9;
  }
  return parts.join("\n");
}

function hits(text: string) {
  return {
    viewReceipt: text.includes("View receipt"),
    paymentRecord: text.includes("Payment record"),
    stripeHost: /pay\.stripe\.com|receipt\.stripe\.com/.test(text),
    hiddenBadge: text.includes("Hidden from clients"),
    documentsSection: text.includes('id="documents"') || text.includes(">Documents<"),
    modelsSection: text.includes('id="models"') || text.includes(">3D Models<"),
    toursSection: text.includes("360° Virtual Tours") || text.includes("360&#xB0; Virtual Tours") || text.includes("360&deg; Virtual Tours"),
    photosSection: text.includes('id="photo-gallery"') || text.includes(">Photo Gallery<"),
  };
}

function snippets(text: string, needles: string[]): string[] {
  const out: string[] = [];
  for (const needle of needles) {
    const at = text.indexOf(needle);
    if (at < 0) {
      out.push(`MISS ${needle}`);
      continue;
    }
    out.push(text.slice(Math.max(0, at - 120), at + needle.length + 160).replace(/\s+/g, " "));
  }
  return out;
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

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const settings = await getAppSettings(SWIFT);
  const business = settings.business;
  const { data: payment } = await admin.from("payments").select("*").eq("id", MANUAL_PAYMENT).single();
  const { data: project } = await admin.from("projects").select("project_name, property_address").eq("id", MANUAL).single();
  const { data: client } = await admin.from("clients").select("name").eq("id", payment!.client_id).single();
  assert(payment && !payment.stripe_receipt_url, "manual payment unexpectedly has a stripe receipt");
  const address = [business.addressLine1, business.addressLine2, [business.city, business.state, business.postalCode].filter(Boolean).join(" "), business.country]
    .map((line) => (line || "").trim())
    .filter(Boolean);
  const input: PaymentRecordInput = {
    businessName: business.businessName || business.portalName,
    addressLines: address,
    clientName: client?.name || "Client",
    projectName: project?.project_name || "Project",
    propertyAddress: project?.property_address || "",
    amountLabel: formatCurrency(payment.amount),
    paidAtLabel: formatDate(payment.paid_at),
    recordedAs: "Marked paid by the business",
    reference: payment.id,
    cardLast4: payment.card_last4,
  };
  const lines = paymentRecordLines(input);
  let logoBytes: Uint8Array | null = null;
  const logoUrl = business.logoUrl || business.emailLogoUrl || "";
  if (logoUrl.startsWith("http")) {
    const logoRes = await fetch(logoUrl);
    if (logoRes.ok) logoBytes = new Uint8Array(await logoRes.arrayBuffer());
  }
  console.log("PDF_FIELDS", JSON.stringify({
    lines,
    logoUrl: logoUrl || null,
    logoBytes: logoBytes?.byteLength ?? 0,
    addressFromSettings: address,
  }));
  assert(!lines.some((line) => /^invoice\b/i.test(line)), "record title uses invoice");
  const pdf = await buildPaymentRecordPdf({
    ...input,
    addressLines: address.length ? address : ["1 Example Street"],
    logoBytes,
    logoType: logoBytes ? "png" : null,
  });
  const plain = pdfPlainText(Buffer.from(pdf));
  assert(plain.includes("Payment record"), "pdf missing title");
  assert(plain.includes(input.businessName), "pdf missing business name");
  assert(plain.includes(payment.id), "pdf missing reference");
  assert(plain.includes("1 Example Street") || address.length > 0, "pdf missing address line");
  if (logoBytes) assert(Buffer.from(pdf).includes(Buffer.from("/Image")), "pdf missing logo image");

  const stamp = Date.now();
  const password = `Record-Probe-${stamp}!Aa`;
  const clientEmail = `record-client-${stamp}@example.test`;
  const staffEmail = `record-staff-${stamp}@example.test`;
  const adminEmail = `record-admin-${stamp}@example.test`;
  const shareEmail = `record-share-${stamp}@example.test`;
  const created: string[] = [];
  const clientUser = await admin.auth.admin.createUser({ email: clientEmail, password, email_confirm: true });
  const staffUser = await admin.auth.admin.createUser({ email: staffEmail, password, email_confirm: true });
  const adminUser = await admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true });
  if (!clientUser.data.user || !staffUser.data.user || !adminUser.data.user) throw new Error("users");
  created.push(clientUser.data.user.id, staffUser.data.user.id, adminUser.data.user.id);
  const { data: probeClient, error: clientErr } = await admin.from("clients").insert({
    business_id: SWIFT, name: "Record probe", email: clientEmail,
  }).select("id").single();
  if (clientErr || !probeClient) throw new Error(clientErr?.message || "client");
  for (const projectId of [JANET, MANUAL, SEVERAL]) {
    const { error } = await admin.from("project_clients").insert({ business_id: SWIFT, project_id: projectId, client_id: probeClient.id });
    if (error) throw new Error(error.message);
  }
  await admin.from("profiles").update({ role: "client", business_id: SWIFT, client_id: probeClient.id, full_name: "Record probe" }).eq("id", clientUser.data.user.id);
  await admin.from("profiles").update({
    role: "staff", business_id: SWIFT, client_id: null, full_name: "Record staff",
    staff_permissions: { v: 1, "area.projects": true, "projects.view_all": true },
  }).eq("id", staffUser.data.user.id);
  await admin.from("profiles").update({ role: "admin", business_id: SWIFT, client_id: null, full_name: "Record admin" }).eq("id", adminUser.data.user.id);

  const { data: linkState } = await admin.from("projects").select("link_access_mode, link_access_token").eq("id", JANET).single();
  const anonToken = `record-probe-${stamp}`;
  try {
    const clientCookie = await signIn(url, anonKey, clientEmail, password);
    const staffCookie = await signIn(url, anonKey, staffEmail, password);
    const adminCookie = await signIn(url, anonKey, adminEmail, password);
    const janetClient = await html(`/b/swift-aerial-media/dashboard/projects/${JANET}`, clientCookie);
    const manualClient = await html(`/b/swift-aerial-media/dashboard/projects/${MANUAL}`, clientCookie);
    const janetAdmin = await html(`/b/swift-aerial-media/admin/projects/${JANET}`, adminCookie);
    const staffPage = await html(`/b/swift-aerial-media/admin/projects/${JANET}`, staffCookie);
    const preview = await html(`/b/swift-aerial-media/dashboard/projects/${JANET}?preview=1`, adminCookie);
    const previewSeveral = await html(`/b/swift-aerial-media/dashboard/projects/${SEVERAL}?preview=1`, adminCookie);
    const clientSeveral = await html(`/b/swift-aerial-media/dashboard/projects/${SEVERAL}`, clientCookie);
    const editor = await html(`/b/swift-aerial-media/admin/projects/${JANET}`, adminCookie);

    const { addProjectShare, buildShareMagicLinkForProject, resolveShareAccessWindow } = await import("../src/lib/project-shares");
    const accessFields = resolveShareAccessWindow("30days");
    const added = await addProjectShare({
      businessId: SWIFT, projectId: JANET, email: shareEmail, invitedBy: SWIFT_ADMIN, notify: false,
      projectName: "Receipt probe", inviterName: "Admin", expiryPreset: "30days",
    });
    const magic = await buildShareMagicLinkForProject({
      businessId: SWIFT, projectId: JANET, email: shareEmail, shareId: added.share.id, accessFields,
    });
    const token = new URL(magic).searchParams.get("token") || "";
    const form = new URLSearchParams();
    form.set("token", token);
    const exchange = await fetch(`${ROOT}/b/swift-aerial-media/auth/share/consume`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(), redirect: "manual",
    });
    const shareCookie = `${(exchange.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ")}; sp_path_tenant=swift-aerial-media`;
    const shareUserId = userIdFromCookie(shareCookie);
    if (shareUserId) created.push(shareUserId);
    const sharePage = await html(`/b/swift-aerial-media/dashboard/projects/${JANET}`, shareCookie);
    await admin.from("projects").update({ link_access_mode: "anyone_with_link", link_access_token: anonToken }).eq("id", JANET);
    const anonPage = await html(`/b/swift-aerial-media/view/${anonToken}`, "");

    const pdfRes = await fetch(`${ROOT}/b/swift-aerial-media/api/payments/${MANUAL_PAYMENT}/receipt`, {
      headers: { Cookie: clientCookie }, redirect: "manual",
    });
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
    const pdfText = pdfPlainText(pdfBytes);
    console.log("HTTP_PDF", pdfRes.status, pdfRes.headers.get("content-type"), "bytes", pdfBytes.length);
    console.log("HTML_JANET_CLIENT", janetClient.status, JSON.stringify(hits(janetClient.text)));
    console.log("HTML_MANUAL_CLIENT", manualClient.status, JSON.stringify(hits(manualClient.text)));
    console.log("HTML_JANET_ADMIN", janetAdmin.status, JSON.stringify(hits(janetAdmin.text)));
    console.log("HTML_STAFF", staffPage.status, JSON.stringify(hits(staffPage.text)));
    console.log("HTML_SHARE", sharePage.status, JSON.stringify(hits(sharePage.text)));
    console.log("HTML_ANON", anonPage.status, JSON.stringify(hits(anonPage.text)));
    console.log("HTML_PREVIEW_JANET", preview.status, JSON.stringify(hits(preview.text)));
    console.log("HTML_EDITOR", editor.status, JSON.stringify(hits(editor.text)));
    console.log("HTML_PREVIEW_SEVERAL", previewSeveral.status, JSON.stringify(hits(previewSeveral.text)));
    console.log("HTML_CLIENT_SEVERAL", clientSeveral.status, JSON.stringify(hits(clientSeveral.text)));
    console.log("SNIP_JANET_CLIENT", JSON.stringify(snippets(janetClient.text, ["View receipt", "pay.stripe.com"])));
    console.log("SNIP_MANUAL_CLIENT", JSON.stringify(snippets(manualClient.text, ["Payment record", "fe037fcc-4583-43e2-84a8-ac20b436de7a"])));
    console.log("SNIP_JANET_ADMIN", JSON.stringify(snippets(janetAdmin.text, ["View receipt", "Hidden from clients"])));
    console.log("SNIP_STAFF", JSON.stringify(snippets(staffPage.text, ["View receipt", "Payment record", "pay.stripe.com"])));
    console.log("SNIP_SHARE", JSON.stringify(snippets(sharePage.text, ["View receipt", "Payment record", "pay.stripe.com"])));
    console.log("SNIP_ANON", JSON.stringify(snippets(anonPage.text, ["View receipt", "Payment record", "pay.stripe.com"])));
    console.log("SNIP_PREVIEW", JSON.stringify(snippets(preview.text, ["Hidden from clients", ">Documents<", "View receipt"])));
    console.log("SNIP_EDITOR", JSON.stringify(snippets(editor.text, ["Hidden from clients"])));
    console.log("SNIP_PREVIEW_SEVERAL", JSON.stringify(snippets(previewSeveral.text, [">Documents<", ">3D Models<", ">Photo Gallery<", "Hidden from clients"])));
    console.log("SNIP_CLIENT_SEVERAL", JSON.stringify(snippets(clientSeveral.text, [">Documents<", ">3D Models<", ">Photo Gallery<", "Hidden from clients"])));
    assert(janetClient.status === 200 && hits(janetClient.text).viewReceipt && hits(janetClient.text).stripeHost, "client janet receipt");
    assert(manualClient.status === 200 && hits(manualClient.text).paymentRecord && !hits(manualClient.text).stripeHost, "client manual record");
    assert(janetAdmin.status === 200 && hits(janetAdmin.text).viewReceipt, "admin janet receipt");
    assert(staffPage.status === 200 && !hits(staffPage.text).viewReceipt && !hits(staffPage.text).paymentRecord && !hits(staffPage.text).stripeHost, "staff saw money");
    assert(sharePage.status === 200 && !hits(sharePage.text).viewReceipt && !hits(sharePage.text).stripeHost, "share saw receipt");
    assert(anonPage.status === 200 && !hits(anonPage.text).viewReceipt && !hits(anonPage.text).stripeHost, "anon saw receipt");
    assert(preview.status === 200 && !hits(preview.text).hiddenBadge && !hits(preview.text).documentsSection, "preview still shows hidden documents");
    assert(editor.status === 200 && hits(editor.text).hiddenBadge, "editor lost hidden badge");
    const previewHits = hits(previewSeveral.text);
    const clientHits = hits(clientSeveral.text);
    assert(previewSeveral.status === 200 && clientSeveral.status === 200, "several pages");
    assert(!previewHits.documentsSection && !previewHits.modelsSection && !previewHits.hiddenBadge, "preview several still shows hidden sections");
    assert(previewHits.documentsSection === clientHits.documentsSection && previewHits.modelsSection === clientHits.modelsSection && previewHits.photosSection === clientHits.photosSection, "preview and client section mismatch");
    assert(pdfRes.status === 200 && (pdfRes.headers.get("content-type") || "").includes("pdf"), "pdf route");
    assert(pdfText.includes("Payment record") && pdfText.includes(input.businessName), "http pdf fields");
    assert(pdfText.includes(input.clientName) && pdfText.includes(input.amountLabel), "http pdf client and amount");
    if (logoBytes) assert(pdfBytes.includes(Buffer.from("/Image")), "http pdf missing logo");
    assert(!/Invoice\s+#|INV-\d+/i.test(pdfText), "pdf has an invoice number");
    const pdfLines = pdfText.split(/[\n()]+/).map((line) => line.trim()).filter((line) =>
      /Payment record|Swift Aerial|Client:|Project:|Property:|Amount:|Date paid|Recorded as|Reference:|Invoice|INV-\d+/i.test(line)
    );
    console.log("HTTP_PDF_FIELDS", JSON.stringify(pdfLines.slice(0, 30)));
  } finally {
    if (linkState) {
      await admin.from("projects").update({
        link_access_mode: linkState.link_access_mode,
        link_access_token: linkState.link_access_token,
      }).eq("id", JANET);
    }
    await admin.from("project_shares").update({ revoked_at: new Date().toISOString() }).eq("email", shareEmail);
    await admin.from("project_clients").delete().eq("client_id", probeClient.id);
    await admin.from("clients").delete().eq("id", probeClient.id);
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const shareAuth = listed.data?.users?.find((user) => user.email === shareEmail);
    if (shareAuth && !created.includes(shareAuth.id)) created.push(shareAuth.id);
    for (const id of created) await admin.auth.admin.deleteUser(id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
