/**
 * Auto-approve partner application E2E: public + in-app paths, idempotency, email once.
 * Usage: PENTEST_BASE_URL=http://127.0.0.1:3002 npx tsx scripts/verify-partner-auto-approve.ts
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  submitPartnerApplication,
  submitAuthenticatedPartnerApplication,
} from "../src/lib/partners";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

async function main() {
  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const stamp = Date.now().toString(36);
  const pw = `AutoAppr-${randomBytes(4).toString("hex")}!aA1`;

  // —— Public path (no existing profile) ——
  const publicEmail = `auto-public-${stamp}@example.test`;
  const r1 = await submitPartnerApplication({
    name: "Public Partner",
    email: publicEmail,
    brandName: `Public Brand ${stamp}`,
    promotionPlan: "YouTube channel",
  });
  console.log("public apply:", {
    status: r1.partner?.status,
    code: r1.partner?.referral_code,
    appId: r1.applicationId,
    autoApproved: r1.autoApproved,
    inviteSent: r1.inviteSent,
    linked: r1.linkedExistingUser,
    alreadyExisted: r1.alreadyExisted,
  });

  const { data: app1 } = await raw
    .from("partner_applications")
    .select("status")
    .eq("id", r1.applicationId)
    .single();
  console.log("application status:", app1?.status);

  const r1b = await submitPartnerApplication({
    name: "Public Partner",
    email: publicEmail,
    brandName: `Public Brand ${stamp}`,
    promotionPlan: "YouTube channel",
  });
  console.log("public double-submit:", {
    alreadyExisted: r1b.alreadyExisted,
    samePartner: r1b.partner?.id === r1.partner?.id,
    sameCode: r1b.partner?.referral_code === r1.partner?.referral_code,
  });

  const { count: emailCount } = await raw
    .from("partner_email_sends")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", r1.partner!.id)
    .eq("is_test", false);
  console.log("approval emails for public partner:", emailCount);

  // —— In-app path (existing profile / case 6) ——
  const inAppEmail = `auto-inapp-${stamp}@example.test`;
  const { data: auth, error: createErr } = await raw.auth.admin.createUser({
    email: inAppEmail,
    password: pw,
    email_confirm: true,
    user_metadata: { full_name: "InApp Partner" },
  });
  if (createErr || !auth.user) throw new Error(createErr?.message || "create user");
  await raw.from("profiles").upsert({
    id: auth.user.id,
    email: inAppEmail,
    full_name: "InApp Partner",
    role: "admin",
    business_id: "00000000-0000-0000-0000-000000000001",
  });

  const r2 = await submitAuthenticatedPartnerApplication(auth.user.id, inAppEmail, {
    name: "InApp Partner",
    email: inAppEmail,
    brandName: `InApp Brand ${stamp}`,
    promotionPlan: "Newsletter",
  });
  console.log("in-app apply:", {
    status: r2.partner?.status,
    code: r2.partner?.referral_code,
    autoApproved: r2.autoApproved,
    linked: r2.linkedExistingUser,
    inviteSent: r2.inviteSent,
    userId: r2.partner?.user_id,
    sameUser: r2.partner?.user_id === auth.user.id,
  });

  const r2b = await submitAuthenticatedPartnerApplication(auth.user.id, inAppEmail, {
    name: "InApp Partner",
    email: inAppEmail,
    brandName: `InApp Brand ${stamp}`,
    promotionPlan: "Newsletter",
  });
  console.log("in-app double-submit:", {
    alreadyExisted: r2b.alreadyExisted,
    samePartner: r2b.partner?.id === r2.partner?.id,
  });

  const { count: emailCount2 } = await raw
    .from("partner_email_sends")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", r2.partner!.id)
    .eq("is_test", false);
  console.log("approval emails for in-app partner:", emailCount2);

  // Cleanup
  await raw.from("partner_email_sends").delete().eq("partner_id", r1.partner!.id);
  await raw.from("partner_email_sends").delete().eq("partner_id", r2.partner!.id);
  await raw.from("partners").delete().eq("id", r1.partner!.id);
  await raw.from("partners").delete().eq("id", r2.partner!.id);
  if (r1.applicationId) await raw.from("partner_applications").delete().eq("id", r1.applicationId);
  if (r2.applicationId) await raw.from("partner_applications").delete().eq("id", r2.applicationId);
  await raw.from("profiles").delete().eq("id", auth.user.id);
  await raw.auth.admin.deleteUser(auth.user.id);

  // Cleanup invite auth user from public path if created
  const { data: list } = await raw.auth.admin.listUsers({ page: 1, perPage: 200 });
  const invited = list?.users?.find((u) => u.email === publicEmail);
  if (invited) {
    await raw.from("profiles").delete().eq("id", invited.id);
    await raw.auth.admin.deleteUser(invited.id);
  }

  console.log("\nAuto-approve verification complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
