/**
 * Swift-only HTML proof for the permission-sensitive mobile bar and staff calendar.
 * Temporary staff user. Deleted at the end. Does not print tokens.
 *
 * Usage: VERIFY_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/verify-mobile-nav-html.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";
const ROOT = process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000";

function loadEnv() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sliceAround(html: string, marker: string, radius = 700) {
  const at = html.indexOf(marker);
  if (at < 0) return `(missing ${marker})`;
  return html.slice(Math.max(0, at - 80), at + radius);
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  assert(url && serviceKey && anonKey, "missing supabase env");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = Date.now();
  const email = `mobile-nav-staff-${stamp}@example.test`;
  const password = `Mobile-Nav-${stamp}!Aa`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(created.error?.message || "createUser failed");
  const userId = created.data.user.id;

  try {
    const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await anon.auth.signInWithPassword({ email, password });
    if (signed.error || !signed.data.session) throw new Error(signed.error?.message || "login failed");
    const projectRef = new URL(url).hostname.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(signed.data.session))}; sp_path_tenant=swift-aerial-media`;

    async function calendarHtml(permissions: Record<string, boolean>) {
      const { error } = await admin
        .from("profiles")
        .update({
          role: "staff",
          business_id: SWIFT_ID,
          client_id: null,
          staff_permissions: permissions,
          full_name: "Mobile nav staff probe",
          disabled_at: null,
        })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      const res = await fetch(`${ROOT}/b/swift-aerial-media/admin/calendar`, {
        headers: { Cookie: cookie },
        redirect: "manual",
      });
      const html = await res.text();
      return { status: res.status, html };
    }

    const noMedia = await calendarHtml({
      "area.projects": true,
      "area.messages": true,
      "area.calendar": true,
      "projects.create": true,
      "clients.create": true,
    });
    assert(noMedia.status === 200, `no-media calendar status ${noMedia.status}`);
    assert(noMedia.html.includes('data-nav-items="Home|Projects|Create|Messages"'), "no-media bar items");
    assert(!noMedia.html.includes('data-nav-items="Home|Projects|Create|Messages|Media"'), "no-media must not include Media");
    assert(noMedia.html.includes('data-sheet-actions="Search|New project|New client"'), "no-media sheet");
    assert(!noMedia.html.includes("Add media"), "no-media sheet must not offer Add media");
    assert(!noMedia.html.includes(">Media<"), "no-media bar must not render a Media label");

    const noUpload = await calendarHtml({
      "area.projects": true,
      "area.messages": true,
      "area.media": true,
      "area.calendar": true,
      "projects.create": true,
      "clients.create": true,
    });
    assert(noUpload.status === 200, `no-upload calendar status ${noUpload.status}`);
    assert(
      noUpload.html.includes('data-nav-items="Home|Projects|Create|Messages|Media"'),
      "media area keeps the Media item"
    );
    assert(noUpload.html.includes('data-sheet-actions="Search|New project|New client"'), "no upload sheet");
    assert(!noUpload.html.includes("Add media"), "missing media.upload must hide Add media");

    const minimal = await calendarHtml({ "area.calendar": true });
    assert(minimal.status === 200, `minimal calendar status ${minimal.status}`);
    assert(minimal.html.includes('data-nav-items="Home|Create"'), `minimal bar: ${sliceAround(minimal.html, "data-nav-items")}`);
    assert(minimal.html.includes('data-sheet-actions="Search"'), "minimal sheet is Search only");
    assert(!minimal.html.includes("New project"), "minimal sheet has no New project");
    assert(!minimal.html.includes("New client"), "minimal sheet has no New client");
    assert(!minimal.html.includes("Add media"), "minimal sheet has no Add media");
    assert(!minimal.html.includes(">Projects<"), "minimal bar has no Projects");
    assert(!minimal.html.includes(">Messages<"), "minimal bar has no Messages");
    assert(!minimal.html.includes(">Media<"), "minimal bar has no Media");

    const markers = [
      "data-external-event",
      "Google calendars",
      "Personal Calendar",
      "data-color-trigger",
      "data-gcal-degraded",
      'href="/partner"',
      ">/partner<",
    ];
    const partnerAt = minimal.html.indexOf("Partner");
    console.log("\n--- Partner occurrence (expect none as a link) ---");
    console.log(partnerAt < 0 ? "(none)" : minimal.html.slice(Math.max(0, partnerAt - 120), partnerAt + 180));
    for (const marker of markers) {
      assert(!minimal.html.includes(marker), `staff calendar HTML contains ${marker}`);
    }
    assert(minimal.html.includes('data-mobile-calendar="schedule"'), "mobile calendar defaults to schedule");
    assert(!minimal.html.includes("data-create-shoot"), "staff without scheduling.propose has no create FAB");
    assert(!minimal.html.includes("Month, week, day, and agenda"), "subtitle removed");
    assert(!minimal.html.includes("Google Calendar is rate limiting"), "rate-limit banner absent for staff");

    console.log("\n--- no area.media (bar + sheet) ---");
    console.log(sliceAround(noMedia.html, 'data-nav-items="Home|Projects|Create|Messages"', 500));
    console.log("\n--- area.media without media.upload (bar + sheet) ---");
    console.log(sliceAround(noUpload.html, 'data-nav-items="Home|Projects|Create|Messages|Media"', 500));
    console.log("\n--- minimal permissions ---");
    console.log(sliceAround(minimal.html, 'data-nav-items="Home|Create"', 400));
    console.log("\n--- staff mobile calendar ---");
    console.log(sliceAround(minimal.html, 'data-mobile-calendar="schedule"', 900));
    console.log("\nverify-mobile-nav-html: passed");
  } finally {
    await admin.auth.admin.deleteUser(userId);
    const { data: left } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    console.log("probe user removed:", !left);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "probe failed");
  process.exit(1);
});
