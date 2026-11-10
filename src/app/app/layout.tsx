import { BrandProvider } from "@/components/brand/brand-provider";
import { publicHostBrand } from "@/lib/public-host-chrome";

import { tenantAppViewport } from "@/lib/pwa/viewport";

/** Installed app: status bar matches the header surface. */
export const generateViewport = tenantAppViewport;

export const dynamic = "force-dynamic";

export default async function AppEntryLayout({ children }: { children: React.ReactNode }) {
  const { brand } = await publicHostBrand();
  return <BrandProvider brand={brand}>{children}</BrandProvider>;
}
