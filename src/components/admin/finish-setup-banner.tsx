"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Persistent CTA when an admin deferred the wizard ("I'll do this later"). */
export function FinishSetupBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p>
          Setup is incomplete — your portal is not fully ready for clients yet. Finish the remaining
          steps when you can.
        </p>
        <Link href="/onboarding">
          <Button type="button" size="sm" variant="outline" className="border-amber-300 bg-white">
            Finish setup
          </Button>
        </Link>
      </div>
    </div>
  );
}
