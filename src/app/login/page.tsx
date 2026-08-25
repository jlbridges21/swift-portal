import { LoginForm } from "./login-form";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { isOAuthAllowedHostname } from "@/lib/oauth-origins";
import { warnOAuthCustomDomainAllowlistGaps } from "@/lib/oauth-allowlist-audit";
import { headers } from "next/headers";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const host = await getPublicHostContext();
  if (host.kind === "tenant" && host.businessId && host.status !== "active") {
    return (
      <TenantUnavailable description="This business is suspended or no longer active. Administrators and clients cannot sign in until it is reactivated." />
    );
  }

  const h = await headers();
  const hostname =
    (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0]?.split(":")[0]?.trim() ?? "";
  const oauthAllowed = isOAuthAllowedHostname(hostname);
  void warnOAuthCustomDomainAllowlistGaps();

  return (
    <Suspense fallback={null}>
      <LoginForm showRequestLink={isActivePublicTenant(host)} oauthAllowed={oauthAllowed} />
    </Suspense>
  );
}
