"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  enableAdminPushNotifications,
  getLocalPushSubscriptionStatus,
  isOneSignalConfigured,
} from "@/lib/onesignal-client";
import { useIsMobileOrPwa } from "@/lib/use-mobile-or-pwa";

interface PushStatus {
  configured: boolean;
  enabled: boolean;
  subscriptionId: string | null;
  localOptedIn: boolean;
}

export function PushNotificationsCard() {
  const isMobileOrPwa = useIsMobileOrPwa();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [testing, setTesting] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!isMobileOrPwa) {
      setSetupNeeded(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/push", { credentials: "include" });
      const data = res.ok ? await res.json() : null;

      const configured = data?.configured ?? isOneSignalConfigured();
      const enabled = data?.enabled ?? false;
      const subscriptionId = data?.subscriptionId ?? null;

      if (!configured) {
        setStatus({ configured, enabled, subscriptionId, localOptedIn: false });
        setSetupNeeded(false);
        return;
      }

      const local = await getLocalPushSubscriptionStatus();
      const isFullySubscribed = enabled && local.optedIn;

      setStatus({
        configured,
        enabled,
        subscriptionId,
        localOptedIn: local.optedIn,
      });
      setSetupNeeded(!isFullySubscribed);
    } catch {
      setStatus({
        configured: isOneSignalConfigured(),
        enabled: false,
        subscriptionId: null,
        localOptedIn: false,
      });
      setSetupNeeded(true);
    }
  }, [isMobileOrPwa]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function handleEnable() {
    if (!isOneSignalConfigured()) {
      toast.error("Push notifications are not configured for this environment.");
      return;
    }

    setEnabling(true);
    try {
      const profileRes = await fetch("/api/profile", { credentials: "include" });
      if (!profileRes.ok) throw new Error("Could not verify admin profile");
      const { profile } = await profileRes.json();
      if (profile?.role !== "admin") throw new Error("Admin access required");

      const { subscriptionId, optedIn } = await enableAdminPushNotifications(profile.id);

      const saveRes = await fetch("/api/admin/push", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", subscriptionId }),
      });

      if (!saveRes.ok) throw new Error("Failed to save push preferences");

      if (optedIn) {
        toast.success("Push notifications enabled on this device");
      } else {
        toast.message("Permission was not granted. You can try again from your browser settings.");
      }

      await refreshStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enable push notifications");
    } finally {
      setEnabling(false);
    }
  }

  async function handleTestPush() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.detail || "Failed to send test push");
      }

      toast.success("Test push sent — check this device");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test push");
    } finally {
      setTesting(false);
    }
  }

  if (!isMobileOrPwa || setupNeeded === null || setupNeeded === false) {
    return null;
  }

  const isEnabledOnDevice = Boolean(status?.enabled && status?.localOptedIn);

  return (
    <Card className="mb-10 border-sky-100 bg-gradient-to-br from-sky-50/50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5 text-accent" />
          Enable Push Notifications
        </CardTitle>
        <CardDescription>
          Get instant alerts when new requests, approvals, scheduling changes, revisions, or payments
          happen in Swift Portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.enabled && !status.localOptedIn && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Push is enabled on your account. Tap below to activate notifications on this device.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            variant="accent"
            className="min-h-11"
            onClick={handleEnable}
            disabled={!status?.configured || enabling || isEnabledOnDevice}
          >
            {enabling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enabling…
              </>
            ) : (
              <>
                <Bell className="h-4 w-4" />
                Enable Notifications
              </>
            )}
          </Button>

          {isEnabledOnDevice && status?.configured && (
            <Button variant="outline" className="min-h-11" onClick={handleTestPush} disabled={testing}>
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send Test Push"
              )}
            </Button>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-white/80 px-4 py-3 text-sm text-muted">
          <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            For iPhone lock-screen alerts, open Swift Portal from your Home Screen icon, then enable
            notifications here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
