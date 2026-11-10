import Link from "next/link";
import { Sparkles } from "lucide-react";

/** Shown until migration v118 is applied (nothing else in the app changes meanwhile). */
export function MarketingSetupNotice({ backHref }: { backHref: string }) {
  return (
    <div className="flex min-h-[var(--app-height)] items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <Sparkles className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 text-lg font-semibold text-heading">Marketing Kit is almost ready</h1>
        <p className="mt-2 text-sm text-muted">
          It needs a one-time database update (migration v118) before property websites and social graphics can be created. Nothing else is affected.
        </p>
        <Link href={backHref} className="mt-6 inline-flex text-sm font-medium text-accent hover:underline">
          Back to the project
        </Link>
      </div>
    </div>
  );
}
