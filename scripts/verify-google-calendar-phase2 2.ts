/**
 * Phase 2 pull rules. No live Google account and no stored event bodies.
 * Usage: npx tsx scripts/verify-google-calendar-phase2.ts
 */
import {
  externalEventsVisibleTo,
  isShootPortalOriginated,
  listGoogleEvents,
  resolveReadCalendarIds,
  toExternalEvent,
  validateReadCalendarSelection,
  type ExternalCalendarEvent,
} from "../src/lib/google-calendar-pull";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const ZONE = "America/New_York";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const originated = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "33333333-3333-3333-3333-333333333333"].map(
  (id, index) => ({
    id: `sp-${index}`,
    status: "confirmed",
    summary: `Confirmed shoot ${index + 1}`,
    iCalUID: `${id}@shootportal.app`,
    start: { dateTime: `2026-06-0${index + 1}T18:00:00Z` },
    end: { dateTime: `2026-06-0${index + 1}T19:00:00Z` },
    extendedProperties: { private: { shootPortalProposalId: id } },
  })
);

const icalOnly = {
  id: "sp-ical",
  status: "confirmed",
  summary: "iCal stamped shoot",
  iCalUID: "44444444-4444-4444-4444-444444444444@shootportal.app",
  start: { dateTime: "2026-06-04T18:00:00Z" },
  end: { dateTime: "2026-06-04T19:00:00Z" },
};

const dentist = {
  id: "ext-dentist",
  status: "confirmed",
  summary: "Dentist",
  iCalUID: "dentist@gmail.com",
  htmlLink: "https://www.google.com/calendar/event?eid=dentist",
  start: { dateTime: "2026-06-05T14:00:00-04:00" },
  end: { dateTime: "2026-06-05T15:00:00-04:00" },
};

async function main() {
  for (const event of [...originated, icalOnly]) {
    assert(isShootPortalOriginated(event), "shoot portal marker");
    assert(toExternalEvent(event, "primary", "Primary", ZONE) === null, "originated event must not render");
  }

  const external = toExternalEvent(dentist, "primary", "Primary", ZONE);
  assert(external?.title === "Dentist", "external title");
  assert(external?.calendarSummary === "Primary", "calendar source");

  const mixed = await listGoogleEvents({
    accessToken: "test-token",
    calendarId: "primary",
    calendarSummary: "Primary",
    timeZone: ZONE,
    timeMin: "2026-06-01T00:00:00Z",
    timeMax: "2026-06-30T00:00:00Z",
    transport: async (url) => {
      assert(url.includes("singleEvents=true"), "recurring events must expand");
      assert(!url.includes("syncToken="), "display fetch is a window, not a cursor");
      return jsonResponse({
        items: [
          ...originated,
          icalOnly,
          dentist,
          { id: "cancelled", status: "cancelled", summary: "Cancelled lunch", start: { dateTime: "2026-06-06T15:00:00Z" } },
          {
            id: "declined",
            status: "confirmed",
            summary: "Declined dinner",
            start: { dateTime: "2026-06-07T23:00:00Z" },
            attendees: [{ self: true, responseStatus: "declined" }],
          },
          {
            id: "someone-else-declined",
            status: "confirmed",
            summary: "Team standup",
            start: { dateTime: "2026-06-08T14:00:00Z" },
            end: { dateTime: "2026-06-08T14:30:00Z" },
            attendees: [{ self: false, responseStatus: "declined" }, { self: true, responseStatus: "accepted" }],
          },
          {
            id: "recur-1",
            status: "confirmed",
            summary: "Weekly sync",
            recurringEventId: "series-1",
            start: { dateTime: "2026-06-09T15:00:00Z" },
            end: { dateTime: "2026-06-09T15:30:00Z" },
          },
          {
            id: "recur-2",
            status: "confirmed",
            summary: "Weekly sync",
            recurringEventId: "series-1",
            start: { dateTime: "2026-06-16T15:00:00Z" },
            end: { dateTime: "2026-06-16T15:30:00Z" },
          },
          {
            id: "all-day",
            status: "confirmed",
            summary: "Office closed",
            start: { date: "2026-03-08" },
            end: { date: "2026-03-09" },
          },
          {
            id: "dst",
            status: "confirmed",
            summary: "Across the clock change",
            start: { dateTime: "2026-03-08T06:30:00Z" },
            end: { dateTime: "2026-03-08T08:00:00Z" },
          },
        ],
      });
    },
  });

  const titles = mixed.events.map((event) => event.title).sort();
  assert(!titles.some((title) => title.startsWith("Confirmed shoot")), "three confirmed shoots must not come back");
  assert(!titles.includes("iCal stamped shoot"), "iCalUID shoot must not come back");
  assert(!titles.includes("Cancelled lunch"), "cancelled excluded");
  assert(!titles.includes("Declined dinner"), "owner decline excluded");
  assert(titles.includes("Dentist"), "external kept");
  assert(titles.includes("Team standup"), "another attendee's decline does not hide the event");
  assert(titles.filter((title) => title === "Weekly sync").length === 2, "recurring instances expand");

  const allDay = mixed.events.find((event) => event.id === "all-day");
  assert(allDay?.allDay === true, "all-day flag");
  assert(allDay?.timeLabel === "All day", "all-day label");
  assert(JSON.stringify(allDay?.dayKeys) === JSON.stringify(["2026-03-08"]), `all-day day ${allDay?.dayKeys}`);
  assert(allDay?.start === "2026-03-08", "all-day start is a date");

  const dst = mixed.events.find((event) => event.id === "dst");
  assert(dst?.timeLabel.includes("1:30") && dst.timeLabel.includes("4:00"), `dst label ${dst?.timeLabel}`);
  assert(JSON.stringify(dst?.dayKeys) === JSON.stringify(["2026-03-08"]), `dst day ${dst?.dayKeys}`);

  let calls = 0;
  const gone = await listGoogleEvents({
    accessToken: "test-token",
    calendarId: "primary",
    calendarSummary: "Primary",
    timeZone: ZONE,
    timeMin: "2026-09-01T00:00:00Z",
    timeMax: "2026-10-01T00:00:00Z",
    syncToken: "dead-token",
    transport: async (url) => {
      calls += 1;
      if (url.includes("syncToken=dead-token")) {
        return jsonResponse({ error: { code: 410 } }, 410);
      }
      assert(url.includes("timeMin="), "full resync uses the window");
      assert(!url.includes("syncToken="), "full resync drops the cursor");
      return jsonResponse({
        items: [dentist],
        nextSyncToken: "fresh-token",
      });
    },
  });
  assert(calls === 2, "410 then one full resync");
  assert(gone.resynced === true, "resync flagged");
  assert(gone.degraded === false, "resync is not a failure");
  assert(gone.events.length === 1 && gone.events[0]?.title === "Dentist", "page still receives the window");
  assert(gone.nextSyncToken === "fresh-token", "new cursor");

  const limited = await listGoogleEvents({
    accessToken: "test-token",
    calendarId: "primary",
    calendarSummary: "Primary",
    timeZone: ZONE,
    timeMin: "2026-09-01T00:00:00Z",
    timeMax: "2026-10-01T00:00:00Z",
    transport: async () => new Response("", { status: 429, headers: { "Retry-After": "30" } }),
  });
  assert(limited.degraded === true, "429 degrades");
  assert(limited.events.length === 0, "429 does not invent events");
  assert(limited.resynced === false, "429 is not a resync");

  const picked = validateReadCalendarSelection(
    ["work@example.com", "personal@example.com", "not-on-account"],
    ["work@example.com", "personal@example.com", "primary"]
  );
  assert(JSON.stringify(picked) === JSON.stringify(["work@example.com", "personal@example.com"]), "read list");
  assert(!picked.includes("primary"), "write target is not forced into the read list");
  assert(JSON.stringify(resolveReadCalendarIds([], "primary")) === JSON.stringify(["primary"]), "default is the write target");
  assert(
    JSON.stringify(resolveReadCalendarIds(["personal@example.com"], "primary")) === JSON.stringify(["personal@example.com"]),
    "stored read list ignores the write target"
  );

  const sample: ExternalCalendarEvent = {
    id: "ext-dentist",
    title: "Dentist",
    calendarId: "personal@example.com",
    calendarSummary: "Personal",
    htmlLink: "https://www.google.com/calendar/event?eid=dentist",
    allDay: false,
    start: "2026-06-05T18:00:00.000Z",
    end: "2026-06-05T19:00:00.000Z",
    dayKeys: ["2026-06-05"],
    timeLabel: "2:00 PM – 3:00 PM",
  };
  assert(externalEventsVisibleTo("staff", [sample]).length === 0, "staff receive no external events");
  assert(externalEventsVisibleTo("admin", [sample]).length === 1, "admin receives external events");
  assert(externalEventsVisibleTo("super_admin", [sample]).length === 1, "super admin receives external events");

  console.log("verify-google-calendar-phase2: passed");
  console.log("kept titles:", titles.join(", "));
  console.log("all-day:", JSON.stringify(allDay));
  console.log("dst:", JSON.stringify(dst));
  console.log("410 resynced events:", gone.events.length, "token replaced");
  console.log("429 degraded:", limited.degraded);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
