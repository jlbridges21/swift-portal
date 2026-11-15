import { NextResponse } from "next/server";
import { academyApiUser } from "@/lib/academy/api-auth";
import { academyLessonByKey } from "@/lib/academy/catalog";
import { AcademySetupRequiredError, loadAcademyProgress, saveLessonProgress } from "@/lib/academy/server";

export const dynamic = "force-dynamic";

/** The signed-in user's Academy progress and certificate. */
export async function GET() {
  const auth = await academyApiUser();
  if (!auth.ok) return auth.response;
  const state = await loadAcademyProgress(auth.profile.id);
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}

/** Save viewing progress for one lesson. Body: { lesson, percent, position, complete? }. */
export async function POST(request: Request) {
  const auth = await academyApiUser();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as {
    lesson?: unknown;
    percent?: unknown;
    position?: unknown;
    complete?: unknown;
  } | null;
  const lesson = typeof body?.lesson === "string" ? academyLessonByKey(body.lesson) : null;
  if (!lesson) return NextResponse.json({ error: "Unknown lesson." }, { status: 400 });
  const percent = Number(body?.percent);
  const position = Number(body?.position);
  if (!Number.isFinite(percent) || !Number.isFinite(position)) {
    return NextResponse.json({ error: "Invalid progress." }, { status: 400 });
  }
  // Read-only impersonation (platform support) must not write on the user's behalf.
  if (auth.tenant.impersonating && !auth.tenant.allowWrites) {
    return NextResponse.json({ ok: false, readOnly: true });
  }
  try {
    const saved = await saveLessonProgress({
      userId: auth.profile.id,
      businessId: auth.tenant.businessId,
      lessonKey: lesson.key,
      percent,
      position,
      markComplete: body?.complete === true,
    });
    return NextResponse.json({ ok: true, lesson: lesson.key, progress: saved });
  } catch (err) {
    if (err instanceof AcademySetupRequiredError) return NextResponse.json({ ok: false, setupRequired: true });
    console.error("[academy/progress]", err);
    return NextResponse.json({ error: "Could not save progress." }, { status: 500 });
  }
}
