/**
 * Verify billing page data path + invite existing-user cases without guessing.
 * Usage: npx tsx scripts/verify-auth-billing-fixes.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

import { createClient } from "@supabase/supabase-js";
import { getBusinessPortalOrigin } from "../src/lib/portal-url";
import { getSubscriptionState } from "../src/lib/subscription";
import { listActivePlans } from "../src/lib/entitlements";

async function fetchBilling(host: string, email: string, password: string) {
  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: users } = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`missing user ${email}`);
  await raw.auth.admin.updateUserById(user.id, { password, email_confirm: true });

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: signed, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !signed.session) throw error || new Error("no session");

  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const payload = encodeURIComponent(
    JSON.stringify({
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
      expires_at: signed.session.expires_at,
      expires_in: signed.session.expires_in,
      token_type: "bearer",
      user: signed.user,
    })
  );

  const res = await fetch("http://127.0.0.1:3003/billing", {
    headers: { Host: host, Cookie: `${cookieName}=${payload}` },
    redirect: "manual",
  });
  const text = await res.text();
  return { status: res.status, location: res.headers.get("location"), text };
}

async function main() {
  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // --- Redirect targets ---
  const { data: testBiz } = await raw
    .from("businesses")
    .select("slug, custom_domain, plan, subscription_status, trial_ends_at, comped_until, comped_reason")
    .eq("slug", "test")
    .single();
  const portal = getBusinessPortalOrigin({
    slug: testBiz!.slug,
    custom_domain: testBiz!.custom_domain,
  });
  console.log("redirect target (signup/invite):", `${portal}/auth/callback?next=%2Fadmin`);
  console.log(
    "redirect target (password reset):",
    `${portal}/auth/callback?next=%2Fauth%2Fupdate-password`
  );

  // --- Plan select / subscription resilience ---
  const plans = await listActivePlans();
  console.log("active plans:", plans.length, plans.map((p) => p.key).join(","));
  const current = plans.find((p) => p.key === testBiz!.plan);
  console.log("test currentPlan:", current?.name ?? "MISSING — would show plan key fallback");

  for (const label of ["trialing", "comped", "trial_expired", "unknown_status"] as const) {
    const fields =
      label === "trialing"
        ? testBiz!
        : label === "comped"
          ? {
              subscription_status: "comped",
              trial_ends_at: null,
              comped_until: null,
              comped_reason: "beta",
            }
          : label === "trial_expired"
            ? {
                subscription_status: "trial_expired",
                trial_ends_at: "2020-01-01T00:00:00Z",
                comped_until: null,
                comped_reason: null,
              }
            : {
                subscription_status: "weird",
                trial_ends_at: null,
                comped_until: null,
                comped_reason: null,
              };
    const state = getSubscriptionState(fields);
    console.log(`subscription ${label}:`, {
      status: state.status,
      requiresPayment: state.requiresPayment,
      isComped: state.isComped,
    });
  }

  // --- Existing-user inventory ---
  const { data: admins } = await raw
    .from("profiles")
    .select("email, role, business_id")
    .eq("role", "admin");
  console.log(
    "admins with business (refuse-if-invited):",
    (admins || []).map((a) => a.email).join(", ")
  );

  const { data: authUsers } = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const orphans = [];
  for (const u of authUsers.users) {
    const { data: p } = await raw
      .from("profiles")
      .select("business_id, role")
      .eq("id", u.id)
      .maybeSingle();
    if (!p || (p.business_id == null && p.role !== "super_admin")) {
      orphans.push(u.email);
    }
  }
  console.log("orphan auth users (attach-if-invited):", orphans.join(", ") || "(none)");

  // --- HTTP billing: trialing ---
  const pwd = "BillingRepro-Test-1";
  const trial = await fetchBilling("test.shootportal.app", "baxter@actonadu.com", pwd);
  console.log("billing trialing:", trial.status, trial.location);
  if (trial.status !== 200 || /Something went wrong/i.test(trial.text)) {
    console.error("FAIL trialing billing", trial.text.slice(0, 500));
    process.exit(1);
  }
  if (!/Studio/i.test(trial.text) && !/Current plan/i.test(trial.text)) {
    console.error("FAIL plan name missing", trial.text.slice(0, 800));
    process.exit(1);
  }
  console.log("billing trialing OK (contains plan UI)");

  // --- HTTP billing: temporarily trial_expired ---
  const prev = {
    subscription_status: testBiz!.subscription_status,
    trial_ends_at: testBiz!.trial_ends_at,
  };
  await raw
    .from("businesses")
    .update({
      subscription_status: "trial_expired",
      trial_ends_at: "2020-01-01T00:00:00Z",
    })
    .eq("slug", "test");
  try {
    const expired = await fetchBilling("test.shootportal.app", "baxter@actonadu.com", pwd);
    console.log("billing trial_expired:", expired.status);
    if (expired.status !== 200 || /Something went wrong/i.test(expired.text)) {
      console.error("FAIL expired billing", expired.text.slice(0, 500));
      process.exit(1);
    }
    console.log("billing trial_expired OK");
  } finally {
    await raw.from("businesses").update(prev).eq("slug", "test");
  }

  // --- Swift comped (admin on custom domain if set) ---
  const { data: swiftBiz } = await raw
    .from("businesses")
    .select("slug, custom_domain, subscription_status")
    .eq("slug", "swift-aerial-media")
    .single();
  const swiftHost = swiftBiz?.custom_domain || "swift-aerial-media.shootportal.app";
  const swiftAdmin = "jackson@swiftaerialmedia.com";
  const swiftBilling = await fetchBilling(swiftHost, swiftAdmin, pwd);
  console.log("billing swift/comped:", swiftBilling.status, "host", swiftHost);
  if (swiftBilling.status !== 200 || /Something went wrong/i.test(swiftBilling.text)) {
    console.error("FAIL swift billing", swiftBilling.text.slice(0, 500));
    process.exit(1);
  }
  console.log("billing swift OK");

  console.log("ALL CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
