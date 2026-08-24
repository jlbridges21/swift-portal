import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { Button } from "@/components/ui/button";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { BrandProvider } from "@/components/brand/brand-provider";
import type { ResolvedPartnerLandingContent } from "@/lib/partner-landing";

type Props = {
  content: ResolvedPartnerLandingContent;
};

export function PartnerLandingPublicView({ content }: Props) {
  const brand = platformPortalBrand();

  return (
    <BrandProvider brand={brand}>
      <MarketingShell>
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                {content.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- partner https asset
                  <img
                    src={content.logoUrl}
                    alt=""
                    className="h-10 max-w-[160px] object-contain object-left"
                  />
                ) : null}
                <p
                  className="text-sm font-semibold uppercase tracking-[0.18em]"
                  style={{ color: content.accentColor }}
                >
                  {content.brandName} × ShootPortal
                </p>
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-heading sm:text-5xl">
                {content.headline}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-muted">{content.subheadline}</p>
              {content.description ? (
                <p className="mt-4 text-base leading-relaxed text-foreground">{content.description}</p>
              ) : null}
              <ul className="mt-6 space-y-2.5">
                {content.benefits.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-foreground">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: content.accentColor }}
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {content.offerText ? (
                <p
                  className="mt-6 rounded-lg border bg-white px-4 py-3 text-sm text-heading"
                  style={{ borderColor: content.accentColor }}
                >
                  {content.offerText}
                </p>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup">
                  <Button
                    className="min-h-11 px-6 hover:opacity-95"
                    style={{
                      backgroundColor: content.accentColor,
                      color: content.accentForeground,
                    }}
                  >
                    {content.ctaLabel}
                  </Button>
                </Link>
                <Link href="/partners">
                  <Button variant="outline" className="min-h-11 border-border bg-white px-6">
                    About the Partner Program
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted">
                Visiting this page attributes your signup to {content.brandName} when you create a
                ShootPortal business (same as their referral link).
              </p>
              {content.testimonialQuote ? (
                <figure className="mt-8 border-l-2 border-border pl-4">
                  <blockquote className="text-sm italic text-foreground">
                    &ldquo;{content.testimonialQuote}&rdquo;
                  </blockquote>
                  {content.testimonialAttribution ? (
                    <figcaption className="mt-2 text-xs text-muted">
                      — {content.testimonialAttribution}
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-subtle">
              {content.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- partner https asset
                <img src={content.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted">
                  <p className="font-medium text-heading">ShootPortal</p>
                  <p>Client portal for photographers &amp; drone professionals</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </MarketingShell>
    </BrandProvider>
  );
}
