import type { Metadata } from "next";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import {
  MARKETING_HELLO_EMAIL,
  MARKETING_SUPPORT_EMAIL,
  marketingPageMetadata,
} from "@/lib/marketing";

export const revalidate = 3600;

export const metadata: Metadata = marketingPageMetadata({
  title: "Contact",
  description: "Contact ShootPortal support and sales. We help media studios get set up.",
  path: "/contact",
});

export default async function ContactPage() {
  await requirePlatformMarketingHost();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            Contact
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0F172A]">
            Talk to us
          </h1>
          <p className="mt-4 text-lg text-[#475569]">
            Whether you are evaluating ShootPortal for your studio or need help with an existing
            account, we are here.
          </p>

          <div className="mt-10 space-y-4">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#0F172A]">Sales &amp; onboarding</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Questions about plans, trials, or whether ShootPortal fits your workflow.
              </p>
              <a
                href={`mailto:${MARKETING_HELLO_EMAIL}`}
                className="mt-4 inline-block text-base font-semibold text-[#4F46E5] hover:underline"
              >
                {MARKETING_HELLO_EMAIL}
              </a>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#0F172A]">Support</h2>
              <p className="mt-2 text-sm text-[#475569]">
                Account access, billing, media uploads, and day-to-day product help.
              </p>
              <a
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
                className="mt-4 inline-block text-base font-semibold text-[#4F46E5] hover:underline"
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </section>
      </MarketingShell>
    </BrandProvider>
  );
}
