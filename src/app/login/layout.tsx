import type { Metadata } from "next";
import { BrandProvider } from "@/components/brand/brand-provider";
import { publicHostBrand } from "@/lib/public-host-chrome";

import { tenantAppViewport } from "@/lib/pwa/viewport";

/** Installed app: status bar matches the header surface. */
export const generateViewport = tenantAppViewport;

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = await publicHostBrand();
  return metadata;
}

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  // Same theme as the business's client portal (Light / Dark / Primary color).
  const { brand, surfaceMode } = await publicHostBrand();
  return <BrandProvider brand={brand} surfaceMode={surfaceMode}>{children}</BrandProvider>;
}
