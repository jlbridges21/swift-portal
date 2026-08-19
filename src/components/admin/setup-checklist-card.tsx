"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X } from "lucide-react";
import type { AppSettings } from "@/lib/app-settings";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { BRAND } from "@/lib/brand";

interface SetupChecklistCardProps {
  settings: AppSettings;
}

function isDone(value: boolean) {
  return value;
}

export function SetupChecklistCard({ settings }: SetupChecklistCardProps) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [stripeOk, setStripeOk] = useState<boolean | null>(null);
  const [hasServices, setHasServices] = useState<boolean | null>(null);

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
        setHasServices(Array.isArray(data.services) && data.services.length > 0);
      })
      .catch(() => setHasServices(false));
  }, []);

  const b = settings.business;
  const items = [
    {
      id: "name",
      label: "Business name",
      href: "#settings-business",
      done: Boolean(b.businessName.trim()) && b.businessName !== PLATFORM_BUSINESS_DEFAULTS.businessName,
    },
    {
      id: "logo",
      label: "Logo",
      href: "#settings-business",
      done: Boolean(b.logoUrl) && b.logoUrl !== PLATFORM_BUSINESS_DEFAULTS.logoUrl && b.logoUrl !== BRAND.logoUrl,
    },
    {
      id: "colors",
      label: "Brand colors",
      href: "#settings-business",
      done:
        b.brandPrimaryColor !== PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor ||
        b.brandAccentColor !== PLATFORM_BUSINESS_DEFAULTS.brandAccentColor,
    },
    {
      id: "contact",
      label: "Contact info",
      href: "#settings-business",
      done: Boolean(b.primaryContactEmail.trim() || b.phoneNumber.trim()),
    },
    {
      id: "email",
      label: "Email sender",
      href: "#settings-email",
      done:
        settings.email.senderMode === "platform" ||
        (settings.email.senderMode === "custom_domain" &&
          settings.email.domainVerificationStatus === "verified"),
    },
    {
      id: "stripe",
      label: "Stripe connection",
      href: "#settings-payments",
      done: stripeOk === true,
    },
    {
      id: "services",
      label: "Services",
      href: "#settings-services",
      done: hasServices === true,
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
          <Link
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
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
