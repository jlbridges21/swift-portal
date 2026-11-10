import { BrandProvider } from "@/components/brand/brand-provider";
import { publicHostBrand } from "@/lib/public-host-chrome";

export const dynamic = "force-dynamic";

/**
 * Public Business Website pages (/portfolio, /services, /contact on tenant hosts are rewritten
 * here by the proxy). BrandProvider only feeds the embedded request form's control styling.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { brand } = await publicHostBrand();
  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}
