/**
 * Authenticated non-partner business admin must get 404/403 on all partner DATA routes.
 * Usage: PENTEST_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/verify-non-partner-authenticated-probe.ts
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

const BASE = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const PASSWORD = `NonPartner-${randomBytes(6).toString("hex")}!aA1`;
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

const API_ROUTES = [
  "/api/partner/me",
  "/api/partner/referrals",
  "/api/partner/commissions",
  "/api/partner/payouts",
  "/api/partner/landing",
];

const PAGE_ROUTES = [
  "/partner/dashboard",
  "/partner/referrals",
  "/partner/commissions",
  "/partner/payouts",
  "/partner/landing",
  "/partner/payout-details",
];

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
  const email = `non-partner-admin-${stamp}@example.test`;

  const { data: auth, error: createErr } = await raw.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (createErr || !auth.user) throw new Error(createErr?.message || "create user");

  await raw.from("profiles").upsert({
    id: auth.user.id,
    email,
    role: "admin",
    business_id: SWIFT,
  });

  const { data: session, error: signErr } = await anon.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signErr || !session.session) throw new Error(signErr?.message || "sign-in");

  const cookie = cookieHeader(
    session.session.access_token,
    session.session.refresh_token,
    session.user
  );

  console.log("=== Authenticated business admin (NO partner row) ===");
  console.log(`user: ${email}`);

  let failed = 0;

  for (const path of API_ROUTES) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Cookie: cookie, Accept: "application/json" },
      redirect: "manual",
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* html */
    }
    const ok = res.status === 404 || res.status === 403;
    console.log(`${ok ? "ok" : "FAIL"} ${path} → ${res.status}`, JSON.stringify(body));
    if (!ok) failed += 1;
  }

  for (const path of PAGE_ROUTES) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Cookie: cookie, Accept: "text/html" },
      redirect: "manual",
    });
    const text = await res.text();
    const is404 = res.status === 404 || text.includes("404") || text.toLowerCase().includes("not found");
    const ok = res.status === 404 || (res.status === 200 && is404);
    console.log(
      `${ok ? "ok" : "FAIL"} ${path} → ${res.status}`,
      `[${text.length} chars, looks404=${is404}]`
    );
    if (!ok) failed += 1;
  }

  await raw.from("profiles").delete().eq("id", auth.user.id);
  await raw.auth.admin.deleteUser(auth.user.id);

  if (failed) {
    console.error(`\n${failed} authenticated non-partner probe(s) failed`);
    process.exit(1);
  }

  console.log("\nAuthenticated non-partner probe complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
