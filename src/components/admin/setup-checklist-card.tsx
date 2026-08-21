"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X } from "lucide-react";
import type { AppSettings } from "@/lib/app-settings";
import { buildSetupChecklistItems, type ServiceCompletenessRow } from "@/lib/setup-completeness";

interface SetupChecklistCardProps {
  settings: AppSettings;
  /** When true, deep-link into /admin/settings (admin home). */
  linkToSettings?: boolean;
}

function settingsHref(hash: string, linkToSettings: boolean) {
  return linkToSettings ? `/admin/settings#${hash}` : `#${hash}`;
}

export function SetupChecklistCard({
  settings,
  linkToSettings = false,
}: SetupChecklistCardProps) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [stripeOk, setStripeOk] = useState<boolean | null>(null);
  const [services, setServices] = useState<ServiceCompletenessRow[] | null>(null);

  useEffect(() => {
    setDismissed(window.localStorage.getItem("portal-setup-dismissed") === "1");
    setReady(true);
    fetch("/api/stripe/connect", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setStripeOk(Boolean(data.isPlatform || data.status === "active"));
      })
      .catch(() => setStripeOk(false));
    fetch("/api/admin/services", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.services) ? data.services : [];
        setServices(list as ServiceCompletenessRow[]);
      })
      .catch(() => setServices([]));
  }, []);

  const items = buildSetupChecklistItems({ settings, stripeOk, services }).map((item) => ({
    ...item,
    href: settingsHref(item.hash, linkToSettings),
  }));

  const incomplete = items.some((item) => !item.done);
  if (!ready || dismissed || !incomplete) return null;

  return (
    <Card className="mb-4 border-sky-200 bg-sky-50/70 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Finish setting up your portal</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            window.localStorage.setItem("portal-setup-dismissed", "1");
            setDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted" />
            )}
            <span>{item.label}</span>
            <span className="text-xs text-muted">{item.done ? "Done" : "Needs attention"}</span>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
