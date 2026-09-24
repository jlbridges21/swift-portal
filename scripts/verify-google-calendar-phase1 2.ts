/**
 * Phase 1 Google Calendar checks that do not call Google.
 * Usage: npx tsx scripts/verify-google-calendar-phase1.ts
 */
import { agendaShootsForMonth } from "../src/lib/calendar-agenda";
import {
  GOOGLE_CALENDAR_SCOPES,
  googleCalendarRedirectUri,
  isGoogleCalendarCallbackHost,
  resolveGoogleCalendarReturnUrl,
  signOAuthState,
  upsertGoogleEvent,
  verifyOAuthState,
  revokeGoogleToken,
  formatGoogleDateTime,
  resolveBusinessTimeZone,
  shootIcalUid,
} from "../src/lib/google-calendar";
import { decryptCalendarSecret, encryptCalendarSecret } from "../src/lib/google-calendar-crypto";
import { passesAccessGate } from "../src/lib/staff-access";
import type { Profile } from "../src/lib/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function main() {
  process.env.PLATFORM_SESSION_SECRET ||= "verify-gcal-secret";
  process.env.GOOGLE_CALENDAR_CLIENT_ID ||= "verify-client";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||= "verify-secret";
  process.env.PLATFORM_ROOT_DOMAIN ||= "shootportal.app";

  const redirect = googleCalendarRedirectUri();
  assert(redirect === "https://shootportal.app/api/integrations/google-calendar/callback", redirect);
  assert(isGoogleCalendarCallbackHost("shootportal.app"), "apex callback host");
  assert(isGoogleCalendarCallbackHost("www.shootportal.app"), "www callback host");
  assert(!isGoogleCalendarCallbackHost("swift.shootportal.app"), "tenant host must not be the callback");
  assert(
    GOOGLE_CALENDAR_SCOPES.length === 2 &&
      GOOGLE_CALENDAR_SCOPES[0].endsWith("/auth/calendar.events") &&
      GOOGLE_CALENDAR_SCOPES[1].endsWith("/auth/calendar.calendarlist.readonly"),
    "scopes"
  );

  const back = resolveGoogleCalendarReturnUrl({
    returnOrigin: "https://swift.shootportal.app",
    businessPortalOrigin: "https://swift.shootportal.app",
  });
  assert(back.startsWith("https://swift.shootportal.app/admin/settings"), back);
  const apex = resolveGoogleCalendarReturnUrl({
    returnOrigin: "https://shootportal.app",
    businessPortalOrigin: "https://swift.shootportal.app",
  });
  assert(apex.startsWith("https://swift.shootportal.app/"), apex);
  assert(!apex.includes("https://shootportal.app/admin"), "must not stay on apex");

  const state = signOAuthState({
    businessId: "00000000-0000-0000-0000-000000000001",
    userId: "user-1",
    returnOrigin: "https://swift.shootportal.app",
  });
  const parsed = verifyOAuthState(state);
  assert(parsed?.businessId === "00000000-0000-0000-0000-000000000001", "state");
  assert(verifyOAuthState(state + "x") === null, "bad sig");

  const token = "ya29.super-secret-refresh";
  const cipher = encryptCalendarSecret(token);
  assert(!cipher.includes(token), "ciphertext leaked plaintext");
  assert(decryptCalendarSecret(cipher) === token, "roundtrip");

  const zone = resolveBusinessTimeZone("");
  assert(zone.usedFallback && zone.timeZone === "America/New_York", "unset timezone");
  const set = resolveBusinessTimeZone("America/Chicago");
  assert(!set.usedFallback && set.timeZone === "America/Chicago", "set timezone");
  const local = formatGoogleDateTime("2026-09-24T18:00:00.000Z", "America/Chicago");
  assert(local === "2026-09-24T13:00:00", `chicago wall time ${local}`);

  const calls: { url: string; method: string; body?: string }[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ url, method, body });
    if (method === "POST" && url.endsWith("/events")) {
      if (calls.filter((c) => c.method === "POST" && c.url.endsWith("/events")).length > 1) {
        return jsonResponse(409, { error: { message: "duplicate" } });
      }
      return jsonResponse(200, { id: "evt-1", htmlLink: "https://calendar.google.com/event?eid=evt-1" });
    }
    if (method === "PATCH") return jsonResponse(200, { id: "evt-1", htmlLink: "https://calendar.google.com/event?eid=evt-1" });
    if (url.includes("iCalUID=")) return jsonResponse(200, { items: [{ id: "evt-1" }] });
    return jsonResponse(404, {});
  };

  const draft = {
    proposalId: "proposal-1",
    calendarId: "primary",
    existingEventId: null as string | null,
    summary: "22175 Buck Road",
    description: "Client: Janet",
    startIso: "2026-09-24T18:00:00.000Z",
    timeZone: "America/Chicago",
  };
  const first = await upsertGoogleEvent("access", draft, transport);
  const second = await upsertGoogleEvent("access", { ...draft, existingEventId: first.eventId }, transport);
  calls.length = 0;
  const third = await upsertGoogleEvent("access", { ...draft, existingEventId: null }, transport);
  const fourth = await upsertGoogleEvent("access", { ...draft, existingEventId: null }, transport);
  assert(first.created && first.eventId === "evt-1", "create");
  assert(!second.created && second.eventId === "evt-1", "update");
  assert(third.created, "retry without id still creates once");
  assert(!fourth.created && fourth.eventId === "evt-1", "duplicate iCalUID does not create a second event");
  const posts = calls.filter((c) => c.method === "POST" && c.url.endsWith("/events"));
  assert(posts.length === 2, `expected 2 inserts (one 409), got ${posts.length}`);
  const createdBodies = posts.map((p) => p.body || "");
  assert(createdBodies.every((b) => b.includes(shootIcalUid("proposal-1"))), "iCalUID");
  assert(createdBodies[0].includes("2026-09-24T13:00:00"), "start wall time");
  assert(createdBodies[0].includes("2026-09-24T14:00:00"), "one hour end");
  assert(createdBodies[0].includes("America/Chicago"), "timezone");
  console.log("event create body:", createdBodies[0]);
  console.log("retry calls:", calls.map((c) => `${c.method} ${c.url}`).join("\n"));

  let revokedBody = "";
  const revoke = await revokeGoogleToken("refresh-secret", async (input, init) => {
    revokedBody = String(init?.body || "");
    assert(String(input) === "https://oauth2.googleapis.com/revoke", "revoke url");
    return jsonResponse(200, {});
  });
  assert(revoke.ok && revoke.status === 200, "revoke status");
  assert(revokedBody.includes("token=refresh-secret"), "revoke sends the refresh token");
  console.log("revoke:", revoke.status, revokedBody);

  const month = agendaShootsForMonth(
    [
      { id: "aug", proposed_at: "2026-08-31T15:00:00.000Z" },
      { id: "late", proposed_at: "2026-09-28T15:00:00.000Z" },
      { id: "early", proposed_at: "2026-09-02T15:00:00.000Z" },
      { id: "oct", proposed_at: "2026-10-01T15:00:00.000Z" },
    ],
    new Date("2026-09-15T12:00:00.000Z")
  );
  assert(month.map((s) => s.id).join(",") === "early,late", month.map((s) => s.id).join(","));
  assert(agendaShootsForMonth([], new Date()).length === 0, "empty");

  const staff = { role: "staff", staff_permissions: { "area.calendar": true } } as unknown as Profile;
  assert(!passesAccessGate(staff, { adminOnly: true }), "staff cannot pass adminOnly");
  console.log("staff adminOnly gate: false");

  console.log("verify-google-calendar-phase1: passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
