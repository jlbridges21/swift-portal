/**
 * Swift-only HTTP proofs for Google Calendar phase 1.
 * Creates a temporary staff user, probes connect/disconnect, then deletes the user.
 * Simulates Google failure with GOOGLE_CALENDAR_FORCE_FAIL and removes the test shoot.
 *
 * Usage: VERIFY_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/verify-google-calendar-phase1-http.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pushConfirmedShoot } from "../src/lib/google-calendar";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";
const PROJECT_ID = "1345a0de-adb1-4795-a981-e6014b3cf42e";
const ROOT = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";

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

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  assert(url && serviceKey && anonKey, "missing supabase env");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now();
  const email = `gcal-phase1-staff-${stamp}@example.test`;
  const password = `Gcal-Phase1-${stamp}!Aa`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message || "createUser failed");
  }
  const userId = created.data.user.id;

  try {
    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        role: "staff",
        business_id: SWIFT_ID,
        client_id: null,
        staff_permissions: { "area.calendar": true },
        full_name: "GCal phase1 staff probe",
      })
      .eq("id", userId);
    if (profileErr) throw new Error(profileErr.message);

    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await anon.auth.signInWithPassword({ email, password });
    if (signed.error || !signed.data.session) throw new Error(signed.error?.message || "login failed");
    const projectRef = new URL(url).hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const sessionPayload = JSON.stringify({
      access_token: signed.data.session.access_token,
      refresh_token: signed.data.session.refresh_token,
      expires_at: signed.data.session.expires_at,
      expires_in: signed.data.session.expires_in,
      token_type: signed.data.session.token_type,
      user: signed.data.session.user,
    });
    const cookie = `${cookieName}=${encodeURIComponent(sessionPayload)}; sp_path_tenant=swift-aerial-media`;

    async function probe(path: string, method: string) {
      const res = await fetch(`${ROOT}${path}`, {
        method,
        redirect: "manual",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
      });
      const text = await res.text();
      console.log(`${method} ${path} → ${res.status} ${text.slice(0, 400)}`);
      return { status: res.status, text };
    }

    const start = await probe("/b/swift-aerial-media/api/integrations/google-calendar/start", "GET");
    const del = await probe("/b/swift-aerial-media/api/integrations/google-calendar", "DELETE");
    assert(start.status === 403, `start expected 403, got ${start.status}`);
    assert(del.status === 403, `delete expected 403, got ${del.status}`);
    assert(start.text.includes("Only the business owner"), "start refusal text");
    assert(del.text.includes("Only the business owner"), "delete refusal text");
  } finally {
    await admin.auth.admin.deleteUser(userId);
    const { data: left } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    console.log("staff probe user removed:", !left);
  }

  process.env.GOOGLE_CALENDAR_FORCE_FAIL = "1";
  const inserted = await admin
    .from("shoot_proposals")
    .insert({
      business_id: SWIFT_ID,
      project_id: PROJECT_ID,
      proposed_by: "admin",
      proposed_at: "2026-09-24T18:00:00.000Z",
      status: "confirmed",
      message: "gcal phase1 force-fail probe — delete me",
    })
    .select("id, status")
    .single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message || "insert failed");
  const proposalId = inserted.data.id;
  try {
    const result = await pushConfirmedShoot(SWIFT_ID, proposalId);
    console.log("force-fail push result:", JSON.stringify(result));
    const { data: row } = await admin
      .from("shoot_proposals")
      .select("id, status, google_sync_status, google_sync_error, google_event_id")
      .eq("id", proposalId)
      .single();
    console.log("shoot still present:", JSON.stringify(row));
    assert(result.ok === false && result.error === "forced_fail", "expected forced_fail");
    assert(row?.status === "confirmed", "shoot must remain confirmed");
    assert(row?.google_sync_status === "error", "sync must be marked error");
    assert(!row?.google_event_id, "no google event id on failure");
  } finally {
    await admin.from("shoot_proposals").delete().eq("id", proposalId);
    const { data: gone } = await admin.from("shoot_proposals").select("id").eq("id", proposalId).maybeSingle();
    console.log("force-fail shoot removed:", !gone);
  }

  console.log("verify-google-calendar-phase1-http: passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
