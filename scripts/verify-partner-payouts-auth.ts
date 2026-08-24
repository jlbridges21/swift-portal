/**
 * Auth checks for phase-5 partner payout endpoints (curl-style via fetch).
 * Usage: PENTEST_BASE_URL=http://127.0.0.1:3025 npx tsx scripts/verify-partner-payouts-auth.ts
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

const BASE = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3025").replace(/\/$/, "");
const PASSWORD = `AuthChk-${randomBytes(6).toString("hex")}!aA1`;
const SWIFT = "00000000-0000-0000-0000-000000000001";

function projectRef(): string {
  return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
}

function cookieHeader(accessToken: string, refreshToken: string, user: object): string {
  const name = `sb-${projectRef()}-auth-token`;
  const payload = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  });
  return `${name}=${encodeURIComponent(payload)}`;
}

async function main() {
  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const stamp = Date.now().toString(36);
  const adminEmail = `biz-admin-${stamp}@example.test`;
  const partnerEmail = `partner-user-${stamp}@example.test`;

  const { data: adminAuth, error: adminErr } = await raw.auth.admin.createUser({
    email: adminEmail,
    password: PASSWORD,
    email_confirm: true,
  });
  if (adminErr || !adminAuth.user) throw new Error(adminErr?.message || "admin create");
  await raw.from("profiles").upsert({
    id: adminAuth.user.id,
    email: adminEmail,
    role: "admin",
    business_id: SWIFT,
  });

  const { data: partnerAuth, error: partnerErr } = await raw.auth.admin.createUser({
    email: partnerEmail,
    password: PASSWORD,
    email_confirm: true,
  });
  if (partnerErr || !partnerAuth.user) throw new Error(partnerErr?.message || "partner create");
  await raw.from("profiles").upsert({
    id: partnerAuth.user.id,
    email: partnerEmail,
    role: "client",
    business_id: null,
  });

  const { data: partnerRow, error: pIns } = await raw
    .from("partners")
    .insert({
      user_id: partnerAuth.user.id,
      name: `Auth Partner ${stamp}`,
      email: partnerEmail,
      brand_name: `Auth Brand ${stamp}`,
      referral_code: `auth${stamp}`,
      commission_rate_pct: 10,
      status: "active",
      approved_by: adminAuth.user.id,
      approved_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (pIns || !partnerRow) throw new Error(pIns?.message || "partner insert");

  async function sessionFor(email: string) {
    const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    if (error || !data.session) throw new Error(error?.message || "sign-in");
    return cookieHeader(data.session.access_token, data.session.refresh_token, data.user);
  }

  const adminCookie = await sessionFor(adminEmail);
  const partnerCookie = await sessionFor(partnerEmail);

  async function hit(cookie: string, method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Cookie: cookie,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const text = await res.text();
    return { status: res.status, text: text.slice(0, 200) };
  }

  const checks: Array<{ name: string; status: number; expect: number }> = [];

  for (const [label, cookie] of [
    ["business_admin", adminCookie],
    ["partner", partnerCookie],
  ] as const) {
    const list = await hit(cookie, "GET", "/api/platform/partners");
    checks.push({ name: `${label} GET /api/platform/partners`, status: list.status, expect: 403 });

    const payout = await hit(cookie, "POST", `/api/platform/partners/${partnerRow.id}/payouts`, {
      amountCents: 100,
      idempotencyKey: `auth-${label}-${stamp}`,
    });
    checks.push({
      name: `${label} POST .../payouts`,
      status: payout.status,
      expect: 403,
    });

    const adj = await hit(cookie, "POST", `/api/platform/partners/${partnerRow.id}/adjustments`, {
      amountCents: 50,
      note: "should fail",
    });
    checks.push({
      name: `${label} POST .../adjustments`,
      status: adj.status,
      expect: 403,
    });
  }

  // Partner may read own payouts via partner API
  const own = await hit(partnerCookie, "GET", "/api/partner/payouts");
  checks.push({ name: "partner GET /api/partner/payouts", status: own.status, expect: 200 });

  let failed = 0;
  for (const c of checks) {
    const ok = c.status === c.expect;
    console.log(`${ok ? "ok" : "FAIL"} — ${c.name}: HTTP ${c.status} (want ${c.expect})`);
    if (!ok) failed += 1;
  }

  await raw.from("partners").delete().eq("id", partnerRow.id);
  await raw.from("profiles").delete().eq("id", partnerAuth.user.id);
  await raw.from("profiles").delete().eq("id", adminAuth.user.id);
  await raw.auth.admin.deleteUser(partnerAuth.user.id);
  await raw.auth.admin.deleteUser(adminAuth.user.id);

  if (failed) {
    console.error(`\n${failed} auth check(s) failed`);
    process.exit(1);
  }
  console.log("\nPartner payout auth checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
