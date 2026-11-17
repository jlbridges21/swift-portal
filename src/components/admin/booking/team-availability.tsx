"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  CalendarCheck2,
  CalendarDays,
  Camera,
  Car,
  ChevronRight,
  Clock,
  Eye,
  Gauge,
  Home,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";
import {
  BookingCard,
  FieldLabel,
  NativeSelect,
  Notice,
  PersonAvatar,
  ToggleRow,
  WeeklyHoursEditor,
} from "@/components/admin/booking/booking-ui";
import {
  calendarLabel,
  useBookingOverview,
  type BookingOverview,
  type OverviewTeamMember,
} from "@/components/admin/booking/use-booking-overview";
import type { TeamProfileFields } from "@/lib/booking/team";
import type { AssignmentWeights } from "@/lib/booking/settings";
import { cn } from "@/lib/utils";
import { MyGoogleCalendarButton } from "@/components/admin/booking/my-google-calendar";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";

type DetailTab = "scheduling" | "profile" | "assignment";

function roleLabel(m: OverviewTeamMember) {
  return m.role === "owner" ? "Owner" : m.role === "admin" ? "Admin" : "Staff";
}

export function TeamAvailabilityTab() {
  const { selectSection, settings } = useSettingsTab();
  const { data, error, loading, reload, setData } = useBookingOverview();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const members = useMemo(() => data?.team ?? [], [data]);
  const selected = members.find((m) => m.userId === selectedId) ?? members[0] ?? null;
  const solo = members.length <= 1;

  return (
    <div id="settings-team" tabIndex={-1} className="scroll-mt-24 space-y-4 outline-none">
      <div>
        <SectionHeading id="team">Team &amp; Availability</SectionHeading>
        <p className="mt-1 text-sm text-muted">
          {solo
            ? "Your photo, hours and service area — what clients see when they book you."
            : "Manage who can be booked, their schedules, and how they appear to clients."}
        </p>
      </div>

      {loading && !data ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
        </p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : data ? (
        <>
          {!data.profilesReady ? (
            <Notice tone="warn">Apply database migration v132 (Instant Booking) to save team scheduling profiles.</Notice>
          ) : null}
          <div className={cn("grid gap-4", !solo && "lg:grid-cols-[260px_1fr]")}>
            {!solo ? (
              <aside className="space-y-2">
                <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                  <p className="px-1 text-sm font-semibold text-heading">Team members</p>
                  <p className="px-1 pb-2 text-xs text-muted">Who can be booked, and their schedules.</p>
                  <div className="space-y-1.5">
                    {members.map((m) => (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => setSelectedId(m.userId)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                          selected?.userId === m.userId ? "border-accent bg-accent-subtle/60" : "border-transparent hover:bg-subtle"
                        )}
                      >
                        <PersonAvatar name={m.name} url={m.avatarUrl} size={40} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-heading">{m.name}</span>
                          <span className="block truncate text-xs text-muted">{m.profile.displayTitle || roleLabel(m)}</span>
                          <span
                            className={cn(
                              "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              m.profile.bookable
                                ? "bg-emerald-50 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300"
                                : "bg-subtle text-muted"
                            )}
                          >
                            {m.profile.bookable ? "Bookable" : "Not bookable"}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectSection("staff")}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-sm font-medium text-accent hover:bg-accent-subtle"
                  >
                    <Plus className="h-4 w-4" /> Add team member
                  </button>
                </div>
              </aside>
            ) : null}
            {selected ? (
              <MemberEditor
                key={selected.userId}
                member={selected}
                overview={data}
                solo={solo}
                businessName={settings.business.businessName}
                onSaved={reload}
                onPhoto={(url) =>
                  setData({ ...data, team: data.team.map((m) => (m.userId === selected.userId ? { ...m, avatarUrl: url } : m)) })
                }
              />
            ) : null}
          </div>
          {solo ? (
            <p className="text-xs text-muted">
              Growing your team?{" "}
              <button type="button" className="font-medium text-accent hover:underline" onClick={() => selectSection("staff")}>
                Invite a photographer
              </button>{" "}
              — ShootPortal will recommend the best person for each booking.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** This person's own Google connection: theirs to connect, everyone else sees the status. */
function OwnGoogleCalendarRow({ member, overview, onChanged }: { member: OverviewTeamMember; overview: BookingOverview; onChanged: () => void }) {
  const own = overview.memberCalendars.find((c) => c.userId === member.userId) ?? null;
  const isViewer = member.userId === overview.viewerUserId;
  const first = member.name.split(" ")[0] || "They";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-subtle/40 px-3 py-2.5">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-heading">{isViewer ? "Your own Google Calendar" : `${first}'s own Google Calendar`}</p>
        <p className={cn("text-xs", own?.status === "needs_reconnect" ? "text-amber-700 surface-dark:text-amber-300" : "text-muted")}>
          {!own
            ? isViewer
              ? "Not connected. Connect it so your appointments block bookings."
              : `Not connected. ${first} can connect it from Calendar → My Google Calendar.`
            : own.status === "needs_reconnect"
              ? `Needs reconnecting (${own.email ?? "Google account"}). Not offered for bookings until then.`
              : `Connected as ${own.email ?? "Google account"}.`}
        </p>
      </div>
      {isViewer ? (
        <MyGoogleCalendarButton label={own ? "Manage" : "Connect"} onClosed={onChanged} />
      ) : null}
    </div>
  );
}

function MemberEditor({
  member,
  overview,
  solo,
  businessName,
  onSaved,
  onPhoto,
}: {
  member: OverviewTeamMember;
  overview: BookingOverview;
  solo: boolean;
  businessName: string;
  onSaved: () => void;
  onPhoto: (url: string | null) => void;
}) {
  const { settings } = useSettingsTab();
  const [tab, setTab] = useState<DetailTab>("scheduling");
  const [name, setName] = useState(member.name);
  const [p, setP] = useState<TeamProfileFields>(() => ({
    ...member.profile,
    bookable: member.hasProfile ? member.profile.bookable : member.role === "owner" || member.profile.bookable,
  }));
  const [perDay, setPerDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ name: member.name, p }));
  const dirty = JSON.stringify({ name, p }) !== baseline;
  const patch = (next: Partial<TeamProfileFields>) => setP((prev) => ({ ...prev, ...next }));
  const services = overview.services.filter((s) => s.isActive);
  const calendars = overview.google.calendars;
  const ownHours = p.workingHours !== null;
  // Rough "today" is fine here: it only hides entries that already ended.
  const [cutoffDay] = useState(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
  const upcomingOff = p.timeOff.filter((t) => t.endDay >= cutoffDay);
  const weights: AssignmentWeights = p.assignmentWeights ?? settings.booking.assignmentWeights;

  useEffect(() => setMessage(null), [tab]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/booking", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, profile: p, name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't save.");
      setBaseline(JSON.stringify({ name, p }));
      setMessage({ tone: "ok", text: "Saved." });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Couldn't save." });
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("userId", member.userId);
      form.set("file", file);
      const res = await fetch("/api/admin/booking/photo", { method: "POST", credentials: "include", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Upload failed.");
      onPhoto(body.avatarUrl);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setUploading(true);
    await fetch(`/api/admin/booking/photo?userId=${encodeURIComponent(member.userId)}`, { method: "DELETE", credentials: "include" });
    onPhoto(null);
    setUploading(false);
  }

  const tabs: { id: DetailTab; label: string; icon: typeof CalendarDays }[] = [
    { id: "scheduling", label: "Scheduling & Booking", icon: CalendarDays },
    { id: "profile", label: "Client Profile", icon: UserRound },
    ...(!solo ? [{ id: "assignment" as const, label: "Assignment Preferences", icon: Sparkles }] : []),
  ];

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative">
            <PersonAvatar name={name} url={member.avatarUrl} size={88} className="rounded-2xl" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label={member.avatarUrl ? "Replace photo" : "Upload photo"}
              className="absolute -bottom-1.5 -right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-heading shadow-sm hover:bg-subtle"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadPhoto(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 rounded-md border border-transparent bg-transparent px-1 text-xl font-bold text-heading hover:border-border focus:border-accent focus:outline-none"
              />
              <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold text-muted">{roleLabel(member)}</span>
            </div>
            <p className="px-1 text-sm text-muted">{p.displayTitle || "Photographer"}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 pt-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> {member.email}
              </span>
              {p.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4" /> {p.phone}
                </span>
              ) : null}
            </div>
            {member.avatarUrl ? (
              <button type="button" onClick={removePhoto} className="px-1 text-xs text-muted hover:text-red-600">
                Remove photo
              </button>
            ) : (
              <p className="px-1 text-xs text-muted">Add a friendly headshot — clients see it when booking.</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
                tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-heading"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "scheduling" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <BookingCard icon={Briefcase} title="Role & services" description="Title and the services this person can be booked for.">
              <div className="space-y-3">
                <div>
                  <FieldLabel htmlFor="tm-title">Title</FieldLabel>
                  <input
                    id="tm-title"
                    value={p.displayTitle}
                    placeholder="Real Estate Photographer"
                    onChange={(e) => patch({ displayTitle: e.target.value })}
                    className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="tm-phone">Phone</FieldLabel>
                  <input id="tm-phone" value={p.phone} onChange={(e) => patch({ phone: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" />
                </div>
                <div>
                  <FieldLabel hint="Leave empty to allow every service.">Service qualifications</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s) => {
                      const on = p.qualifiedServiceIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            patch({ qualifiedServiceIds: on ? p.qualifiedServiceIds.filter((x) => x !== s.id) : [...p.qualifiedServiceIds, s.id] })
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium",
                            on ? "border-accent bg-accent-subtle text-accent" : "border-border text-muted hover:text-heading"
                          )}
                        >
                          {s.name}
                          {on ? <X className="h-3 w-3" /> : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-muted">{p.qualifiedServiceIds.length ? `${p.qualifiedServiceIds.length} selected` : "All services"}</p>
                </div>
              </div>
            </BookingCard>

            <BookingCard
              icon={Clock}
              title="Working hours"
              description="When this person is available for shoots."
              action={
                <label className="flex items-center gap-2 text-xs text-muted">
                  Own hours
                  <Switch
                    aria-label="Use own working hours"
                    checked={ownHours}
                    onCheckedChange={(v) => patch({ workingHours: v ? settings.booking.workingHours.map((d) => ({ ...d })) : null })}
                  />
                </label>
              }
            >
              {ownHours && p.workingHours ? (
                <WeeklyHoursEditor idPrefix={`tm-${member.userId}`} value={p.workingHours} onChange={(wh) => patch({ workingHours: wh })} perDay={perDay} onPerDayChange={setPerDay} />
              ) : (
                <p className="text-sm text-muted">Uses your business working hours (Settings → Instant Booking).</p>
              )}
            </BookingCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <BookingCard icon={Home} title="Home / base address" description="Where their day starts and ends. Used for drive times and assignments.">
              <AddressAutocomplete
                aria-label="Base address"
                value={p.baseAddress}
                placeholder={overview.businessAddress ?? "Start typing an address"}
                onChange={(v) => patch({ baseAddress: v })}
                onPick={(a) => patch({ baseAddress: a.formatted })}
                inputClassName="h-10 bg-card"
              />
              <p className="mt-1.5 text-xs text-muted">Pick from the suggestions so drive times are accurate. Leave empty to use the business address.</p>
            </BookingCard>

            <BookingCard icon={CalendarCheck2} title="Availability & calendars" description="Keep availability up to date from Google Calendar.">
              <OwnGoogleCalendarRow member={member} overview={overview} onChanged={onSaved} />
              {!overview.google.connected ? (
                <p className="mt-3 text-sm text-muted">Connect the business Google Calendar in Integrations to also block calendars shared with it.</p>
              ) : (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  <div>
                    <FieldLabel hint={member.role === "owner" ? "Adds to the business calendars in Instant Booking." : "Busy times here block this person."}>
                      Calendars that block availability
                    </FieldLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {p.blockCalendarIds.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs">
                          {calendarLabel(overview, id)}
                          <button type="button" aria-label="Remove" onClick={() => patch({ blockCalendarIds: p.blockCalendarIds.filter((x) => x !== id) })}>
                            <X className="h-3 w-3 text-muted" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <NativeSelect
                      ariaLabel="Add blocking calendar"
                      className="mt-2"
                      value=""
                      onChange={(v) => v && patch({ blockCalendarIds: [...p.blockCalendarIds, v] })}
                      options={[
                        { value: "", label: "Add calendar…" },
                        ...calendars.filter((c) => !p.blockCalendarIds.includes(c.id)).map((c) => ({ value: c.id, label: c.summary || c.id })),
                      ]}
                    />
                  </div>
                  {settings.booking.calendarStrategy === "individual" ? (
                    <div>
                      <FieldLabel>Calendar for confirmed shoots</FieldLabel>
                      <NativeSelect
                        ariaLabel="Calendar for confirmed shoots"
                        value={p.destinationCalendarId}
                        onChange={(v) => patch({ destinationCalendarId: v })}
                        options={[{ value: "", label: "Business calendar" }, ...calendars.map((c) => ({ value: c.id, label: c.summary || c.id }))]}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </BookingCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <BookingCard icon={Layers} title="Max shoots per day" description="Leave on default to use the business limit.">
              <NativeSelect
                ariaLabel="Max shoots per day"
                value={p.maxShootsPerDay == null ? "" : String(p.maxShootsPerDay)}
                onChange={(v) => patch({ maxShootsPerDay: v ? Number(v) : null })}
                options={[
                  { value: "", label: `Business default (${settings.booking.maxShootsPerDay})` },
                  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} shoot${i ? "s" : ""} per day` })),
                  // A value the team member typed in their own Settings.
                  ...(p.maxShootsPerDay != null && p.maxShootsPerDay > 12
                    ? [{ value: String(p.maxShootsPerDay), label: `${p.maxShootsPerDay} shoots per day` }]
                    : []),
                ]}
              />
            </BookingCard>
            <BookingCard icon={MapPin} title="Service area radius" description="Only assign properties within this driving distance of their base.">
              <NativeSelect
                ariaLabel="Service area radius"
                value={p.serviceRadiusMiles == null ? "" : String(p.serviceRadiusMiles)}
                onChange={(v) => patch({ serviceRadiusMiles: v ? Number(v) : null })}
                options={[
                  {
                    value: "",
                    label: settings.booking.serviceRadiusEnabled ? `Business default (${settings.booking.serviceRadiusMiles} miles)` : "No limit",
                  },
                  ...[...new Set([10, 15, 20, 25, 30, 40, 50, 75, 100, ...(p.serviceRadiusMiles != null ? [p.serviceRadiusMiles] : [])])]
                    .sort((a, b) => a - b)
                    .map((m) => ({ value: String(m), label: `${m} miles` })),
                ]}
              />
              {!settings.booking.serviceRadiusEnabled ? (
                <p className="mt-1.5 text-xs text-muted">Turn on the service area in Instant Booking for radius limits to apply.</p>
              ) : null}
            </BookingCard>
          </div>

          {member.role === "staff" ? (
            <BookingCard icon={UserRound} title="Their own Settings" description="What this person can change from Settings in their own account.">
              <div className="space-y-4">
                <ToggleRow
                  id={`limits-${member.userId}`}
                  checked={p.staffCanEditLimits}
                  onChange={(v) => patch({ staffCanEditLimits: v })}
                  label="Let them change their max shoots per day and drive distance"
                  description="Working hours and time off are always theirs to manage."
                />
                <div>
                  <p className="mb-1.5 text-xs font-medium text-foreground">Upcoming time off</p>
                  {upcomingOff.length ? (
                    <ul className="space-y-1 text-sm text-heading">
                      {upcomingOff.map((t) => (
                        <li key={t.id}>
                          {t.startDay === t.endDay ? t.startDay : `${t.startDay} → ${t.endDay}`}
                          {t.startTime && t.endTime ? ` · ${t.startTime}–${t.endTime}` : " · all day"}
                          {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">None. They add time off from their own Settings.</p>
                  )}
                </div>
              </div>
            </BookingCard>
          ) : null}

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                <CalendarDays className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-sm font-semibold text-heading">Can be offered in client-facing booking</p>
                <p className="text-[13px] text-muted">Include this person as an available option when clients book a shoot.</p>
              </div>
            </div>
            <Switch aria-label="Can be offered in client booking" checked={p.bookable} onCheckedChange={(v) => patch({ bookable: v })} />
          </div>
        </div>
      ) : null}

      {tab === "profile" ? (
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <BookingCard icon={UserRound} title="Client-facing booking profile" description="What clients see when choosing a photographer.">
            <div className="space-y-3">
              <div>
                <FieldLabel htmlFor="tm-display-title">Display title</FieldLabel>
                <input
                  id="tm-display-title"
                  value={p.displayTitle}
                  placeholder="Real Estate Photographer"
                  onChange={(e) => patch({ displayTitle: e.target.value })}
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                />
              </div>
              <div>
                <FieldLabel htmlFor="tm-bio">Short bio</FieldLabel>
                <textarea
                  id="tm-bio"
                  rows={4}
                  maxLength={160}
                  value={p.shortBio}
                  placeholder="Experienced real estate photographer who delivers clean, market-ready photos with a fast turnaround."
                  onChange={(e) => patch({ shortBio: e.target.value })}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
                <p className="text-right text-xs text-muted">{p.shortBio.length} / 160</p>
              </div>
            </div>
          </BookingCard>
          <BookingCard icon={Eye} title="Client card preview" description={`How ${solo ? "you" : "this person"} appear on ${businessName}'s booking page.`}>
            <div className="flex items-center gap-3 rounded-xl border border-accent bg-accent-subtle/50 p-3.5 ring-1 ring-accent">
              <PersonAvatar name={name} url={member.avatarUrl} size={56} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-heading">{name}</p>
                <p className="truncate text-xs text-muted">{p.displayTitle || "Photographer"}</p>
                <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Available</span>
              </div>
            </div>
            {p.shortBio ? <p className="mt-3 text-xs leading-relaxed text-muted">{p.shortBio}</p> : null}
          </BookingCard>
        </div>
      ) : null}

      {tab === "assignment" ? (
        <BookingCard icon={Sparkles} title="Assignment preferences" description="How this person is prioritized when ShootPortal recommends someone for a booking.">
          <div className="space-y-4">
            {(
              [
                ["distance", "Drive distance", Car, "Prefer them when they're closest to the property."],
                ["workload", "Workload", Gauge, "Prefer them when their day is lighter."],
                ["fit", "Qualification fit", Layers, "Prefer them when they specialize in the booked services."],
              ] as const
            ).map(([key, label, Icon, hint]) => (
              <div key={key} className="grid items-center gap-2 sm:grid-cols-[180px_1fr_70px]">
                <span className="flex items-center gap-2 text-sm font-medium text-heading" title={hint}>
                  <Icon className="h-4 w-4 text-muted" /> {label}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={weights[key]}
                  aria-label={label}
                  onChange={(e) => patch({ assignmentWeights: { ...weights, [key]: Number(e.target.value) } })}
                  className="w-full accent-accent"
                />
                <span className="text-xs text-muted">{weights[key] >= 70 ? "High" : weights[key] >= 40 ? "Medium" : "Low"}</span>
              </div>
            ))}
            {p.assignmentWeights ? (
              <button type="button" className="text-xs text-muted hover:text-heading" onClick={() => patch({ assignmentWeights: null })}>
                Reset to business defaults
              </button>
            ) : null}
          </div>
        </BookingCard>
      ) : null}

      <div className="sticky bottom-0 z-20 flex items-center justify-end gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
        {message ? (
          <span className={cn("mr-auto text-sm", message.tone === "ok" ? "text-emerald-700" : "text-red-600")}>{message.text}</span>
        ) : dirty ? (
          <span className="mr-auto text-sm text-muted">Unsaved changes</span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || saving}
          onClick={() => {
            const prev = JSON.parse(baseline) as { name: string; p: TeamProfileFields };
            setName(prev.name);
            setP(prev.p);
          }}
        >
          <Trash2 className="h-4 w-4" /> Discard
        </Button>
        <Button type="button" variant="accent" disabled={!dirty || saving || !overview.profilesReady} onClick={save} className="min-w-[120px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save changes
        </Button>
      </div>
    </div>
  );
}
