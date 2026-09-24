/**
 * Verify staff invite uses generateLink hashed_token → /auth/confirm
 * (prefetch-safe interstitial), not inviteUserByEmail / action_link.
 *
 * Jackson / Swift test data only.
 *
 * Usage: npx tsx scripts/verify-staff-invite-token-hash.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  disableStaffMember,
  inviteStaffMember,
  staffInviteConfirmLink,
} from "../src/lib/staff";
import { getBusinessPortalOrigin } from "../src/lib/portal-url";
import { authConfirmUrl, getCanonicalAuthConfirmUrl } from "../src/lib/auth-confirm";
import { invitePartnerUser, findProfileIdByEmail } from "../src/lib/partners";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";

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
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  loadEnv();
  const stamp = Date.now();
  const NEW_EMAIL = `staff-invite-new-${stamp}@swift-test.local`;
  const EXISTING_EMAIL = `staff-invite-existing-${stamp}@swift-test.local`;

  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: biz } = await raw
    .from("businesses")
    .select(
      "id, slug, name, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured"
    )
    .eq("id", SWIFT_ID)
    .single();
  assert(biz, "Swift business missing");

  const portalOrigin = getBusinessPortalOrigin({
    slug: biz.slug,
    custom_domain: biz.custom_domain,
    custom_domain_status: biz.custom_domain_status,
    custom_domain_vercel_verified: biz.custom_domain_vercel_verified,
    custom_domain_misconfigured: biz.custom_domain_misconfigured,
  });
  const canonicalConfirm = getCanonicalAuthConfirmUrl();
  console.log("portalOrigin:", portalOrigin);
  console.log("canonicalConfirm:", canonicalConfirm);

  const { data: adminProfile } = await raw
    .from("profiles")
    .select("id, email")
    .eq("business_id", SWIFT_ID)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  assert(adminProfile, "Swift admin profile missing");
  const actor = { id: adminProfile.id, email: adminProfile.email };

  // --- 1. Brand-new email invite ---
  console.log("\n=== 1. Brand-new invite ===");
  const invited = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: NEW_EMAIL,
    fullName: "Invite Token Test",
    actor,
  });
  assert(invited.ok, invited.ok ? "" : invited.error);
  assert(invited.inviteSent, "invite email should send");
  assert(invited.inviteUrl, "inviteUrl required");
  console.log("inviteUrl:", invited.inviteUrl);

  const url = new URL(invited.inviteUrl!);
  assert(url.pathname.includes("/auth/confirm"), "must be /auth/confirm");
  assert(url.searchParams.get("token_hash"), "must have token_hash");
  assert(url.searchParams.get("type") === "invite", "type=invite");
  assert(url.searchParams.get("next") === "/staff", "next=/staff");
  assert(url.searchParams.get("return_to") === portalOrigin, `return_to=${portalOrigin}`);
  assert(
    url.origin === new URL(canonicalConfirm).origin,
    "must use canonical auth host"
  );
  assert(!invited.inviteUrl!.includes("/auth/v1/verify"), "must not use action_link verify URL");
  assert(!invited.inviteUrl!.includes("action_link"), "must not embed action_link");

  const { data: profile } = await raw
    .from("profiles")
    .select("id, email, role, business_id, staff_permissions, full_name")
    .eq("id", invited.userId)
    .single();
  console.log("profile row:", JSON.stringify(profile, null, 2));
  assert(profile?.role === "staff", "role=staff");
  assert(profile?.business_id === SWIFT_ID, "business_id=Swift");
  assert(profile?.staff_permissions != null, "staff_permissions set");

  const { data: authUser } = await raw.auth.admin.getUserById(invited.userId);
  console.log("auth metadata:", authUser.user?.user_metadata);
  assert(authUser.user?.user_metadata?.role === "staff", "metadata.role=staff");
  assert(authUser.user?.user_metadata?.business_id === SWIFT_ID, "metadata.business_id");
  assert(!authUser.user?.email_confirmed_at, "should be unconfirmed until password setup");

  // --- 2. Scanner GET then human verifyOtp ---
  console.log("\n=== 2. Scanner GET then verify OTP ===");
  const getRes = await fetch(invited.inviteUrl!, { method: "GET", redirect: "manual" });
  console.log("scanner GET status:", getRes.status, "location:", getRes.headers.get("location"));
  assert(
    getRes.status === 200 ||
      getRes.status === 307 ||
      getRes.status === 302 ||
      getRes.status === 308 ||
      getRes.status === 0,
    `unexpected GET status ${getRes.status}`
  );

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const tokenHash = url.searchParams.get("token_hash")!;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite",
  });
  console.log("verifyOtp after GET:", {
    userId: otpData.user?.id,
    session: Boolean(otpData.session),
    error: otpErr?.message ?? null,
  });
  assert(!otpErr && otpData.user, `token must survive scanner GET: ${otpErr?.message}`);
  await anon.auth.signOut();

  // --- 3. Re-invite pending staff ---
  console.log("\n=== 3. Re-invite pending ===");
  const pendingEmail = `staff-invite-pending-${stamp}@swift-test.local`;
  const pending = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: pendingEmail,
    fullName: "Pending Reinvite",
    actor,
  });
  assert(pending.ok && pending.inviteSent, pending.ok ? "pending invite failed send" : pending.error);
  const reinvited = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: pendingEmail,
    fullName: "Pending Reinvite",
    actor,
  });
  assert(reinvited.ok, reinvited.ok ? "" : reinvited.error);
  assert(reinvited.reinvited, "should be reinvited");
  assert(reinvited.userId === pending.userId, "no duplicate auth user");
  assert(reinvited.inviteSent && reinvited.inviteUrl, "re-invite should send new link");
  console.log("re-inviteUrl:", reinvited.inviteUrl);
  assert(reinvited.inviteUrl !== pending.inviteUrl, "new token on re-invite");

  // --- 4. Existing confirmed account attach (no duplicate) ---
  console.log("\n=== 4. Existing confirmed profile ===");
  const { data: created } = await raw.auth.admin.createUser({
    email: EXISTING_EMAIL,
    email_confirm: true,
    password: `TmpPass-${stamp}!aA1`,
    user_metadata: { full_name: "Existing User" },
  });
  assert(created.user, "create existing user");
  await raw.from("profiles").upsert({
    id: created.user!.id,
    email: EXISTING_EMAIL,
    role: "client",
    business_id: null,
    full_name: "Existing User",
  });

  const attached = await inviteStaffMember({
    businessId: SWIFT_ID,
    email: EXISTING_EMAIL,
    fullName: "Existing Now Staff",
    actor,
  });
  assert(attached.ok, attached.ok ? "" : attached.error);
  assert(attached.attachedExisting, "attached existing");
  assert(attached.userId === created.user!.id, "same auth id — no duplicate");
  assert(!attached.inviteSent, "confirmed user needs no invite email");
  const { data: attachedProfile } = await raw
    .from("profiles")
    .select("role, business_id")
    .eq("id", created.user!.id)
    .single();
  console.log("attached profile:", attachedProfile);
  assert(attachedProfile?.role === "staff" && attachedProfile.business_id === SWIFT_ID);

  // --- 5. Partner invite still hashed_token ---
  console.log("\n=== 5. Partner invite pattern ===");
  const partnerEmail = `partner-invite-${stamp}@swift-test.local`;
  const referralCode = `INV${stamp.toString(36).slice(-6).toUpperCase()}`;
  const { data: partner, error: partnerErr } = await raw
    .from("partners")
    .insert({
      email: partnerEmail,
      name: "Invite Pattern Partner",
      brand_name: "Test Brand",
      status: "active",
      commission_rate_pct: 10,
      referral_code: referralCode,
    })
    .select("id, email")
    .single();
  if (partnerErr || !partner) {
    console.warn("  skip partner invite (could not insert partner):", partnerErr?.message);
  } else {
    assert(!(await findProfileIdByEmail(partnerEmail)), "no profile yet");
    const pInvite = await invitePartnerUser({
      email: partnerEmail,
      fullName: "Invite Pattern Partner",
      partnerId: partner.id,
    });
    console.log("  partner invite:", {
      inviteSent: pInvite.inviteSent,
      inviteUrl: pInvite.inviteUrl,
      error: pInvite.inviteError,
    });
    assert(pInvite.inviteUrl?.includes("/auth/confirm"), "partner confirm link");
    assert(pInvite.inviteUrl?.includes("token_hash="), "partner token_hash");
    assert(!pInvite.inviteUrl?.includes("/auth/v1/verify"), "partner no action_link");
  }

  // --- 6. Share-style generateLink returns hashed_token (emails use it, not action_link) ---
  console.log("\n=== 6. Share generateLink hashed_token ===");
  const shareEmail = `share-invite-${stamp}@swift-test.local`;
  await raw.auth.admin.createUser({
    email: shareEmail,
    email_confirm: true,
    password: `TmpPass-${stamp}!aA1`,
  });
  const { data: shareLink, error: shareLinkErr } = await raw.auth.admin.generateLink({
    type: "magiclink",
    email: shareEmail,
    options: {
      redirectTo: authConfirmUrl(portalOrigin),
    },
  });
  const shareHash = shareLink?.properties?.hashed_token?.trim();
  console.log("  share-style generateLink:", {
    error: shareLinkErr?.message ?? null,
    hasHashedToken: Boolean(shareHash),
    actionLinkHost: shareLink?.properties?.action_link
      ? new URL(shareLink.properties.action_link).host
      : null,
  });
  assert(shareHash, "generateLink returns hashed_token");
  const safeShare = staffInviteConfirmLink({
    portalOrigin,
    tokenHash: shareHash!,
  });
  assert(safeShare.includes("token_hash="), "share safe link uses token_hash");
  assert(!safeShare.includes("/auth/v1/verify"), "safe link is not action_link");

  // --- Cleanup ---
  console.log("\n=== Cleanup ===");
  const shareUser = (
    await raw.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ).data.users.find((u) => u.email?.toLowerCase() === shareEmail);

  for (const id of [invited.userId, pending.userId, created.user!.id, shareUser?.id].filter(
    Boolean
  ) as string[]) {
    const { data: p } = await raw
      .from("profiles")
      .select("role, business_id")
      .eq("id", id)
      .maybeSingle();
    if (p?.role === "staff" && p.business_id === SWIFT_ID) {
      await disableStaffMember({ businessId: SWIFT_ID, userId: id, actor });
    }
    await raw.from("profiles").delete().eq("id", id);
    await raw.auth.admin.deleteUser(id);
  }
  if (partner) {
    await raw.from("partners").delete().eq("id", partner.id);
    const pid = await findProfileIdByEmail(partnerEmail);
    if (pid) {
      await raw.from("profiles").delete().eq("id", pid);
      await raw.auth.admin.deleteUser(pid);
    }
  }

  console.log("\nALL STAFF INVITE TOKEN_HASH CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
