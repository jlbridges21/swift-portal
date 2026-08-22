"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorField } from "@/components/ui/color-field";
import { BrandAssetField } from "@/components/admin/brand-asset-field";
import { ServicesSettingsCard } from "@/components/admin/services-settings-card";
import { StripeConnectCard } from "@/components/admin/stripe-connect-card";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogOut,
  RotateCcw,
} from "lucide-react";
import {
  ONBOARDING_STEP_IDS,
  type OnboardingStepId,
  type OnboardingState,
} from "@/lib/onboarding";
import { LANDING_LIMITS, DEFAULT_HOW_IT_WORKS, HOW_IT_WORKS_STEP_COUNT } from "@/lib/landing-content";
import { cn } from "@/lib/utils";

function BrandPreview({
  primary,
  accent,
  name,
  logoUrl,
}: {
  primary: string;
  accent: string;
  name: string;
  logoUrl: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border"
      style={{ backgroundColor: primary }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-8 w-auto max-w-[120px] object-contain" />
        ) : (
          <span className="text-sm font-semibold text-white">{name || "Your studio"}</span>
        )}
        <span
          className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: accent }}
        >
          Accent
        </span>
      </div>
    </div>
  );
}

type OnboardingPayload = {
  completedAt: string | null;
  state: OnboardingState;
  canCustomizeBranding: boolean;
  portalUrl: string;
  business: {
    businessName: string;
    primaryContactEmail: string;
    phoneNumber: string;
    logoUrl: string;
    brandPrimaryColor: string;
    brandAccentColor: string;
  };
  landing: {
    headline: string;
    subheadline: string;
    headlinePlaceholder: string;
    subheadlinePlaceholder: string;
    howItWorks: { label: string; description: string }[];
    howItWorksPlaceholders: { label: string; description: string }[];
  };
  gates: {
    identity: { ok: boolean; reason?: string };
    services: { ok: boolean; reason?: string };
    finish: { ok: boolean; reason?: string };
  };
  serviceCount: number;
};

const STEP_LABELS: Record<OnboardingStepId, string> = {
  welcome: "Welcome",
  identity: "Identity",
  branding: "Branding",
  services: "Services",
  payments: "Payments",
  landing: "Landing",
  finish: "Finish",
};

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
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState({
    businessName: initial.business.businessName,
    primaryContactEmail: initial.business.primaryContactEmail,
    phoneNumber: initial.business.phoneNumber,
  });
  const [branding, setBranding] = useState({
    logoUrl: initial.business.logoUrl,
    brandPrimaryColor: initial.business.brandPrimaryColor,
    brandAccentColor: initial.business.brandAccentColor,
  });
  const [landing, setLanding] = useState({
    headline: initial.landing.headline,
    subheadline: initial.landing.subheadline,
    howItWorks: initial.landing.howItWorks.length
      ? initial.landing.howItWorks
      : DEFAULT_HOW_IT_WORKS.map((s) => ({ label: "", description: "" })),
  });

  const step = data.state.currentStep;
  const stepIdx = ONBOARDING_STEP_IDS.indexOf(step);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/onboarding", { credentials: "include" });
    const next = (await parseJson(res)) as unknown as OnboardingPayload;
    setData(next);
    setIdentity({
      businessName: next.business.businessName,
      primaryContactEmail: next.business.primaryContactEmail,
      phoneNumber: next.business.phoneNumber,
    });
    setBranding({
      logoUrl: next.business.logoUrl,
      brandPrimaryColor: next.business.brandPrimaryColor,
      brandAccentColor: next.business.brandAccentColor,
    });
    setLanding({
      headline: next.landing.headline,
      subheadline: next.landing.subheadline,
      howItWorks: next.landing.howItWorks?.length
        ? next.landing.howItWorks
        : DEFAULT_HOW_IT_WORKS.map(() => ({ label: "", description: "" })),
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
        },
      });
      await runAction({ action: "complete", step: "identity" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save identity");
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
          },
        });
      }
      await runAction({ action: "complete", step: "branding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save branding");
      setBusy(false);
    }
  }

  async function completeLanding() {
    setBusy(true);
    try {
      if (data.canCustomizeBranding) {
        await saveSettings({
          landing: {
            hero: {
              headline: landing.headline,
              subheadline: landing.subheadline,
            },
            howItWorks: landing.howItWorks.slice(0, HOW_IT_WORKS_STEP_COUNT),
          },
        });
      }
      await runAction({ action: "complete", step: "landing" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save landing copy");
      setBusy(false);
    }
  }

  async function defer() {
    const next = await runAction({ action: "defer" });
    if (next) {
      toast.message("You can finish setup anytime from the banner on your dashboard.");
      router.push("/admin");
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Portal setup
          </p>
          <h1 className="mt-1 text-xl font-bold text-heading sm:text-2xl">
            {businessDisplayName || "Your studio"}
          </h1>
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

      <Card className="flex-1 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{STEP_LABELS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === "welcome" && (
            <div className="space-y-4 text-sm text-muted">
              <p className="text-base text-heading">
                Let&apos;s get your client portal ready to share — about five minutes.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Business name and contact email (required)</li>
                <li>Logo and colors (optional — skip if you want)</li>
                <li>Confirm your services and pricing (required)</li>
                <li>Connect Stripe so you can get paid</li>
                <li>A quick landing-page headline, then preview</li>
              </ul>
              <p>
                Seeded starter services are already in place. You can refine them now or later in
                Settings.
              </p>
              <Button
                type="button"
                variant="accent"
                disabled={busy}
                onClick={() => void runAction({ action: "complete", step: "welcome" })}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {step === "identity" && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                This name appears in client emails, the portal header, and your landing page.
              </p>
              <div className="space-y-2">
                <Label htmlFor="ob-name">Business name</Label>
                <Input
                  id="ob-name"
                  value={identity.businessName}
                  onChange={(e) => setIdentity((p) => ({ ...p, businessName: e.target.value }))}
                  placeholder="Acme Aerial"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ob-email">Contact email</Label>
                <Input
                  id="ob-email"
                  type="email"
                  value={identity.primaryContactEmail}
                  onChange={(e) =>
                    setIdentity((p) => ({ ...p, primaryContactEmail: e.target.value }))
                  }
                  placeholder="hello@studio.com"
                />
                <p className="text-xs text-muted">Used as reply-to on client email and in the footer.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ob-phone">Phone (optional)</Label>
                <Input
                  id="ob-phone"
                  value={identity.phoneNumber}
                  onChange={(e) => setIdentity((p) => ({ ...p, phoneNumber: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "goto", step: "welcome" })}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="button" variant="accent" disabled={busy} onClick={() => void completeIdentity()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "branding" && (
            <div className="space-y-4">
              {!data.canCustomizeBranding ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  Custom branding is not on your current plan. Platform defaults will be used until
                  you upgrade. You can skip this step.
                </div>
              ) : (
                <>
                  <BrandPreview
                    primary={branding.brandPrimaryColor}
                    accent={branding.brandAccentColor}
                    name={identity.businessName || businessDisplayName}
                    logoUrl={branding.logoUrl}
                  />
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
                      onChange={(brandPrimaryColor) =>
                        setBranding((p) => ({ ...p, brandPrimaryColor }))
                      }
                    />
                    <ColorField
                      id="ob-accent"
                      label="Accent color"
                      value={branding.brandAccentColor}
                      onChange={(brandAccentColor) =>
                        setBranding((p) => ({ ...p, brandAccentColor }))
                      }
                    />
                  </div>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "goto", step: "identity" })}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "skip", step: "branding" })}>
                  Skip for now
                </Button>
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
                Your client request form lists active services. Keep at least one with a price (or
                custom / hide pricing). Edit the starters below, then continue.
              </p>
              {!data.gates.services.ok && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {data.gates.services.reason}
                </p>
              )}
              <ServicesSettingsCard />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "goto", step: "branding" })}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
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

          {step === "payments" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                You cannot receive client payments until Stripe Connect is complete. You can skip
                and connect later from Settings — just know invoices will stay blocked until then.
              </div>
              <StripeConnectCard />
              <p className="text-sm text-muted">
                Optional later:{" "}
                <a href="/admin/settings#settings-custom-domain" className="font-medium text-accent underline">
                  Use your own web address
                </a>{" "}
                (for example portal.yourstudio.com) so clients open your portal on your brand.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "goto", step: "services" })}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "skip", step: "payments" })}>
                  Skip for now
                </Button>
                <Button type="button" variant="accent" disabled={busy} onClick={() => void runAction({ action: "complete", step: "payments" })}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "landing" && (
            <div className="space-y-4">
              {!data.canCustomizeBranding ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  Landing customization needs Custom branding on your plan. Your portal already
                  shows derived defaults — you can skip.
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    Leave blank to use smart defaults. Fine-tuning lives in Settings → Client Landing
                    Page.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="ob-headline">Headline</Label>
                    <Input
                      id="ob-headline"
                      maxLength={LANDING_LIMITS.headline}
                      value={landing.headline}
                      placeholder={data.landing.headlinePlaceholder}
                      onChange={(e) => setLanding((p) => ({ ...p, headline: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ob-sub">Subheadline</Label>
                    <textarea
                      id="ob-sub"
                      maxLength={LANDING_LIMITS.subheadline}
                      rows={3}
                      value={landing.subheadline}
                      placeholder={data.landing.subheadlinePlaceholder}
                      onChange={(e) => setLanding((p) => ({ ...p, subheadline: e.target.value }))}
                      className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-3 pt-2">
                    <div>
                      <p className="text-sm font-medium text-heading">How it works (optional)</p>
                      <p className="text-xs text-muted">
                        Four steps, fixed order. Leave blank to keep the defaults.
                      </p>
                    </div>
                    {Array.from({ length: HOW_IT_WORKS_STEP_COUNT }, (_, i) => {
                      const stepRow = landing.howItWorks[i] ?? { label: "", description: "" };
                      const ph =
                        data.landing.howItWorksPlaceholders?.[i] ?? DEFAULT_HOW_IT_WORKS[i];
                      return (
                        <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                              Step {String(i + 1).padStart(2, "0")}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() =>
                                setLanding((p) => {
                                  const howItWorks = [...p.howItWorks];
                                  howItWorks[i] = { label: "", description: "" };
                                  return { ...p, howItWorks };
                                })
                              }
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Reset to default
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`ob-hiw-${i}-label`}>Label</Label>
                            <Input
                              id={`ob-hiw-${i}-label`}
                              maxLength={LANDING_LIMITS.howItWorksLabel}
                              value={stepRow.label}
                              placeholder={ph?.label}
                              onChange={(e) =>
                                setLanding((p) => {
                                  const howItWorks = [...p.howItWorks];
                                  while (howItWorks.length < HOW_IT_WORKS_STEP_COUNT) {
                                    howItWorks.push({ label: "", description: "" });
                                  }
                                  howItWorks[i] = { ...howItWorks[i], label: e.target.value };
                                  return { ...p, howItWorks };
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`ob-hiw-${i}-desc`}>Description</Label>
                            <textarea
                              id={`ob-hiw-${i}-desc`}
                              maxLength={LANDING_LIMITS.howItWorksDescription}
                              rows={2}
                              value={stepRow.description}
                              placeholder={ph?.description}
                              onChange={(e) =>
                                setLanding((p) => {
                                  const howItWorks = [...p.howItWorks];
                                  while (howItWorks.length < HOW_IT_WORKS_STEP_COUNT) {
                                    howItWorks.push({ label: "", description: "" });
                                  }
                                  howItWorks[i] = {
                                    ...howItWorks[i],
                                    description: e.target.value,
                                  };
                                  return { ...p, howItWorks };
                                })
                              }
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <p className="text-sm text-muted">
                Optional:{" "}
                <a href="/admin/settings#settings-custom-domain" className="font-medium text-accent underline">
                  Use your own web address
                </a>{" "}
                so clients visit portal.yourstudio.com instead of a ShootPortal subdomain.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "goto", step: "payments" })}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "skip", step: "landing" })}>
                  Skip for now
                </Button>
                <Button type="button" variant="accent" disabled={busy} onClick={() => void completeLanding()}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "finish" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">You&apos;re almost there</p>
                  <p className="mt-1">
                    Open your live client portal, then send yourself a test request so you see the
                    flow your clients will use.
                  </p>
                </div>
              </div>
              {!data.gates.finish.ok && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {data.gates.finish.reason}
                </p>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={data.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-heading"
                >
                  Open client portal <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={`${data.portalUrl.replace(/\/$/, "")}/request`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white"
                >
                  Send yourself a test request <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => void runAction({ action: "goto", step: "landing" })}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="button" variant="accent" disabled={busy || !data.gates.finish.ok} onClick={() => void finish()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Finish setup
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
