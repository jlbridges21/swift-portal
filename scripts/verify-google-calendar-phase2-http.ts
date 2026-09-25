/**
 * Swift-only privacy proof for Google Calendar phase 2.
 * Temporary staff user with area.calendar. Deleted at the end.
 *
 * Usage: VERIFY_BASE_URL=http://localhost:3000 npx tsx scripts/verify-google-calendar-phase2-http.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";
const ROOT = process.env.VERIFY_BASE_URL || "http://localhost:3000";

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
  const email = `gcal-phase2-staff-${stamp}@example.test`;
  const password = `Gcal-Phase2-${stamp}!Aa`;
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
        full_name: "GCal phase2 staff probe",
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
      console.log(`\n${method} ${path}\n${res.status}\n${text.slice(0, 1200)}`);
      return { status: res.status, text };
    }

    const events = await probe(
      "/b/swift-aerial-media/api/integrations/google-calendar/events?from=2026-08-01T00:00:00.000Z&to=2026-09-01T00:00:00.000Z",
      "GET"
    );
    const bare = await probe("/b/swift-aerial-media/api/integrations/google-calendar/events", "GET");
    const posted = await probe("/b/swift-aerial-media/api/integrations/google-calendar/events", "POST");
    const calendars = await probe("/b/swift-aerial-media/api/integrations/google-calendar/calendars", "GET");
    const page = await probe("/b/swift-aerial-media/admin/calendar", "GET");

    assert(events.status === 403, `events expected 403, got ${events.status}`);
    assert(bare.status === 403, `bare events expected 403, got ${bare.status}`);
    assert(calendars.status === 403, `calendars expected 403, got ${calendars.status}`);
    assert(events.text.includes("External Google events are visible to the business owner only."), "events refusal");
    assert(calendars.text.includes("Only the business owner can view Google calendars."), "calendars refusal");
    assert(!events.text.includes("Dentist"), "events body has no fixture title");
    assert(!/"events"\s*:/.test(events.text), "events body has no events array");
    assert(!/"calendars"\s*:/.test(calendars.text), "calendar list body has no calendar array");
    assert(posted.status === 403 || posted.status === 405, `POST events must be refused, got ${posted.status}`);

    const html = page.text;
    const markers = [
      "data-external-event",
      "Hide Google events",
      "Google calendars",
      "Dentist",
      "htmlLink",
      "timeLabel",
      "calendarSummary",
      "bg-violet",
      "Personal Calendar",
      "Shoots color",
      "data-color-trigger",
      "Reset to default",
    ];
    for (const marker of markers) {
      assert(!html.includes(marker), `staff HTML contains ${marker}`);
    }
    assert(html.includes("Shoot Calendar") || html.includes("shoot-calendar") || page.status === 200, "calendar page rendered");
    const main = html.slice(html.indexOf("<main"), html.indexOf("<main") + 2500);
    console.log("\n--- staff calendar <main> excerpt ---\n");
    console.log(main);
    console.log("\nstaff calendar status", page.status, "html bytes", html.length);
    console.log("staff HTML marker scan: none of", markers.join(", "));
  } finally {
    await admin.auth.admin.deleteUser(userId);
    const { data: left } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    console.log("staff probe user removed:", !left);
  }

  console.log("verify-google-calendar-phase2-http: passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
