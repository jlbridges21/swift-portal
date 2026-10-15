import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { Button } from "@/components/ui/button";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { MARKETING_BRAND, marketingPageMetadata } from "@/lib/marketing";

const SKYYTASK_URL = "https://skyytask.com";
const SKYYTASK_LOGO = "/icons/SKKYTASK-applogo.png";

export const metadata: Metadata = marketingPageMetadata({
  title: "Strategic Partners",
  description:
    "ShootPortal partners with complementary companies serving drone pilots, photographers, videographers, and media professionals. SkyyTask is the featured strategic partner.",
  path: "/strategic-partners",
});

const SKYYTASK_POINTS = [
  {
    title: "Clients",
    body: "Post drone jobs, receive bids from qualified local pilots, communicate directly, and manage projects from start to finish.",
  },
  {
    title: "Pilots",
    body: "Build detailed profiles, showcase certifications, equipment, and experience, browse available jobs, and submit bids.",
  },
  {
    title: "The right pilot",
    body: "Professionalism, transparency, and fair pricing across real estate, inspections, mapping, and more.",
  },
] as const;

export default async function StrategicPartnersPage() {
  await requirePlatformMarketingHost();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <section className="relative overflow-hidden border-b border-[#E2E8F0]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 80% -10%, rgba(29,143,232,0.16), transparent 50%), radial-gradient(ellipse 60% 45% at 10% 0%, rgba(79,70,229,0.12), transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 70%, #F1F5F9 100%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pb-16 sm:pt-16 lg:px-8 lg:pb-20 lg:pt-20">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">
                Strategic Partners
              </p>
              <h1 className="mt-4 text-[2rem] font-bold leading-[1.12] tracking-tight text-[#0F172A] sm:text-5xl sm:leading-[1.08]">
                Better tools. Stronger partnerships.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#475569] sm:text-lg">
                ShootPortal works with complementary companies that serve drone pilots,
                photographers, videographers, and media professionals.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#1D8FE8]">
            Featured partner
          </p>
          <article className="group relative mt-5 overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-sm transition duration-200 hover:shadow-lg hover:shadow-sky-500/10">
            <div
              className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-80 blur-3xl transition duration-300 group-hover:opacity-100"
              style={{ background: "radial-gradient(circle, rgba(29,143,232,0.35), transparent 68%)" }}
            />
            <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[auto_1fr] lg:items-start lg:gap-10 lg:p-10">
              <a
                href={SKYYTASK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit rounded-2xl ring-offset-2 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D8FE8]"
                aria-label="SkyyTask (opens in a new tab)"
              >
                <Image
                  src={SKYYTASK_LOGO}
                  alt="SkyyTask"
                  width={112}
                  height={112}
                  className="h-24 w-24 rounded-[1.35rem] object-cover shadow-md shadow-sky-900/15 sm:h-28 sm:w-28"
                />
              </a>
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
                  SkyyTask
                </h2>
                <p className="mt-2 text-base font-medium text-[#0369A1]">
                  Connecting clients with certified drone pilots nationwide.
                </p>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#475569]">
                  SkyyTask connects businesses and individuals with FAA Part 107 certified drone
                  pilots across all 50 states. Clients can post drone jobs, receive bids from
                  qualified local pilots, communicate directly, and manage projects from start to
                  finish.
                </p>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#475569]">
                  Pilots can build detailed profiles, showcase their certifications, equipment, and
                  experience, browse available jobs, submit bids, and connect directly with clients.
                </p>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#475569]">
                  SkyyTask supports a wide range of drone services, including real estate
                  photography, inspections, thermal imaging, agricultural work, aerial mapping,
                  recovery services, and more. The platform is built around professionalism,
                  transparency, fair pricing, and helping clients find the right pilot for the job.
                </p>
                <div className="mt-6">
                  <a
                    href={SKYYTASK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1D8FE8] px-5 text-sm font-medium text-white shadow-md shadow-sky-500/25 transition-colors hover:bg-[#1578C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D8FE8] focus-visible:ring-offset-2"
                  >
                    Learn More
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </a>
                </div>
              </div>
            </div>
            <div className="relative grid gap-px border-t border-[#E2E8F0] bg-[#E2E8F0] sm:grid-cols-3">
              {SKYYTASK_POINTS.map((point) => (
                <div key={point.title} className="bg-[#F8FAFC] px-6 py-5 sm:px-8">
                  <h3 className="text-sm font-semibold text-[#0F172A]">{point.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{point.body}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="border-t border-[#E2E8F0] bg-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
                Building something complementary?
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#475569]">
                If your company serves drone pilots, photographers, videographers, or media teams,
                tell us about a strategic partnership.
              </p>
            </div>
            <Link href="/contact">
              <Button
                className="min-h-11 px-6 text-white"
                style={{ backgroundColor: MARKETING_BRAND.indigo }}
              >
                Contact ShootPortal
              </Button>
            </Link>
          </div>
        </section>
      </MarketingShell>
    </BrandProvider>
  );
}
