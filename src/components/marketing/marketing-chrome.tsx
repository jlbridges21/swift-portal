import Link from "next/link";
import Image from "next/image";
import { SITE, SITE_ICONS } from "@/lib/site-metadata";
import { MARKETING_BRAND } from "@/lib/marketing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#product-demo", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/partners", label: "Partners" },
  { href: "/contact", label: "Contact" },
] as const;

export function MarketingHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80",
        className
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image
            src={SITE_ICONS.logoMark}
            alt={SITE.name}
            width={140}
            height={36}
            className="h-8 w-auto object-contain"
            priority
          />
          <span className="sr-only">{SITE.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[#475569] transition hover:text-[#0F172A]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" className="min-h-11 px-4 text-[#0F172A]">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              className="min-h-11 px-4 text-white hover:opacity-95"
              style={{ backgroundColor: MARKETING_BRAND.indigo }}
            >
              Start free trial
            </Button>
          </Link>
        </div>
      </div>

      <nav
        className="flex gap-4 overflow-x-auto border-t border-[#E2E8F0] px-4 py-2 md:hidden"
        aria-label="Mobile"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 text-sm font-medium text-[#475569]"
          >
            {item.label}
          </Link>
        ))}
        <Link href="/login" className="shrink-0 text-sm font-medium text-[#475569] sm:hidden">
          Log in
        </Link>
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[#E2E8F0] bg-[#0F172A] text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-1">
          <Image
            src={SITE_ICONS.logoWhite}
            alt={SITE.name}
            width={148}
            height={40}
            className="h-9 w-auto object-contain"
          />
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            {MARKETING_BRAND.tagline}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Product</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/how-it-works" className="hover:text-white">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-white">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/partners" className="hover:text-white">
                Partner Program
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:text-white">
                Start free trial
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Company</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/contact" className="hover:text-white">
                Contact
              </Link>
            </li>
            <li>
              <a href="mailto:hello@shootportal.app" className="hover:text-white">
                hello@shootportal.app
              </a>
            </li>
            <li>
              <a href="mailto:support@shootportal.app" className="hover:text-white">
                support@shootportal.app
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Legal</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/privacy" className="hover:text-white">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-white">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-white">
                Log in
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-400 sm:px-6 lg:px-8">
          © {year} ShootPortal. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export function MarketingShell({
  children,
  trialNote,
}: {
  children: React.ReactNode;
  trialNote?: string | null;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      {trialNote ? (
        <p className="sr-only" aria-live="polite">
          {trialNote}
        </p>
      ) : null}
      <MarketingFooter />
    </div>
  );
}

export function MarketingCtaBand({
  title,
  body,
  trialLabel,
  secondaryHref = "#product-demo",
  secondaryLabel = "See how it works",
}: {
  title: string;
  body: string;
  trialLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="border-t border-[#E2E8F0] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-base text-[#475569]">{body}</p>
          <p className="mt-2 text-sm text-[#475569]">{trialLabel}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup">
            <Button
              className="min-h-11 px-6 text-white"
              style={{ backgroundColor: MARKETING_BRAND.indigo }}
            >
              Start your free trial
            </Button>
          </Link>
          <Link href={secondaryHref}>
            <Button variant="outline" className="min-h-11 border-[#E2E8F0] bg-white px-6 text-[#0F172A]">
              {secondaryLabel}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
