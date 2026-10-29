"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Super admin demo helpers: start a signup that ignores this browser's partner referral, and
 * clear that referral from this browser. `browserReferralCode` is read server-side from the
 * httpOnly sp_partner_ref cookie.
 */
export function AdminDemoSignupTools({ browserReferralCode }: { browserReferralCode: string | null }) {
  const [code, setCode] = useState(browserReferralCode);
  const [busy, setBusy] = useState<"start" | "clear" | null>(null);

  async function startDemo() {
    setBusy("start");
    try {
      const res = await fetch("/api/platform/demo-signup", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start demo signup.");
      // Same tab: a window.open after an await is often blocked as a popup.
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start demo signup.");
    } finally {
      setBusy(null);
    }
  }

  async function clearReferral() {
    setBusy("clear");
    try {
      const res = await fetch("/api/platform/referral-cookie/clear", { method: "POST" });
      const data = (await res.json()) as { cleared?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not clear.");
      setCode(null);
      toast.success(data.cleared ? "Partner referral cleared from this browser." : "This browser had no partner referral.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6 text-sm">
        <div>
          <h3 className="font-semibold text-heading">Demo signups</h3>
          <p className="mt-1 text-muted">
            Creating an account for someone during a demo? Use <strong>Demo signup</strong>. It opens the normal
            signup page, but the account won’t be linked to any partner, even if this browser has visited a
            partner link. Free trial and paid signup both work as usual. Demo mode lasts 4 hours.
          </p>
          <p className="mt-2">
            This browser’s partner referral:{" "}
            {code ? <span className="font-mono font-semibold">{code}</span> : <span className="text-muted">none</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="accent" disabled={busy != null} onClick={() => void startDemo()}>
            {busy === "start" ? "Opening…" : "Demo signup (no partner referral)"}
          </Button>
          <Button type="button" variant="outline" disabled={busy != null} onClick={() => void clearReferral()}>
            {busy === "clear" ? "Clearing…" : "Clear referral from this browser"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
