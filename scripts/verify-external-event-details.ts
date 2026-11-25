/**
 * Google/Outlook event details mapping — pure checks, no network, no database.
 * Run: npx tsx scripts/verify-external-event-details.ts
 */
import {
  addDaysToDate,
  googleEventDetails,
  htmlToText,
  mergeGoogleAttendees,
  mergeOutlookAttendees,
  outlookEventDetails,
  parseExternalEventUpdate,
  shiftSeriesTimes,
} from "../src/lib/external-event-details";
import { googleEventEditable, toExternalEvent } from "../src/lib/google-calendar-pull";

function throws(fn: () => unknown, re: RegExp): boolean {
  try {
    fn();
    return false;
  } catch (err) {
    return re.test(err instanceof Error ? err.message : "");
  }
}

let failed = 0;
function check(cond: unknown, msg: string) {
  if (cond) console.log(`ok  ${msg}`);
  else {
    failed++;
    console.error(`FAIL ${msg}`);
  }
}

// htmlToText
check(htmlToText("Line 1<br>Line 2") === "Line 1\nLine 2", "br becomes newline");
check(htmlToText('<a href="https://x.com/a">Agenda</a>') === "Agenda (https://x.com/a)", "link keeps its url");
check(htmlToText('<a href="https://x.com/a">https://x.com/a</a>') === "https://x.com/a", "bare link not doubled");
check(htmlToText("Tom &amp; Jerry &lt;3") === "Tom & Jerry <3", "entities decoded");
check(htmlToText("<script>alert(1)</script>Hi") === "Hi", "script dropped");
check(htmlToText("<ul><li>A</li><li>B</li></ul>")?.includes("• A") === true, "list items bulleted");
check(htmlToText("   ") === null, "blank → null");
check(htmlToText("plain\r\n\r\n\r\n\r\ntext") === "plain\n\ntext", "plain text collapses blank lines");

// Google
const g = googleEventDetails({
  description: "Bring <b>drone</b><br>Gate code 1234",
  location: "123 Main St, Pensacola, FL",
  hangoutLink: "https://meet.google.com/abc-defg-hij",
  conferenceData: {
    conferenceSolution: { name: "Google Meet" },
    entryPoints: [
      { entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" },
      { entryPointType: "phone", uri: "tel:+1-555-0100", label: "+1 555-0100", pin: "123456" },
    ],
  },
  organizer: { email: "owner@example.com", displayName: "Owner" },
  attendees: [
    { email: "owner@example.com", displayName: "Owner", organizer: true, responseStatus: "accepted", self: true },
    { email: "client@example.com", responseStatus: "declined" },
    { email: "room@resource.calendar.google.com", resource: true, responseStatus: "accepted" },
  ],
  attachments: [{ title: "Shot list", fileUrl: "https://drive.google.com/file/d/1" }, { title: "Bad", fileUrl: "javascript:alert(1)" }],
  recurringEventId: "abc",
  transparency: "transparent",
});
check(g.description === "Bring drone\nGate code 1234", "google description to text");
check(g.meeting?.url === "https://meet.google.com/abc-defg-hij" && g.meeting.label === "Join Google Meet", "google meet link");
check(g.meeting?.phone === "+1 555-0100 · PIN 123456", "google dial-in");
check(g.attendees.length === 2, "rooms excluded from guests");
check(g.attendees[0].response === "organizer" && g.attendees[0].self, "organizer + self flags");
check(g.attachments.length === 1, "unsafe attachment url dropped");
check(g.recurring && g.showAs === "free", "recurring + free");
check(googleEventDetails({ organizer: { email: "me@x.com" } }).organizer === null, "solo event hides organizer");
check(googleEventDetails({ hangoutLink: "javascript:alert(1)" }).meeting === null, "unsafe meeting url dropped");

// Outlook
const o = outlookEventDetails({
  body: { contentType: "text", content: "Agenda\r\nhttps://example.com/doc" },
  location: { displayName: "Microsoft Teams Meeting" },
  isOnlineMeeting: true,
  onlineMeetingProvider: "teamsForBusiness",
  onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/xyz", tollNumber: "+1 555 0101", conferenceId: "987" },
  organizer: { emailAddress: { name: "Brenden", address: "brenden@example.com" } },
  attendees: [
    { type: "required", status: { response: "accepted" }, emailAddress: { name: "Brenden", address: "Brenden@example.com" } },
    { type: "optional", status: { response: "tentativelyAccepted" }, emailAddress: { name: "Jackson", address: "j@example.com" } },
    { type: "resource", status: { response: "accepted" }, emailAddress: { name: "Room 1", address: "room@example.com" } },
  ],
  type: "occurrence",
  showAs: "busy",
  sensitivity: "private",
});
check(o.description === "Agenda\nhttps://example.com/doc", "outlook text body");
check(o.location === null, "teams placeholder location hidden");
check(o.meeting?.label === "Join Microsoft Teams" && o.meeting.phone === "+1 555 0101 · ID 987", "teams join + dial-in");
check(o.attendees.length === 2 && o.attendees[0].organizer && o.attendees[1].response === "tentative" && o.attendees[1].optional, "outlook guests");
check(o.recurring && o.visibility === "private", "outlook recurring + private");
check(outlookEventDetails({ location: { displayName: "Office" } }).location === "Office", "outlook plain location");
check(outlookEventDetails({ bodyPreview: "" }).description === null, "empty outlook body → null");

// Edit permissions
check(g.edit.canEdit === false || g.edit.canEdit === true, "google edit info present");
const own = googleEventDetails(
  { organizer: { self: true, email: "me@x.com" }, start: { dateTime: "2026-11-25T13:00:00-06:00" }, end: { dateTime: "2026-11-25T14:00:00-06:00" } },
  { calendarId: "me@x.com", writable: true }
);
check(own.edit.canEdit && own.edit.start === "2026-11-25T19:00:00.000Z" && own.edit.canAddMeeting && own.edit.canChooseNotify, "own google event editable");
check(!googleEventDetails({ organizer: { email: "boss@x.com" } }, { calendarId: "me@x.com" }).edit.canEdit, "google invitation not editable");
check(googleEventDetails({ organizer: { email: "boss@x.com" }, guestsCanModify: true }, { calendarId: "me@x.com" }).edit.canEdit, "guestsCanModify editable");
check(googleEventDetails({ organizer: { email: "team@group.calendar.google.com" } }, { calendarId: "team@group.calendar.google.com" }).edit.canEdit, "calendar-organized event editable");
check(!googleEventDetails({}, { writable: false }).edit.canEdit, "read-only calendar not editable");
check(!googleEventDetails({ eventType: "birthday" }).edit.canEdit, "birthday not editable");
const allDayG = googleEventDetails({ start: { date: "2026-11-26" }, end: { date: "2026-11-27" } });
check(allDayG.edit.allDay && allDayG.edit.start === "2026-11-26" && allDayG.edit.end === "2026-11-27", "google all-day edit dates");
check(googleEventEditable({ organizer: { email: "x@y.com" } }, "me@x.com") === false, "list: invitation not editable");
check(googleEventEditable({}, "me@x.com") === true, "list: no organizer editable");
const listed = toExternalEvent(
  { id: "i1", summary: "Gym", recurringEventId: "r", organizer: { self: true }, start: { dateTime: "2026-11-25T19:00:00Z" }, end: { dateTime: "2026-11-25T20:00:00Z" } } as never,
  "primary",
  "Personal",
  "America/Chicago"
);
check(listed?.editable === true && listed.recurring === true, "list event carries editable + recurring");

check(o.edit.canEdit && !o.edit.canRemoveMeeting && !o.edit.canChooseNotify, "outlook organizer editable");
check(!outlookEventDetails({ isOrganizer: false }).edit.canEdit, "outlook invitation not editable");
check(!outlookEventDetails({}, { calendarCanEdit: false }).edit.canEdit, "outlook read-only calendar not editable");
check(outlookEventDetails({}, { meetingProvider: "teamsForBusiness" }).edit.canAddMeeting, "outlook can add teams");
check(!outlookEventDetails({}, { meetingProvider: "unknown" }).edit.canAddMeeting, "outlook unknown provider can't add meeting");
const oTimed = outlookEventDetails({ isOrganizer: true, start: { dateTime: "2026-11-25T19:00:00.0000000" }, end: { dateTime: "2026-11-25T20:00:00.0000000" } });
check(oTimed.edit.start === "2026-11-25T19:00:00.000Z" && oTimed.edit.end === "2026-11-25T20:00:00.000Z", "outlook UTC times → ISO");
const oAll = outlookEventDetails({ isAllDay: true, start: { dateTime: "2026-11-26T00:00:00.0000000" }, end: { dateTime: "2026-11-27T00:00:00.0000000" } });
check(oAll.edit.allDay && oAll.edit.start === "2026-11-26" && oAll.edit.end === "2026-11-27", "outlook all-day dates");

// Update parsing
const u = parseExternalEventUpdate({
  scope: "all",
  notify: false,
  title: "New",
  start: "2026-11-25T19:00:00Z",
  end: "2026-11-25T20:30:00Z",
  attendees: [{ email: "a@x.com" }, { email: "A@x.com" }, { email: "b@x.com", optional: true }],
  meeting: "add",
});
check(u.scope === "all" && !u.notify && u.title === "New" && u.allDay === false, "update basics");
check(u.start === "2026-11-25T19:00:00.000Z" && u.end === "2026-11-25T20:30:00.000Z", "update times normalized");
check(u.attendees?.length === 2 && u.attendees[1].optional, "guests deduped + optional");
check(u.meeting === "add", "meeting add");
check(parseExternalEventUpdate({}).scope === "this" && parseExternalEventUpdate({}).notify === true, "defaults: this + notify");
check(parseExternalEventUpdate({ title: "x" }).start === undefined, "no time change when omitted");
check(throws(() => parseExternalEventUpdate({ start: "2026-11-25T20:00:00Z", end: "2026-11-25T19:00:00Z" }), /after the start/), "end before start rejected");
check(throws(() => parseExternalEventUpdate({ start: "2026-11-01T00:00:00Z", end: "2026-12-15T00:00:00Z" }), /31 days/), "too long rejected");
check(throws(() => parseExternalEventUpdate({ attendees: [{ email: "not-an-email" }] }), /valid email/), "bad guest rejected");
check(throws(() => parseExternalEventUpdate({ title: 5 }), /Invalid title/), "bad title type rejected");
const ad = parseExternalEventUpdate({ allDay: true, start: "2026-11-26", end: "2026-11-27" });
check(ad.allDay && ad.start === "2026-11-26" && ad.end === "2026-11-27", "all-day update");
check(throws(() => parseExternalEventUpdate({ allDay: true, start: "2026-11-26", end: "2026-11-26" }), /end date/), "all-day zero length rejected");

// Guest merging keeps replies, rooms and the organizer
const mergedG = mergeGoogleAttendees(
  [
    { email: "me@x.com", organizer: true, responseStatus: "accepted" } as { email: string; organizer: boolean; responseStatus: string },
    { email: "a@x.com", responseStatus: "accepted" } as { email: string; responseStatus: string },
    { email: "room@resource.calendar.google.com", resource: true } as { email: string; resource: boolean },
    { email: "gone@x.com" } as { email: string },
  ],
  [{ email: "A@x.com", optional: true }, { email: "new@x.com", optional: false }]
) as { email: string; responseStatus?: string; optional?: boolean; resource?: boolean; organizer?: boolean }[];
check(mergedG.find((a) => a.email === "a@x.com")?.responseStatus === "accepted", "google keeps reply");
check(mergedG.find((a) => a.email === "a@x.com")?.optional === true, "google optional updated");
check(mergedG.some((a) => a.email === "new@x.com"), "google adds guest");
check(mergedG.some((a) => a.resource) && mergedG.some((a) => a.organizer), "google keeps room + organizer");
check(!mergedG.some((a) => a.email === "gone@x.com"), "google removes guest");
const mergedO = mergeOutlookAttendees(
  [
    { type: "required", emailAddress: { name: "Ann", address: "ann@x.com" } },
    { type: "resource", emailAddress: { name: "Room", address: "room@x.com" } },
    { type: "required", emailAddress: { address: "gone@x.com" } },
  ],
  [{ email: "ANN@x.com", optional: true }, { email: "new@x.com", optional: false }]
);
check(mergedO[0].type === "optional" && mergedO[0].emailAddress.name === "Ann" && mergedO[0].emailAddress.address === "ann@x.com", "outlook keeps name/address");
check(mergedO.some((a) => a.type === "resource") && !mergedO.some((a) => a.emailAddress.address === "gone@x.com"), "outlook keeps room, removes guest");

// Series time shift
const sh = shiftSeriesTimes("2026-06-01T14:00:00.000Z", "2026-11-25T15:00:00.000Z", "2026-11-25T16:30:00.000Z", "2026-11-25T17:00:00.000Z");
check(sh.start === "2026-06-01T15:30:00.000Z" && sh.end === "2026-06-01T16:00:00.000Z", "series shifted by the same amount + new length");
check(addDaysToDate("2026-12-31", 1) === "2027-01-01" && addDaysToDate("2026-03-01", -1) === "2026-02-28", "date math");

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll external event detail checks passed.");
