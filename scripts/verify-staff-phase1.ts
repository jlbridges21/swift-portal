/**
 * Phase 1 staff verification against Swift Aerial Media.
 * Usage: npx tsx scripts/verify-staff-phase1.ts
 *
 * Studio admin_seats is unlimited (dormant). This script temporarily sets
 * admin_seats=2 to exercise the still-wired seat enforcement path, then restores.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getBusinessSeatSnapshot,
  countBusinessSeatsUsed,
  inviteStaffMember,
  disableStaffMember,
  staffInviteRedirectTo,
} from "../src/lib/staff";
import { getBusinessPortalOrigin } from "../src/lib/portal-url";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_BIZ = "25a153f2-c8ae-4a15-9009-1ea7e891e940";

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
  const newEmail = `staff-phase1-new-${stamp}@example.test`;
  const existingEmail = `staff-phase1-existing-${stamp}@example.test`;
  const otherEmail = `staff-phase1-otherbiz-${stamp}@example.test`;
  const overEmail = `staff-phase1-over-${stamp}@example.test`;

  const actor = { id: "", email: "" as string | null };
  const { data: swiftAdmin } = await admin
    .from("profiles")
    .select("id, email")
    .eq("business_id", SWIFT_ID)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  assert(swiftAdmin, "need a Swift admin actor");
  actor.id = swiftAdmin.id;
  actor.email = swiftAdmin.email;

  const { data: biz } = await admin
    .from("businesses")
    .select(
      "id, slug, name, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured, plan"
    )
    .eq("id", SWIFT_ID)
    .single();
  assert(biz, "Swift business missing");

  const portal = getBusinessPortalOrigin({
    slug: biz.slug,
    custom_domain: biz.custom_domain,
    custom_domain_status: biz.custom_domain_status,
    custom_domain_vercel_verified: biz.custom_domain_vercel_verified,
    custom_domain_misconfigured: biz.custom_domain_misconfigured,
  });
  const redirect = staffInviteRedirectTo(portal);
  console.log("13. Invite redirectTo:", redirect);
  assert(redirect.includes("return_to="), "must include return_to");
  assert(
    redirect.includes(encodeURIComponent(portal)) ||
      decodeURIComponent(redirect).includes(portal),
    "return_to must be business portal origin"
  );

  const { data: planRow } = await admin
    .from("plans")
    .select("id, limits")
    .eq("key", "studio")
    .single();
  assert(planRow, "studio plan missing");
  const originalLimits = { ...(planRow.limits as Record<string, unknown>) };
  const usedBeforeCap = await countBusinessSeatsUsed(SWIFT_ID);
  // Temporarily cap seats so enforcement still fires (Studio is unlimited in prod).
  const tempLimit = usedBeforeCap + 1;
  const { error: capErr } = await admin
    .from("plans")
    .update({
      limits: { ...originalLimits, admin_seats: tempLimit },
      updated_at: new Date().toISOString(),
    })
    .eq("key", "studio");
  assert(!capErr, capErr?.message || "failed to set temp seat cap");
  console.log(`   Temp seat cap for test: admin_seats=${tempLimit} (was ${originalLimits.admin_seats ?? "unlimited"})`);

  const seatsStart = await getBusinessSeatSnapshot(SWIFT_ID);
  console.log("9. Seats start (admins count as seats):", seatsStart);
  assert(seatsStart.limit === tempLimit, "temp cap should apply");
  const { count: adminCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("business_id", SWIFT_ID)
    .eq("role", "admin")
    .is("disabled_at", null);
  console.log(
    `   Owner/admins counted: ${adminCount} admin profile(s) toward admin_seats (limit ${seatsStart.limit}). Staff also count.`
  );

  try {
  // 7. Other business staff refuse (no seat consumed)
  const { data: otherUser, error: otherErr } = await admin.auth.admin.createUser({
    email: otherEmail,
    email_confirm: true,
    password: "TempStaffPass1!",
    user_metadata: { role: "staff", business_id: OTHER_BIZ, full_name: "Other Biz" },
  });
  assert(!otherErr && otherUser.user, otherErr?.message || "other create failed");
  await admin.from("profiles").upsert({
    id: otherUser.user!.id,
    email: otherEmail,
    role: "staff",
    business_id: OTHER_BIZ,
    full_name: "Other Biz",
    staff_permissions: {},
  });
  const refuseOther = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: otherEmail,
    actor,
  });
  console.log("7. Refuse other-business staff:", refuseOther);
  assert(!refuseOther.ok, "should refuse");
  assert(
    !refuseOther.ok && /one business|already staffed/i.test(refuseOther.error),
    refuseOther.ok ? "" : refuseOther.error
  );

  // 6. Existing confirmed user — attach (uses the free seat)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: existingEmail,
    email_confirm: true,
    password: "TempStaffPass1!",
    user_metadata: { role: "client", full_name: "Existing User" },
  });
  assert(!createErr && created.user, createErr?.message || "createUser failed");
  await admin.from("profiles").upsert({
    id: created.user!.id,
    email: existingEmail,
    role: "client",
    business_id: null,
    full_name: "Existing User",
  });
  const beforeUsers = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.filter(
    (u) => u.email?.toLowerCase() === existingEmail
  ).length;

  const inviteExisting = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: existingEmail,
    fullName: "Existing User Staff",
    actor,
  });
  console.log("6. Invite existing account:", inviteExisting);
  assert(inviteExisting.ok, !inviteExisting.ok ? inviteExisting.error : "");
  assert(inviteExisting.ok && inviteExisting.attachedExisting, "attach existing");
  const afterUsers = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.filter(
    (u) => u.email?.toLowerCase() === existingEmail
  ).length;
  assert(beforeUsers === afterUsers, "no duplicate auth user");
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, role, business_id")
    .eq("id", created.user!.id)
    .single();
  console.log("   Attached profile:", existingProfile);
  assert(existingProfile?.role === "staff" && existingProfile.business_id === SWIFT_ID);

  // 8. Seat limit — one more must refuse
  const over = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: overEmail,
    actor,
  });
  console.log("8. Seat limit refuse:", over);
  assert(!over.ok && over.code === "seat_limit", "expected seat_limit");
  console.log("   Seat-limit prompt:", !over.ok ? over.error : "");
  assert(!over.ok && /Studio|admin seat|seat limit/i.test(over.error));

  // Free a seat, then invite brand-new
  const disableExisting = await disableStaffMember({
    businessId: SWIFT_ID,
    userId: created.user!.id,
    actor,
  });
  assert(disableExisting.ok, "disable existing failed");
  const seatsAfterDisable = await getBusinessSeatSnapshot(SWIFT_ID);
  console.log("10. After disable existing, seats:", seatsAfterDisable);
  assert(
    seatsAfterDisable.used === seatsStart.used,
    "disabling staff releases seat back to starting admin-only count"
  );

  // 5. Brand-new invite
  const inviteNew = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: newEmail,
    fullName: "Phase1 New Staff",
    actor,
  });
  console.log("5. Invite brand-new:", inviteNew);
  assert(inviteNew.ok, !inviteNew.ok ? inviteNew.error : "");
  const { data: newProfile } = await admin
    .from("profiles")
    .select("id, email, role, business_id, staff_permissions, disabled_at")
    .eq("email", newEmail)
    .maybeSingle();
  console.log("   New profile row:", newProfile);
  assert(newProfile?.role === "staff" && newProfile.business_id === SWIFT_ID);

  // 11. Staff lands on /staff via session cookie (not portal_unavailable, not /admin)
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: newEmail,
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
  const staffPage = await fetch(`${base}/staff`, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  const staffHtml = await staffPage.text();
  console.log("11. GET /staff →", staffPage.status);
  assert(staffPage.status === 200, `expected 200, got ${staffPage.status}`);
  assert(/No projects assigned|staff account is ready/i.test(staffHtml), "expected empty staff state copy");
  assert(!/portal is unavailable/i.test(staffHtml), "must not show portal unavailable");
  const adminPage = await fetch(`${base}/admin`, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  console.log("11b. GET /admin as staff →", adminPage.status, adminPage.headers.get("location"));
  assert(
    adminPage.status === 307 || adminPage.status === 302 || adminPage.status === 303,
    "staff must be redirected away from /admin"
  );
  const loc = adminPage.headers.get("location") || "";
  assert(/\/staff/.test(loc), `admin redirect should go to /staff, got ${loc}`);

  // Re-invite same staff — no duplicate
  const reinvite = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: newEmail,
    actor,
  });
  console.log("Re-invite same staff:", reinvite);
  assert(reinvite.ok && reinvite.reinvited, "reinvite should not duplicate");

  // Cleanup test users
  for (const e of [newEmail, existingEmail, otherEmail, overEmail]) {
    await cleanupEmail(admin, e);
  }
  } finally {
    const { error: restoreErr } = await admin
      .from("plans")
      .update({
        limits: { ...originalLimits, admin_seats: null },
        updated_at: new Date().toISOString(),
      })
      .eq("key", "studio");
    if (restoreErr) {
      console.error("FAILED to restore Studio admin_seats=unlimited:", restoreErr.message);
    } else {
      console.log("   Restored Studio admin_seats=unlimited");
    }
  }

  console.log("\nverify-staff-phase1: PASS");
  console.log(
    "Downgrade policy: when used > limit after a plan change, existing staff are kept; only new invites are refused until usage ≤ limit."
  );
  console.log(
    "Seat formula: count(profiles where business_id=X AND role IN (admin,staff) AND disabled_at IS NULL)."
  );
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
