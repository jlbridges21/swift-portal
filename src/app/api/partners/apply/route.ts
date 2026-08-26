import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPublicHostContext } from "@/lib/host-resolution";
import { allowPartnerApplicationAttempt } from "@/lib/partner-rate-limit";
import { submitPartnerApplication } from "@/lib/partners";

function clientIp(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

const GENERIC_OK = { success: true as const };
const GENERIC_ERR = { error: "Unable to submit application. Please try again later." };

/**
 * Public partner application. Platform apex only.
 * Always returns a generic success/error — does not reveal prior applications.
 */
export async function POST(request: Request) {
  const host = await getPublicHostContext();
  if (host.kind === "tenant") {
    return NextResponse.json(
      { error: "Partner applications are only available on shootportal.app." },
      { status: 403 }
    );
  }

  const h = await headers();
  const ip = clientIp(h);
  if (!allowPartnerApplicationAttempt(ip)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json(GENERIC_ERR, { status: 400 });
  }

  try {
    const result = await submitPartnerApplication({
      name: typeof body.name === "string" ? body.name : "",
      email: typeof body.email === "string" ? body.email : "",
      brandName: typeof body.brandName === "string" ? body.brandName : typeof body.brand_name === "string" ? body.brand_name : "",
      website: typeof body.website === "string" ? body.website : null,
      socialLinks:
        body.socialLinks && typeof body.socialLinks === "object" && !Array.isArray(body.socialLinks)
          ? (body.socialLinks as Record<string, unknown>)
          : body.social_links && typeof body.social_links === "object" && !Array.isArray(body.social_links)
            ? (body.social_links as Record<string, unknown>)
            : {},
      audienceSize: typeof body.audienceSize === "string" ? body.audienceSize : typeof body.audience_size === "string" ? body.audience_size : null,
      promotionPlan: typeof body.promotionPlan === "string" ? body.promotionPlan : typeof body.promotion_plan === "string" ? body.promotion_plan : null,
    });
    return NextResponse.json({ ...GENERIC_OK, autoApproved: result.autoApproved });
  } catch (err) {
    console.error("[api/partners/apply]", err instanceof Error ? err.message : err);
    return NextResponse.json(GENERIC_ERR, { status: 400 });
  }
}
