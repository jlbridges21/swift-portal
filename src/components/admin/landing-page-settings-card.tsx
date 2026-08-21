"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  LANDING_LIMITS,
  HOW_IT_WORKS_STEP_COUNT,
  landingContentPlaceholders,
  type LandingSettings,
  type LandingHowItWorksStep,
  type LandingSocialLinks,
  type LandingSectionVisibility,
} from "@/lib/landing-content";
import { ExternalLink, RotateCcw } from "lucide-react";

function CharCount({ value, max }: { value: string; max: number }) {
  const n = value.length;
  return (
    <span className={`text-xs ${n > max * 0.9 ? "text-amber-700" : "text-muted"}`}>
      {n}/{max}
    </span>
  );
}

function FieldShell({
  label,
  htmlFor,
  hint,
  value,
  max,
  onReset,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  value: string;
  max?: number;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        <div className="flex items-center gap-2">
          {max != null ? <CharCount value={value} max={max} /> : null}
          {onReset ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onReset}>
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset to default
            </Button>
          ) : null}
        </div>
      </div>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function LandingPageSettingsCard({
  landing,
  businessName,
  serviceNames,
  portalPreviewUrl,
  canEdit,
  onChange,
}: {
  landing: LandingSettings;
  businessName: string;
  serviceNames: string[];
  portalPreviewUrl: string;
  canEdit: boolean;
  onChange: (next: LandingSettings) => void;
}) {
  const placeholders = landingContentPlaceholders(businessName, serviceNames);

  function patchHero(patch: Partial<LandingSettings["hero"]>) {
    onChange({ ...landing, hero: { ...landing.hero, ...patch } });
  }

  function patchIntro(businessDescription: string) {
    onChange({ ...landing, intro: { businessDescription } });
  }

  function patchFooter(tagline: string) {
    onChange({ ...landing, footer: { tagline } });
  }

  function patchSocial(patch: Partial<LandingSocialLinks>) {
    onChange({ ...landing, social: { ...landing.social, ...patch } });
  }

  function patchSections(patch: Partial<LandingSectionVisibility>) {
    onChange({ ...landing, sections: { ...landing.sections, ...patch } });
  }

  function setHowItWorks(index: number, patch: Partial<LandingHowItWorksStep>) {
    const next = landing.howItWorks.map((step, i) =>
      i === index ? { ...step, ...patch } : step
    );
    while (next.length < HOW_IT_WORKS_STEP_COUNT) {
      next.push({ label: "", description: "" });
    }
    onChange({ ...landing, howItWorks: next.slice(0, HOW_IT_WORKS_STEP_COUNT) });
  }

  function setIndustriesText(text: string) {
    const items = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, LANDING_LIMITS.industriesMax)
      .map((s) => s.slice(0, LANDING_LIMITS.industryItem));
    onChange({ ...landing, industries: items });
  }

  if (!canEdit) {
    return (
      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-muted">
            Customizing the client landing page requires the{" "}
            <span className="font-medium text-heading">Custom branding</span> entitlement. Your
            portal still shows a polished page derived from your business name and services.
          </p>
          <a
            href={portalPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent underline underline-offset-2"
          >
            Preview your client portal <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
        <p className="text-sm text-heading">
          Changes apply to your public client portal. Layout, fonts, and section order stay locked.
        </p>
        <a
          href={portalPreviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          Preview your client portal <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-semibold text-heading">Hero</h3>
          <FieldShell
            label="Headline"
            htmlFor="landing-headline"
            value={landing.hero.headline}
            max={LANDING_LIMITS.headline}
            hint={`Default: ${placeholders.headline}`}
            onReset={() => patchHero({ headline: "" })}
          >
            <Input
              id="landing-headline"
              maxLength={LANDING_LIMITS.headline}
              value={landing.hero.headline}
              placeholder={placeholders.headline}
              onChange={(e) => patchHero({ headline: e.target.value })}
            />
          </FieldShell>
          <FieldShell
            label="Subheadline"
            htmlFor="landing-subheadline"
            value={landing.hero.subheadline}
            max={LANDING_LIMITS.subheadline}
            onReset={() => patchHero({ subheadline: "" })}
          >
            <textarea
              id="landing-subheadline"
              maxLength={LANDING_LIMITS.subheadline}
              rows={3}
              value={landing.hero.subheadline}
              placeholder={placeholders.subheadline}
              onChange={(e) => patchHero({ subheadline: e.target.value })}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
          </FieldShell>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell
              label="Primary CTA"
              htmlFor="landing-cta-primary"
              value={landing.hero.ctaPrimaryLabel}
              max={LANDING_LIMITS.ctaLabel}
              onReset={() => patchHero({ ctaPrimaryLabel: "" })}
            >
              <Input
                id="landing-cta-primary"
                maxLength={LANDING_LIMITS.ctaLabel}
                value={landing.hero.ctaPrimaryLabel}
                placeholder={placeholders.ctaPrimaryLabel}
                onChange={(e) => patchHero({ ctaPrimaryLabel: e.target.value })}
              />
            </FieldShell>
            <FieldShell
              label="Secondary CTA"
              htmlFor="landing-cta-secondary"
              value={landing.hero.ctaSecondaryLabel}
              max={LANDING_LIMITS.ctaLabel}
              onReset={() => patchHero({ ctaSecondaryLabel: "" })}
            >
              <Input
                id="landing-cta-secondary"
                maxLength={LANDING_LIMITS.ctaLabel}
                value={landing.hero.ctaSecondaryLabel}
                placeholder={placeholders.ctaSecondaryLabel}
                onChange={(e) => patchHero({ ctaSecondaryLabel: e.target.value })}
              />
            </FieldShell>
          </div>
          <FieldShell
            label="Showreel (YouTube URL)"
            htmlFor="landing-showreel"
            value={landing.hero.showreelUrl}
            max={LANDING_LIMITS.showreelUrl}
            hint="Optional. Leave blank to hide the hero video."
            onReset={() => patchHero({ showreelUrl: "" })}
          >
            <Input
              id="landing-showreel"
              maxLength={LANDING_LIMITS.showreelUrl}
              value={landing.hero.showreelUrl}
              placeholder="https://www.youtube.com/watch?v=…"
              onChange={(e) => patchHero({ showreelUrl: e.target.value })}
            />
          </FieldShell>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-semibold text-heading">About</h3>
          <FieldShell
            label="Business description"
            htmlFor="landing-description"
            value={landing.intro.businessDescription}
            max={LANDING_LIMITS.businessDescription}
            hint={`Default: ${placeholders.businessDescription}`}
            onReset={() => patchIntro("")}
          >
            <textarea
              id="landing-description"
              maxLength={LANDING_LIMITS.businessDescription}
              rows={4}
              value={landing.intro.businessDescription}
              placeholder={placeholders.businessDescription}
              onChange={(e) => patchIntro(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
          </FieldShell>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-semibold text-heading">Industries</h3>
          <FieldShell
            label="Industries (comma-separated)"
            htmlFor="landing-industries"
            value={landing.industries.join(", ")}
            hint={`Up to ${LANDING_LIMITS.industriesMax} items, ${LANDING_LIMITS.industryItem} chars each. Default: ${placeholders.industries.join(", ")}`}
            onReset={() => onChange({ ...landing, industries: [] })}
          >
            <Input
              id="landing-industries"
              value={landing.industries.join(", ")}
              placeholder={placeholders.industries.join(", ")}
              onChange={(e) => setIndustriesText(e.target.value)}
            />
          </FieldShell>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-semibold text-heading">How it works</h3>
          <p className="text-xs text-muted">
            Four steps, fixed order. Only labels and descriptions are editable.
          </p>
          {Array.from({ length: HOW_IT_WORKS_STEP_COUNT }, (_, i) => {
            const step = landing.howItWorks[i] ?? { label: "", description: "" };
            const ph = placeholders.howItWorks[i];
            return (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Step {String(i + 1).padStart(2, "0")}
                </p>
                <FieldShell
                  label="Label"
                  htmlFor={`landing-step-${i}-label`}
                  value={step.label}
                  max={LANDING_LIMITS.howItWorksLabel}
                  onReset={() => setHowItWorks(i, { label: "", description: step.description })}
                >
                  <Input
                    id={`landing-step-${i}-label`}
                    maxLength={LANDING_LIMITS.howItWorksLabel}
                    value={step.label}
                    placeholder={ph?.label}
                    onChange={(e) => setHowItWorks(i, { label: e.target.value })}
                  />
                </FieldShell>
                <FieldShell
                  label="Description"
                  htmlFor={`landing-step-${i}-desc`}
                  value={step.description}
                  max={LANDING_LIMITS.howItWorksDescription}
                  onReset={() => setHowItWorks(i, { description: "", label: step.label })}
                >
                  <textarea
                    id={`landing-step-${i}-desc`}
                    maxLength={LANDING_LIMITS.howItWorksDescription}
                    rows={2}
                    value={step.description}
                    placeholder={ph?.description}
                    onChange={(e) => setHowItWorks(i, { description: e.target.value })}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  />
                </FieldShell>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-semibold text-heading">Footer &amp; social</h3>
          <FieldShell
            label="Footer tagline (optional)"
            htmlFor="landing-footer-tagline"
            value={landing.footer.tagline}
            max={LANDING_LIMITS.footerTagline}
            onReset={() => patchFooter("")}
          >
            <Input
              id="landing-footer-tagline"
              maxLength={LANDING_LIMITS.footerTagline}
              value={landing.footer.tagline}
              placeholder="Start your project in minutes…"
              onChange={(e) => patchFooter(e.target.value)}
            />
          </FieldShell>
          {(
            [
              ["instagram", "Instagram"],
              ["facebook", "Facebook"],
              ["youtube", "YouTube"],
              ["linkedin", "LinkedIn"],
              ["website", "Website"],
            ] as const
          ).map(([key, label]) => (
            <FieldShell
              key={key}
              label={label}
              htmlFor={`landing-social-${key}`}
              value={landing.social[key]}
              max={LANDING_LIMITS.socialUrl}
              onReset={() => patchSocial({ [key]: "" })}
            >
              <Input
                id={`landing-social-${key}`}
                maxLength={LANDING_LIMITS.socialUrl}
                value={landing.social[key]}
                placeholder="https://"
                onChange={(e) => patchSocial({ [key]: e.target.value })}
              />
            </FieldShell>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="space-y-3 pt-6">
          <h3 className="font-semibold text-heading">Optional sections</h3>
          <p className="text-xs text-muted">
            Turn off sections you do not use so the page never shows an empty block.
          </p>
          {(
            [
              ["showreel", "Hero showreel"],
              ["industries", "Industries line"],
              ["services", "Services catalog"],
              ["social", "Social links"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={landing.sections[key]}
                onChange={(e) => patchSections({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
