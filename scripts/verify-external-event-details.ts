/**
 * Google/Outlook event details mapping — pure checks, no network, no database.
 * Run: npx tsx scripts/verify-external-event-details.ts
 */
import { googleEventDetails, htmlToText, outlookEventDetails } from "../src/lib/external-event-details";

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

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll external event detail checks passed.");
