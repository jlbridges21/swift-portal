/** Client-safe share expiry types and helpers (no server imports). */

export type ShareExpiryPreset =
  | "one_time"
  | "24h"
  | "1week"
  | "30days"
  | "60days"
  | "indefinite"
  | "custom";

export type ShareAccessMode = "one_time" | "reusable";

export type ShareAccessFields = {
  access_mode: ShareAccessMode;
  access_starts_at: string | null;
  access_expires_at: string | null;
  expiry_preset: ShareExpiryPreset;
};

export type ShareAccessWindowRow = ShareAccessFields & {
  revoked_at?: string | null;
  one_time_used_at?: string | null;
};

export type ShareAccessValidation =
  | { ok: true }
  | {
      ok: false;
      code:
        | "share_revoked"
        | "share_not_started"
        | "share_expired"
        | "share_one_time_used"
        | "share_invalid";
      message: string;
    };

export function resolveShareAccessWindow(
  preset: ShareExpiryPreset,
  custom?: { startsAt?: string | null; expiresAt?: string | null },
  now = new Date()
): ShareAccessFields {
  const base = now.getTime();
  if (preset === "one_time") {
    return {
      access_mode: "one_time",
      access_starts_at: now.toISOString(),
      access_expires_at: new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString(),
      expiry_preset: "one_time",
    };
  }
  if (preset === "indefinite") {
    return {
      access_mode: "reusable",
      access_starts_at: now.toISOString(),
      access_expires_at: null,
      expiry_preset: "indefinite",
    };
  }
  if (preset === "custom") {
    const startsAt = custom?.startsAt ? new Date(custom.startsAt).toISOString() : now.toISOString();
    const expiresAt = custom?.expiresAt ? new Date(custom.expiresAt).toISOString() : null;
    return {
      access_mode: "reusable",
      access_starts_at: startsAt,
      access_expires_at: expiresAt,
      expiry_preset: "custom",
    };
  }

  const hours: Record<Exclude<ShareExpiryPreset, "one_time" | "indefinite" | "custom">, number> = {
    "24h": 24,
    "1week": 24 * 7,
    "30days": 24 * 30,
    "60days": 24 * 60,
  };
  const h = hours[preset as keyof typeof hours] ?? 24 * 30;
  return {
    access_mode: "reusable",
    access_starts_at: now.toISOString(),
    access_expires_at: new Date(base + h * 60 * 60 * 1000).toISOString(),
    expiry_preset: preset,
  };
}

export function validateShareAccessWindow(
  share: Pick<
    ShareAccessWindowRow,
    "revoked_at" | "access_mode" | "access_starts_at" | "access_expires_at" | "one_time_used_at"
  >,
  now = new Date()
): ShareAccessValidation {
  if (share.revoked_at) {
    return { ok: false, code: "share_revoked", message: "This project share was revoked." };
  }
  if (share.access_starts_at && new Date(share.access_starts_at) > now) {
    return {
      ok: false,
      code: "share_not_started",
      message: "This share link is not active yet.",
    };
  }
  if (share.access_expires_at && new Date(share.access_expires_at) <= now) {
    return {
      ok: false,
      code: "share_expired",
      message: "This share link has expired.",
    };
  }
  if (share.access_mode === "one_time" && share.one_time_used_at) {
    return {
      ok: false,
      code: "share_one_time_used",
      message: "This one-time link has already been used.",
    };
  }
  return { ok: true };
}

export function formatShareExpiryLabel(
  share: Pick<
    ShareAccessWindowRow,
    "expiry_preset" | "access_expires_at" | "access_mode" | "one_time_used_at" | "revoked_at"
  >
): string {
  if (share.revoked_at) return "Revoked";
  if (share.access_mode === "one_time") {
    return share.one_time_used_at ? "One-time · Used" : "One-time access";
  }
  if (share.expiry_preset === "indefinite") return "Indefinitely";
  if (!share.access_expires_at) return "No expiry";
  const exp = new Date(share.access_expires_at);
  if (exp <= new Date()) return `Expired ${exp.toLocaleDateString()}`;
  return `Expires ${exp.toLocaleDateString()}`;
}

export function isShareExpired(
  share: Pick<ShareAccessWindowRow, "access_expires_at" | "revoked_at">
): boolean {
  if (share.revoked_at) return true;
  if (!share.access_expires_at) return false;
  return new Date(share.access_expires_at) <= new Date();
}
