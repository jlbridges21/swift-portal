import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { recordReview, REVIEW_STATUSES, type ReviewAction } from "@/lib/seo-growth/store";

/** Mark an SEO opportunity reviewed / dismissed / reopened. Super-admin only; stored in platform_audit_log. */
export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  let body: { id?: unknown; action?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const action = body.action as ReviewAction;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (!id || id.length > 200 || /[\u0000-\u001f]/.test(id)) return NextResponse.json({ error: "Invalid opportunity id." }, { status: 400 });
  if (!REVIEW_STATUSES.includes(action)) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  await recordReview({ actorUserId: auth.profile.id, actorEmail: auth.profile.email ?? null, opportunityId: id, action, note: note || null });
  return NextResponse.json({ ok: true });
}
