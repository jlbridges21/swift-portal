import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { listActiveServiceOptions } from "@/lib/business-services";

/**
 * Active services for request / create-project dropdowns.
 * Authenticated callers use profile tenant context. Public callers use the
 * host resolved in proxy — never a hardcoded business id.
 */
export async function GET() {
  const tenant = await getTenantContext();
  if (tenant?.businessId) {
    const options = await listActiveServiceOptions(tenant.businessId);
    return NextResponse.json({ options, businessId: tenant.businessId });
  }

  const host = await getPublicHostContext();
  if (isActivePublicTenant(host) && host.businessId) {
    const options = await listActiveServiceOptions(host.businessId);
    return NextResponse.json({ options, businessId: host.businessId });
  }

  return NextResponse.json({ options: [], businessId: null });
}
