import { BrandProvider } from "@/components/brand/brand-provider";
import { publicHostBrand } from "@/lib/public-host-chrome";

export const dynamic = "force-dynamic";

export default async function AppEntryLayout({ children }: { children: React.ReactNode }) {
  const { brand } = await publicHostBrand();
  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}
