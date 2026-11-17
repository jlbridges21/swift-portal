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
2. **Environment — `GOOGLE_MAPS_API_KEY`** (server only; never sent to the browser).
   In Google Cloud enable **Routes API** and **Maps Static API** for the key; restrict it to those
   two APIs. Without it: drive time between shoots is assumed to be 30 minutes, travel fees are left
   for the business to quote (the business is notified), and the route modal shows a sketch.
3. **Google Calendar** — no new scopes. The existing `calendar.events` +
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

## Tests

`npm run test:instant-booking` — engine rules (hours, notice, buffers, drive time, start/end-of-day,
daily limits, Google conflicts, unknown drive times), team ranking/merge, time zones incl. DST,
pricing, service area, templates, booking token. No database or network.

## Known limitations / follow-ups

- Team members' calendars are read through the business's single Google connection (share each
  photographer's calendar with that account). Per-person Google OAuth is a follow-up.
- Appointment reminders (24h before) are not added yet; confirmation, reschedule and cancellation
  notifications are.
- Multiple appointments per project are supported in the data model (`appointment_key`) and the
  confirm function; the UI manages the primary appointment only.
- The legacy propose/confirm card stays on the project page for businesses that prefer proposing
  times to clients.
