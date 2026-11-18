import type { Metadata } from "next";
import { BrandProvider } from "@/components/brand/brand-provider";
import { publicHostBrand } from "@/lib/public-host-chrome";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = await publicHostBrand();
  return { ...metadata, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ClientAccessLayout({ children }: { children: React.ReactNode }) {
  const { brand } = await publicHostBrand();
  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}
