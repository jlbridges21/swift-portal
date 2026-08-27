import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { getPartnerById } from "@/lib/partners";
import { Button } from "@/components/ui/button";
import { PlatformPartnerDetailNav } from "@/components/platform/platform-partner-detail-nav";

export const dynamic = "force-dynamic";

export default async function PlatformPartnerDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPage();
  const { id } = await params;
  const partner = await getPartnerById(id);
  if (!partner) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <nav className="text-sm text-muted" aria-label="Breadcrumb">
            <Link href="/platform/partners" className="hover:text-heading">
              Partners
            </Link>
            <span className="mx-1.5" aria-hidden>
              /
            </span>
            <span className="text-heading">{partner.brand_name}</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold text-heading">{partner.brand_name}</h1>
          <p className="text-sm text-muted">
            {partner.name} · {partner.email} ·{" "}
            <span className="font-mono">{partner.referral_code}</span> ·{" "}
            {partner.commission_rate_pct}% · {partner.status}
          </p>
        </div>
        <Link href="/platform/partners">
          <Button type="button" variant="outline" className="min-h-11">
            Back to list
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <aside className="w-full shrink-0 md:sticky md:top-20 md:w-56">
          <PlatformPartnerDetailNav partnerId={partner.id} />
        </aside>
        <div className="min-w-0 flex-1 space-y-4">{children}</div>
      </div>
    </main>
  );
}
