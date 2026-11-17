import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

/** Public booking pages: portal header, back link, title block, content. */
export function BookingPageShell({
  title,
  subtitle,
  backHref,
  backLabel,
  children,
  publicChrome = true,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
  /** Off inside the client portal, which has its own chrome. */
  publicChrome?: boolean;
}) {
  const body = (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      {backHref ? (
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          <ChevronLeft className="h-4 w-4" /> {backLabel ?? "Back"}
        </Link>
      ) : null}
      <div className="flex items-start gap-4">
        <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-subtle text-accent sm:inline-flex">
          <CalendarDays className="h-7 w-7" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
  if (!publicChrome) return <div className="px-4 py-6 sm:px-6 lg:px-8">{body}</div>;
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">{body}</main>
      <Footer />
    </div>
  );
}

export function InvalidBookingLink() {
  return (
    <BookingPageShell title="This link has expired" subtitle="Booking links are personal and expire after a while.">
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted shadow-sm">
        Sign in to your client portal to see and manage your shoot, or reply to your confirmation email and we&apos;ll help.
        <div className="mt-4">
          <Link href="/login">
            <Button variant="accent">Sign in</Button>
          </Link>
        </div>
      </div>
    </BookingPageShell>
  );
}
