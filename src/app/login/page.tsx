import { LoginForm } from "./login-form";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const host = await getPublicHostContext();
  if (host.kind === "tenant" && host.businessId && host.status !== "active") {
    return (
      <TenantUnavailable description="This business is suspended or no longer active. Administrators and clients cannot sign in until it is reactivated." />
    );
  }
  return (
    <Suspense fallback={null}>
      <LoginForm showRequestLink={isActivePublicTenant(host)} />
    </Suspense>
  );
}
