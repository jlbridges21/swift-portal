"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { AppSettings, SetupAcceptDefaultKey } from "@/lib/app-settings";

const LABELS: Record<SetupAcceptDefaultKey, string> = {
  logo: "Use ShootPortal default logo",
  colors: "Use ShootPortal default colors",
  stripe: "Skip for now — connect payments later",
  custom_domain: "Keep ShootPortal address for now",
};

/**
 * Consistent affordance: acknowledge ShootPortal defaults for optional setup.
 * Persists on the business settings row (not localStorage).
 */
export function AcceptSetupDefaultButton({
  acceptKey,
  className,
  variant = "outline",
  size = "sm",
}: {
  acceptKey: SetupAcceptDefaultKey;
  className?: string;
  variant?: "outline" | "ghost";
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      const getRes = await fetch("/api/admin/settings", { credentials: "include" });
      const getData = (await getRes.json()) as { settings?: AppSettings; error?: string };
      if (!getRes.ok || !getData.settings) {
        throw new Error(getData.error || "Could not load settings");
      }
      const next: AppSettings = {
        ...getData.settings,
        setupAcceptedDefaults: {
          ...getData.settings.setupAcceptedDefaults,
          [acceptKey]: true,
        },
      };
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save");
      toast.success(
        acceptKey === "stripe"
          ? "Payments marked for later — you can connect Stripe anytime in Settings."
          : acceptKey === "custom_domain"
            ? "You can connect your own web address anytime under Settings → Use your own web address."
            : "Default saved. You can customize this anytime in Settings."
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={busy}
      onClick={() => void accept()}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {LABELS[acceptKey]}
    </Button>
  );
}
