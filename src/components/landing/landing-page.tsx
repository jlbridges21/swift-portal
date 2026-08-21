/**
 * Tenant client landing page — CONFIGURABLE TEMPLATE.
 *
 * Tenants deliberately cannot change: section order, layout, fonts, spacing,
 * component structure, the ShootPortal request-form flow (/request), or inject
 * HTML/markdown. They only fill plain-text slots and optional asset URLs defined
 * in landing-content.ts. Every combination must still look professionally designed.
 */

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PortalBrand } from "@/lib/portal-brand";
import type { ResolvedLandingPage } from "@/lib/landing-content";
import { LANDING_FEATURE_ICON_MAP } from "@/lib/landing-feature-icons";
import {
  CheckCircle2,
  ArrowRight,
  Play,
  Home,
  ExternalLink,
} from "lucide-react";

const STEP_CARD_WIDTH = 480;

const FEATURE_ICON_MAP = LANDING_FEATURE_ICON_MAP;

function buildShowcase(landing: ResolvedLandingPage) {
  return [
    { title: "Request form", image: landing.assets.screenshots.request },
    { title: "Estimate & scheduling", image: landing.assets.screenshots.quote },
    { title: "Property microsite", image: landing.assets.screenshots.microsite },
  ].filter((item) => Boolean(item.image));
}

function buildMediaUses(landing: ResolvedLandingPage) {
  return [
    {
      title: "Real estate listings",
      image: landing.assets.luxuryHome,
      description:
        "Cinematic aerial photography and video that elevates listings and shows property context.",
    },
    {
      title: "Golf courses",
      image: landing.assets.golfCourse,
      description: "Course flyovers, clubhouse media, and marketing visuals for clubs and resorts.",
    },
    {
      title: "Construction progress",
      image: landing.assets.construction,
      description: "Recurring aerial progress media for builders, developers, and project teams.",
    },
  ].filter((item) => Boolean(item.image));
}

function RequestShootButton({
  label,
  size = "default",
  className = "",
}: {
  label: string;
  size?: "default" | "lg";
  className?: string;
}) {
  return (
    <Link href="/request">
      <Button
        variant="accent"
        size={size}
        className={`${size === "lg" ? "px-8 text-base" : ""} ${className}`}
      >
        {label} <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}

function LandingLogo({
  className = "h-8 w-auto",
  href,
  src,
  name,
}: {
  className?: string;
  href: string;
  src: string;
  name: string;
}) {
  if (!src) return <span className="text-sm font-semibold text-white">{name}</span>;
  return (
    <a href={href || undefined} aria-label={`Go to ${name} website`} className="inline-flex items-center">
      <Image src={src} alt={name} width={180} height={52} className={className} priority />
    </a>
  );
}

function SocialLinks({ page }: { page: ResolvedLandingPage }) {
  if (!page.showSocial) return null;
  const items: { href: string; label: string }[] = [];
  if (page.social.instagram) items.push({ href: page.social.instagram, label: "Instagram" });
  if (page.social.facebook) items.push({ href: page.social.facebook, label: "Facebook" });
  if (page.social.youtube) items.push({ href: page.social.youtube, label: "YouTube" });
  if (page.social.linkedin) items.push({ href: page.social.linkedin, label: "LinkedIn" });
  if (page.social.website) items.push({ href: page.social.website, label: "Website" });
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-[#334155] transition hover:border-blue-200 hover:text-[#0F172A]"
        >
          <ExternalLink className="h-4 w-4" />
          {item.label}
        </a>
      ))}
    </div>
  );
}

export function LandingPage({
  brand,
  page,
}: {
  brand: PortalBrand;
  page: ResolvedLandingPage;
}) {
  const stepScreenshots = [
    page.assets.screenshots.request,
    page.assets.screenshots.quote,
    page.assets.screenshots.dashboard,
    page.assets.screenshots.review,
  ];
  const STEPS = page.howItWorks.map((step, i) => ({
    step: String(i + 1).padStart(2, "0"),
    title: step.label,
    description: step.description,
    image: stepScreenshots[i % stepScreenshots.length],
    alt: `${page.portalName} step ${i + 1}`,
  }));
  const PORTAL_SHOWCASE = buildShowcase(page);
  const MEDIA_USES = buildMediaUses(page);
  const headerLogo = page.assets.logoHeader || brand.logoUrl;
  const footerLogo = page.assets.logoFooter || headerLogo;
  const website = brand.websiteUrl || page.social.website || "/";
  const industriesLine =
    page.industries.length <= 1
      ? page.industries[0] ?? ""
      : `${page.industries.slice(0, -1).join(", ")}, and ${page.industries[page.industries.length - 1]}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#334155]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F172A]/90 backdrop-blur-xl safe-area-top safe-area-x">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <LandingLogo href={website} src={headerLogo} name={brand.name} />

          <nav className="flex items-center gap-2 sm:gap-3">
            {brand.websiteUrl ? (
              <a
                href={brand.websiteUrl}
                className="hidden items-center gap-1 text-sm font-medium text-slate-300 transition hover:text-white sm:flex"
              >
                <Home className="h-4 w-4" />
                Main Website
              </a>
            ) : null}

            <Link href="/request">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
                Request a Shoot
              </Button>
            </Link>

            <Link href="/login">
              <Button variant="accent" size="sm">
                {page.ctaSecondaryLabel}
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-[#0F172A]">
          <div className="absolute inset-0">
            {page.showShowreel && page.showreelVideoId ? (
              <iframe
                src={`https://www.youtube.com/embed/${page.showreelVideoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${page.showreelVideoId}&showinfo=0&rel=0&modestbranding=1&playsinline=1`}
                title={`${brand.name} showreel`}
                className="pointer-events-none absolute inset-0 h-full w-full scale-[1.4] opacity-40"
                allow="autoplay; encrypted-media"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/80 via-[#0F172A]/70 to-[#0F172A]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <div className="max-w-3xl">
              {page.eyebrow ? (
                <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-blue-300">
                  {page.eyebrow}
                </p>
              ) : null}

              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                {page.headline}
                {page.headlineAccent ? (
                  <span className="mt-2 block text-blue-400">{page.headlineAccent}</span>
                ) : null}
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
                {page.subheadline}
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <RequestShootButton
                  label={page.ctaPrimaryLabel}
                  size="lg"
                  className="w-full sm:w-auto"
                />

                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/25 bg-white/5 px-8 text-base text-white hover:bg-white/15 sm:w-auto"
                  >
                    {page.ctaSecondaryLabel}
                  </Button>
                </Link>
              </div>
            </div>

            {page.showIndustries ? (
              <div className="mt-16 hidden lg:block">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  <Play className="h-4 w-4 text-blue-400" />
                  Built for {industriesLine}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {page.showServices ? (
          <section className="bg-[#F8FAFC] py-20 sm:py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto mb-12 max-w-2xl text-center">
                <p className="text-sm font-semibold uppercase tracking-widest text-[#3B82F6]">
                  Services
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
                  What {page.businessName} offers
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {page.services.map((service) => (
                  <div
                    key={service.name}
                    className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/40"
                  >
                    <h3 className="font-semibold text-[#0F172A]">{service.name}</h3>
                    {service.startingLabel ? (
                      <p className="mt-1 text-sm font-medium text-[#3B82F6]">{service.startingLabel}</p>
                    ) : null}
                    {service.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{service.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden bg-[#F8FAFC] py-24 sm:py-32">
          <div className="mx-auto mb-12 max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#3B82F6]">
              How it works
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
              From first request to final download
            </h2>
            <p className="mt-4 hidden text-[#64748B] sm:block">Scroll to explore each step →</p>
          </div>

          <div className="flex snap-x snap-mandatory items-start gap-8 overflow-x-auto pb-6 pl-[max(1rem,calc(50vw-240px))] pr-[max(1rem,calc(50vw-240px))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STEPS.map((item) => (
              <article
                key={item.step}
                className="flex shrink-0 snap-center flex-col"
                style={{ width: STEP_CARD_WIDTH, maxWidth: "88vw" }}
              >
                <div className="mb-6 px-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3B82F6]">
                    Step {item.step}
                  </span>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#0F172A] sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748B] sm:text-base">
                    {item.description}
                  </p>
                </div>

                {item.image ? (
                  <div className="rounded-3xl bg-white p-2 shadow-xl shadow-slate-200/60 ring-1 ring-black/[0.04] sm:p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt={item.alt}
                      width={STEP_CARD_WIDTH}
                      className="h-auto w-full rounded-2xl"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="bg-white py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
                Everything in one place
              </h2>
              <p className="mt-4 text-lg text-[#64748B]">
                A complete client experience, not a folder of random links.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {page.features.map((feature) => {
                const Icon = FEATURE_ICON_MAP[feature.icon] ?? CheckCircle2;
                return (
                <div
                  key={`${feature.icon}-${feature.title}`}
                  className="group rounded-2xl border border-slate-100 bg-[#F8FAFC] p-6 transition-all hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-500/5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3B82F6]/10 transition-colors group-hover:bg-[#3B82F6]/15">
                    <Icon className="h-5 w-5 text-[#3B82F6]" />
                  </div>
                  <h3 className="mt-4 font-semibold text-[#0F172A]">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{feature.description}</p>
                </div>
                );
              })}
            </div>
          </div>
        </section>

        {PORTAL_SHOWCASE.length > 0 ? (
          <section className="overflow-hidden bg-[#0F172A] py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto mb-16 max-w-3xl text-center">
                <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
                  Inside the portal
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Request, schedule, estimate, review, and pay
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-slate-400">
                  Submit project details, review preliminary pricing, track progress, preview
                  deliverables, and complete payment from a single organized portal.
                </p>
              </div>

              <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 pl-[max(1rem,calc(50vw-210px))] pr-[max(1rem,calc(50vw-210px))]">
                {PORTAL_SHOWCASE.map((item, i) => (
                  <div
                    key={item.title}
                    className="w-[85vw] shrink-0 snap-center sm:w-[420px] lg:w-[480px]"
                    style={{ transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)` }}
                  >
                    <div className="overflow-hidden rounded-2xl bg-slate-800 shadow-2xl ring-1 ring-white/10">
                      <div className="border-b border-white/10 px-4 py-3">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                      </div>
                      <Image
                        src={item.image}
                        alt={item.title}
                        width={960}
                        height={600}
                        className="h-auto w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {MEDIA_USES.length > 0 ? (
          <section className="py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mx-auto mb-16 max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
                  Built for properties that need to stand out
                </h2>
                <p className="mt-4 text-lg text-[#64748B]">
                  {page.portalName} supports every type of aerial project {page.businessName}{" "}
                  delivers.
                </p>
              </div>

              <div className="grid gap-8 lg:grid-cols-3">
                {MEDIA_USES.map((item) => (
                  <div
                    key={item.title}
                    className="group overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-black/5"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 1024px) 100vw, 33vw"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-[#0F172A]">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-y border-slate-100 bg-white py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/*
              When there is no headshot, a two-column `lg:grid-cols-[280px_1fr]`
              would place the copy in the 280px track — left-hug / mobile width on desktop.
            */}
            <div
              className={
                page.assets.ownerHeadshot
                  ? "grid items-center gap-12 lg:grid-cols-[280px_minmax(0,1fr)]"
                  : "mx-auto max-w-3xl"
              }
            >
              {page.assets.ownerHeadshot ? (
                <div className="mx-auto lg:mx-0">
                  <div className="relative h-56 w-56 overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
                    <Image
                      src={page.assets.ownerHeadshot}
                      alt={brand.name}
                      fill
                      className="object-cover"
                      sizes="224px"
                    />
                  </div>
                </div>
              ) : null}

              <div className={page.assets.ownerHeadshot ? undefined : "text-center sm:text-left"}>
                <h2 className="text-3xl font-bold tracking-tight text-[#0F172A]">
                  Built to make working with {page.businessName} effortless
                </h2>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#64748B] mx-auto sm:mx-0">
                  {page.customBusinessDescription ||
                    `${page.portalName} keeps requests, estimates, project updates, deliverables, and payments organized in one beautiful place, so you spend less time chasing files and more time using your media.`}
                </p>

                <ul
                  className={
                    page.assets.ownerHeadshot
                      ? "mt-8 grid gap-3 text-sm text-[#334155] sm:grid-cols-2"
                      : "mt-8 mx-auto grid max-w-2xl gap-3 text-sm text-[#334155] sm:grid-cols-2 sm:mx-0"
                  }
                >
                  {[
                    "Direct communication",
                    "Organized project flow",
                    "Professional media delivery",
                    "Secure Stripe payments",
                    "Easy access to past projects",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3B82F6]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {page.showSocial ? (
          <section className="bg-[#F8FAFC] py-16">
            <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
              <h2 className="text-xl font-semibold text-[#0F172A]">Connect with {page.businessName}</h2>
              <div className="mt-6">
                <SocialLinks page={page} />
              </div>
            </div>
          </section>
        ) : null}

        <section className="bg-gradient-to-br from-[#0F172A] to-slate-900 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <LandingLogo
              className="mx-auto mb-8 h-12 w-auto opacity-95"
              href={website}
              src={page.assets.logoStackedWhite || headerLogo}
              name={brand.name}
            />

            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to request your next shoot?
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              {page.footerTagline ||
                `Start your project in minutes and manage everything through ${page.portalName}.`}
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <RequestShootButton label={page.ctaPrimaryLabel} size="lg" />

              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white/25 bg-transparent px-8 text-white hover:bg-white/10 sm:w-auto"
                >
                  {page.ctaSecondaryLabel}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          {website && website !== "/" ? (
            <a
              href={website}
              aria-label={`Go to ${brand.name} website`}
              className="inline-flex items-center"
            >
              {footerLogo ? (
                <Image
                  src={footerLogo}
                  alt={brand.name}
                  width={180}
                  height={52}
                  className="h-8 w-auto opacity-90"
                />
              ) : (
                <span className="text-sm font-semibold text-[#0F172A]">{brand.name}</span>
              )}
            </a>
          ) : (
            <span className="text-sm font-semibold text-[#0F172A]">{brand.legalName}</span>
          )}

          <div className="flex flex-col items-center gap-2 text-center sm:items-end sm:text-right">
            <p className="text-sm text-[#64748B]">
              © {new Date().getFullYear()} {brand.legalName}. All rights reserved.
            </p>
            {brand.websiteUrl ? (
              <a
                href={brand.websiteUrl}
                className="text-sm font-medium text-[#3B82F6] hover:text-[#0F172A]"
              >
                Back to main website →
              </a>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
