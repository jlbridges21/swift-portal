# Instant Booking

Native client self-scheduling for ShootPortal: availability from service durations, working hours,
buffers, existing shoots, Google Calendar busy times, daily limits and real drive times (Google
Routes), for solo operators and teams.

## Setup

1. **Database — apply `supabase/migration-v132-instant-booking.sql`** (Supabase SQL editor).
   Additive only. Until it runs, Settings → Instant Booking shows a notice, requests submit without a
   scheduling step, and the calendar works as before. It adds:
   - `shoot_proposals`: `end_at`, buffers, `assigned_user_id`, `booking_source`, `appointment_key`,
     `google_calendar_id`, override + cancel audit columns, status value `cancelled`
   - `projects.scheduling_status` (+ travel snapshot: miles, minutes, outside-area flag, duration)
   - `business_services`: `duration_minutes`, `buffer_minutes`, `instant_booking_allowed`,
     `outside_radius_requires_quote`
   - tables `team_scheduling_profiles`, `booking_holds`, `route_cache` (service-role only)
   - exclusion constraint `shoot_proposals_no_double_booking` (needs `btree_gist`) and
     `confirm_instant_booking()` (advisory-locked confirm that rechecks holds + overlaps)
2. **Database — apply `supabase/migration-v133-booking-followups.sql`** after v132. Additive.
   Adds the activity types booking logs (cancel, reassign, override, skipped, times offered),
   `shoot_proposals.reminder_sent_at` (+ index), `shoot_proposals.google_owner_user_id`, the
   `offer` booking source, and `team_google_calendar_connections` (service-role only, tokens
   encrypted like the business connection). Until it runs: reminders don't send, offers save as
   legacy proposals, and personal calendar connections show a "needs migration" notice.
3. **Environment — `GOOGLE_MAPS_API_KEY`** (server only; never sent to the browser).
   In Google Cloud enable **Routes API** and **Maps Static API** for the key; restrict it to those
   two APIs. Without it: drive time between shoots is assumed to be 30 minutes, travel fees are left
   for the business to quote (the business is notified), and the route modal shows a sketch.
4. **Cron — `/api/cron/shoot-reminders`** every 15 minutes (in `vercel.json`; needs the existing
   `CRON_SECRET`). `?dryRun=1` reports what would send.
5. **Address autocomplete** — enable **Places API (New)** on the same key and add it to the key's
   API restrictions. The request forms (street address) and Team → base address then suggest real
   addresses as people type (`/api/places`, same-origin only, rate limited, results biased to the
   visitor's area). Until it's enabled they work as plain text fields.
6. **Google Calendar** — no new scopes. The existing `calendar.events` +
   `calendar.calendarlist.readonly` grant covers busy-time reads, event writes, location and
   attendees. Busy times come from `events.list` (ShootPortal's own events are excluded; all-day
   events don't block).

## How it fits together

| Piece | Where |
| --- | --- |
| Settings model (`booking` in `business_settings.settings`) | `src/lib/booking/settings.ts` |
| Availability engine (pure) | `src/lib/booking/engine.ts` |
| Google Routes + Static Maps, per-business cache | `src/lib/booking/routes.ts` |
| Travel fee pricing (per-mile / tiers / none) + service area | `src/lib/booking/travel-pricing.ts` |
| Orchestration (facts, busy times, holds, availability) | `src/lib/booking/server.ts` |
| Writes (confirm, cancel, reassign, override) | `src/lib/booking/actions.ts` |
| API (client token, signed-in client, team) | `POST /api/booking`, `GET /api/booking/map` |
| Admin settings data, team profiles, photos | `/api/admin/booking`, `/api/admin/booking/photo` |
| Client pages | `/request/thank-you`, `/request/schedule?b=`, `/request/shoot?b=`, `/dashboard/projects/[id]/schedule`, `/dashboard/projects/[id]/shoot` |
| Business UI | Settings → Instant Booking / Services / Team & Availability; Calendar (team filter, drive times, Book shoot, appointment modal); Project → "Schedule shoot" |

**Booking modes:** Off (no scheduling step) · Optional (book now or "Request without scheduling") ·
Required (must pick a time — unless nothing is open, then the request still goes through).

**Separation of concerns:** booking never reads or changes proposals, invoices or payments. The
project pipeline only advances from *Awaiting Scheduling* to *Scheduled*. `projects.scheduling_status`
(`unscheduled`, `awaiting_booking`, `scheduled`, `reschedule_requested`, `cancelled`) is the
scheduling state.

**Travel fees vs. feasibility:** fees use one-way driving miles from the business address, measured
once at request time and saved on the estimate + project (never recalculated). Feasibility uses each
photographer's real day (previous shoot → property → next shoot, or base address).

**Double-booking:** holds (10 min) while a client confirms → server-side recheck through the same
engine → `confirm_instant_booking()` serialized per team member → exclusion constraint as the last
line. Manual scheduling and drag-to-reschedule use the same engine; conflicts can be overridden only
by an owner/admin, with a reason and explicit confirmation, and are logged.

**ZIP travel fees are retired.** Businesses that had them on are carried into the new model
automatically (tiers → tiers, per-mile-outside-radius → per-mile round trip). Historical estimates
keep their saved travel lines. `travel-fee.ts` remains only for reading old line items.

## Shoot reminders

Settings → Instant Booking → Shoot reminders: on by default, 24 hours before (2/12/24/48), to the
client and the assigned photographer (the owner on solo businesses). Channels follow Settings →
Notifications → *Shoot reminder*. One reminder per appointment row (`reminder_sent_at`, claimed
with a conditional update so overlapping runs can't double-send); a reschedule makes a new row, so
the new time gets its own reminder. Shoots booked after the reminder time are skipped. Applies to
every confirmed shoot, including ones confirmed through the legacy proposal flow.

## Offered times (replaces "propose a time")

The project page has one booking card: **Schedule shoot**, **Offer times** (up to 3 engine-checked
times; the client picks one in their portal or from the email), and **Copy booking link** (the
client's personal booking page; needs a client on the project and Instant Booking on). The old
proposal card only appears while something is pending (offered times, a time the client
suggested). Accepting any proposal, by client or business, now books through the engine and
`confirm_instant_booking()`, so it can't double-book; a taken time returns a clear message and the
business is notified. Offers don't hold the time.

## Personal Google Calendars

Each team member can connect their own Google account (Calendar → **My Google Calendar**, or their
card in Team & Availability). Their chosen calendars block their availability (read with their own
token; a broken connection fails closed, so they aren't offered). With "Each photographer's own
calendar" selected, their confirmed shoots are written to their chosen calendar through their own
account; reassigning moves the event between accounts (`google_owner_user_id` records which
account holds it). Disconnecting moves their upcoming shoots back to the business calendar. The
business connection and calendars shared with it keep working as before.

## Calendar

Week view is the default. Shoots are drawn for their booked length (`end_at`; legacy proposals
stay one hour) on the Shoot Calendar and Projects → Calendar. With "Show drive time" on, hatched
strips show the drive in (from home for the day's first shoot, else from the previous shoot) and
the drive home after the last one (`computeCalendarTravelLegs`, cached Routes). On team calendars
each photographer has a color (owner sets it from the swatch next to their name; stored
business-wide in `booking.teamColors`; automatic colors until chosen). Times use the business time
zone (Settings → Contact Information → Time zone, set automatically when the business address is
picked from suggestions); the calendar notes when it differs from the device's zone.

## Tests

`npm run test:instant-booking` — engine rules (incl. hold vs. Google conflicts), reminder timing
and wording, (hours, notice, buffers, drive time, start/end-of-day,
daily limits, Google conflicts, unknown drive times), team ranking/merge, time zones incl. DST,
pricing, service area, templates, booking token. No database or network.

`scripts/live-check-instant-booking.ts` — **writes live data**; runs Routes, holds, the
confirm race, the exclusion constraint and Google create/move/reassign/cancel against the owner's
own business, then deletes everything. Header explains how to run it with notifications muted.

## Known limitations / follow-ups

- Multiple appointments per project are supported in the data model (`appointment_key`) and the
  confirm function; the UI manages the primary appointment only.
- Offered times don't hold the slot; a client who picks a time someone else just took is asked to
  pick another (and the business is notified).
- Personal Google connections need the Google OAuth app to be published (or each person listed as
  a test user while it's in testing mode).
