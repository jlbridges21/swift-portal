"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X } from "lucide-react";
import type { AppSettings } from "@/lib/app-settings";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { BRAND } from "@/lib/brand";

/** Starter catalog from createBusinessForPlatform — not "set up" yet. */
const STARTER_SERVICE_SLUGS = new Set([
  "aerial_photography",
  "aerial_videography",
  "drone_mapping",
  "custom_project",
]);

interface SetupChecklistCardProps {
  settings: AppSettings;
  /** When true, deep-link into /admin/settings (admin home). */
  linkToSettings?: boolean;
}

function isDone(value: boolean) {
  return value;
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
  const [servicesCustomized, setServicesCustomized] = useState<boolean | null>(null);

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
        if (list.length === 0) {
          setServicesCustomized(false);
          return;
        }
        const onlyStarters =
          list.length === STARTER_SERVICE_SLUGS.size &&
          list.every(
            (s: { slug?: string }) => typeof s.slug === "string" && STARTER_SERVICE_SLUGS.has(s.slug)
          );
        setServicesCustomized(!onlyStarters);
      })
      .catch(() => setServicesCustomized(false));
  }, []);

  const b = settings.business;
  const items = [
    {
      id: "name",
      label: "Business name",
      href: settingsHref("settings-business-name", linkToSettings),
      done: Boolean(b.businessName.trim()) && b.businessName !== PLATFORM_BUSINESS_DEFAULTS.businessName,
    },
    {
      id: "logo",
      label: "Logo",
      href: settingsHref("settings-logo", linkToSettings),
      done: Boolean(b.logoUrl) && b.logoUrl !== PLATFORM_BUSINESS_DEFAULTS.logoUrl && b.logoUrl !== BRAND.logoUrl,
    },
    {
      id: "colors",
      label: "Brand colors",
      href: settingsHref("settings-colors", linkToSettings),
      done:
        b.brandPrimaryColor !== PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor ||
        b.brandAccentColor !== PLATFORM_BUSINESS_DEFAULTS.brandAccentColor,
    },
    {
      id: "contact",
      label: "Contact info",
      href: settingsHref("settings-contact", linkToSettings),
      done: Boolean(b.primaryContactEmail.trim() || b.phoneNumber.trim()),
    },
    {
      id: "email",
      label: "Email sender",
      href: settingsHref("settings-email", linkToSettings),
      // Platform default sender is not "set up" — custom domain must be verified.
      done:
        settings.email.senderMode === "custom_domain" &&
        settings.email.domainVerificationStatus === "verified",
    },
    {
      id: "stripe",
      label: "Stripe connection",
      href: settingsHref("settings-payments", linkToSettings),
      done: stripeOk === true,
    },
    {
      id: "services",
      label: "Services",
      href: settingsHref("settings-services", linkToSettings),
      done: servicesCustomized === true,
    },
  ];

  const incomplete = items.some((item) => !isDone(item.done));
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
