import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { SITE } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export default async function PlatformHomePage() {
  await requireSuperAdmin();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4F46E5]">{SITE.name}</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-900">Platform</h1>
      <p className="mt-3 text-slate-600">
        Super-admin console. Tenant data is never implied by the URL — impersonate a business
        before reading or writing tenant records.
      </p>
      <p className="mt-8">
        <Link href="/admin" className="text-[#4F46E5] underline">
          Open admin (requires impersonation)
        </Link>
      </p>
    </div>
  );
}
