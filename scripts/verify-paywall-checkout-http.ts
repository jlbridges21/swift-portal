/**
 * Real-HTTP regression: paywalled admin can reach checkout through middleware.
 *
 * Middleware does NOT run when calling route handlers directly — this script
 * must hit a live Next server so the paywall gate is exercised.
 *
 *   npm run test:paywall-checkout-http
 *
 * Optional: PAYWALL_TEST_BASE_URL=http://127.0.0.1:3019 (default)
 * Starts `next start` on that port when nothing is listening.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { isPaywallApiExempt } from "../src/lib/subscription";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const PORT = Number(new URL(process.env.PAYWALL_TEST_BASE_URL || "http://127.0.0.1:3019").port || 3019);
const BASE = (process.env.PAYWALL_TEST_BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const ROOT_DOMAIN = process.env.PLATFORM_ROOT_DOMAIN || "shootportal.app";
const PASSWORD = `PaywallHttp-${randomBytes(6).toString("hex")}!aA1`;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
}

function projectRef(): string {
  return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
}

function sessionCookieHeader(accessToken: string, refreshToken: string, user: object): string {
  const name = `sb-${projectRef()}-auth-token`;
  const payload = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  });
  const CHUNK = 3180;
  if (payload.length <= CHUNK) return `${name}=${encodeURIComponent(payload)}`;
  const parts: string[] = [];
  for (let i = 0, n = 0; i < payload.length; i += CHUNK, n++) {
    parts.push(`${name}.${n}=${encodeURIComponent(payload.slice(i, i + CHUNK))}`);
  }
  return parts.join("; ");
}

async function serverResponds(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, attempts = 60): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (await serverResponds(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

async function main() {
  // Unit-level allowlist sanity (does not replace HTTP proof).
  assert(isPaywallApiExempt("/api/auth/signout"), "auth signout exempt");
  assert(isPaywallApiExempt("/api/billing/checkout"), "checkout exempt");
  assert(isPaywallApiExempt("/api/billing/portal"), "portal exempt");
  assert(!isPaywallApiExempt("/api/projects"), "projects NOT exempt");
  assert(!isPaywallApiExempt("/api/clients"), "clients NOT exempt");
  assert(!isPaywallApiExempt("/api/admin/settings"), "settings NOT exempt");
  assert(!isPaywallApiExempt("/api/media/upload"), "media upload NOT exempt");

  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const slug = `pwhttp-${Date.now().toString(36)}`;
  const host = `${slug}.${ROOT_DOMAIN}`;
  const email = `${slug}@example.test`;

  const { data: business, error: bizErr } = await raw
    .from("businesses")
    .insert({
      name: "Paywall HTTP Test",
      slug,
      plan: "studio",
      status: "active",
      subscription_status: "trial_expired",
      trial_ends_at: new Date(Date.now() - 86400000).toISOString(),
    })
    .select("id, slug, subscription_status")
    .single();
  if (bizErr || !business) throw bizErr || new Error("business insert failed");

  let userId: string | null = null;
  let serverProc: ChildProcess | null = null;

  try {
    const { data: created, error: createErr } = await raw.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Paywall HTTP Admin" },
    });
    if (createErr || !created.user) throw createErr || new Error("createUser failed");
    userId = created.user.id;

    const { error: profileErr } = await raw.from("profiles").upsert({
      id: userId,
      email,
      full_name: "Paywall HTTP Admin",
      role: "admin",
      business_id: business.id,
    });
    if (profileErr) throw profileErr;

    const alreadyUp = await serverResponds(`${BASE}/login`);
    if (!alreadyUp) {
      console.log(`Starting next start on :${PORT} …`);
      serverProc = spawn("npx", ["next", "start", "-p", String(PORT)], {
        cwd: process.cwd(),
        env: { ...process.env, PORT: String(PORT) },
        stdio: ["ignore", "pipe", "pipe"],
      });
      serverProc.stderr?.on("data", (buf) => {
        const s = String(buf);
        if (/error|Error|EADDRINUSE/i.test(s)) process.stderr.write(s);
      });
    } else {
      console.log(`Using existing server on :${PORT}`);
    }

    await waitForServer(`${BASE}/login`);

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: signed, error: signErr } = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signErr || !signed.session) throw signErr || new Error("sign-in failed");

    const cookie = sessionCookieHeader(
      signed.session.access_token,
      signed.session.refresh_token,
      signed.user
    );

    async function http(
      method: string,
      path: string,
      body?: unknown
    ): Promise<{ status: number; json: Record<string, unknown>; text: string }> {
      const headers: Record<string, string> = {
        Host: host,
        "x-forwarded-host": host,
        Cookie: cookie,
        Accept: "application/json",
      };
      let payload: string | undefined;
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
      }
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: payload,
        redirect: "manual",
      });
      const text = await res.text();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        /* non-JSON */
      }
      return { status: res.status, json, text: text.slice(0, 400) };
    }

    // --- THE BUG: checkout must NOT be 402 ---
    const checkout = await http("POST", "/api/billing/checkout", {
      planKey: "studio",
      interval: "monthly",
    });
    console.log("checkout status", checkout.status, checkout.json);
    assert(checkout.status !== 402, "checkout must not return paywall 402");
    assert(
      typeof checkout.json.url === "string" && String(checkout.json.url).includes("stripe"),
      "checkout returns a Stripe Checkout URL"
    );
    assert(
      checkout.json.code !== "subscription_required",
      "checkout body is not paywallApiBody"
    );

    // Operating APIs remain blocked.
    const projects = await http("GET", "/api/projects");
    assert(projects.status === 402, "GET /api/projects still 402 when paywalled");
    assert(projects.json.code === "subscription_required", "projects body is paywall");

    const clients = await http("GET", "/api/clients");
    assert(clients.status === 402, "GET /api/clients still 402 when paywalled");

    const settings = await http("GET", "/api/admin/settings");
    assert(settings.status === 402, "GET /api/admin/settings still 402 when paywalled");

    // Sign out escape hatch.
    const signout = await http("POST", "/api/auth/signout");
    assert(signout.status !== 402, "sign out must not be paywalled");

    console.log("verify-paywall-checkout-http: all passed");
  } finally {
    if (userId) {
      await raw.from("profiles").delete().eq("id", userId);
      await raw.auth.admin.deleteUser(userId);
    }
    await raw.from("businesses").delete().eq("id", business.id);
    if (serverProc?.pid) {
      serverProc.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
