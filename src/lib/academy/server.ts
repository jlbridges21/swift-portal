import { randomInt } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ACADEMY_COMPLETE_PERCENT,
  ACADEMY_LESSONS,
  ACADEMY_LESSON_COUNT,
  academyLessonByKey,
} from "@/lib/academy/catalog";

/**
 * ShootPortal Academy storage (migration v130). Tables are service-role only; every function
 * here acts on one user's own rows, and callers pass the signed-in user's id.
 * Every reader fails safe: before the migration runs, the Academy works without saved progress.
 */

export type AcademyLessonProgress = {
  percent: number;
  position: number;
  completedAt: string | null;
};

export type AcademyCertificate = {
  code: string;
  holderName: string;
  businessName: string | null;
  issuedAt: string;
  lessonCount: number;
};

export type AcademyProgressState = {
  setupRequired: boolean;
  lessons: Record<string, AcademyLessonProgress>;
  certificate: AcademyCertificate | null;
};

export class AcademySetupRequiredError extends Error {
  constructor() {
    super("Academy tables are missing (run supabase/migration-v130-academy.sql).");
  }
}

function isMissingRelation(message: string | undefined): boolean {
  return Boolean(message && /does not exist|schema cache|PGRST205|42P01/i.test(message));
}

type CertificateRow = {
  code: string;
  holder_name: string;
  business_name: string | null;
  issued_at: string;
  lesson_count: number;
  revoked_at?: string | null;
};

function toCertificate(row: CertificateRow): AcademyCertificate {
  return {
    code: row.code,
    holderName: row.holder_name,
    businessName: row.business_name,
    issuedAt: row.issued_at,
    lessonCount: row.lesson_count,
  };
}

export async function loadAcademyProgress(userId: string): Promise<AcademyProgressState> {
  const empty: AcademyProgressState = { setupRequired: false, lessons: {}, certificate: null };
  try {
    const db = await createServiceClient();
    const [progress, cert] = await Promise.all([
      db
        .from("academy_lesson_progress")
        .select("lesson_key, watched_percent, last_position_seconds, completed_at")
        .eq("user_id", userId),
      db
        .from("academy_certificates")
        .select("code, holder_name, business_name, issued_at, lesson_count, revoked_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (progress.error || cert.error) {
      const msg = progress.error?.message ?? cert.error?.message;
      if (isMissingRelation(msg)) return { ...empty, setupRequired: true };
      console.error("[academy] progress read failed", msg);
      return empty;
    }
    const lessons: Record<string, AcademyLessonProgress> = {};
    for (const row of progress.data ?? []) {
      lessons[row.lesson_key] = {
        percent: row.watched_percent ?? 0,
        position: row.last_position_seconds ?? 0,
        completedAt: row.completed_at ?? null,
      };
    }
    const certRow = cert.data as CertificateRow | null;
    return {
      setupRequired: false,
      lessons,
      certificate: certRow && !certRow.revoked_at ? toCertificate(certRow) : null,
    };
  } catch (err) {
    console.error("[academy] progress read failed", err instanceof Error ? err.message : err);
    return empty;
  }
}

/**
 * Record viewing progress. Percent only ever moves forward; a lesson completes at
 * ACADEMY_COMPLETE_PERCENT, or when the user marks it complete. Completion is never undone here.
 */
export async function saveLessonProgress(input: {
  userId: string;
  businessId: string;
  lessonKey: string;
  percent: number;
  position: number;
  markComplete?: boolean;
}): Promise<AcademyLessonProgress> {
  const lesson = academyLessonByKey(input.lessonKey);
  if (!lesson) throw new Error("Unknown lesson.");
  const db = await createServiceClient();
  const { data: existing, error: readErr } = await db
    .from("academy_lesson_progress")
    .select("watched_percent, completed_at, completed_via")
    .eq("user_id", input.userId)
    .eq("lesson_key", lesson.key)
    .maybeSingle();
  if (readErr) {
    if (isMissingRelation(readErr.message)) throw new AcademySetupRequiredError();
    throw new Error(readErr.message);
  }
  const percent = Math.max(
    existing?.watched_percent ?? 0,
    Math.min(100, Math.max(0, Math.round(input.percent)))
  );
  const position = Math.min(lesson.durationSeconds, Math.max(0, Math.round(input.position)));
  let completedAt: string | null = existing?.completed_at ?? null;
  let completedVia: string | null = existing?.completed_via ?? null;
  if (!completedAt && (percent >= ACADEMY_COMPLETE_PERCENT || input.markComplete)) {
    completedAt = new Date().toISOString();
    completedVia = percent >= ACADEMY_COMPLETE_PERCENT ? "watched" : "manual";
  }
  const { error } = await db.from("academy_lesson_progress").upsert(
    {
      user_id: input.userId,
      business_id: input.businessId,
      lesson_key: lesson.key,
      watched_percent: percent,
      last_position_seconds: position,
      completed_at: completedAt,
      completed_via: completedVia,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_key" }
  );
  if (error) {
    if (isMissingRelation(error.message)) throw new AcademySetupRequiredError();
    throw new Error(error.message);
  }
  return { percent, position, completedAt };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCertificateCode(): string {
  const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `SPA-${part()}-${part()}`;
}

/**
 * Issue (or return) the user's certificate. Only when every course lesson is complete.
 * Returns null when lessons are still missing.
 */
export async function issueAcademyCertificate(input: {
  userId: string;
  businessId: string;
  holderName: string;
  businessName: string | null;
}): Promise<AcademyCertificate | null> {
  const state = await loadAcademyProgress(input.userId);
  if (state.setupRequired) throw new AcademySetupRequiredError();
  if (state.certificate) return state.certificate;
  const done = ACADEMY_LESSONS.filter((l) => state.lessons[l.key]?.completedAt).length;
  if (done < ACADEMY_LESSON_COUNT) return null;

  const db = await createServiceClient();
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await db
      .from("academy_certificates")
      .insert({
        user_id: input.userId,
        business_id: input.businessId,
        code: newCertificateCode(),
        holder_name: input.holderName.slice(0, 120),
        business_name: input.businessName ? input.businessName.slice(0, 160) : null,
        lesson_count: ACADEMY_LESSON_COUNT,
      })
      .select("code, holder_name, business_name, issued_at, lesson_count")
      .single();
    if (!error && data) return toCertificate(data as CertificateRow);
    if (error && /duplicate key/i.test(error.message)) {
      // Another tab issued it first (user_id is unique), or a code collided: re-read and retry.
      const again = await loadAcademyProgress(input.userId);
      if (again.certificate) return again.certificate;
      continue;
    }
    if (error && isMissingRelation(error.message)) throw new AcademySetupRequiredError();
    if (error) throw new Error(error.message);
  }
  throw new Error("Could not issue the certificate.");
}

/** Public verification. Returns null for unknown or revoked codes. */
export async function findAcademyCertificate(code: string): Promise<AcademyCertificate | null> {
  const normalized = code.trim().toUpperCase();
  if (!/^SPA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) return null;
  try {
    const db = await createServiceClient();
    const { data, error } = await db
      .from("academy_certificates")
      .select("code, holder_name, business_name, issued_at, lesson_count, revoked_at")
      .eq("code", normalized)
      .maybeSingle();
    if (error || !data || (data as CertificateRow).revoked_at) return null;
    return toCertificate(data as CertificateRow);
  } catch {
    return null;
  }
}
