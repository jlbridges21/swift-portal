"use client";

import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { Button } from "@/components/ui/button";
import { BrandProvider } from "@/components/brand/brand-provider";
import { SafeBrandImage } from "@/components/partner/safe-brand-image";
import { PartnerLandingPhoto } from "@/components/partner/partner-landing-photo";
import { PLATFORM_BUSINESS_DEFAULTS, type PortalBrand } from "@/lib/portal-brand";
import type { ResolvedPartnerLandingContent } from "@/lib/partner-landing-resolve";

/** ShootPortal chrome for partner landings — client-safe (no host/headers). */
function shootPortalBrand(): PortalBrand {
  const b = PLATFORM_BUSINESS_DEFAULTS;
  return {
    name: b.businessName,
    portalName: b.portalName,
    logoUrl: b.logoUrl,
    primaryColor: b.brandPrimaryColor,
    accentColor: b.brandAccentColor,
    websiteUrl: b.websiteUrl,
    contactEmail: b.primaryContactEmail,
    phoneNumber: b.phoneNumber,
    adminDisplayName: b.adminDisplayName,
    supportEmail: b.supportEmail,
    addressLine1: b.addressLine1,
    addressLine2: b.addressLine2,
    city: b.city,
    state: b.state,
    postalCode: b.postalCode,
    country: b.country,
    legalName: b.legalName,
    tagline: b.tagline,
    faviconUrl: b.faviconUrl,
    emailLogoUrl: b.emailLogoUrl,
    termsUrl: b.termsUrl,
    privacyUrl: b.privacyUrl,
    preliminaryDisclaimer: "",
  };
}

type Props = {
  content: ResolvedPartnerLandingContent;
};

export function PartnerLandingPublicView({ content }: Props) {
  const brand = shootPortalBrand();

  return (
    <BrandProvider brand={brand}>
      <MarketingShell>
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                {content.logoUrl ? (
                  <SafeBrandImage
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
              <h1
                className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl"
                style={{ color: content.primaryColor }}
              >
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
            <PartnerLandingPhoto
              src={content.photoUrl}
              width={content.photoWidth}
              height={content.photoHeight}
              alt=""
            />
          </div>
        </section>
      </MarketingShell>
    </BrandProvider>
  );
}
