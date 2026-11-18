import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TenantUnavailable } from "@/components/public/tenant-unavailable";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { getProfile } from "@/lib/auth";
import { getAppSettings } from "@/lib/app-settings";
import { maskEmail } from "@/lib/portal-activation";
import { loadClientAccessContext } from "@/lib/client-access-link-server";
import { canOfferFreshLink, clientAccessRefusalMessage, safeClientAccessPath } from "@/lib/client-access-link";
import { ClientAccessLanding } from "./client-access-landing";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ token?: string; error?: string }> };

function hostPathPrefix(host: { source: string; slug: string | null }): string {
  return host.source === "path" && host.slug ? `/b/${host.slug}` : "";
}

/** Add ?preview=1 to a portal path, keeping its query and hash. */
function withPreview(path: string): string {
  const hashAt = path.indexOf("#");
  const beforeHash = hashAt >= 0 ? path.slice(0, hashAt) : path;
  const hash = hashAt >= 0 ? path.slice(hashAt) : "";
  return `${beforeHash}${beforeHash.includes("?") ? "&" : "?"}preview=1${hash}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:px-6 sm:py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

/**
 * Landing for one-click client links (project emails, "Deliver to client").
 * GET never signs anyone in (prefetch / link-scanner safe); the page submits
 * itself to POST /auth/client/consume, which mints the session.
 */
export default async function ClientAccessPage({ searchParams }: PageProps) {
  const host = await getPublicHostContext();
  if (host.kind === "tenant" && host.businessId && host.status !== "active") {
    return <TenantUnavailable />;
  }
  const prefix = hostPathPrefix(host);
  const { token: rawToken, error } = await searchParams;
  const token = String(rawToken ?? "").trim();

  if (!isActivePublicTenant(host) || !token) {
    return (
      <Shell>
        <ClientAccessLanding mode="refused" token="" prefix={prefix} message={clientAccessRefusalMessage("invalid")} />
      </Shell>
    );
  }

  const ctx = await loadClientAccessContext(token, host.businessId);
  if (!ctx) {
    return (
      <Shell>
        <ClientAccessLanding mode="refused" token="" prefix={prefix} message={clientAccessRefusalMessage("invalid")} />
      </Shell>
    );
  }

  const destination = safeClientAccessPath(ctx.payload.p, ctx.payload.n);
  const settings = await getAppSettings(host.businessId);
  const businessName = settings.business.businessName;

  // Already signed in: the client themself goes straight in; the business (owner/staff
  // testing their own email) sees the client preview without swapping sessions.
  const profile = await getProfile();
  if (profile && ctx.client && !ctx.refusal) {
    if (profile.role === "client" && ctx.client.user_id && profile.id === ctx.client.user_id) {
      redirect(`${prefix}${destination}`);
    }
    if ((profile.role === "admin" || profile.role === "staff") && profile.business_id === host.businessId) {
      redirect(`${prefix}${withPreview(destination)}`);
    }
  }

  if (ctx.refusal || error) {
    const reason = ctx.refusal ?? error ?? "invalid";
    const loginHref = `${prefix}/login?redirect=${encodeURIComponent(destination)}${
      ctx.client?.email ? `&email=${encodeURIComponent(ctx.client.email)}` : ""
    }`;
    return (
      <Shell>
        <ClientAccessLanding
          mode="refused"
          token={canOfferFreshLink(reason) ? token : ""}
          prefix={prefix}
          message={clientAccessRefusalMessage(reason)}
          maskedEmail={ctx.client?.email ? maskEmail(ctx.client.email) : null}
          loginHref={loginHref}
          retry={reason === "sign_in_failed"}
          businessName={businessName}
        />
      </Shell>
    );
  }

  const firstName = (ctx.client?.full_name || ctx.client?.name || "").trim().split(/\s+/)[0] || null;
  return (
    <Shell>
      <ClientAccessLanding mode="open" token={token} prefix={prefix} firstName={firstName} businessName={businessName} />
    </Shell>
  );
}
