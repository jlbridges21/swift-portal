/**
 * Swift-only receipt proofs. Creates test-mode charges, prints rows, refunds,
 * and deletes the probe payments. Does not email real client addresses.
 *
 * Usage: VERIFY_BASE_URL=http://localhost:3000 npx tsx scripts/verify-payment-receipts.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import { resolveStripeReceipt } from "../src/lib/stripe-receipt";
import { sendPaymentReceiptEmails } from "../src/lib/stripe-receipt-email";
import { sendBrandedEmail, getConfiguredFromEmail } from "../src/lib/email";
import { handlePaymentSuccess } from "../src/lib/stripe-payments";
import { getAppSettings } from "../src/lib/app-settings";
import { getPlatformApexHostname } from "../src/lib/portal-url";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const ROOT = process.env.VERIFY_BASE_URL || "http://localhost:3000";
const RECEIPT_PROJECT = "1345a0de-adb1-4795-a981-e6014b3cf42e";
const NO_RECEIPT_PROJECT = "275af875-f429-40ae-8186-e09f9f9728d8";

function loadEnv() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
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

function receiptHits(text: string) {
  return {
    viewReceipt: text.includes("View receipt"),
    stripeReceiptHost: /pay\.stripe\.com|receipt\.stripe\.com/.test(text),
    cardEnding: text.includes("Card ending"),
  };
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  assert(url && serviceKey && anonKey && stripeKey, "missing env");
  assert(stripeKey.startsWith("sk_test_"), "refusing non-test Stripe key");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-05-27.dahlia" });

  const { data: connectRows } = await admin
    .from("business_integrations")
    .select("business_id, stripe_account_id, stripe_account_status, stripe_charges_enabled")
    .eq("stripe_account_status", "active")
    .eq("stripe_charges_enabled", true);
  const connect = (connectRows ?? []).find((row) => row.business_id !== SWIFT && row.stripe_account_id);
  assert(connect?.stripe_account_id, "no active connected account for the connect proof");

  const { data: clientRow } = await admin
    .from("clients")
    .select("id")
    .eq("business_id", SWIFT)
    .limit(1)
    .maybeSingle();
  assert(clientRow?.id, "swift client missing");

  const platformIntent = await stripe.paymentIntents.create({
    amount: 50,
    currency: "usd",
    payment_method: "pm_card_visa",
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    description: "ShootPortal platform receipt probe",
  });
  const connectIntent = await stripe.paymentIntents.create(
    {
      amount: 50,
      currency: "usd",
      payment_method: "pm_card_visa",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      description: "ShootPortal connect receipt probe",
    },
    { stripeAccount: connect.stripe_account_id }
  );

  const platformReceipt = await resolveStripeReceipt({ paymentIntentId: platformIntent.id });
  const connectReceipt = await resolveStripeReceipt({
    paymentIntentId: connectIntent.id,
    stripeAccountId: connect.stripe_account_id,
  });
  assert(platformReceipt.receiptUrl, "platform charge has no receipt_url");
  assert(connectReceipt.receiptUrl, "connect charge has no receipt_url");

  const due = new Date().toISOString().slice(0, 10);
  const { data: platformPayment, error: platformInsertError } = await admin
    .from("payments")
    .insert({
      business_id: SWIFT,
      project_id: RECEIPT_PROJECT,
      client_id: clientRow.id,
      amount: 50,
      description: "Platform receipt probe",
      due_date: due,
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: platformIntent.id,
      stripe_account_id: null,
      stripe_receipt_url: platformReceipt.receiptUrl,
      card_last4: platformReceipt.cardLast4,
    })
    .select("id, business_id, amount, status, stripe_payment_intent_id, stripe_account_id, stripe_receipt_url, card_last4")
    .single();
  if (platformInsertError || !platformPayment) throw new Error(platformInsertError?.message || "platform insert failed");

  const { data: connectPayment, error: connectInsertError } = await admin
    .from("payments")
    .insert({
      business_id: SWIFT,
      project_id: RECEIPT_PROJECT,
      client_id: clientRow.id,
      amount: 50,
      description: "Connect receipt probe",
      due_date: due,
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: connectIntent.id,
      stripe_account_id: connect.stripe_account_id,
      stripe_receipt_url: connectReceipt.receiptUrl,
      card_last4: connectReceipt.cardLast4,
    })
    .select("id, business_id, amount, status, stripe_payment_intent_id, stripe_account_id, stripe_receipt_url, card_last4")
    .single();
  if (connectInsertError || !connectPayment) throw new Error(connectInsertError?.message || "connect insert failed");

  console.log("PLATFORM_ROW", JSON.stringify(platformPayment));
  console.log("CONNECT_ROW", JSON.stringify({
    ...connectPayment,
    stripe_account_id: `${connect.stripe_account_id.slice(0, 8)}…`,
    stripe_receipt_url: connectPayment.stripe_receipt_url,
  }));

  const platformCharge = platformIntent.latest_charge;
  const chargeId = typeof platformCharge === "string" ? platformCharge : platformCharge?.id;
  const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null;
  const account = await stripe.accounts.retrieve();
  console.log("STRIPE_OWN_EMAIL", JSON.stringify({
    paymentIntentReceiptEmail: platformIntent.receipt_email,
    chargeReceiptEmail: charge?.receipt_email ?? null,
    accountSettingsKeys: account.settings ? Object.keys(account.settings) : [],
    note: "Dashboard “Successful payments” is per account and is not a field on Account.settings. This code never sets receipt_email.",
  }));

  await stripe.refunds.create({ payment_intent: platformIntent.id });
  await stripe.refunds.create({ payment_intent: connectIntent.id }, { stripeAccount: connect.stripe_account_id });

  const stamp = Date.now();
  const clientEmail = `receipt-client-${stamp}@example.test`;
  const staffEmail = `receipt-staff-${stamp}@example.test`;
  const shareEmail = `receipt-share-${stamp}@example.test`;
  const password = `Receipt-Probe-${stamp}!Aa`;
  const createdUsers: string[] = [];

  const clientUser = await admin.auth.admin.createUser({ email: clientEmail, password, email_confirm: true });
  const staffUser = await admin.auth.admin.createUser({ email: staffEmail, password, email_confirm: true });
  if (!clientUser.data.user || !staffUser.data.user) throw new Error("probe users failed");
  createdUsers.push(clientUser.data.user.id, staffUser.data.user.id);

  const { data: probeClient, error: probeClientError } = await admin
    .from("clients")
    .insert({ business_id: SWIFT, name: "Receipt probe", email: clientEmail })
    .select("id")
    .single();
  if (probeClientError || !probeClient) throw new Error(probeClientError?.message || "client insert failed");

  const { error: linkError } = await admin.from("project_clients").insert({
    business_id: SWIFT,
    project_id: RECEIPT_PROJECT,
    client_id: probeClient.id,
  });
  if (linkError) throw new Error(linkError.message);
  const { error: noReceiptLinkError } = await admin.from("project_clients").insert({
    business_id: SWIFT,
    project_id: NO_RECEIPT_PROJECT,
    client_id: probeClient.id,
  });
  if (noReceiptLinkError) throw new Error(noReceiptLinkError.message);

  const { error: clientProfileError } = await admin.from("profiles").update({
    role: "client",
    business_id: SWIFT,
    client_id: probeClient.id,
    full_name: "Receipt probe client",
  }).eq("id", clientUser.data.user.id);
  if (clientProfileError) throw new Error(clientProfileError.message);

  const { error: staffProfileError } = await admin.from("profiles").update({
    role: "staff",
    business_id: SWIFT,
    client_id: null,
    full_name: "Receipt probe staff",
    staff_permissions: { v: 1, "area.projects": true, "projects.view_all": true },
  }).eq("id", staffUser.data.user.id);
  if (staffProfileError) throw new Error(staffProfileError.message);

  const { data: linkState } = await admin
    .from("projects")
    .select("link_access_mode, link_access_token")
    .eq("id", RECEIPT_PROJECT)
    .single();

  const anonToken = `receipt-probe-${stamp}`;
  try {
    const clientCookie = await signIn(url, anonKey, clientEmail, password);
    const staffCookie = await signIn(url, anonKey, staffEmail, password);
    const clientPage = await html(`/b/swift-aerial-media/dashboard/projects/${RECEIPT_PROJECT}`, clientCookie);
    const missingPage = await html(`/b/swift-aerial-media/dashboard/projects/${NO_RECEIPT_PROJECT}`, clientCookie);
    const staffPage = await html(`/b/swift-aerial-media/admin/projects/${RECEIPT_PROJECT}`, staffCookie);

    const { addProjectShare, buildShareMagicLinkForProject, resolveShareAccessWindow } =
      await import("../src/lib/project-shares");
    const accessFields = resolveShareAccessWindow("30days");
    const added = await addProjectShare({
      businessId: SWIFT,
      projectId: RECEIPT_PROJECT,
      email: shareEmail,
      invitedBy: SWIFT_ADMIN,
      notify: false,
      projectName: "Receipt probe",
      inviterName: "Admin",
      expiryPreset: "30days",
    });
    const magic = await buildShareMagicLinkForProject({
      businessId: SWIFT,
      projectId: RECEIPT_PROJECT,
      email: shareEmail,
      shareId: added.share.id,
      accessFields,
    });
    const token = new URL(magic).searchParams.get("token") || "";
    const form = new URLSearchParams();
    form.set("token", token);
    const exchange = await fetch(`${ROOT}/b/swift-aerial-media/auth/share/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      redirect: "manual",
    });
    const setCookies = exchange.headers.getSetCookie?.() ?? [];
    const shareCookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    const shareLocation = exchange.headers.get("location") || "";
    const sharePathname = shareLocation.startsWith("http") ? new URL(shareLocation).pathname : shareLocation;
    const sharePath = sharePathname.startsWith("/b/")
      ? sharePathname
      : `/b/swift-aerial-media${sharePathname.startsWith("/") ? sharePathname : `/${sharePathname}`}`;
    const sharePage = await html(sharePath, `${shareCookie}; sp_path_tenant=swift-aerial-media`);

    await admin.from("projects").update({
      link_access_mode: "anyone_with_link",
      link_access_token: anonToken,
    }).eq("id", RECEIPT_PROJECT);
    const anonPage = await html(`/b/swift-aerial-media/view/${anonToken}`, "");

    console.log("HTML_CLIENT", clientPage.status, JSON.stringify(receiptHits(clientPage.text)));
    console.log("HTML_NO_RECEIPT", missingPage.status, JSON.stringify(receiptHits(missingPage.text)));
    console.log("HTML_STAFF", staffPage.status, JSON.stringify(receiptHits(staffPage.text)));
    console.log("HTML_SHARE", exchange.status, sharePage.status, JSON.stringify(receiptHits(sharePage.text)));
    console.log("HTML_ANON", anonPage.status, JSON.stringify(receiptHits(anonPage.text)));

    const clientHits = receiptHits(clientPage.text);
    assert(clientPage.status === 200 && clientHits.viewReceipt && clientHits.stripeReceiptHost, "assigned client receipt missing");
    const none = receiptHits(missingPage.text);
    assert(missingPage.status === 200 && !none.viewReceipt && !none.stripeReceiptHost, "missing receipt still rendered a link");
    const staffHits = receiptHits(staffPage.text);
    assert(staffPage.status === 200 && !staffHits.viewReceipt && !staffHits.stripeReceiptHost && !staffHits.cardEnding, "staff without money.view saw a receipt");
    const shareHits = receiptHits(sharePage.text);
    assert(sharePage.status === 200, `shared viewer page status ${sharePage.status}`);
    assert(!shareHits.viewReceipt && !shareHits.stripeReceiptHost, "shared viewer saw a receipt");
    const anonHits = receiptHits(anonPage.text);
    assert(anonPage.status === 200 && !anonHits.viewReceipt && !anonHits.stripeReceiptHost, "anonymous visitor saw a receipt");
  } finally {
    if (linkState) {
      await admin.from("projects").update({
        link_access_mode: linkState.link_access_mode,
        link_access_token: linkState.link_access_token,
      }).eq("id", RECEIPT_PROJECT);
    }
    await admin.from("project_shares").update({ revoked_at: new Date().toISOString() }).eq("email", shareEmail);
    await admin.from("project_clients").delete().eq("client_id", probeClient.id);
    await admin.from("clients").delete().eq("id", probeClient.id);
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  }

  const clientTo = `receipt-mail-client-${stamp}@example.test`;
  const businessTo = `receipt-mail-business-${stamp}@example.test`;
  try {
  const { data: sample } = await admin.from("payments").select("*").eq("id", platformPayment.id).maybeSingle();
  assert(sample?.id, "probe payment missing before email proof");

  const before = await admin
    .from("email_events")
    .select("id", { count: "exact", head: true })
    .eq("email_type", "payment_receipt")
    .filter("metadata->>paymentId", "eq", sample.id);

  const replay = await handlePaymentSuccess({
    payment: sample,
    receiptUrl: sample.stripe_receipt_url,
    cardLast4: sample.card_last4,
    source: "webhook",
  });
  const after = await admin
    .from("email_events")
    .select("id", { count: "exact", head: true })
    .eq("email_type", "payment_receipt")
    .filter("metadata->>paymentId", "eq", sample.id);
  console.log("WEBHOOK_REPLAY", JSON.stringify({
    alreadyPaid: replay.alreadyPaid,
    eventsBefore: before.count ?? 0,
    eventsAfter: after.count ?? 0,
  }));
  assert(replay.alreadyPaid, "paid payment was not treated as already paid");
  assert((before.count ?? 0) === (after.count ?? 0), "webhook replay inserted receipt emails");

  const settings = await getAppSettings(SWIFT);
  const from = await getConfiguredFromEmail(SWIFT);
  const apex = getPlatformApexHostname();
  const sends: { to: string; subject: string; ctaUrl: string; sent: boolean; error?: string }[] = [];
  const first = await sendPaymentReceiptEmails(
    {
      businessId: SWIFT,
      payment: sample,
      amountLabel: "$1.00",
      projectLabel: "Receipt probe",
      receiptUrl: sample.stripe_receipt_url,
      cardLast4: sample.card_last4,
      sendClient: settings.workflow.payments.autoSendReceipt !== false,
    },
    {
      clientEmails: [clientTo],
      businessEmails: [businessTo],
      send: async (mail) => {
        const result = await sendBrandedEmail({
          businessId: SWIFT,
          to: mail.to,
          subject: mail.subject,
          title: mail.title,
          body: mail.body,
          ctaLabel: mail.ctaLabel,
          ctaUrl: mail.ctaUrl,
          emailType: "payment_receipt",
          analytics: { projectId: sample.project_id, emailType: "payment_receipt" },
        });
        sends.push({
          to: mail.to,
          subject: mail.subject,
          ctaUrl: mail.ctaUrl,
          sent: Boolean(result.sent),
          error: result.error,
        });
        const host = new URL(mail.ctaUrl).hostname;
        assert(host !== apex, `receipt link used apex ${apex}`);
        assert(!mail.subject.toLowerCase().includes("invoice") && !mail.body.toLowerCase().includes("invoice"), "receipt email says invoice");
      },
    }
  );
  const second = await sendPaymentReceiptEmails(
    {
      businessId: SWIFT,
      payment: sample,
      amountLabel: "$1.00",
      projectLabel: "Receipt probe",
      receiptUrl: sample.stripe_receipt_url,
      cardLast4: sample.card_last4,
      sendClient: settings.workflow.payments.autoSendReceipt !== false,
    },
    {
      clientEmails: [clientTo],
      businessEmails: [businessTo],
      send: async () => {
        throw new Error("replay must not send");
      },
    }
  );

  const { data: tracking } = await admin
    .from("email_events")
    .select("id, recipient, email_type, event_type, metadata, created_at")
    .eq("email_type", "payment_receipt")
    .in("recipient", [clientTo, businessTo])
    .order("created_at", { ascending: true });
  console.log("EMAIL_SETTINGS", JSON.stringify({
    autoSendReceipt: settings.workflow.payments.autoSendReceipt,
    paymentReceivedEmail: settings.notifications.payment_received?.email ?? null,
    from,
  }));
  console.log("EMAIL_SENDS", JSON.stringify(sends));
  console.log("EMAIL_FIRST", JSON.stringify({ sent: first.sent.map((m) => m.to), skipped: first.skipped }));
  console.log("EMAIL_REPLAY", JSON.stringify({ sent: second.sent.map((m) => m.to), skipped: second.skipped }));
  console.log("EMAIL_TRACKING", JSON.stringify(tracking));
  assert(second.sent.length === 0, "replay sent again");
  const businessEmailOn = settings.notifications.payment_received?.email !== false;
  const clientEmailOn = settings.workflow.payments.autoSendReceipt !== false;
  if (clientEmailOn) {
    assert(first.sent.some((m) => m.to === clientTo), "client receipt was not sent");
    assert(second.skipped.includes(clientTo), "client replay was not skipped");
  }
  if (businessEmailOn) {
    assert(first.sent.some((m) => m.to === businessTo), "business receipt was not sent");
    assert(second.skipped.includes(businessTo), "business replay was not skipped");
  }

  } finally {
    await admin.from("email_events").delete().eq("email_type", "payment_receipt").in("recipient", [clientTo, businessTo]);
    await admin.from("payments").delete().in("id", [platformPayment.id, connectPayment.id]);
  }
  const { count: leftover } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .in("id", [platformPayment.id, connectPayment.id]);
  assert((leftover ?? 0) === 0, "probe payments were not deleted");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
