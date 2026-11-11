import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isActiveStaff, isOwnerAdmin } from "@/lib/staff-access";
import { getUiExperience, saveUserInterface } from "@/lib/ui-rollout-server";
import { safeReturnPath, type UiInterface } from "@/lib/ui-rollout";

export const dynamic = "force-dynamic";

/**
 * Save the signed-in business user's interface choice, then return them to the same page.
 * Form POST (application/x-www-form-urlencoded): interface=classic|new, next=/same/path.
 *
 * Presentation only — the destination page runs its usual access checks. Only owners/admins,
 * active staff, and super-admins may save, and only while the rollout lets them switch.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin), 303);

  // Same-origin form posts only (the auth cookie is SameSite=Lax as well).
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const next = safeReturnPath(form?.get("next"));
  const raw = form?.get("interface");
  const choice: UiInterface | null = raw === "new" || raw === "classic" ? raw : null;

  const profile = await getProfile();
  if (!profile) return back("/login");
  if (!(isOwnerAdmin(profile) || isActiveStaff(profile)) || !choice) return back(next);

  const experience = await getUiExperience(profile);
  if (!experience.canSwitch) return back(next);

  try {
    await saveUserInterface(profile.id, choice);
  } catch (err) {
    console.error("[ui-preference/switch] save failed", err);
  }
  return back(next);
}
