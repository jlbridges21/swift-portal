/**
 * Outlook Calendar — pure checks with a mocked Microsoft transport. No network, no database.
 * Run: npx tsx scripts/verify-outlook-calendar.ts
 */
process.env.MICROSOFT_CALENDAR_CLIENT_ID ||= "unit-test-client";
process.env.MICROSOFT_CALENDAR_CLIENT_SECRET ||= "unit-test-secret";
process.env.PLATFORM_ROOT_DOMAIN ||= "shootportal.app";

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };

function mockTransport(responses: Array<(call: Call) => { status: number; json?: unknown } | null>) {
  const calls: Call[] = [];
  const transport = async (input: string, init?: RequestInit) => {
    const call: Call = {
      url: input,
      method: (init?.method || "GET").toUpperCase(),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body instanceof URLSearchParams ? Object.fromEntries(init.body) : null,
      headers: (init?.headers as Record<string, string>) || {},
    };
    calls.push(call);
    for (const r of responses) {
      const hit = r(call);
      if (hit) return new Response(hit.json === undefined ? null : JSON.stringify(hit.json), { status: hit.status });
    }
    throw new Error(`unexpected request ${call.method} ${call.url}`);
  };
  return { transport, calls };
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
}

async function main() {
  const m = await import("../src/lib/outlook-calendar");

  // OAuth state
  const state = m.signOutlookOAuthState({ businessId: "b1", userId: "u1", returnOrigin: "https://x.shootportal.app" });
  assert(m.verifyOutlookOAuthState(state)?.businessId === "b1", "signed state verifies");
  const [data, sig] = state.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(data, "base64url").toString()), businessId: "b2" })).toString("base64url");
  assert(m.verifyOutlookOAuthState(`${forged}.${sig}`) === null, "tampered state is rejected");
  const expired = m.signOutlookOAuthState({ businessId: "b1", userId: "u1", returnOrigin: "https://x", exp: Date.now() - 1 });
  assert(m.verifyOutlookOAuthState(expired) === null, "expired state is rejected");

  // Auth URL + redirect
  const auth = new URL(m.outlookAuthUrl(state));
  assert(auth.origin === "https://login.microsoftonline.com" && auth.pathname === "/common/oauth2/v2.0/authorize", "authorize endpoint is /common v2.0");
  assert(auth.searchParams.get("scope")?.includes("offline_access") && auth.searchParams.get("scope")?.includes("Calendars.ReadWrite"), "scopes include offline_access + Calendars.ReadWrite");
  assert(m.outlookCalendarRedirectUri() === "https://www.shootportal.app/api/integrations/outlook-calendar/callback", "redirect URI is the www apex callback");
  assert(m.isOutlookCalendarCallbackHost("www.shootportal.app") && m.isOutlookCalendarCallbackHost("shootportal.app"), "callback accepted on apex/www");
  assert(!m.isOutlookCalendarCallbackHost("gateway.shootportal.app"), "callback refused on a tenant host");

  // Token refresh: rotation + permanent vs transient failures
  {
    const { transport } = mockTransport([() => ({ status: 200, json: { access_token: "A2", refresh_token: "R2", expires_in: 3600 } })]);
    const t = await m.refreshOutlookAccessToken("R1", transport);
    assert(t.accessToken === "A2" && t.refreshToken === "R2" && t.expiresAt, "refresh stores the rotated refresh token");
  }
  {
    const { transport } = mockTransport([() => ({ status: 400, json: { error: "invalid_grant" } })]);
    const err = await m.refreshOutlookAccessToken("R1", transport).catch((e) => e);
    assert(err instanceof Error && (err as { permanent?: boolean }).permanent === true, "invalid_grant marks needs-reconnect");
  }
  {
    const { transport } = mockTransport([() => ({ status: 503, json: {} })]);
    const err = await m.refreshOutlookAccessToken("R1", transport).catch((e) => e);
    assert(err instanceof Error && (err as { permanent?: boolean }).permanent === false, "a 503 is transient (connection kept)");
  }

  // Calendars
  {
    const { transport } = mockTransport([
      (c) =>
        c.url.includes("/me/calendars") && !c.url.includes("skip")
          ? {
              status: 200,
              json: {
                value: [
                  { id: "cal-1", name: "Calendar", isDefaultCalendar: true, canEdit: true, hexColor: "#1f77b4" },
                  { id: "cal-2", name: "Birthdays", isDefaultCalendar: false, canEdit: false, hexColor: "" },
                ],
              },
            }
          : null,
    ]);
    const cals = await m.listOutlookCalendars("tok", transport);
    assert(cals.length === 2 && cals[0].isDefault && !cals[1].canEdit && cals[1].color === null, "calendar list maps default/canEdit/color");
  }

  // Event upsert: PATCH existing, 404 falls back to create in the chosen calendar
  {
    const { transport, calls } = mockTransport([
      (c) => (c.method === "PATCH" ? { status: 404, json: { error: { code: "ErrorItemNotFound" } } } : null),
      (c) => (c.method === "POST" ? { status: 201, json: { id: "evt-new" } } : null),
    ]);
    const r = await m.upsertOutlookEvent(
      "tok",
      {
        calendarId: "cal-1",
        existingEventId: "evt-old",
        summary: "Jane - 12 Main St",
        description: "Shoot",
        startIso: "2026-12-01T15:00:00.000Z",
        endIso: null,
        location: "12 Main St",
        attendees: [{ email: "jane@example.com", displayName: "Jane" }],
      },
      transport
    );
    const post = calls.find((c) => c.method === "POST")!;
    const body = post.body as { start: { dateTime: string; timeZone: string }; end: { dateTime: string }; attendees: unknown[]; showAs: string };
    assert(r.eventId === "evt-new" && r.created, "missing event is recreated");
    assert(post.url.endsWith("/me/calendars/cal-1/events"), "create goes to the chosen calendar");
    assert(body.start.timeZone === "UTC" && body.start.dateTime === "2026-12-01T15:00:00.000", "start sent in UTC");
    assert(body.end.dateTime === "2026-12-01T16:00:00.000", "missing end defaults to one hour");
    assert(body.attendees.length === 1 && body.showAs === "busy", "attendees + busy");
  }
  {
    const { transport } = mockTransport([(c) => (c.method === "PATCH" ? { status: 200, json: { id: "evt-old" } } : null)]);
    const r = await m.upsertOutlookEvent("tok", { calendarId: "cal-1", existingEventId: "evt-old", summary: "s", description: "d", startIso: "2026-12-01T15:00:00Z" }, transport);
    assert(r.eventId === "evt-old" && !r.created, "existing event is updated in place");
  }
  {
    const { transport } = mockTransport([() => ({ status: 404 })]);
    await m.deleteOutlookEvent("tok", "gone", transport);
    assert(true, "deleting an already-deleted event is fine");
  }

  // Busy times: UTC parsing + filters + paging
  {
    const page2 = "https://graph.microsoft.com/v1.0/me/calendars/cal-1/calendarView?page=2";
    const { transport, calls } = mockTransport([
      (c) =>
        c.url === page2
          ? { status: 200, json: { value: [{ id: "e5", showAs: "busy", start: { dateTime: "2026-12-02T18:00:00.0000000" }, end: { dateTime: "2026-12-02T19:00:00.0000000" } }] } }
          : null,
      (c) =>
        c.url.includes("calendarView")
          ? {
              status: 200,
              json: {
                "@odata.nextLink": page2,
                value: [
                  { id: "e1", showAs: "busy", start: { dateTime: "2026-12-01T15:00:00.0000000" }, end: { dateTime: "2026-12-01T16:30:00.0000000" } },
                  { id: "e2", showAs: "free", start: { dateTime: "2026-12-01T17:00:00.0000000" }, end: { dateTime: "2026-12-01T18:00:00.0000000" } },
                  { id: "e3", isAllDay: true, showAs: "busy", start: { dateTime: "2026-12-01T00:00:00.0000000" }, end: { dateTime: "2026-12-02T00:00:00.0000000" } },
                  { id: "e4", isCancelled: true, showAs: "busy", start: { dateTime: "2026-12-01T09:00:00.0000000" }, end: { dateTime: "2026-12-01T10:00:00.0000000" } },
                  { id: "e6", showAs: "tentative", responseStatus: { response: "declined" }, start: { dateTime: "2026-12-01T11:00:00.0000000" }, end: { dateTime: "2026-12-01T12:00:00.0000000" } },
                ],
              },
            }
          : null,
    ]);
    const busy = await m.listOutlookBusy("tok", "cal-1", "2026-12-01T00:00:00.000Z", "2026-12-08T00:00:00.000Z", transport);
    assert(calls[0].headers.Prefer === 'outlook.timezone="UTC"', "calendarView asks for UTC times");
    assert(busy.map((b) => b.id).join(",") === "e1,e5", "free / all-day / cancelled / declined are skipped; pages followed");
    assert(busy[0].start === Date.parse("2026-12-01T15:00:00Z") && busy[0].end === Date.parse("2026-12-01T16:30:00Z"), "UTC wall times parsed as instants");
  }

  // Shoot Calendar display: Graph event → ExternalCalendarEvent (same converter Google uses)
  {
    const { toExternalEvent } = await import("../src/lib/google-calendar-pull");
    const timed = toExternalEvent(
      m.outlookEventAsGoogleShape({ id: "e1", subject: "Dentist", webLink: "https://outlook.live.com/x", start: { dateTime: "2026-12-01T15:00:00.0000000" }, end: { dateTime: "2026-12-01T16:30:00.0000000" } }),
      "outlook:cal-1",
      "Calendar",
      "America/New_York",
      null
    );
    assert(timed && !timed.allDay && timed.dayKeys.join() === "2026-12-01" && timed.timeLabel === "10:00 AM – 11:30 AM", "timed Outlook event lands at local business time");
    assert(timed?.htmlLink === "https://outlook.live.com/x" && timed?.title === "Dentist", "title + Outlook link carried over");
    const allDay = toExternalEvent(
      m.outlookEventAsGoogleShape({ id: "e2", subject: "Vacation", isAllDay: true, start: { dateTime: "2026-12-24T00:00:00.0000000" }, end: { dateTime: "2026-12-26T00:00:00.0000000" } }),
      "outlook:cal-1",
      "Calendar",
      "America/New_York",
      null
    );
    assert(allDay?.allDay && allDay.dayKeys.join() === "2026-12-24,2026-12-25", "all-day Outlook event keeps its dates (end exclusive)");
  }

  console.log("\nAll Outlook Calendar checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
