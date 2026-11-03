"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  deniedPermissionMessage,
  pushSetupTip,
  unsupportedPushMessage,
  type PushEnvironment,
  type PushPermission,
} from "@/lib/push-platform";
import {
  enableWebPush,
  getDevicePushSubscription,
  readPushEnvironment,
  readPushPermission,
} from "@/lib/web-push-client";
import { useIsMobileOrPwa } from "@/lib/use-mobile-or-pwa";
import { usePortalBrand } from "@/components/brand/brand-provider";

interface PushStatus {
  configured: boolean;
  vapidPublicKey: string | null;
  /** Account has push turned on (any device, including legacy OneSignal). */
  enabled: boolean;
  /** This device has a Web Push subscription the server knows about. */
  deviceRegistered: boolean;
  permission: PushPermission;
  env: PushEnvironment;
}

async function checkDeviceRegistered(vapidPublicKey: string): Promise<boolean> {
  const subscription = await getDevicePushSubscription(vapidPublicKey);
  if (!subscription) return false;
  const res = await fetch("/api/admin/push", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "check", endpoint: subscription.endpoint }),
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => ({}));
  return data.registered === true;
}

export function PushNotificationsCard() {
  const brand = usePortalBrand();
  const isMobileOrPwa = useIsMobileOrPwa();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [testing, setTesting] = useState(false);
  /** Keep the card up after enabling so the admin can send a test push. */
  const [justEnabled, setJustEnabled] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!isMobileOrPwa) return;

    const env = readPushEnvironment();
    const permission = readPushPermission();
    try {
      const res = await fetch("/api/admin/push", { credentials: "include" });
      const data = res.ok ? await res.json() : null;
      const vapidPublicKey: string | null = data?.vapidPublicKey ?? null;
      const deviceRegistered =
        vapidPublicKey && env.support === "supported" && permission === "granted"
          ? await checkDeviceRegistered(vapidPublicKey).catch(() => false)
          : false;

      setStatus({
        configured: Boolean(data?.configured && vapidPublicKey),
        vapidPublicKey,
        enabled: data?.enabled ?? false,
        deviceRegistered,
        permission,
        env,
      });
    } catch {
      setStatus({
        configured: false,
        vapidPublicKey: null,
        enabled: false,
        deviceRegistered: false,
        permission,
        env,
      });
    }
  }, [isMobileOrPwa]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function handleEnable() {
    if (!status?.vapidPublicKey) {
      toast.error("Push notifications aren't available right now. Please try again later.");
      return;
    }

    setEnabling(true);
    try {
      // Permission is requested first inside enableWebPush (iOS needs the tap gesture).
      const result = await enableWebPush({ vapidPublicKey: status.vapidPublicKey, env: status.env });
      if (result.status === "enabled") {
        setJustEnabled(true);
        toast.success("Push notifications enabled on this device");
      } else if (result.status === "denied") {
        toast.message("Notifications are blocked. See the steps on this card to turn them on.");
      } else if (result.status === "dismissed") {
        toast.message("Notifications weren't enabled. Tap Enable Notifications when you're ready.");
      } else {
        toast.error(result.message);
      }
      await refreshStatus();
    } catch (error) {
      console.error("[push] enable failed:", error);
      toast.error("Couldn't enable notifications on this device. Please try again.");
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
        toast.error("Couldn't send a test notification. Try enabling notifications on this device again.");
        return;
      }

      toast.success("Test push sent — check this device");
    } catch {
      toast.error("Couldn't send a test notification. Check your connection and try again.");
    } finally {
      setTesting(false);
    }
  }

  if (!isMobileOrPwa || !status || !status.configured) return null;

  const isEnabledOnDevice = status.deviceRegistered && status.permission === "granted";
  if (isEnabledOnDevice && !justEnabled) return null;

  const unsupportedMessage = unsupportedPushMessage(status.env, brand.portalName);
  const isDenied = !unsupportedMessage && status.permission === "denied";
  const tip = pushSetupTip(status.env, brand.portalName);

  return (
    <Card className="mb-10 border-sky-100 bg-gradient-to-br from-sky-50/50 to-white surface-dark:from-background surface-dark:to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5 text-accent" />
          Enable Push Notifications
        </CardTitle>
        <CardDescription>
          Get instant alerts when new requests, approvals, scheduling changes, revisions, or payments
          happen in {brand.portalName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {unsupportedMessage ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-white/80 surface-dark:bg-card/80 px-4 py-3 text-sm text-muted">
            <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{unsupportedMessage}</p>
          </div>
        ) : (
          <>
            {isEnabledOnDevice && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Notifications are on for this device.</p>
              </div>
            )}

            {!isEnabledOnDevice && status.enabled && !isDenied && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Push is enabled on your account. Tap below to activate notifications on this device.
              </div>
            )}

            {isDenied && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {deniedPermissionMessage(status.env, brand.portalName)}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {!isEnabledOnDevice && (
                <Button
                  variant="accent"
                  className="min-h-11"
                  onClick={isDenied ? refreshStatus : handleEnable}
                  disabled={enabling}
                >
                  {enabling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enabling…
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4" />
                      {isDenied ? "I've allowed notifications" : "Enable Notifications"}
                    </>
                  )}
                </Button>
              )}

              {isEnabledOnDevice && (
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

            {tip && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-white/80 surface-dark:bg-card/80 px-4 py-3 text-sm text-muted">
                <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{tip}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
