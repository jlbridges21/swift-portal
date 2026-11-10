import type { Metadata } from "next";
import Link from "next/link";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { listPublishedListings } from "@/lib/marketing/public";
import { getAppSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return { title: "Listings", robots: { index: false } };
  const settings = await getAppSettings(host.businessId);
  return { title: { absolute: `Featured listings — ${settings.business.businessName}` } };
}

/** Listing domain root (listings.yourstudio.com/) — published property websites, newest first. */
export default async function ListingsIndexPage() {
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) {
    return <main className="flex min-h-screen items-center justify-center p-8 text-slate-500">No listings here.</main>;
  }
  const [listings, settings] = await Promise.all([listPublishedListings(host.businessId), getAppSettings(host.businessId)]);
  const prefix = host.source === "listing_domain" ? "" : "/l";
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{settings.business.businessName}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Featured listings</h1>
        {listings.length === 0 ? (
          <p className="mt-10 text-slate-500">No property websites are published right now.</p>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <li key={l.slug}>
                <Link href={`${prefix}/${l.slug}`} className="group block overflow-hidden rounded-2xl ring-1 ring-slate-200 transition hover:shadow-lg">
                  <div className="aspect-[4/3] bg-slate-100">
                    {l.heroUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.heroUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-slate-900">{l.address}</p>
                    {l.locality ? <p className="text-sm text-slate-500">{l.locality}</p> : null}
                    {l.priceText ? <p className="mt-2 font-semibold text-slate-900">{l.priceText}</p> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
