/**
 * Verify Partner Program phase 1 foundation.
 * Usage: npx tsx scripts/verify-partners-phase1.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  validateReferralCode,
  suggestReferralCodeFromBrand,
} from "../src/lib/reserved-subdomains";
import {
  submitPartnerApplication,
  approvePartnerApplication,
  updatePartner,
  createPartner,
  listPartnerApplications,
  getPartnerById,
} from "../src/lib/partners";
import { resetPartnerApplicationRateLimitsForTests } from "../src/lib/partner-rate-limit";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const k = m[1].trim();
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(k in process.env)) process.env[k] = v;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  resetPartnerApplicationRateLimitsForTests();

  // 8. Reserved / invalid referral codes
  for (const code of ["pricing", "admin", "www", "partners", "how-it-works"]) {
    const r = validateReferralCode(code);
    assert(!r.ok, `expected reserved rejection for ${code}`);
    console.log(`ok reserved reject: ${code} → ${r.error}`);
  }

  const stamp = Date.now().toString(36);
  const email = `partner-verify-${stamp}@example.test`;

  await submitPartnerApplication({
    name: "Verify Partner",
    email,
    brandName: `Verify Brand ${stamp}`,
    website: "https://example.test",
    audienceSize: "10k",
    promotionPlan: "Newsletter + Instagram",
  });
  // Duplicate pending should soft-succeed
  await submitPartnerApplication({
    name: "Verify Partner",
    email,
    brandName: `Verify Brand ${stamp}`,
  });
  console.log("ok application submit (incl soft-dedupe)");

  const apps = await listPartnerApplications("pending");
  const app = apps.find((a) => a.email === email);
  assert(app, "pending application not found");

  // Find a super_admin actor for audit/approve
  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: sa } = await raw
    .from("profiles")
    .select("id, email")
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  assert(sa?.id, "no super_admin profile for actor");

  const suggested = suggestReferralCodeFromBrand(app.brand_name);
  const code = `${suggested}-${stamp}`.slice(0, 48);
  const approved = await approvePartnerApplication(
    app.id,
    { referralCode: code, commissionRatePct: 25, reviewNote: "verify approve" },
    { id: sa.id, email: sa.email }
  );
  assert(approved.partner.referral_code === code, "referral code mismatch");
  assert(Number(approved.partner.commission_rate_pct) === 25, "rate mismatch");
  console.log("ok approve → partner", approved.partner.id);
  console.log(
    "invite URL (redacted):",
    (approved.inviteUrl || "(none)").replace(/token_hash=[^&]+/i, "token_hash=REDACTED")
  );
  console.log("inviteSent:", approved.inviteSent, "inviteError:", approved.inviteError);

  // Duplicate code rejected
  let dupFailed = false;
  try {
    await createPartner(
      {
        name: "Dup",
        email: `dup-${stamp}@example.test`,
        brandName: "Dup Brand",
        referralCode: code,
      },
      { id: sa.id, email: sa.email }
    );
  } catch (e) {
    dupFailed = true;
    console.log("ok duplicate code rejected:", e instanceof Error ? e.message : e);
  }
  assert(dupFailed, "duplicate code should fail");

  // Update rate + code
  const newCode = `ok-${stamp}`;
  const updated = await updatePartner(
    approved.partner.id,
    { commissionRatePct: 33.5, referralCode: newCode },
    { id: sa.id, email: sa.email }
  );
  assert(updated.referral_code === newCode, "code update failed");
  assert(Number(updated.commission_rate_pct) === 33.5, "rate update failed");
  console.log("ok update code + rate");

  // Suspend
  const suspended = await updatePartner(
    approved.partner.id,
    { status: "suspended" },
    { id: sa.id, email: sa.email }
  );
  assert(suspended.status === "suspended", "suspend failed");
  console.log("ok suspend");

  const reactivated = await updatePartner(
    approved.partner.id,
    { status: "active" },
    { id: sa.id, email: sa.email }
  );
  assert(reactivated.status === "active", "reactivate failed");
  console.log("ok reactivate");

  // Audit rows present
  const { data: audits } = await raw
    .from("platform_audit_log")
    .select("action")
    .in("action", [
      "partner.create",
      "partner.invite",
      "partner.update",
      "partner.application_approve",
    ])
    .eq("target_id", approved.partner.id);
  // application_approve targets application id
  const { data: appAudits } = await raw
    .from("platform_audit_log")
    .select("action")
    .eq("action", "partner.application_approve")
    .eq("target_id", app.id);
  assert((audits?.length ?? 0) + (appAudits?.length ?? 0) >= 2, "missing audit rows");
  console.log("ok audit log entries");

  // Cleanup verification rows (keep schema)
  await raw.from("partners").delete().eq("id", approved.partner.id);
  await raw.from("partner_applications").delete().eq("id", app.id);
  // Also clean any orphan partner from failed dup attempt
  await raw.from("partners").delete().eq("email", `dup-${stamp}@example.test`);
  console.log("ok cleanup");

  const still = await getPartnerById(approved.partner.id);
  assert(!still, "partner should be deleted");
  console.log("\nverify-partners-phase1: ALL CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
