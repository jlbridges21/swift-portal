import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant";
import { loadKitContext, MarketingSetupRequiredError, resolveMarketingActor, toClientState, visibleToClient } from "@/lib/marketing/server";
import { MarketingKitEditor } from "@/components/marketing/marketing-kit-editor";
import { MarketingSetupNotice } from "@/components/marketing/marketing-setup-notice";

export const metadata: Metadata = { title: "Marketing Kit", robots: { index: false } };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; payment?: string }>;
}

/**
 * Client-side Marketing Kit: full previews with the client's real photos and details,
 * purchase (Pay now / Add to invoice), customize, publish and download per permissions.
 * Shared viewers (project_shares) never see it.
 */
export default async function ClientMarketingKitPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab, payment } = await searchParams;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin" || profile.role === "staff") redirect(`/admin/projects/${id}/marketing`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tenant = await requireTenantContext();
  const actor = await resolveMarketingActor(profile, id, tenant.businessId);
  if (!actor || actor.kind !== "client") notFound();
  const backHref = `/dashboard/projects/${id}`;
  let ctx: Awaited<ReturnType<typeof loadKitContext>>;
  let setupRequired = false;
  try {
    ctx = await loadKitContext(tenant.businessId, id);
  } catch (e) {
    if (!(e instanceof MarketingSetupRequiredError)) throw e;
    ctx = null;
    setupRequired = true;
  }
  if (setupRequired) return <MarketingSetupNotice backHref={backHref} />;
  if (!ctx || !visibleToClient(ctx)) notFound();
  return (
    <MarketingKitEditor
      initialState={toClientState(ctx, actor)}
      backHref={backHref}
      initialTab={tab === "social" ? "social" : "website"}
      paymentReturn={payment ?? null}
    />
  );
}
