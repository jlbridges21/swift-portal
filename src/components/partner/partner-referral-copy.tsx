"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

export function PartnerReferralCopy({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <code className="block min-w-0 flex-1 truncate rounded-lg border border-border bg-subtle px-3 py-2.5 text-sm text-heading">
        {link}
      </code>
      <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => void copy()}>
        {copied ? (
          <>
            <Check className="h-4 w-4" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" /> Copy link
          </>
        )}
      </Button>
    </div>
  );
}
