import Link from "next/link";
import Image from "next/image";
import { SITE, SITE_ICONS } from "@/lib/site-metadata";
import { Button } from "@/components/ui/button";
import { formatTrialDaysLabel } from "@/lib/plan-catalog";

export function PlatformLanding({ trialDays }: { trialDays: number }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Image
              src={SITE_ICONS.logoPrimary}
              alt={SITE.name}
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
            <span className="text-lg font-semibold text-slate-900">{SITE.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" className="min-h-11 px-4 text-slate-800">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="min-h-11 bg-[#4F46E5] px-4 text-white hover:bg-[#4338CA]">
                Start free trial
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-20 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4F46E5]">{SITE.name}</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {SITE.tagline}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-slate-600">{SITE.description}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup">
            <Button className="min-h-11 bg-[#4F46E5] px-6 text-white hover:bg-[#4338CA]">
              Start free trial
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="min-h-11 border-slate-300 bg-white px-6 text-slate-900">
              Log in
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          {trialDays > 0
            ? `${formatTrialDaysLabel(trialDays)} Studio trial. No credit card required.`
            : "Studio plan. Subscribe after signup — no free trial."}
        </p>
      </main>
    </div>
  );
}
