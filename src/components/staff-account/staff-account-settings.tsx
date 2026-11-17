"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Camera,
  CalendarClock,
  KeyRound,
  Loader2,
  Mail,
  Palette,
  ShieldCheck,
  UserRound,
  Check,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import { createClient } from "@/lib/supabase/client";
import { BookingCard, FieldLabel, NativeSelect, Notice, PersonAvatar, ToggleRow } from "@/components/admin/booking/booking-ui";
import { StaffAvailabilitySection } from "@/components/staff-account/staff-availability-section";
import { useSectionSave } from "@/components/staff-account/use-section-save";
import {
  STAFF_NOTIFICATION_EVENTS,
  isStaffEventOn,
  type StaffNotificationEventKey,
  type ThemePreference,
} from "@/lib/staff-account-shared";
import type { StaffAccountData } from "@/lib/staff-account";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "security", label: "Sign-in & security", icon: KeyRound },
  { id: "availability", label: "Availability", icon: CalendarClock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "access", label: "Your access", icon: ShieldCheck },
] as const;

const MIGRATION_NOTE = "Your studio needs a quick update before this can be saved. Ask your studio owner.";

/**
 * A team member's own Settings. Trimmed down from Business Settings: only things about this
 * person. Each card saves on its own.
 */
export function StaffAccountSettings({
  data,
  pendingEmail,
}: {
  data: StaffAccountData;
  /** New sign-in email waiting for confirmation. */
  pendingEmail: string | null;
}) {
  const sections = useMemo(
    () => SECTIONS.filter((s) => s.id !== "availability" || data.availability.bookable),
    [data.availability.bookable]
  );
  const search = useSearchParams();
  const router = useRouter();

  // Messages from the Google Calendar round trip and the email-change link.
  useEffect(() => {
    const gcal = search.get("mycal");
    const email = search.get("email");
    if (gcal !== "connected" && gcal !== "error" && email !== "updated") return;
    if (gcal === "connected") toast.success("Google Calendar connected. Your busy times now block bookings.");
    if (gcal === "error") toast.error("Google Calendar didn't connect. Please try again.");
    if (email === "updated") toast.success("Your sign-in email is updated.");
    router.replace(`/admin/account${window.location.hash}`, { scroll: false });
  }, [search, router]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Settings sections" className="mb-5 lg:mb-0">
          <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {sections.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-heading lg:w-full"
                >
                  <s.icon className="h-4 w-4" aria-hidden />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <ProfileSection data={data} />
          <SecuritySection email={data.email} pendingEmail={pendingEmail} />
          {data.availability.bookable ? <StaffAvailabilitySection data={data} /> : null}
          <NotificationsSection data={data} />
          <PreferencesSection data={data} />
          <AccessSection data={data} />
        </div>
      </div>
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────

function ProfileSection({ data }: { data: StaffAccountData }) {
  const router = useRouter();
  const { saving, save } = useSectionSave("profile");
  const [fullName, setFullName] = useState(data.fullName);
  const [title, setTitle] = useState(data.profile.displayTitle);
  const [bio, setBio] = useState(data.profile.shortBio);
  const [phone, setPhone] = useState(data.profile.phone);
  const [address, setAddress] = useState(data.profile.baseAddress);
  const [avatarUrl, setAvatarUrl] = useState(data.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    fullName !== data.fullName ||
    title !== data.profile.displayTitle ||
    bio !== data.profile.shortBio ||
    phone !== data.profile.phone ||
    address !== data.profile.baseAddress;

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image (JPG, PNG or WebP).");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form, credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { avatar_url?: string; error?: string };
      if (!res.ok || !json.avatar_url) {
        toast.error(json.error || "Couldn't upload your photo.");
        return;
      }
      setAvatarUrl(json.avatar_url);
      toast.success("Photo updated");
      router.refresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <BookingCard
      id="profile"
      icon={UserRound}
      title="Profile"
      description="How you appear to clients and your team."
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <PersonAvatar name={fullName || data.email} url={avatarUrl} size={72} />
          <div className="space-y-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              id="staff-avatar"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Camera className="mr-1.5 h-3.5 w-3.5" />}
              {avatarUrl ? "Change photo" : "Add photo"}
            </Button>
            <p className="text-xs text-muted">A clear, friendly headshot works best.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="staff-name">Full name</FieldLabel>
            <Input id="staff-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={120} />
          </div>
          <div>
            <FieldLabel htmlFor="staff-title">Job title</FieldLabel>
            <Input id="staff-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lead Pilot" maxLength={80} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="staff-bio">Short bio</FieldLabel>
            <Textarea
              id="staff-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder="FAA Part 107 pilot with 6 years of real estate and construction work."
            />
            <p className="mt-1 text-right text-xs text-muted">{bio.length}/400</p>
          </div>
          <div>
            <FieldLabel htmlFor="staff-phone">Phone</FieldLabel>
            <Input id="staff-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={40} />
          </div>
          <div>
            <FieldLabel htmlFor="staff-base" hint="Instant Booking measures your drive time to each shoot from here.">
              Home base address
            </FieldLabel>
            <AddressAutocomplete
              id="staff-base"
              value={address}
              onChange={setAddress}
              onPick={(a) => setAddress(a.formatted)}
              placeholder="Leave blank to start from the studio"
              maxLength={300}
            />
          </div>
        </div>

        <Notice>
          <span className="font-medium">Where clients see this:</span> your photo, name, title and bio appear on the booking
          page when clients choose who shoots, on their scheduled shoot page, and your name appears in their shoot emails.
          Your phone and home base are only visible to your studio.
        </Notice>
        {!data.bookingReady ? <Notice tone="warn">Title, bio, phone and home base can&apos;t be saved yet. {MIGRATION_NOTE}</Notice> : null}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!dirty || saving || !fullName.trim()}
            onClick={() =>
              void save(
                data.bookingReady
                  ? { fullName, displayTitle: title, shortBio: bio, phone, baseAddress: address }
                  : { fullName },
                "Profile saved"
              )
            }
          >
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>
    </BookingCard>
  );
}

// ── Sign-in & security ─────────────────────────────────────────────────────

function SecuritySection({ email, pendingEmail }: { email: string; pendingEmail: string | null }) {
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(pendingEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function changeEmail() {
    const next = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (next === email.toLowerCase()) {
      toast.error("That's already your sign-in email.");
      return;
    }
    setEmailBusy(true);
    try {
      const supabase = createClient();
      const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/admin/account?email=updated#security")}`;
      const { error } = await supabase.auth.updateUser({ email: next }, { emailRedirectTo: redirect });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSentTo(next);
      setNewEmail("");
      toast.success(`Check ${next} for a confirmation link.`);
    } finally {
      setEmailBusy(false);
    }
  }

  async function changePassword() {
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("The passwords don't match.");
      return;
    }
    setPasswordBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      setPassword("");
      setConfirm("");
      toast.success("Password updated");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <BookingCard id="security" icon={KeyRound} title="Sign-in & security" description="The email and password you sign in with.">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted" aria-hidden />
            <span className="text-muted">Signed in as</span>
            <span className="font-medium text-heading">{email}</span>
          </div>
          {sentTo ? (
            <Notice>
              Waiting for you to confirm <span className="font-medium">{sentTo}</span>. Open the link we emailed there; your
              sign-in email changes once you do. If you also get a link at your current address, open that one too.
            </Notice>
          ) : null}
          <div>
            <FieldLabel htmlFor="staff-new-email">New email</FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="staff-new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
              <Button type="button" variant="outline" disabled={emailBusy || !newEmail.trim()} onClick={() => void changeEmail()}>
                {emailBusy ? "Sending…" : "Change email"}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              We&apos;ll send a confirmation link to the new address. It also becomes where your notifications go.
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-heading">Change password</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="staff-password">New password</FieldLabel>
              <Input
                id="staff-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div>
              <FieldLabel htmlFor="staff-password-confirm">Confirm new password</FieldLabel>
              <Input
                id="staff-password-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">At least 8 characters.</p>
            <Button type="button" disabled={passwordBusy || !password || !confirm} onClick={() => void changePassword()}>
              {passwordBusy ? "Updating…" : "Update password"}
            </Button>
          </div>
        </div>
      </div>
    </BookingCard>
  );
}

// ── Notifications ──────────────────────────────────────────────────────────

function NotificationsSection({ data }: { data: StaffAccountData }) {
  const { saving, save } = useSectionSave("notifications");
  const initial = data.notifications;
  const [emailOn, setEmailOn] = useState(initial.emailOn);
  const [inAppOn, setInAppOn] = useState(initial.inAppOn);
  const initialEvents = useMemo(
    () =>
      Object.fromEntries(STAFF_NOTIFICATION_EVENTS.map((e) => [e.key, isStaffEventOn(initial.events, e.key)])) as Record<
        StaffNotificationEventKey,
        boolean
      >,
    [initial.events]
  );
  const [events, setEvents] = useState(initialEvents);
  const eventsDirty = STAFF_NOTIFICATION_EVENTS.some((e) => events[e.key] !== initialEvents[e.key]);
  const dirty = emailOn !== initial.emailOn || inAppOn !== initial.inAppOn || eventsDirty;
  const bothOff = !emailOn && !inAppOn;

  return (
    <BookingCard
      id="notifications"
      icon={Bell}
      title="Notifications"
      description={`How you hear about your projects. Emails go to ${data.email}. Billing and subscription alerts stay with your studio owner.`}
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <ToggleRow id="notif-email" checked={emailOn} onChange={setEmailOn} label="Email" description="Send alerts to your inbox." />
          <ToggleRow id="notif-inapp" checked={inAppOn} onChange={setInAppOn} label="In-app" description="Bell alerts while you're signed in." />
        </div>

        <div className="border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-heading">Tell me about</h4>
          <p className="mb-3 text-xs text-muted">Only for projects you&apos;re on.</p>
          <div className={cn("space-y-3", bothOff && "opacity-50")}>
            {STAFF_NOTIFICATION_EVENTS.map((e) => (
              <ToggleRow
                key={e.key}
                id={`notif-${e.key}`}
                checked={events[e.key]}
                onChange={(v) => setEvents((prev) => ({ ...prev, [e.key]: v }))}
                label={e.label}
                description={e.hint}
                disabled={!data.v134Ready || bothOff}
              />
            ))}
          </div>
          {bothOff ? <p className="mt-3 text-xs text-muted">Turn on email or in-app to choose which alerts you get.</p> : null}
          {!data.v134Ready ? <div className="mt-3"><Notice tone="warn">Per-alert choices aren&apos;t available yet. {MIGRATION_NOTE}</Notice></div> : null}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!dirty || saving}
            onClick={() =>
              void save(
                { emailOn, inAppOn, ...(data.v134Ready && eventsDirty ? { events } : {}) },
                "Notification settings saved"
              )
            }
          >
            {saving ? "Saving…" : "Save notifications"}
          </Button>
        </div>
      </div>
    </BookingCard>
  );
}

// ── Preferences ────────────────────────────────────────────────────────────

function allTimeZones(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    if (supported) return supported("timeZone");
  } catch {
    /* older browsers */
  }
  return [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Phoenix",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
  ];
}

function zoneLabel(zone: string): string {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return `${zone.replace(/_/g, " ")}${name ? ` (${name})` : ""}`;
  } catch {
    return zone;
  }
}

function PreferencesSection({ data }: { data: StaffAccountData }) {
  const { saving, save } = useSectionSave("preferences");
  const [timeZone, setTimeZone] = useState(data.preferences.timeZone ?? "");
  const [theme, setTheme] = useState<ThemePreference>(data.preferences.theme);
  const [zones, setZones] = useState<string[]>([]);
  useEffect(() => setZones(allTimeZones()), []);
  const dirty = timeZone !== (data.preferences.timeZone ?? "") || theme !== data.preferences.theme;

  const zoneOptions = useMemo(() => {
    const list = zones.length ? zones : [data.preferences.businessTimeZone];
    const options = [{ value: "", label: `Same as the studio — ${zoneLabel(data.preferences.businessTimeZone)}` }];
    for (const z of list) options.push({ value: z, label: zoneLabel(z) });
    if (timeZone && !list.includes(timeZone)) options.push({ value: timeZone, label: zoneLabel(timeZone) });
    return options;
  }, [zones, data.preferences.businessTimeZone, timeZone]);

  const themes: { value: ThemePreference; label: string; hint: string }[] = [
    { value: "studio", label: "Match studio", hint: "Your studio's look" },
    { value: "light", label: "Light", hint: "Light background" },
    { value: "dark", label: "Dark", hint: "Easier at night" },
  ];

  return (
    <BookingCard id="preferences" icon={Palette} title="Preferences" description="Make the app work the way you like.">
      <div className="space-y-5">
        <div>
          <FieldLabel htmlFor="staff-tz" hint="Used for your shoot reminders. Shoot times on booking pages stay in the studio's time zone.">
            Time zone
          </FieldLabel>
          <NativeSelect
            id="staff-tz"
            value={timeZone}
            onChange={setTimeZone}
            options={zoneOptions}
            disabled={!data.v134Ready}
            className="w-full sm:max-w-md"
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-foreground">Theme</p>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2 sm:max-w-md">
            {themes.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={theme === t.value}
                disabled={!data.v134Ready}
                onClick={() => setTheme(t.value)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                  theme === t.value ? "border-accent bg-accent-subtle" : "border-border bg-card hover:border-accent/50"
                )}
              >
                <span className="block text-sm font-medium text-heading">{t.label}</span>
                <span className="block text-xs text-muted">{t.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {!data.v134Ready ? <Notice tone="warn">Time zone and theme aren&apos;t available yet. {MIGRATION_NOTE}</Notice> : null}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!dirty || saving || !data.v134Ready}
            onClick={() => void save({ timeZone: timeZone || null, theme }, "Preferences saved")}
          >
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </div>
    </BookingCard>
  );
}

// ── Your access ────────────────────────────────────────────────────────────

function AccessSection({ data }: { data: StaffAccountData }) {
  const areas = data.access.groups.find((g) => g.id === "areas");
  const rest = data.access.groups.filter((g) => g.id !== "areas");
  return (
    <BookingCard
      id="access"
      icon={ShieldCheck}
      title="Your access"
      description="What your studio owner has set up for you."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Role</span>
          <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-semibold text-accent">Team member</span>
          {areas?.allowed.length ? (
            <>
              <span className="ml-2 text-muted">Sections</span>
              {areas.allowed.map((a) => (
                <span key={a} className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium text-heading">
                  {a}
                </span>
              ))}
            </>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {rest.map((g) => (
            <div key={g.id} className="rounded-xl border border-border p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</p>
              {g.allowed.length ? (
                <ul className="space-y-1">
                  {g.allowed.map((label) => (
                    <li key={label} className="flex items-center gap-1.5 text-sm text-heading">
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  No access
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">Contact your studio owner to change access.</p>
      </div>
    </BookingCard>
  );
}
