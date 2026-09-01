import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { updatePartner } from "@/lib/partners";

export const runtime = "nodejs";

/** Partner self-service: set or clear checkout promo code. */
export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "suspended") {
    return NextResponse.json({ error: "Partner account is suspended.", suspended: true }, { status: 403 });
  }
  if (access.kind !== "active") {
    return NextResponse.json({ error: "Partner access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { promoCode?: string | null };
  const hasKey = Object.prototype.hasOwnProperty.call(body, "promoCode");
  if (!hasKey) {
    return NextResponse.json({ error: "promoCode is required (string or null to clear)." }, { status: 400 });
  }

  try {
    const previous = access.partner.promo_code ?? null;
    const updated = await updatePartner(
      access.partner.id,
      { promoCode: body.promoCode },
      { id: profile.id, email: profile.email }
    );
    const next = updated.promo_code ?? null;
    const changedExisting = Boolean(previous && previous !== next);
    return NextResponse.json({
      ok: true,
      promoCode: next,
      warning: changedExisting
        ? "Changing your promo code invalidates the previous code immediately. Anything already shared with the old code will stop working."
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update promo code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
