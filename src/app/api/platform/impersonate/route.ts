import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { writePlatformAudit } from "@/lib/platform-audit";
import {
  IMPERSONATION_TTL_SECONDS,
  SA_BUSINESS_CONTEXT_COOKIE,
  impersonationCookieOptions,
  signImpersonationCookie,
  verifyImpersonationCookie,
} from "@/lib/platform-session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    businessId?: string;
  };
  const action = body.action ?? "start";
  const store = await cookies();
  const actor = { id: auth.profile.id, email: auth.profile.email };

  if (action === "exit") {
    const existing = verifyImpersonationCookie(store.get(SA_BUSINESS_CONTEXT_COOKIE)?.value);
    store.set(SA_BUSINESS_CONTEXT_COOKIE, "", { ...impersonationCookieOptions(0), maxAge: 0 });
    await writePlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "impersonation.stop",
      targetBusinessId: existing?.businessId ?? null,
      targetType: "business",
    });
    return NextResponse.json({ ok: true, redirect: "/platform" });
  }

  if (action === "allow_writes") {
    const existing = verifyImpersonationCookie(store.get(SA_BUSINESS_CONTEXT_COOKIE)?.value);
    if (!existing) {
      return NextResponse.json({ error: "No impersonation session." }, { status: 400 });
    }
    const remaining = Math.max(1, existing.exp - Math.floor(Date.now() / 1000));
    const value = signImpersonationCookie({
      businessId: existing.businessId,
      allowWrites: true,
      exp: existing.exp,
    });
    store.set(SA_BUSINESS_CONTEXT_COOKIE, value, impersonationCookieOptions(remaining));
    await writePlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "impersonation.allow_writes",
      targetBusinessId: existing.businessId,
      targetType: "business",
    });
    return NextResponse.json({ ok: true, allowWrites: true });
  }

  const businessId = body.businessId;
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  const raw = await createServiceClient();
  const { data: business } = await raw
    .from("businesses")
    .select("id, name, deleted_at")
    .eq("id", businessId)
    .maybeSingle();
  if (!business || business.deleted_at) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  const exp = Math.floor(Date.now() / 1000) + IMPERSONATION_TTL_SECONDS;
  const value = signImpersonationCookie({
    businessId,
    allowWrites: false,
    exp,
  });
  store.set(SA_BUSINESS_CONTEXT_COOKIE, value, impersonationCookieOptions());

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "impersonation.start",
    targetBusinessId: businessId,
    targetType: "business",
    metadata: { allowWrites: false },
  });

  return NextResponse.json({ ok: true, redirect: "/admin" });
}
