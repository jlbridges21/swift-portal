import { NextResponse } from "next/server";
import { requireStaffSelf } from "@/lib/staff-self-api";
import { saveOwnBookingProfile, saveOwnPreferences } from "@/lib/staff-account";
import { mergeWeeklyHours } from "@/lib/booking/settings";
import {
  STAFF_NOTIFICATION_EVENTS,
  isValidTimeZone,
  parseThemePreference,
  parseTimeOff,
  type StaffNotificationEventPrefs,
} from "@/lib/staff-account-shared";

/**
 * A staff member's own Settings. One section per request:
 *   profile        name + booking profile (title, bio, phone, home base)
 *   availability   weekly hours, max shoots/day, drive distance, time off
 *   notifications  email / in-app switches + per-event choices
 *   preferences    time zone, theme
 * Email and password changes go through Supabase Auth from the browser.
 */
export async function PATCH(request: Request) {
  const auth = await requireStaffSelf();
  if (!auth.ok) return auth.response;
  const { profile, businessId } = auth;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.section !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const intOrNull = (v: unknown, min: number, max: number): number | null | "invalid" => {
    if (v === null || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : "invalid";
  };

  switch (body.section) {
    case "profile": {
      const fullName = str(body.fullName, 120);
      if (fullName !== undefined && !fullName.trim()) {
        return NextResponse.json({ error: "Enter your name." }, { status: 400 });
      }
      if (typeof body.shortBio === "string" && body.shortBio.length > 400) {
        return NextResponse.json({ error: "Keep your bio under 400 characters." }, { status: 400 });
      }
      const named = await saveOwnPreferences(businessId, profile.id, { fullName });
      if (!named.ok) return NextResponse.json({ error: named.error }, { status: named.status });
      const saved = await saveOwnBookingProfile(businessId, profile.id, {
        displayTitle: str(body.displayTitle, 80),
        shortBio: str(body.shortBio, 400),
        phone: str(body.phone, 40),
        baseAddress: str(body.baseAddress, 300),
      });
      if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
      return NextResponse.json({ ok: true });
    }

    case "availability": {
      const patch: Parameters<typeof saveOwnBookingProfile>[2] = {};
      if ("workingHours" in body) {
        patch.workingHours = Array.isArray(body.workingHours) ? mergeWeeklyHours(body.workingHours) : null;
      }
      if ("maxShootsPerDay" in body) {
        const v = intOrNull(body.maxShootsPerDay, 1, 50);
        if (v === "invalid") return NextResponse.json({ error: "Max shoots per day must be 1–50." }, { status: 400 });
        patch.maxShootsPerDay = v;
      }
      if ("serviceRadiusMiles" in body) {
        const v = intOrNull(body.serviceRadiusMiles, 1, 1000);
        if (v === "invalid") return NextResponse.json({ error: "Drive distance must be 1–1000 miles." }, { status: 400 });
        patch.serviceRadiusMiles = v;
      }
      if ("timeOff" in body) {
        if (!Array.isArray(body.timeOff)) return NextResponse.json({ error: "Invalid time off." }, { status: 400 });
        const parsed = parseTimeOff(body.timeOff);
        if (parsed.length !== body.timeOff.length) {
          return NextResponse.json({ error: "Check your time off dates (one entry can be up to a year)." }, { status: 400 });
        }
        patch.timeOff = parsed;
      }
      const saved = await saveOwnBookingProfile(businessId, profile.id, patch);
      if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
      return NextResponse.json({ ok: true, timeOff: patch.timeOff });
    }

    case "notifications": {
      const events: StaffNotificationEventPrefs = {};
      const rawEvents = body.events && typeof body.events === "object" ? (body.events as Record<string, unknown>) : null;
      if (rawEvents) {
        for (const e of STAFF_NOTIFICATION_EVENTS) {
          if (typeof rawEvents[e.key] === "boolean") events[e.key] = rawEvents[e.key] as boolean;
        }
      }
      const saved = await saveOwnPreferences(businessId, profile.id, {
        emailOn: typeof body.emailOn === "boolean" ? body.emailOn : undefined,
        inAppOn: typeof body.inAppOn === "boolean" ? body.inAppOn : undefined,
        events: rawEvents ? events : undefined,
      });
      if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
      return NextResponse.json({ ok: true });
    }

    case "preferences": {
      let timeZone: string | null | undefined;
      if ("timeZone" in body) {
        if (body.timeZone === null || body.timeZone === "") timeZone = null;
        else if (isValidTimeZone(body.timeZone)) timeZone = body.timeZone;
        else return NextResponse.json({ error: "Unknown time zone." }, { status: 400 });
      }
      const saved = await saveOwnPreferences(businessId, profile.id, {
        timeZone,
        theme: "theme" in body ? parseThemePreference(body.theme) : undefined,
      });
      if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  }
}
