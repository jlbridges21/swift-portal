"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorField } from "@/components/ui/color-field";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import { BrandAssetField } from "@/components/admin/brand-asset-field";
import { ServicesSettingsCard } from "@/components/admin/services-settings-card";
import { TravelFeesOnboarding } from "@/components/admin/booking/travel-onboarding";
import { StripeConnectCard } from "@/components/admin/stripe-connect-card";
import { BrandingLivePreview } from "@/components/admin/settings-tabs/branding-live-preview";
import { LandingEditorPreviewFrame } from "@/components/landing/landing-editor-preview-frame";
import { SiteHome } from "@/components/website/site-home";
import { SiteNavProvider } from "@/components/website/site-ui";
import { StepIntro } from "@/components/onboarding/step-intro";
import { BookingStep } from "@/components/onboarding/booking-step";
import { PreliminaryEstimateToggle } from "@/components/onboarding/preliminary-toggle";
import { buildSiteView } from "@/lib/website/view";
import { WEBSITE_TEMPLATE_INFO, WEBSITE_TEMPLATES, type WebsiteTemplateId } from "@/lib/website/settings";
import type { OnboardingWebsitePayload } from "@/lib/website/onboarding";
import { deriveBrandTheme, type SurfaceMode } from "@/lib/brand-color";
import { PORTAL_LOGO_SIZE } from "@/lib/brand-logo-size";
import { COMMON_TIME_ZONES, timeZoneDisplayName, timeZoneFromAddress, type TimeZoneMode } from "@/lib/business-timezone";
import { ONBOARDING_STEP_INTROS } from "@/lib/onboarding-videos";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, ExternalLink, Globe, Loader2, LogOut, UserPlus } from "lucide-react";
import { ONBOARDING_STEP_IDS, type OnboardingStepId, type OnboardingState } from "@/lib/onboarding";

import { cn } from "@/lib/utils";

type OnboardingPayload = {
  completedAt: string | null;
  state: OnboardingState;
  canCustomizeBranding: boolean;
  portalUrl: string;
  business: {
    businessName: string;
    primaryContactEmail: string;
    phoneNumber: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    logoUrl: string;
    brandPrimaryColor: string;
    brandAccentColor: string;
    surfaceMode: SurfaceMode;
    country: string;
    timeZone: string;
    timeZoneMode: TimeZoneMode;
  };
  landing: {
    headline: string;
    subheadline: string;
    headlinePlaceholder: string;
    subheadlinePlaceholder: string;
    howItWorks: { label: string; description: string }[];
    howItWorksPlaceholders: { label: string; description: string }[];
  };
  /** The automatically generated Business Website (Settings → Business Website). */
  website: OnboardingWebsitePayload;
  gates: {
    identity: { ok: boolean; reason?: string };
    services: { ok: boolean; reason?: string };
    finish: { ok: boolean; reason?: string };
  };
  serviceCount: number;
};

const STEP_LABELS: Record<OnboardingStepId, string> = {
  identity: "Your business",
  branding: "Brand & look",
  services: "Services",
  booking: "Booking & calendar",
  payments: "Get paid",
  landing: "Your website",
  finish: "You're live",
};

/** Where each skippable step lives in Settings ("do later" links on the last step). */
const LATER_LINKS: Partial<Record<OnboardingStepId, string>> = {
  branding: "/admin/settings#settings-logo",
  booking: "/admin/settings#settings-booking",
  payments: "/admin/settings#settings-payments",
  landing: "/admin/settings#settings-website",
};

const THEMES: { mode: SurfaceMode; label: string }[] = [
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
  { mode: "brand", label: "Primary color" },
];

type SiteDraft = {
  template: WebsiteTemplateId;
  heroImageUrl: string;
  headline: string;
  intro: string;
  aboutBody: string;
  showServicePricing: boolean;
  instagram: string;
  facebook: string;
};

function siteDraftFrom(website: OnboardingWebsitePayload["website"]): SiteDraft {
  return {
    template: website.template,
    heroImageUrl: website.heroSource === "image" ? website.heroImageUrl : "",
    headline: website.headline,
    intro: website.intro,
    aboutBody: website.about.body,
    showServicePricing: website.showServicePricing,
    instagram: website.social.instagram,
    facebook: website.social.facebook,
  };
}

/** "@studio", "studio" or "instagram.com/studio" → a full https link (the website only keeps https URLs). */
function socialUrl(raw: string, host: "instagram.com" | "facebook.com"): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v.replace(/^http:/i, "https:");
  if (/^(www\.)?(instagram|facebook|fb)\.com\//i.test(v)) return `https://${v.replace(/^www\./i, "")}`;
  return `https://${host}/${v.replace(/^@/, "")}`;
}

async function parseJson(res: Response) {
  const data = (await res.json()) as { error?: string } & Record<string, unknown>;
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function OnboardingWizard({
  initial,
  businessDisplayName,
}: {
  initial: OnboardingPayload;
  businessDisplayName: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState({
    businessName: initial.business.businessName,
    primaryContactEmail: initial.business.primaryContactEmail,
    phoneNumber: initial.business.phoneNumber,
    addressLine1: initial.business.addressLine1 ?? "",
    city: initial.business.city ?? "",
    state: initial.business.state ?? "",
    postalCode: initial.business.postalCode ?? "",
    country: initial.business.country ?? "",
  });
  /** "" = automatic (follows the address); otherwise a zone the owner picked. */
  const [zoneChoice, setZoneChoice] = useState(initial.business.timeZoneMode === "manual" ? initial.business.timeZone : "");
  const [branding, setBranding] = useState({
    logoUrl: initial.business.logoUrl,
    brandPrimaryColor: initial.business.brandPrimaryColor,
    brandAccentColor: initial.business.brandAccentColor,
    surfaceMode: initial.business.surfaceMode,
  });
  const [site, setSite] = useState<SiteDraft>(() => siteDraftFrom(initial.website.website));

  const step = data.state.currentStep;
  const stepIdx = ONBOARDING_STEP_IDS.indexOf(step);
  const addressZone = timeZoneFromAddress({ city: identity.city, state: identity.state, country: identity.country });

  // Back from Google Calendar (Booking & calendar step).
  useEffect(() => {
    const gcal = search.get("gcal");
    if (gcal !== "connected" && gcal !== "error") return;
    if (gcal === "connected") toast.success("Google Calendar connected");
    if (gcal === "error") toast.error("Google Calendar didn't connect. You can try again or do it later in Settings.");
    router.replace("/onboarding", { scroll: false });
  }, [search, router]);

  const draftSiteView = useMemo(
    () =>
      buildSiteView({
        website: {
          ...data.website.website,
          template: site.template,
          heroSource: site.heroImageUrl ? "image" : data.website.website.heroSource === "image" ? "auto" : data.website.website.heroSource,
          heroImageUrl: site.heroImageUrl,
          headline: site.headline,
          intro: site.intro,
          showServicePricing: site.showServicePricing,
          about: { ...data.website.website.about, enabled: Boolean(site.aboutBody.trim()), body: site.aboutBody },
          social: {
            ...data.website.website.social,
            instagram: socialUrl(site.instagram, "instagram.com"),
            facebook: socialUrl(site.facebook, "facebook.com"),
          },
        },
        business: {
          ...data.website.business,
          name: identity.businessName.trim() || data.website.business.name || businessDisplayName,
          logoUrl: branding.logoUrl,
          primaryColor: branding.brandPrimaryColor,
          accentColor: branding.brandAccentColor,
          email: identity.primaryContactEmail,
          phone: identity.phoneNumber,
        },
        services: data.website.services,
        portfolio: [],
        links: { clientLogin: "/login", request: "/request" },
      }),
    [data.website, site, identity, branding, businessDisplayName]
  );
  const previewSiteView = useDebouncedValue(draftSiteView, 150);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/onboarding", { credentials: "include" });
    const next = (await parseJson(res)) as unknown as OnboardingPayload;
    setData(next);
    setIdentity({
      businessName: next.business.businessName,
      primaryContactEmail: next.business.primaryContactEmail,
      phoneNumber: next.business.phoneNumber,
      addressLine1: next.business.addressLine1 ?? "",
      city: next.business.city ?? "",
      state: next.business.state ?? "",
      postalCode: next.business.postalCode ?? "",
      country: next.business.country ?? "",
    });
    setBranding({
      logoUrl: next.business.logoUrl,
      brandPrimaryColor: next.business.brandPrimaryColor,
      brandAccentColor: next.business.brandAccentColor,
      surfaceMode: next.business.surfaceMode,
    });
    return next;
  }, []);

  useEffect(() => {
    if (data.completedAt) {
      router.replace("/admin");
    }
  }, [data.completedAt, router]);

  async function runAction(body: Record<string, string>) {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await parseJson(res);
      const next = await refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return next;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(patch: Record<string, unknown>) {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: patch }),
    });
    await parseJson(res);
  }

  async function completeIdentity() {
    setBusy(true);
    try {
      await saveSettings({
        business: {
          businessName: identity.businessName.trim(),
          portalName: identity.businessName.trim(),
          legalName: identity.businessName.trim(),
          primaryContactEmail: identity.primaryContactEmail.trim(),
          phoneNumber: identity.phoneNumber.trim(),
          supportEmail: identity.primaryContactEmail.trim(),
          addressLine1: identity.addressLine1.trim(),
          city: identity.city.trim(),
          state: identity.state.trim(),
          postalCode: identity.postalCode.trim(),
          ...(identity.country ? { country: identity.country } : {}),
        },
        // Automatic follows the address on every read; a picked zone is kept as is.
        workflow: {
          businessDefaults: zoneChoice
            ? { timezoneMode: "manual", timezone: zoneChoice }
            : { timezoneMode: "auto", ...(addressZone ? { timezone: addressZone } : {}) },
        },
      });
      await runAction({ action: "complete", step: "identity" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your business details");
      setBusy(false);
    }
  }

  async function completeBranding() {
    setBusy(true);
    try {
      if (data.canCustomizeBranding) {
        await saveSettings({
          business: {
            logoUrl: branding.logoUrl,
            brandPrimaryColor: branding.brandPrimaryColor,
            brandAccentColor: branding.brandAccentColor,
            surfaceMode: branding.surfaceMode,
          },
        });
      }
      await runAction({ action: "complete", step: "branding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your brand");
      setBusy(false);
    }
  }

  async function completeWebsite() {
    setBusy(true);
    try {
      const w = data.website.website;
      const before = siteDraftFrom(w);
      if (JSON.stringify(before) !== JSON.stringify(site)) {
        const heroChanged = site.heroImageUrl !== before.heroImageUrl;
        await saveSettings({
          website: {
            template: site.template,
            ...(heroChanged ? { heroSource: site.heroImageUrl ? "image" : "auto", heroImageUrl: site.heroImageUrl } : {}),
            headline: site.headline.trim(),
            intro: site.intro.trim(),
            showServicePricing: site.showServicePricing,
            about: { ...w.about, enabled: Boolean(site.aboutBody.trim()), body: site.aboutBody.trim() },
            social: {
              ...w.social,
              instagram: socialUrl(site.instagram, "instagram.com"),
              facebook: socialUrl(site.facebook, "facebook.com"),
            },
          },
        });
      }
      await runAction({ action: "complete", step: "landing" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your website");
      setBusy(false);
    }
  }

  async function defer() {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "defer" }),
      });
      await parseJson(res);
      toast.message("You can finish setup anytime from the banner on your dashboard.");
      // Hard nav so middleware sees deferred state (and fresh DB if cache was stale).
      window.location.assign("/admin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not leave setup");
      setBusy(false);
    }
  }

  async function finish() {
    const next = await runAction({ action: "finish" });
    if (next?.completedAt) {
      toast.success("Your portal is ready");
      // Brief pause so the success state registers, then hard-nav so middleware
      // sees fresh onboarding_completed_at (in-memory host cache is invalidated server-side).
      await new Promise((r) => setTimeout(r, 900));
      window.location.assign("/admin");
    }
  }

  const back = (to: OnboardingStepId) => (
    <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "goto", step: to })}>
      <ArrowLeft className="h-4 w-4" /> Back
    </Button>
  );
  const skip = (s: OnboardingStepId) => (
    <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "skip", step: s })}>
      Skip for now
    </Button>
  );

  return (
    <div
      className={cn(
        "mx-auto flex min-h-screen w-full flex-col px-4 py-6 sm:px-6 sm:py-10",
        step === "landing" || step === "branding" ? "max-w-6xl" : "max-w-3xl"
      )}
    >
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Portal setup</p>
          <h1 className="mt-1 text-xl font-bold text-heading sm:text-2xl">{businessDisplayName || "Your studio"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void defer()}>
            I&apos;ll do this later
          </Button>
          <form action="/api/auth/signout" method="POST">
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <nav aria-label="Setup progress" className="mb-8">
        <ol className="flex flex-wrap gap-2">
          {ONBOARDING_STEP_IDS.map((id, i) => {
            const done = data.state.completedSteps.includes(id);
            const active = id === step;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={busy || i > stepIdx + 1}
                  onClick={() => void runAction({ action: "goto", step: id })}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition",
                    active && "bg-accent text-white",
                    done && !active && "bg-teal-50 text-teal-800",
                    !done && !active && "bg-subtle text-muted"
                  )}
                >
                  {i + 1}. {STEP_LABELS[id]}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((stepIdx + 1) / ONBOARDING_STEP_IDS.length) * 100}%` }}
          />
        </div>
      </nav>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{STEP_LABELS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === "identity" && (
            <div className="space-y-4">
              {!data.state.completedSteps.length ? (
                <p className="text-base text-heading">
                  Let&apos;s get your client portal ready. It takes about five minutes, and you can change everything later.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="ob-name">Business name</Label>
                <Input
                  id="ob-name"
                  value={identity.businessName}
                  onChange={(e) => setIdentity((p) => ({ ...p, businessName: e.target.value }))}
                  placeholder="Acme Aerial"
                />
                <p className="text-xs text-muted">Shown in client emails, your portal header and your website.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ob-email">Contact email</Label>
                <Input
                  id="ob-email"
                  type="email"
                  value={identity.primaryContactEmail}
                  onChange={(e) => setIdentity((p) => ({ ...p, primaryContactEmail: e.target.value }))}
                  placeholder="hello@studio.com"
                />
                <p className="text-xs text-muted">Client replies come here. It also appears in your email footer.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ob-phone">Phone (optional)</Label>
                <Input
                  id="ob-phone"
                  type="tel"
                  value={identity.phoneNumber}
                  onChange={(e) => setIdentity((p) => ({ ...p, phoneNumber: e.target.value }))}
                />
              </div>
              <fieldset id="ob-address" className="space-y-3 rounded-lg border border-border p-3">
                <legend className="px-1 text-sm font-medium text-heading">Business address (recommended)</legend>
                <p className="text-xs text-muted">Sets your time zone and where travel fees and drive times are measured from.</p>
                <div className="space-y-2">
                  <Label htmlFor="ob-address1">Street address</Label>
                  <AddressAutocomplete
                    id="ob-address1"
                    placeholder="Start typing your business address"
                    value={identity.addressLine1}
                    onChange={(v) => setIdentity((p) => ({ ...p, addressLine1: v }))}
                    onPick={(a) =>
                      setIdentity((p) => ({
                        ...p,
                        addressLine1: a.street || a.formatted,
                        city: a.city,
                        state: a.state,
                        postalCode: a.zip,
                        country: a.country || p.country,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label htmlFor="ob-city">City</Label>
                    <Input id="ob-city" autoComplete="address-level2" value={identity.city} onChange={(e) => setIdentity((p) => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ob-state">State</Label>
                    <Input id="ob-state" autoComplete="address-level1" value={identity.state} onChange={(e) => setIdentity((p) => ({ ...p, state: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ob-postal">ZIP / postal code</Label>
                    <Input
                      id="ob-postal"
                      autoComplete="postal-code"
                      value={identity.postalCode}
                      onChange={(e) => setIdentity((p) => ({ ...p, postalCode: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
                  <Clock3 className="h-4 w-4 text-muted" aria-hidden />
                  <Label htmlFor="ob-zone" className="text-sm font-medium text-heading">
                    Time zone
                  </Label>
                  <select
                    id="ob-zone"
                    value={zoneChoice}
                    onChange={(e) => setZoneChoice(e.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-sm text-foreground sm:max-w-xs"
                  >
                    <option value="">
                      {addressZone ? `${timeZoneDisplayName(addressZone)} (from your address)` : "Automatic (from your address)"}
                    </option>
                    {COMMON_TIME_ZONES.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                    {zoneChoice && !COMMON_TIME_ZONES.some((z) => z.value === zoneChoice) ? (
                      <option value={zoneChoice}>{timeZoneDisplayName(zoneChoice)}</option>
                    ) : null}
                  </select>
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="accent" disabled={busy} onClick={() => void completeIdentity()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === "branding" && (
            <div className="space-y-4">
              {!data.canCustomizeBranding ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  Custom branding is not on your current plan. Platform defaults will be used until you upgrade. You can skip this
                  step.
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
                  <div className="min-w-0 space-y-5">
                    <BrandAssetField
                      kind="logo"
                      inputId="ob-logo"
                      value={branding.logoUrl}
                      onUrlChange={(logoUrl) => setBranding((p) => ({ ...p, logoUrl }))}
                      onUploaded={(logoUrl) => setBranding((p) => ({ ...p, logoUrl }))}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ColorField
                        id="ob-primary"
                        label="Primary color"
                        value={branding.brandPrimaryColor}
                        onChange={(brandPrimaryColor) => setBranding((p) => ({ ...p, brandPrimaryColor }))}
                      />
                      <ColorField
                        id="ob-accent"
                        label="Accent color"
                        value={branding.brandAccentColor}
                        onChange={(brandAccentColor) => setBranding((p) => ({ ...p, brandAccentColor }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <p id="ob-theme-label" className="text-sm font-medium text-heading">
                        Theme
                      </p>
                      <div role="radiogroup" aria-labelledby="ob-theme-label" className="grid grid-cols-3 gap-2">
                        {THEMES.map(({ mode, label }) => {
                          const selected = branding.surfaceMode === mode;
                          const t = deriveBrandTheme(branding.brandPrimaryColor, branding.brandAccentColor, mode);
                          return (
                            <button
                              key={mode}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setBranding((p) => ({ ...p, surfaceMode: mode }))}
                              className={cn(
                                "rounded-xl border p-2 text-left transition-shadow",
                                selected ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent/50"
                              )}
                            >
                              <span
                                className="flex h-12 flex-col gap-1 rounded-lg border p-1.5"
                                style={{ background: t.background, borderColor: t.border }}
                                aria-hidden
                              >
                                <span className="block h-1.5 w-1/2 rounded-full" style={{ background: t.heading }} />
                                <span className="block flex-1 rounded" style={{ background: t.card }} />
                              </span>
                              <span className="mt-1.5 block text-xs font-semibold text-heading">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted">The background you and your clients see in the portal.</p>
                    </div>
                  </div>
                  <BrandingLivePreview
                    primary={branding.brandPrimaryColor}
                    accent={branding.brandAccentColor}
                    surfaceMode={branding.surfaceMode}
                    portalName={identity.businessName}
                    businessName={identity.businessName || businessDisplayName}
                    logoUrl={branding.logoUrl}
                    emailLogoUrl=""
                    logoSizePx={PORTAL_LOGO_SIZE.default}
                    footerText=""
                    brandUnsaved={false}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {back("identity")}
                {skip("branding")}
                <Button type="button" variant="accent" disabled={busy} onClick={() => void completeBranding()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "services" && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                These are the services clients pick on your request and booking forms. Edit the starters, set your prices and time
                on site, then continue.
              </p>
              {!data.gates.services.ok && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {data.gates.services.reason}
                </p>
              )}
              <ServicesSettingsCard editorPresentation="modal" />
              <PreliminaryEstimateToggle />
              <TravelFeesOnboarding onAddressSaved={() => void refresh()} />
              <div className="flex flex-wrap gap-2">
                {back("branding")}
                <Button
                  type="button"
                  variant="accent"
                  disabled={busy}
                  onClick={async () => {
                    await refresh();
                    await runAction({ action: "complete", step: "services" });
                  }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "booking" && (
            <BookingStep
              busy={busy}
              onBack={() => void runAction({ action: "goto", step: "services" })}
              onSkip={() => void runAction({ action: "skip", step: "booking" })}
              onContinue={async () => {
                await runAction({ action: "complete", step: "booking" });
              }}
            />
          )}

          {step === "payments" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                You can&apos;t receive client payments until Stripe is connected. You can skip this and connect later from Settings;
                invoices stay blocked until then.
              </div>
              <StripeConnectCard />
              <div className="flex flex-wrap gap-2">
                {back("booking")}
                {skip("payments")}
                <Button type="button" variant="accent" disabled={busy} onClick={() => void runAction({ action: "complete", step: "payments" })}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "landing" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
              <div className="min-w-0 space-y-5">
                <p className="text-sm text-muted">Make a few touches now. The preview updates as you type.</p>
                <div className="space-y-2">
                  <Label>Style</Label>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Website style">
                    {WEBSITE_TEMPLATES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={site.template === t}
                        onClick={() => setSite((p) => ({ ...p, template: t }))}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-left text-xs",
                          site.template === t ? "border-accent bg-accent/5 text-heading ring-2 ring-accent/20" : "border-border text-muted"
                        )}
                      >
                        <span className="block font-semibold">{WEBSITE_TEMPLATE_INFO[t].name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <BrandAssetField
                    kind="heroImage"
                    value={site.heroImageUrl}
                    inputId="ob-hero-image"
                    onUrlChange={(heroImageUrl) => setSite((p) => ({ ...p, heroImageUrl }))}
                  />
                  <p className="text-xs text-muted">Optional. Without one, your website uses a designed background in your colors.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-headline">Headline</Label>
                  <Input
                    id="ob-headline"
                    value={site.headline}
                    maxLength={120}
                    onChange={(e) => setSite((p) => ({ ...p, headline: e.target.value }))}
                    placeholder="Leave blank to use the automatic headline"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-intro">Tagline</Label>
                  <Input
                    id="ob-intro"
                    value={site.intro}
                    maxLength={240}
                    onChange={(e) => setSite((p) => ({ ...p, intro: e.target.value }))}
                    placeholder="One line under the headline"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-about">About you (optional)</Label>
                  <Textarea
                    id="ob-about"
                    rows={3}
                    value={site.aboutBody}
                    maxLength={1200}
                    onChange={(e) => setSite((p) => ({ ...p, aboutBody: e.target.value }))}
                    placeholder="Two or three sentences about you and your work. Adds an About section."
                  />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <label htmlFor="ob-prices" className="cursor-pointer">
                    <span className="block text-sm font-medium text-heading">Show prices on the website</span>
                    <span className="block text-xs text-muted">Off: services show without &ldquo;Starting at&rdquo; prices.</span>
                  </label>
                  <Switch
                    id="ob-prices"
                    checked={site.showServicePricing}
                    onCheckedChange={(showServicePricing) => setSite((p) => ({ ...p, showServicePricing }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ob-instagram">Instagram</Label>
                    <Input
                      id="ob-instagram"
                      value={site.instagram}
                      onChange={(e) => setSite((p) => ({ ...p, instagram: e.target.value }))}
                      placeholder="@yourstudio"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ob-facebook">Facebook</Label>
                    <Input
                      id="ob-facebook"
                      value={site.facebook}
                      onChange={(e) => setSite((p) => ({ ...p, facebook: e.target.value }))}
                      placeholder="facebook.com/yourstudio"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-subtle p-3">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <p className="text-sm text-heading">
                    <span className="font-medium">Your own web address (optional).</span>{" "}
                    <span className="text-muted">Clients can open your portal at portal.yourstudio.com. </span>
                    <Link href="/admin/settings#settings-custom-domain" className="font-medium text-accent underline">
                      Set it up in Settings
                    </Link>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {back("payments")}
                  <a
                    href={data.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-heading"
                  >
                    Preview <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "skip", step: "landing" })}>
                    Customize later
                  </Button>
                  <Button type="button" variant="accent" disabled={busy} onClick={() => void completeWebsite()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="min-w-0 lg:sticky lg:top-6 lg:h-[min(72dvh,44rem)]">
                <LandingEditorPreviewFrame title="Your Business Website">
                  <SiteNavProvider preview>
                    <SiteHome view={previewSiteView} preview />
                  </SiteNavProvider>
                </LandingEditorPreviewFrame>
              </div>
            </div>
          )}

          {step === "finish" && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">Your portal is ready to share</p>
                  <p className="mt-1">Open it to see what clients see, then send yourself a test request to try the full flow.</p>
                </div>
              </div>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {ONBOARDING_STEP_IDS.filter((id) => id !== "finish").map((id) => {
                  const done = data.state.completedSteps.includes(id);
                  const later = LATER_LINKS[id];
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-full",
                            done ? "bg-emerald-100 text-emerald-700" : "bg-subtle text-muted"
                          )}
                          aria-hidden
                        >
                          {done ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                        </span>
                        <span className={done ? "text-heading" : "text-muted"}>{STEP_LABELS[id]}</span>
                      </span>
                      {done ? (
                        <span className="text-xs font-medium text-emerald-700">Done</span>
                      ) : later ? (
                        <Link href={later} className="text-xs font-medium text-accent hover:underline">
                          Do it later in Settings
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="text-xs font-medium text-accent hover:underline"
                          onClick={() => void runAction({ action: "goto", step: id })}
                        >
                          Finish this step
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!data.gates.finish.ok && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{data.gates.finish.reason}</p>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={data.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
                >
                  Open client portal <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={`${data.portalUrl.replace(/\/$/, "")}/request`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-heading hover:bg-subtle"
                >
                  Send yourself a test request <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <Link href="/admin/settings#settings-staff" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                <UserPlus className="h-4 w-4" aria-hidden /> Invite a teammate (optional)
              </Link>
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {back("landing")}
                <Button type="button" variant="accent" disabled={busy || !data.gates.finish.ok} onClick={() => void finish()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Finish setup
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help for this step, under the card: collapsed until opened. */}
      <div className="mt-4">
        <StepIntro key={step} intro={ONBOARDING_STEP_INTROS[step]} />
      </div>
    </div>
  );
}
