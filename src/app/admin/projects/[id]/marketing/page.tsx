import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-access";
import { canAccessProject } from "@/lib/staff-access";
import { loadKitContext, MarketingSetupRequiredError, resolveMarketingActor, toClientState } from "@/lib/marketing/server";
import { MarketingKitEditor } from "@/components/marketing/marketing-kit-editor";
import { MarketingSetupNotice } from "@/components/marketing/marketing-setup-notice";

export const metadata: Metadata = { title: "Marketing Kit", robots: { index: false } };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; from?: string }>;
}

/** Business-side Marketing Kit editor (full screen): Property Website + Social Media Kit. */
export default async function AdminMarketingKitPage({ params, searchParams }: PageProps) {
  const { profile, tenant } = await requireAdminPage({ area: "projects" });
  const { id } = await params;
  const { tab, from } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (profile.role === "staff" && !(await canAccessProject(tenant.businessId, profile, id))) notFound();
  const actor = await resolveMarketingActor(profile, id, tenant.businessId);
  if (!actor || actor.kind !== "business") notFound();
  const backHref = `/admin/projects/${id}#marketing-kit`;
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
  if (!ctx) notFound();
  // Opened from Sites → Property Websites (owners only): offer the way back there too.
  const sitesHref = from === "sites" && profile.role !== "staff" ? "/admin/sites/property" : null;
  return (
    <MarketingKitEditor
      initialState={toClientState(ctx, actor)}
      backHref={backHref}
      sitesHref={sitesHref}
      initialTab={tab === "social" ? "social" : "website"}
    />
  );
}
