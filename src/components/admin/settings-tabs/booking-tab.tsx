"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownWideNarrow,
  BellRing,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  CalendarX2,
  Car,
  Clock,
  Hourglass,
  Layers,
  MapPin,
  Plus,
  Route,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";
import {
  BookingCard,
  FieldLabel,
  MinutesSelect,
  NativeSelect,
  Notice,
  OptionCard,
  ToggleRow,
  WeeklyHoursEditor,
} from "@/components/admin/booking/booking-ui";
import { calendarLabel, useBookingOverview } from "@/components/admin/booking/use-booking-overview";
import { EVENT_TEMPLATE_FIELDS, REMINDER_LEAD_HOURS, type BookingSettings } from "@/lib/booking/settings";
import { travelPricingExample } from "@/lib/booking/travel-pricing";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8C3.9 20.6 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7H2.1C1.4 8.5 1 10.2 1 12s.4 3.5 1.1 5l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 3.9 3.4 2.1 7l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

const NOTICE = [0, 60, 120, 240, 720, 1440, 2880, 4320];
const WINDOW = [7, 14, 30, 60, 90, 120, 180, 365];
const BUFFERS = [0, 5, 10, 15, 20, 30, 45, 60];
const MARGINS = [0, 5, 10, 15, 20, 30];
const NOTICE_HOURS = [0, 2, 4, 12, 24, 48, 72];

function noticeLabel(minutes: number) {
  if (minutes === 0) return "No minimum";
  if (minutes < 60 * 24) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
}

export function BookingTab() {
  const { settings, setSettings, selectSection } = useSettingsTab();
  const booking = settings.booking;
  const { data: overview } = useBookingOverview();
  const [perDay, setPerDay] = useState(() => {
    const on = booking.workingHours.filter((d) => d.enabled);
    return on.some((d) => d.start !== on[0]?.start || d.end !== on[0]?.end);
  });
  const [showAdvancedTravel, setShowAdvancedTravel] = useState(false);
  const patch = (p: Partial<BookingSettings>) => setSettings((prev) => ({ ...prev, booking: { ...prev.booking, ...p } }));
  const patchEvents = (p: Partial<BookingSettings["events"]>) => patch({ events: { ...booking.events, ...p } });
  const patchReminders = (p: Partial<BookingSettings["reminders"]>) => patch({ reminders: { ...booking.reminders, ...p } });

  const google = overview?.google;
  const calendars = google?.calendars ?? [];
  const isTeam = (overview?.team.filter((m) => m.profile.bookable).length ?? 0) > 1;
  const off = booking.mode === "off";
  const addable = calendars.filter((c) => !booking.blockCalendarIds.includes(c.id));
  const travel = booking.travel;
  const travelSummary =
    travel.model === "none"
      ? "No travel fee"
      : travel.model === "per_mile"
        ? `${formatCurrency(travel.perMileCents)} per mile after ${travel.freeMiles} miles${travel.roundTrip ? " (round trip)" : ""}`
        : `${travel.tiers.length} distance tiers`;

  return (
    <div id="settings-booking" tabIndex={-1} className="scroll-mt-24 space-y-4 outline-none">
      <div>
        <SectionHeading id="booking">Instant Booking</SectionHeading>
        <p className="mt-1 text-sm text-muted">Control how clients book shoots, your availability, travel and calendar events.</p>
      </div>

      {overview && !overview.schemaReady ? (
        <Notice tone="warn">
          Instant Booking is almost ready: apply database migration <strong>v132</strong> (Instant Booking) to turn it on. Your
          settings below save now and take effect once it&apos;s applied.
        </Notice>
      ) : null}
      {overview && !overview.routesConfigured ? (
        <Notice tone="warn">
          Drive times and travel fees use Google Routes. Add a <code>GOOGLE_MAPS_API_KEY</code> to the server environment; until
          then ShootPortal assumes 30 minutes between shoots and leaves travel fees for you to quote.
        </Notice>
      ) : null}

      <BookingCard icon={CalendarCheck2} title="Booking mode" description="Choose how instant booking works for your clients." id="settings-booking-mode">
        <div className="grid gap-2.5 md:grid-cols-3">
          <OptionCard
            name="booking-mode"
            icon={CalendarOff}
            selected={booking.mode === "off"}
            onSelect={() => patch({ mode: "off" })}
            title="Off"
            description="Clients request a shoot and you approve the time."
          />
          <OptionCard
            name="booking-mode"
            icon={CalendarCheck2}
            selected={booking.mode === "optional"}
            onSelect={() => patch({ mode: "optional" })}
            title="Optional for client"
            description="Clients can book an available time instantly or request a time for approval."
          />
          <OptionCard
            name="booking-mode"
            icon={CalendarClock}
            selected={booking.mode === "required"}
            onSelect={() => patch({ mode: "required" })}
            title="Required for client"
            description="Clients choose a time to submit. If nothing is open, they can still send the request."
          />
        </div>
      </BookingCard>

      <div className={cn("space-y-4", off && "opacity-60")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <BookingCard
            icon={CalendarX2}
            title="Calendars that block availability"
            description="Busy times on these Google calendars keep you from being double-booked. Outlook calendars are chosen in Integrations → Outlook Calendar."
            id="settings-booking-calendars"
          >
            {!google?.connected ? (
              <p className="text-sm text-muted">
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => selectSection("integrations")}>
                  Connect Google Calendar
                </button>{" "}
                to block busy times. ShootPortal shoots always block, connected or not.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {booking.blockCalendarIds.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-heading">
                      <GoogleMark className="h-3.5 w-3.5" />
                      {calendarLabel(overview, id)}
                      <button
                        type="button"
                        aria-label={`Remove ${calendarLabel(overview, id)}`}
                        className="text-muted hover:text-heading"
                        onClick={() => patch({ blockCalendarIds: booking.blockCalendarIds.filter((x) => x !== id) })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  {!booking.blockCalendarIds.length ? <span className="text-xs text-muted">No calendars yet — only ShootPortal shoots block time.</span> : null}
                </div>
                {addable.length ? (
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-accent" aria-hidden />
                    <NativeSelect
                      ariaLabel="Add a Google calendar"
                      className="w-full max-w-xs"
                      value=""
                      onChange={(v) => v && patch({ blockCalendarIds: [...booking.blockCalendarIds, v] })}
                      options={[{ value: "", label: "Add Google Calendar…" }, ...addable.map((c) => ({ value: c.id, label: c.summary || c.id }))]}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </BookingCard>

          <BookingCard
            icon={CalendarPlus}
            title="Where confirmed shoots are created"
            description="The Google calendar that receives each confirmed shoot."
            id="settings-booking-destination"
          >
            {!google?.connected ? (
              <p className="text-sm text-muted">Shoots appear on your ShootPortal calendar. Connect Google Calendar to also add them there.</p>
            ) : (
              <div className="space-y-3">
                <NativeSelect
                  ariaLabel="Destination calendar"
                  value={booking.destinationCalendarId || ""}
                  onChange={(v) => patch({ destinationCalendarId: v })}
                  options={[
                    { value: "", label: `${calendarLabel(overview, google.defaultCalendarId || "primary")} (connected calendar)` },
                    ...calendars.filter((c) => c.id !== google.defaultCalendarId).map((c) => ({ value: c.id, label: c.summary || c.id })),
                  ]}
                />
                {isTeam ? (
                  <NativeSelect
                    ariaLabel="Team calendar strategy"
                    value={booking.calendarStrategy}
                    onChange={(v) => patch({ calendarStrategy: v as BookingSettings["calendarStrategy"] })}
                    options={[
                      { value: "shared", label: "All team shoots go to this calendar" },
                      { value: "individual", label: "Each photographer's own calendar, else this one" },
                    ]}
                  />
                ) : null}
                {isTeam && booking.calendarStrategy === "individual" ? (
                  <p className="text-xs text-muted">
                    Photographers connect their own Google account from Calendar → My Google Calendar (or Team → their card).
                    Until they do, their shoots go to the calendar set in Team, else this one.
                  </p>
                ) : null}
              </div>
            )}
          </BookingCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <BookingCard icon={Clock} title="Business working hours" description="When shoots can be booked. Team members can have their own hours." id="settings-booking-hours">
            <WeeklyHoursEditor
              idPrefix="booking-hours"
              value={booking.workingHours}
              onChange={(workingHours) => patch({ workingHours })}
              perDay={perDay}
              onPerDayChange={setPerDay}
            />
          </BookingCard>

          <BookingCard icon={CalendarDays} title="Booking rules" description="How far ahead clients can book and the notice you need.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="booking-notice" hint="The earliest a client can book, counted from now.">
                  Minimum notice
                </FieldLabel>
                <NativeSelect
                  id="booking-notice"
                  value={String(booking.minNoticeMinutes)}
                  onChange={(v) => patch({ minNoticeMinutes: Number(v) })}
                  options={(NOTICE.includes(booking.minNoticeMinutes) ? NOTICE : [...NOTICE, booking.minNoticeMinutes].sort((a, b) => a - b)).map((m) => ({ value: String(m), label: noticeLabel(m) }))}
                />
              </div>
              <div>
                <FieldLabel htmlFor="booking-window" hint="How far into the future clients can book.">
                  Booking window
                </FieldLabel>
                <NativeSelect
                  id="booking-window"
                  value={String(booking.bookingWindowDays)}
                  onChange={(v) => patch({ bookingWindowDays: Number(v) })}
                  options={(WINDOW.includes(booking.bookingWindowDays) ? WINDOW : [...WINDOW, booking.bookingWindowDays].sort((a, b) => a - b)).map((d) => ({ value: String(d), label: `${d} days` }))}
                />
              </div>
              <div>
                <FieldLabel htmlFor="booking-interval" hint="Start times are offered on this grid (e.g. 8:00, 8:30, 9:00).">
                  Start times every
                </FieldLabel>
                <MinutesSelect id="booking-interval" value={booking.slotIntervalMinutes} onChange={(v) => patch({ slotIntervalMinutes: v })} values={[15, 30, 60]} />
              </div>
            </div>
          </BookingCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <BookingCard icon={Layers} title="Buffer time" description="Time around each shoot for setup and wrap-up.">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="buffer-before">Before</FieldLabel>
                <MinutesSelect id="buffer-before" value={booking.bufferBeforeMinutes} onChange={(v) => patch({ bufferBeforeMinutes: v })} values={BUFFERS} />
              </div>
              <div>
                <FieldLabel htmlFor="buffer-after">After</FieldLabel>
                <MinutesSelect id="buffer-after" value={booking.bufferAfterMinutes} onChange={(v) => patch({ bufferAfterMinutes: v })} values={BUFFERS} />
              </div>
            </div>
          </BookingCard>
          <BookingCard icon={CalendarDays} title="Maximum shoots per day" description={isTeam ? "Per photographer. Override per person in Team." : "Most shoots you'll take in a day."}>
            <NativeSelect
              ariaLabel="Maximum shoots per day"
              value={String(booking.maxShootsPerDay)}
              onChange={(v) => patch({ maxShootsPerDay: Number(v) })}
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} shoot${i ? "s" : ""} per day` }))}
            />
          </BookingCard>
          <BookingCard icon={ArrowDownWideNarrow} title="Sort available times" description="How clients see open times.">
            <div className="space-y-2">
              {(
                [
                  ["chronological", "Chronological", "Earliest to latest."],
                  ["optimized", "Optimized", "Times with the least driving first."],
                ] as const
              ).map(([value, title, desc]) => (
                <label key={value} className="flex cursor-pointer items-start gap-2.5">
                  <input type="radio" name="slot-sort" className="mt-1 h-4 w-4 accent-accent" checked={booking.slotSort === value} onChange={() => patch({ slotSort: value })} />
                  <span>
                    <span className="block text-sm font-medium text-heading">{title}</span>
                    <span className="block text-xs text-muted">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </BookingCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <BookingCard icon={Car} title="Travel behavior" description="How drive time is handled when showing available times." id="settings-booking-travel-behavior">
            <div className="space-y-3">
              <div className="grid items-center gap-2 sm:grid-cols-[170px_1fr]">
                <FieldLabel htmlFor="travel-margin" hint="Extra time added to every drive estimate for traffic, parking and delays.">
                  Travel safety margin
                </FieldLabel>
                <MinutesSelect id="travel-margin" value={booking.travelSafetyMarginMinutes} onChange={(v) => patch({ travelSafetyMarginMinutes: v })} values={MARGINS} />
              </div>
              <div className="grid items-center gap-2 sm:grid-cols-[170px_1fr]">
                <FieldLabel htmlFor="travel-start" hint="Whether the drive to the first shoot of the day may start before your working hours.">
                  Start of day
                </FieldLabel>
                <NativeSelect
                  id="travel-start"
                  value={booking.startOfDayRule}
                  onChange={(v) => patch({ startOfDayRule: v as BookingSettings["startOfDayRule"] })}
                  options={[
                    { value: "travel_before_hours", label: "Drive before hours (shoot at opening)" },
                    { value: "travel_within_hours", label: "Drive within working hours" },
                  ]}
                />
              </div>
              <div className="grid items-center gap-2 sm:grid-cols-[170px_1fr]">
                <FieldLabel htmlFor="travel-end" hint="Whether the last shoot must finish by closing time.">
                  End of day
                </FieldLabel>
                <NativeSelect
                  id="travel-end"
                  value={booking.endOfDayRule}
                  onChange={(v) => patch({ endOfDayRule: v as BookingSettings["endOfDayRule"] })}
                  options={[
                    { value: "finish_by_close", label: "Finish by closing time" },
                    { value: "start_before_close", label: "Start before closing (may run over)" },
                  ]}
                />
              </div>
              <ToggleRow
                id="travel-return"
                checked={booking.allowReturnTravelOutsideHours}
                onChange={(v) => patch({ allowReturnTravelOutsideHours: v })}
                label="Allow return travel outside working hours"
                description="The drive home after the last shoot may end after your working hours."
              />
            </div>
          </BookingCard>

          <div className="space-y-4">
            <BookingCard
              icon={MapPin}
              title="Service area radius"
              description="Only allow instant booking within driving distance of your business address."
              action={
                <span className="flex min-h-9 items-center">
                  <Switch
                    id="radius-on"
                    aria-label="Limit instant booking to a service area"
                    checked={booking.serviceRadiusEnabled}
                    onCheckedChange={(v) => patch({ serviceRadiusEnabled: v })}
                  />
                </span>
              }
            >
              {booking.serviceRadiusEnabled ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NativeSelect
                      ariaLabel="Service radius"
                      value={String(booking.serviceRadiusMiles)}
                      onChange={(v) => patch({ serviceRadiusMiles: Number(v) })}
                      options={[10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200]
                        .concat([10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200].includes(booking.serviceRadiusMiles) ? [] : [booking.serviceRadiusMiles])
                        .sort((a, b) => a - b)
                        .map((m) => ({ value: String(m), label: `${m} miles` }))}
                    />
                    <NativeSelect
                      ariaLabel="Outside the service area"
                      value={booking.outsideAreaBehavior}
                      onChange={(v) => patch({ outsideAreaBehavior: v as BookingSettings["outsideAreaBehavior"] })}
                      options={[
                        { value: "custom_quote", label: "Outside: require a custom quote" },
                        { value: "request_only", label: "Outside: request only (no instant booking)" },
                        { value: "allow", label: "Outside: allow booking (travel fee applies)" },
                      ]}
                    />
                  </div>
                  <p className="text-xs text-muted">
                    Clients can book instantly within {booking.serviceRadiusMiles} driving miles of{" "}
                    {overview?.businessAddress ? overview.businessAddress : "your business address (add it in Contact)"}. Services can
                    also require a quote individually in Services.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted">Off — clients anywhere can book.</p>
              )}
            </BookingCard>

            <BookingCard icon={UserCog} title="Client self-service" description="Let clients manage their own booking, with notice limits.">
              <div className="space-y-3">
                {(
                  [
                    ["allowClientReschedule", "rescheduleNoticeHours", "Allow clients to reschedule"],
                    ["allowClientCancel", "cancelNoticeHours", "Allow clients to cancel"],
                  ] as const
                ).map(([flag, hours, label]) => (
                  <div key={flag} className="flex flex-wrap items-center justify-between gap-2">
                    <ToggleRow id={`self-${flag}`} checked={booking[flag]} onChange={(v) => patch({ [flag]: v } as Partial<BookingSettings>)} label={label} />
                    <div className="flex items-center gap-2 text-xs text-muted">
                      with at least
                      <NativeSelect
                        ariaLabel={`${label} notice`}
                        className="w-28"
                        disabled={!booking[flag]}
                        value={String(booking[hours])}
                        onChange={(v) => patch({ [hours]: Number(v) } as Partial<BookingSettings>)}
                        options={(NOTICE_HOURS.includes(booking[hours]) ? NOTICE_HOURS : [...NOTICE_HOURS, booking[hours]].sort((a, b) => a - b)).map((h) => ({ value: String(h), label: h === 0 ? "No notice" : `${h} hours` }))}
                      />
                      notice
                    </div>
                  </div>
                ))}
              </div>
            </BookingCard>

            <BookingCard icon={BellRing} title="Shoot reminders" description="A reminder before every confirmed shoot." id="settings-booking-reminders">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ToggleRow
                    id="reminders-on"
                    checked={booking.reminders.enabled}
                    onChange={(v) => patchReminders({ enabled: v })}
                    label="Send reminders"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <NativeSelect
                      ariaLabel="Reminder timing"
                      className="w-32"
                      disabled={!booking.reminders.enabled}
                      value={String(booking.reminders.leadHours)}
                      onChange={(v) => patchReminders({ leadHours: Number(v) })}
                      options={REMINDER_LEAD_HOURS.map((h) => ({ value: String(h), label: `${h} hours` }))}
                    />
                    before the shoot
                  </div>
                </div>
                <div className="space-y-2 border-t border-border pt-3">
                  <ToggleRow
                    id="reminders-client"
                    checked={booking.reminders.notifyClient}
                    disabled={!booking.reminders.enabled}
                    onChange={(v) => patchReminders({ notifyClient: v })}
                    label="Remind the client"
                    description="Time, address and a link to reschedule within your notice limits."
                  />
                  <ToggleRow
                    id="reminders-staff"
                    checked={booking.reminders.notifyPhotographer}
                    disabled={!booking.reminders.enabled}
                    onChange={(v) => patchReminders({ notifyPhotographer: v })}
                    label={isTeam ? "Remind the assigned photographer" : "Remind me"}
                    description="Client, address and a link to the shoot on your calendar."
                  />
                </div>
                <p className="text-xs text-muted">
                  Shoots booked after the reminder time (for example, booked today for tomorrow) skip it: the confirmation already went
                  out. Email, push and in-app channels follow Settings → Notifications → Shoot reminder.
                </p>
              </div>
            </BookingCard>
          </div>
        </div>

        {isTeam ? (
          <BookingCard icon={Users} title="Team booking" description="How photographers are offered and assigned.">
            <div className="space-y-3">
              <ToggleRow
                id="client-chooses"
                checked={booking.clientChoosesStaff}
                onChange={(v) => patch({ clientChoosesStaff: v })}
                label="Let clients choose a photographer"
                description="Off: ShootPortal recommends the best available photographer for each time."
              />
              {booking.clientChoosesStaff ? (
                <ToggleRow
                  id="show-unavailable"
                  checked={booking.showUnavailableStaff}
                  onChange={(v) => patch({ showUnavailableStaff: v })}
                  label="Let clients see unavailable photographers"
                  description="Hidden by default. When shown, they're marked unavailable and can't be booked."
                />
              ) : null}
              <p className="text-xs text-muted">
                Recommendation weights (drive distance, workload, service fit) are set per person in{" "}
                <button type="button" onClick={() => selectSection("team")} className="font-medium text-accent hover:underline">
                  Team &amp; Availability
                </button>
                .
              </p>
            </div>
          </BookingCard>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <BookingCard icon={CalendarPlus} title="Google Calendar event" description="How confirmed shoots appear on Google Calendar." id="settings-booking-event">
            <div className="space-y-3">
              <TemplateField
                id="event-title"
                label="Event title"
                value={booking.events.titleTemplate}
                onChange={(v) => patchEvents({ titleTemplate: v })}
              />
              <TemplateField
                id="event-description"
                label="Description"
                multiline
                value={booking.events.descriptionTemplate}
                onChange={(v) => patchEvents({ descriptionTemplate: v })}
              />
              <div className="grid gap-2.5 sm:grid-cols-2">
                <ToggleRow id="ev-link" checked={booking.events.includeProjectLink} onChange={(v) => patchEvents({ includeProjectLink: v })} label="Include ShootPortal project link" />
                <ToggleRow id="ev-loc" checked={booking.events.includeAddressAsLocation} onChange={(v) => patchEvents({ includeAddressAsLocation: v })} label="Property address as location" />
                <ToggleRow id="ev-staff" checked={booking.events.inviteAssignedStaff} onChange={(v) => patchEvents({ inviteAssignedStaff: v })} label="Invite the assigned photographer" />
                <ToggleRow id="ev-client" checked={booking.events.inviteClient} onChange={(v) => patchEvents({ inviteClient: v })} label="Invite the client" description="Google emails them an invitation." />
              </div>
            </div>
          </BookingCard>

          <BookingCard icon={Route} title="Travel fee" description="Priced from Google Routes driving distance.">
            <div className="space-y-2 text-sm">
              <p className="font-medium text-heading">{travelSummary}</p>
              <p className="text-xs text-muted">{travelPricingExample(travel)}</p>
              <button type="button" onClick={() => selectSection("services")} className="text-xs font-medium text-accent hover:underline">
                Edit travel fees in Services →
              </button>
              <button type="button" className="block text-xs text-muted hover:text-heading" onClick={() => setShowAdvancedTravel((v) => !v)}>
                {showAdvancedTravel ? "Hide" : "How is travel measured?"}
              </button>
              {showAdvancedTravel ? (
                <p className="text-xs text-muted">
                  Fees use one-way driving miles from your business address to the property, measured once when the request comes in
                  and saved with the estimate. Availability uses each photographer&apos;s real route for that day (previous shoot → this
                  property → next shoot), so the two never interfere.
                </p>
              ) : null}
            </div>
          </BookingCard>
        </div>
      </div>

      <p className="flex items-center gap-1.5 px-1 text-xs text-muted">
        <Hourglass className="h-3.5 w-3.5" aria-hidden /> Service durations and per-service booking rules live in{" "}
        <Link href="#settings-services" className="font-medium text-accent hover:underline">
          Services
        </Link>
        .
      </p>
    </div>
  );
}

function TemplateField({
  id,
  label,
  value,
  onChange,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const insert = (token: string) => onChange(`${value}${value && !value.endsWith(" ") && !value.endsWith("\n") ? " " : ""}${token}`);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </label>
        <NativeSelect
          ariaLabel={`Insert a field into ${label}`}
          className="w-36"
          value=""
          onChange={(v) => v && insert(v)}
          options={[{ value: "", label: "{ } Insert field" }, ...EVENT_TEMPLATE_FIELDS.map((f) => ({ value: f.token, label: f.label }))]}
        />
      </div>
      {multiline ? (
        <textarea
          id={id}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      )}
    </div>
  );
}
