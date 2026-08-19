import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { listActiveServiceOptions } from "@/lib/business-services";
import { getTenantContext, LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";

/**
 * Active services for request / create-project dropdowns.
 * TODO(tenant): public /request has no hostname routing until prompt 18 —
 * unauthenticated callers receive LEGACY_DEFAULT_BUSINESS_ID (Swift).
 */
export async function GET() {
  const profile = await getProfile();
  const tenant = await getTenantContext();
  const businessId = tenant?.businessId ?? LEGACY_DEFAULT_BUSINESS_ID;
  void profile;
  const options = await listActiveServiceOptions(businessId);
  return NextResponse.json({ options, businessId });
}
