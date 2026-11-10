import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { getAppSettings } from "@/lib/app-settings";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { isOAuthAllowedHostname } from "@/lib/oauth-origins";
import { pwaAppleIcon, pwaAppleMetadata, pwaIconVersion } from "@/lib/pwa/metadata";
import { websiteLogoSrc } from "@/lib/website/view";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = await getPublicHostContext();
  const name = isActivePublicTenant(host) ? (await getAppSettings(host.businessId)).business.businessName : "ShootPortal";
  const version = isActivePublicTenant(host)
    ? await getAppSettings(host.businessId).then((s) => pwaIconVersion(s.business.logoUrl, s.business.brandPrimaryColor))
    : undefined;
  return {
    title: { absolute: name },
    robots: { index: false, follow: false },
    icons: { apple: pwaAppleIcon(version) },
    ...pwaAppleMetadata(name),
  };
}

/**
 * Installed-app entry point — the manifest start_url on business portal hosts.
 *
 * Signed in: the proxy never lets this render; it sends the user to their role's home
 * (owner dashboard / onboarding / billing, staff area, client projects) exactly like a signed-in
 * visit to /login, so there is no login flash and no public website in between.
 * Signed out (or session expired / revoked): a branded sign-in screen.
 */
export default async function AppEntryPage() {
  const host = await getPublicHostContext();
  if (host.kind === "tenant" && host.businessId && host.status !== "active") {
    return <TenantUnavailable description="This business is suspended or no longer active." />;
  }
  if (!isActivePublicTenant(host)) redirect("/login");

  const settings = await getAppSettings(host.businessId);
  const h = await headers();
  const hostname = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0]?.split(":")[0]?.trim() ?? "";
  const name = settings.business.businessName || settings.business.portalName || "Your portal";
  return (
    <Suspense fallback={null}>
      <LoginForm
        showRequestLink
        oauthAllowed={isOAuthAllowedHostname(hostname)}
        app={{ name, logoUrl: settings.business.logoUrl ? websiteLogoSrc(settings.business.logoUrl) : null }}
      />
    </Suspense>
  );
}
