import { notFound } from "next/navigation";
import { getPublicHostContext } from "@/lib/host-resolution";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { BrandProvider } from "@/components/brand/brand-provider";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { SignupForm } from "@/components/auth/signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const host = await getPublicHostContext();
  // Defense in depth — middleware also blocks tenant hosts.
  if (host.kind === "tenant") notFound();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <SignupForm platformRootDomain={getPlatformRootDomain()} />
    </BrandProvider>
  );
}
