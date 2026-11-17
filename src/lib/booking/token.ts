/**
 * Booking link token: lets the client who submitted a request choose, view, reschedule or
 * cancel that project's appointment without a password. AES-256-GCM sealed (purpose-keyed),
 * bound to business + client + project. Delivered only to the submitting browser and the
 * client's email, like the request confirmation. Signed-in clients don't need it.
 */
import { openWithPurpose, sealWithPurpose } from "@/lib/purpose-cipher";

const PURPOSE = "client-booking-link";
const WHAT = "booking link token";
export const BOOKING_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type BookingTokenPayload = {
  v: 1;
  b: string;
  c: string;
  p: string;
  exp: number;
};

export function sealBookingToken(input: { businessId: string; clientId: string; projectId: string }, now = Date.now()): string {
  const payload: BookingTokenPayload = {
    v: 1,
    b: input.businessId,
    c: input.clientId,
    p: input.projectId,
    exp: now + BOOKING_TOKEN_TTL_MS,
  };
  return sealWithPurpose(PURPOSE, WHAT, Buffer.from(JSON.stringify(payload), "utf8"));
}

export function openBookingToken(token: string | null | undefined, now = Date.now()): BookingTokenPayload | null {
  const raw = String(token ?? "").trim();
  if (!raw || raw.length > 2048) return null;
  try {
    const parsed = JSON.parse(openWithPurpose(PURPOSE, WHAT, raw).toString("utf8")) as BookingTokenPayload;
    if (
      parsed?.v !== 1 ||
      typeof parsed.b !== "string" ||
      typeof parsed.c !== "string" ||
      typeof parsed.p !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= now
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const BOOK_PATH = "/request/schedule";
export const SHOOT_PATH = "/request/shoot";

export function bookingPagePath(token: string): string {
  return `${BOOK_PATH}?b=${encodeURIComponent(token)}`;
}

export function shootPagePath(token: string): string {
  return `${SHOOT_PATH}?b=${encodeURIComponent(token)}`;
}
