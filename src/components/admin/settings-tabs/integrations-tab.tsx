"use client";

import { Check, Link2, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { GoogleCalendarSettingsCard } from "@/components/admin/google-calendar-settings-card";
import { OutlookCalendarSettingsCard } from "@/components/admin/outlook-calendar-settings-card";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";

export function IntegrationsTab() {
  const { settings, savedSettings, patchIntegrations } = useSettingsTab();
  const webhookUrl = settings.integrations?.ghlWebhookUrl ?? "";
  const savedUrl = (savedSettings.integrations?.ghlWebhookUrl ?? "").trim();
  const ghlConnected = savedUrl.length > 0;
  const ghlPending = webhookUrl.trim() !== savedUrl;

  return (
    <div id="settings-integrations" tabIndex={-1} className="scroll-mt-24 space-y-5">
      <div>
        <SectionHeading id="integrations">Integrations</SectionHeading>
        <p className="mt-1 text-sm text-muted">Connect the tools you already use.</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <GoogleCalendarSettingsCard />
        <OutlookCalendarSettingsCard />

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-heading text-card">
              <Webhook className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-heading">GoHighLevel</h3>
              <p className="text-[13px] text-muted">Send new requests to your CRM</p>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                ghlConnected
                  ? "bg-emerald-50 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300"
                  : "bg-subtle text-muted"
              )}
            >
              {ghlConnected ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
              {ghlConnected ? "Connected" : "Not connected"}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ghlWebhookUrl">Inbound webhook URL</Label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                id="ghlWebhookUrl"
                type="url"
                inputMode="url"
                className="h-11 pl-9"
                value={webhookUrl}
                onChange={(e) => patchIntegrations({ ghlWebhookUrl: e.target.value })}
                placeholder="https://services.leadconnectorhq.com/hooks/…"
              />
            </div>
            <p className="text-xs text-muted">
              {ghlPending
                ? "Save Settings to apply this change."
                : "New project requests are sent here. Leave blank to skip."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ghlLeadSource">Lead source label</Label>
            <Input
              id="ghlLeadSource"
              className="h-11"
              value={settings.integrations?.ghlLeadSource ?? ""}
              onChange={(e) => patchIntegrations({ ghlLeadSource: e.target.value })}
              placeholder="ShootPortal"
            />
          </div>

          {webhookUrl.trim() ? (
            <div>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                onClick={() => patchIntegrations({ ghlWebhookUrl: "" })}
              >
                {ghlConnected ? "Disconnect" : "Clear"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
