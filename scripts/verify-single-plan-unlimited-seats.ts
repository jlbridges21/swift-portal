/**
 * Single-plan + dormant unlimited seats verification.
 *
 * 1. Confirm Solo/Agency inactive (rows + Stripe mappings kept)
 * 2. Studio admin_seats null (unlimited)
 * 3. Invite 10 staff on Bulk Test biz — none refused
 * 4. Temporarily set Studio admin_seats=2 — next invite refused; restore
 * 5. Staff with every permission still cannot manage staff (API refusals)
 * 6. Referral discount copy for monthly ($5×3) and annual ($15 once)
 *
 * Usage: npx tsx scripts/verify-single-plan-unlimited-seats.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  countBusinessSeatsUsed,
  getBusinessSeatSnapshot,
  inviteStaffMember,
  disableStaffMember,
  updateStaffMember,
} from "../src/lib/staff";
import {
  NEVER_DELEGABLE_PERMISSION_KEYS,
  staffPermissionDefaults,
  STAFF_PERMISSION_META,
} from "../src/lib/staff-permissions";
import {
  formatReferralPlanPriceDisplay,
  loadPartnerProgramSettings,
} from "../src/lib/partner-referral-discount";
import { listPublicPlans } from "../src/lib/entitlements";
import { isOwnerAdmin } from "../src/lib/staff-access";
import type { Profile } from "../src/lib/types";
import type { AppliedReferralDiscount } from "../src/lib/partner-referral-discount.constants";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";
/** Disposable bulk-test business for the 10-staff flood */
const TEST_BIZ = "e11cb6c8-89a7-4e5c-89d6-7be11e57a575";

function loadEnv() {
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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function cleanupEmail(
  admin: ReturnType<typeof createClient>,
  email: string
) {
  const { data: p } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (p?.id) {
    await admin.from("project_staff").delete().eq("user_id", p.id);
    await admin.from("profiles").delete().eq("id", p.id);
    await admin.auth.admin.deleteUser(p.id);
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const stamp = Date.now();

  console.log("\n=== 1. Plan catalog + Solo/Agency subscribers ===");
  const { data: plans } = await admin
    .from("plans")
    .select(
      "key, name, is_active, is_public, price_monthly_cents, price_annual_cents, limits, stripe_product_id, stripe_price_monthly_id, stripe_price_annual_id"
    )
    .order("display_order");
  console.log(JSON.stringify(plans, null, 2));

  const solo = plans?.find((p) => p.key === "solo");
  const agency = plans?.find((p) => p.key === "agency");
  const studio = plans?.find((p) => p.key === "studio");
  assert(solo && solo.is_active === false && solo.is_public === false, "Solo must be inactive+non-public");
  assert(
    agency && agency.is_active === false && agency.is_public === false,
    "Agency must be inactive+non-public"
  );
  assert(studio && studio.is_active === true && studio.is_public === true, "Studio must be active+public");
  assert(
    (studio.limits as { admin_seats?: unknown }).admin_seats == null,
    "Studio admin_seats must be null (unlimited)"
  );
  assert(studio.price_monthly_cents === 2900, "Studio monthly $29");
  assert(solo.stripe_price_monthly_id && agency.stripe_price_monthly_id, "Stripe price ids kept");

  const { data: soloAgencyBiz } = await admin
    .from("businesses")
    .select("id, name, plan, subscription_status")
    .in("plan", ["solo", "agency"]);
  console.log("Businesses on Solo/Agency:", soloAgencyBiz);
  assert((soloAgencyBiz ?? []).length === 0, "expected zero Solo/Agency businesses");

  const { data: soloAgencyPlans } = await admin
    .from("plans")
    .select("id, key")
    .in("key", ["solo", "agency", "studio"]);
  const planIds = (soloAgencyPlans ?? []).map((p) => p.id);
  const { data: priceMaps } = await admin
    .from("plan_stripe_prices")
    .select("mode, billing_interval, stripe_product_id, stripe_price_id, plan_id")
    .in("plan_id", planIds);
  const keyed = (priceMaps ?? []).map((row) => ({
    ...row,
    key: soloAgencyPlans?.find((p) => p.id === row.plan_id)?.key,
  }));
  console.log("plan_stripe_prices (solo/agency/studio):", JSON.stringify(keyed, null, 2));
  assert(keyed.length >= 12, "expected test+live × monthly+annual × 3 plans");

  const publicPlans = await listPublicPlans();
  console.log(
    "Public plans:",
    publicPlans.map((p) => p.key)
  );
  assert(publicPlans.length === 1 && publicPlans[0].key === "studio", "one public plan: Studio");

  console.log("\n=== 2. Unlimited: invite 10 staff ===");
  const { data: testAdmin } = await admin
    .from("profiles")
    .select("id, email")
    .eq("business_id", TEST_BIZ)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  assert(testAdmin, "need admin on test business");
  const actor = { id: testAdmin.id, email: testAdmin.email as string | null };

  const before = await getBusinessSeatSnapshot(TEST_BIZ);
  console.log("Seats before:", before);
  assert(before.limit == null, "test biz must see unlimited Studio seats");

  const invitedEmails: string[] = [];
  for (let i = 0; i < 10; i++) {
    const email = `seat-flood-${stamp}-${i}@example.test`;
    invitedEmails.push(email);
    const result = await inviteStaffMember({
      businessId: TEST_BIZ,
      email,
      fullName: `Flood ${i}`,
      actor,
    });
    assert(result.ok, `invite ${i} refused: ${!result.ok ? result.error : ""}`);
  }
  const afterFlood = await getBusinessSeatSnapshot(TEST_BIZ);
  console.log("After 10 invites:", afterFlood);
  assert(afterFlood.used === before.used + 10, `expected +10 seats used, got ${afterFlood.used - before.used}`);
  console.log(`PASTE count: used=${afterFlood.used} limit=${afterFlood.limit} (10 added, none refused)`);

  console.log("\n=== 3. Temp admin_seats=2 enforcement, then restore ===");
  const { data: studioRow } = await admin
    .from("plans")
    .select("limits")
    .eq("key", "studio")
    .single();
  const originalLimits = { ...(studioRow!.limits as Record<string, unknown>) };
  try {
    await admin
      .from("plans")
      .update({
        limits: { ...originalLimits, admin_seats: 2 },
        updated_at: new Date().toISOString(),
      })
      .eq("key", "studio");
    const capped = await getBusinessSeatSnapshot(TEST_BIZ);
    console.log("Capped state:", capped);
    assert(capped.limit === 2, "limit must be 2");
    const refuse = await inviteStaffMember({
      businessId: TEST_BIZ,
      email: `seat-cap-refuse-${stamp}@example.test`,
      actor,
    });
    console.log("Invite while capped:", refuse);
    assert(!refuse.ok && refuse.code === "seat_limit", "expected seat_limit while capped");
    console.log("PASTE capped refuse:", !refuse.ok ? refuse.error : "");
  } finally {
    await admin
      .from("plans")
      .update({
        limits: { ...originalLimits, admin_seats: null },
        updated_at: new Date().toISOString(),
      })
      .eq("key", "studio");
    const restored = await getBusinessSeatSnapshot(TEST_BIZ);
    console.log("Restored state:", restored);
    assert(restored.limit == null, "must restore unlimited");
    console.log("PASTE restored: limit=null (unlimited)");
  }

  console.log("\n=== 4. Staff cannot manage staff ===");
  const staffEmail = `seat-staff-allperms-${stamp}@example.test`;
  invitedEmails.push(staffEmail);
  const invited = await inviteStaffMember({
    businessId: TEST_BIZ,
    email: staffEmail,
    fullName: "All Perms Staff",
    actor,
  });
  assert(invited.ok && invited.userId, "staff invite for deny test");

  const allPerms: Record<string, boolean> = { ...staffPermissionDefaults() };
  for (const m of STAFF_PERMISSION_META) {
    allPerms[m.key] = true;
  }
  // Never-delegable must be refused when storing
  for (const key of NEVER_DELEGABLE_PERMISSION_KEYS) {
    const refused = await updateStaffMember({
      businessId: TEST_BIZ,
      userId: invited.userId!,
      permissions: { ...allPerms, [key]: true },
      actor,
    });
    console.log(`Store ${key}:`, refused);
    assert(!refused.ok, `must refuse storing ${key}`);
  }
  // Store every delegable permission
  const stored = await updateStaffMember({
    businessId: TEST_BIZ,
    userId: invited.userId!,
    permissions: allPerms,
    actor,
  });
  assert(stored.ok, !stored.ok ? stored.error : "");

  const { data: staffProfile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", invited.userId!)
    .single();
  const profile = staffProfile as unknown as Profile;
  assert(!isOwnerAdmin(profile), "staff is not owner admin");
  assert(
    (NEVER_DELEGABLE_PERMISSION_KEYS as readonly string[]).includes("staff_management"),
    "staff_management must remain never-delegable"
  );

  // HTTP: staff session hitting /api/admin/staff
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: staffEmail,
  });
  assert(!linkErr && linkData.properties?.hashed_token, linkErr?.message || "no magic link");
  const { data: verified, error: vErr } = await userClient.auth.verifyOtp({
    token_hash: linkData.properties!.hashed_token!,
    type: "email",
  });
  assert(!vErr && verified.session, vErr?.message || "verify failed");
  const projectRef = new URL(url).hostname.split(".")[0];
  const cookie = `sb-${projectRef}-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: verified.session!.access_token,
      refresh_token: verified.session!.refresh_token,
      expires_at: verified.session!.expires_at,
      expires_in: verified.session!.expires_in,
      token_type: verified.session!.token_type,
      user: verified.user,
    })
  )}`;
  const base = process.env.VERIFY_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";

  const getStaff = await fetch(`${base}/api/admin/staff`, {
    headers: { Cookie: cookie },
  });
  const getBody = await getStaff.text();
  console.log("PASTE GET /api/admin/staff as staff:", getStaff.status, getBody);

  const postInvite = await fetch(`${base}/api/admin/staff`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "invite",
      email: `should-fail-${stamp}@example.test`,
    }),
  });
  const postBody = await postInvite.text();
  console.log("PASTE POST invite as staff:", postInvite.status, postBody);

  const patchStaff = await fetch(`${base}/api/admin/staff`, {
    method: "PATCH",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: invited.userId,
      permissions: allPerms,
    }),
  });
  const patchBody = await patchStaff.text();
  console.log("PASTE PATCH as staff:", patchStaff.status, patchBody);

  const delStaff = await fetch(
    `${base}/api/admin/staff?userId=${encodeURIComponent(invited.userId!)}`,
    { method: "DELETE", headers: { Cookie: cookie } }
  );
  const delBody = await delStaff.text();
  console.log("PASTE DELETE as staff:", delStaff.status, delBody);

  assert(getStaff.status === 403 || getStaff.status === 401, `GET expected deny, got ${getStaff.status}`);
  assert(postInvite.status === 403 || postInvite.status === 401, `POST expected deny, got ${postInvite.status}`);
  assert(patchStaff.status === 403 || patchStaff.status === 401, `PATCH expected deny, got ${patchStaff.status}`);
  assert(delStaff.status === 403 || delStaff.status === 401, `DELETE expected deny, got ${delStaff.status}`);

  console.log("\n=== 5. Referral discount copy ===");
  const settings = await loadPartnerProgramSettings();
  console.log("partner_program_settings:", {
    amount: settings.referral_discount_amount_cents,
    months: settings.referral_discount_duration_months,
    annualEnabled: settings.referral_discount_annual_enabled,
    annualAmount: settings.referral_discount_annual_amount_cents,
  });
  assert(settings.referral_discount_amount_cents === 500, "$5 monthly");
  assert(settings.referral_discount_duration_months === 3, "×3 months");
  assert(settings.referral_discount_annual_amount_cents === 1500, "$15 annual");

  const monthlyDiscount: AppliedReferralDiscount = {
    eligible: true,
    config: {
      enabled: true,
      amountOffCents: settings.referral_discount_amount_cents,
      durationMonths: settings.referral_discount_duration_months,
      annualEnabled: settings.referral_discount_annual_enabled,
      annualAmountOffCents: settings.referral_discount_annual_amount_cents,
      source: "program",
    },
  };
  const annualDiscount: AppliedReferralDiscount = {
    eligible: true,
    config: {
      enabled: true,
      amountOffCents: settings.referral_discount_amount_cents,
      durationMonths: settings.referral_discount_duration_months,
      annualEnabled: settings.referral_discount_annual_enabled,
      annualAmountOffCents: settings.referral_discount_annual_amount_cents,
      source: "program",
    },
  };
  const monthly = formatReferralPlanPriceDisplay({
    listPriceCents: 2900,
    interval: "monthly",
    discount: monthlyDiscount,
  });
  const annual = formatReferralPlanPriceDisplay({
    listPriceCents: 2400,
    interval: "annual",
    discount: annualDiscount,
  });
  assert(monthly, "monthly display");
  assert(annual, "annual display");
  console.log("PASTE monthly headline:", monthly!.headline);
  console.log("PASTE annual headline:", annual!.headline);
  assert(/\$24\/mo for your first 3 months/.test(monthly!.headline), monthly!.headline);
  assert(/\$15 off the annual bill/.test(annual!.headline), annual!.headline);

  console.log("\n=== cleanup flood staff ===");
  for (const email of invitedEmails) {
    const { data: p } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (p?.id) {
      await disableStaffMember({
        businessId: TEST_BIZ,
        userId: p.id,
        actor,
      }).catch(() => undefined);
    }
    await cleanupEmail(admin, email);
  }
  const finalUsed = await countBusinessSeatsUsed(TEST_BIZ);
  console.log("Test biz seats after cleanup:", finalUsed);

  // Ensure Studio still unlimited after all tests
  const { data: finalStudio } = await admin
    .from("plans")
    .select("limits")
    .eq("key", "studio")
    .single();
  assert(
    (finalStudio?.limits as { admin_seats?: unknown })?.admin_seats == null,
    "Studio must end unlimited"
  );

  console.log("\n✅ verify-single-plan-unlimited-seats PASS");
}

main().catch((err) => {
  console.error("\n❌ verify-single-plan-unlimited-seats FAILED:", err);
  process.exit(1);
});
