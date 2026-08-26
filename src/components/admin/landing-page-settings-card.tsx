"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LandingFeatureIconPicker } from "@/components/admin/landing-feature-icon-picker";
import { SettingsCollapsible } from "@/components/admin/settings-collapsible";
import { BrandAssetField } from "@/components/admin/brand-asset-field";
import { PartnerBrandColorField } from "@/components/partner/partner-brand-color-field";
import { LandingPage } from "@/components/landing/landing-page";
import { LandingEditorPreviewFrame } from "@/components/landing/landing-editor-preview-frame";
import { LandingEditorShell } from "@/components/landing/landing-editor-shell";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { PortalBrand } from "@/lib/portal-brand";
import {
  LANDING_LIMITS,
  HOW_IT_WORKS_DEFAULT_COUNT,
  DEFAULT_HOW_IT_WORKS,
  DEFAULT_FEATURE_CARDS,
  landingContentPlaceholders,
  mergeLandingSettings,
  resolveLandingPage,
  resolveHeroMediaKind,
  heroOverlayLeavesHeadlineUnreadable,
  HERO_OVERLAY_CONTRAST_MIN,
  type LandingSettings,
  type LandingHowItWorksStep,
  type LandingFeatureCard,
  type LandingFeatureIconId,
  type LandingSocialLinks,
  type LandingSectionVisibility,
  type LandingHeroMediaType,
} from "@/lib/landing-content";
import { ChevronDown, ChevronUp, ExternalLink, Plus, RotateCcw, Trash2 } from "lucide-react";

function sliceDirty(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

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

function editorHowItWorks(landing: LandingSettings): LandingHowItWorksStep[] {
  if (landing.howItWorks.length >= LANDING_LIMITS.howItWorksMin) {
    return landing.howItWorks;
  }
  return Array.from({ length: HOW_IT_WORKS_DEFAULT_COUNT }, (_, i) => ({
    label: landing.howItWorks[i]?.label ?? "",
    description: landing.howItWorks[i]?.description ?? "",
    imageUrl: landing.howItWorks[i]?.imageUrl ?? "",
  }));
}

export function LandingPageSettingsCard({
  landing,
  baselineLanding,
  businessName,
  serviceNames,
  portalPreviewUrl,
  canEdit,
  brand,
  onChange,
  shellNav,
  shellFooter,
}: {
  landing: LandingSettings;
  /** Last-saved landing — used for per-section Unsaved badges. */
  baselineLanding?: LandingSettings;
  businessName: string;
  serviceNames: string[];
  portalPreviewUrl: string;
  canEdit: boolean;
  brand: PortalBrand;
  onChange: (next: LandingSettings) => void;
  /** Left rail for the desktop editor shell (settings section nav). */
  shellNav: React.ReactNode;
  /** Optional sticky save controls in the form pane. */
  shellFooter?: React.ReactNode;
}) {
  const placeholders = landingContentPlaceholders(businessName, serviceNames);
  const steps = editorHowItWorks(landing);
  const saved = baselineLanding ?? landing;

  const dirtyHero = sliceDirty(landing.hero, saved.hero);
  const dirtyAbout = sliceDirty(landing.intro, saved.intro);
  const dirtyIndustries =
    sliceDirty(landing.industries, saved.industries) ||
    sliceDirty(landing.sections.industries, saved.sections.industries);
  const dirtyHowItWorks = sliceDirty(landing.howItWorks, saved.howItWorks);
  const dirtyFeatures = sliceDirty(landing.features, saved.features);
  const dirtyFooter =
    sliceDirty(landing.footer, saved.footer) ||
    sliceDirty(landing.social, saved.social) ||
    sliceDirty(
      {
        showreel: landing.sections.showreel,
        services: landing.sections.services,
        social: landing.sections.social,
      },
      {
        showreel: saved.sections.showreel,
        services: saved.sections.services,
        social: saved.sections.social,
      }
    );

  const resolvedMediaType: LandingHeroMediaType =
    landing.hero.mediaType || resolveHeroMediaKind(landing);

  const overlayColorForEditor =
    landing.hero.overlayColor.trim() || brand.primaryColor || "#0F172A";
  const overlayOpacityForEditor =
    landing.hero.overlayOpacity == null ? 80 : landing.hero.overlayOpacity;

  const contrastWarn = heroOverlayLeavesHeadlineUnreadable({
    overlayColor: overlayColorForEditor,
    overlayOpacity: overlayOpacityForEditor,
  });

  const draftPage = useMemo(() => {
    const merged = mergeLandingSettings(landing);
    return resolveLandingPage({
      landing: merged,
      businessName,
      portalName: brand.portalName || businessName,
      serviceNames,
      services: serviceNames.map((name) => ({
        name,
        startingLabel: "",
        description: "",
      })),
    });
  }, [landing, businessName, brand.portalName, serviceNames]);
  const previewPage = useDebouncedValue(draftPage, 200);

  function patchHero(patch: Partial<LandingSettings["hero"]>) {
    onChange({ ...landing, hero: { ...landing.hero, ...patch } });
  }

  function setMediaType(next: LandingHeroMediaType) {
    onChange({
      ...landing,
      hero: { ...landing.hero, mediaType: next },
      sections: {
        ...landing.sections,
        showreel: next === "showreel",
      },
    });
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

  function setHowItWorksList(next: LandingHowItWorksStep[]) {
    onChange({ ...landing, howItWorks: next });
  }

  function setHowItWorks(index: number, patch: Partial<LandingHowItWorksStep>) {
    setHowItWorksList(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  function addHowItWorksStep() {
    if (steps.length >= LANDING_LIMITS.howItWorksMax) return;
    setHowItWorksList([...steps, { label: "", description: "", imageUrl: "" }]);
  }

  function removeHowItWorksStep(index: number) {
    if (steps.length <= LANDING_LIMITS.howItWorksMin) return;
    const label = steps[index]?.label?.trim() || `Step ${index + 1}`;
    if (
      !window.confirm(
        `Remove “${label}”? This cannot be undone (you can reset the whole section to defaults).`
      )
    ) {
      return;
    }
    setHowItWorksList(steps.filter((_, i) => i !== index));
  }

  function moveHowItWorksStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    setHowItWorksList(next);
  }

  function resetHowItWorksDefaults() {
    setHowItWorksList(
      Array.from({ length: HOW_IT_WORKS_DEFAULT_COUNT }, () => ({
        label: "",
        description: "",
        imageUrl: "",
      }))
    );
  }

  function editorFeatures(): LandingFeatureCard[] {
    return landing.features.length >= LANDING_LIMITS.featuresMin
      ? landing.features
      : DEFAULT_FEATURE_CARDS.map((c) => ({ ...c }));
  }

  function setFeatures(next: LandingFeatureCard[]) {
    onChange({ ...landing, features: next });
  }

  function setFeature(index: number, patch: Partial<LandingFeatureCard>) {
    const list = editorFeatures().map((card, i) => (i === index ? { ...card, ...patch } : card));
    setFeatures(list);
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
      <LandingEditorShell
        nav={shellNav}
        formFooter={shellFooter}
        form={
          <Card className="shadow-sm">
            <CardContent className="space-y-4 pt-6">
              <div>
                <h2 className="text-lg font-semibold text-primary">Client Landing Page</h2>
                <p className="mt-1 text-sm text-muted">
                  Customize the public page at your portal URL. Plain text only — layout stays locked.
                </p>
              </div>
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
        }
        canvas={
          <LandingEditorPreviewFrame>
            <LandingPage brand={brand} page={previewPage} />
          </LandingEditorPreviewFrame>
        }
      />
    );
  }

  return (
    /*
      Defaults: Hero open (primary edit surface); other sections closed.
      Expansion remembered in sessionStorage. Layout is LandingEditorShell only.
    */
    <LandingEditorShell
      nav={shellNav}
      formFooter={shellFooter}
      form={
        <div id="settings-landing" tabIndex={-1} className="min-w-0 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">Client Landing Page</h2>
            <p className="mt-1 text-sm text-muted">
              Customize the public page at your portal URL. Plain text only — layout stays locked.
            </p>
          </div>
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

          <SettingsCollapsible
            id="landing-section-hero"
            title="Hero"
            description="Headline, CTAs, and hero media."
            defaultOpen
            storageKey="admin-settings-landing-hero"
            dirty={dirtyHero}
          >
            <div className="space-y-4">
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

              <div className="space-y-3">
                <Label>Hero media</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {(
                    [
                      ["showreel", "Showreel video"],
                      ["image", "Hero image"],
                      ["none", "None"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm"
                    >
                      <input
                        type="radio"
                        name="landing-hero-media"
                        checked={resolvedMediaType === value}
                        onChange={() => setMediaType(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {resolvedMediaType === "showreel" ? (
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
              ) : null}

              {resolvedMediaType === "image" ? (
                <BrandAssetField
                  kind="heroImage"
                  value={landing.hero.heroImageUrl}
                  inputId="landing-hero-image"
                  onUrlChange={(url) => patchHero({ heroImageUrl: url, mediaType: "image" })}
                />
              ) : null}

              {resolvedMediaType !== "none" ? (
                <div className="space-y-4 rounded-lg border border-border bg-subtle/40 p-4">
                  <p className="text-sm font-medium text-heading">Media overlay</p>
                  <p className="text-xs text-muted">
                    Darkens video or image so the white headline stays readable. Defaults to your brand
                    primary; leave unset to keep the classic ShootPortal gradient.
                  </p>
                  <PartnerBrandColorField
                    id="landing-overlay-color"
                    label="Overlay color"
                    value={landing.hero.overlayColor}
                    fallback={brand.primaryColor || "#0F172A"}
                    help="Applied over showreel and hero image."
                    onChange={(v) => patchHero({ overlayColor: v })}
                    onReset={() => patchHero({ overlayColor: "", overlayOpacity: null })}
                  />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="landing-overlay-opacity">Overlay intensity</Label>
                      <span className="text-xs text-muted">{overlayOpacityForEditor}%</span>
                    </div>
                    <input
                      id="landing-overlay-opacity"
                      type="range"
                      min={0}
                      max={100}
                      value={overlayOpacityForEditor}
                      onChange={(e) =>
                        patchHero({
                          overlayOpacity: Number(e.target.value),
                          overlayColor: landing.hero.overlayColor.trim() || overlayColorForEditor,
                        })
                      }
                      className="w-full"
                    />
                  </div>
                  {contrastWarn ? (
                    <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Headline may be hard to read: white text vs this overlay is below{" "}
                      {HERO_OVERLAY_CONTRAST_MIN}:1 contrast (WCAG AA) when the media behind is bright.
                      Darken the overlay or raise intensity.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SettingsCollapsible>

          <SettingsCollapsible
            id="landing-section-about"
            title="About"
            description="Business description under the hero."
            defaultOpen={false}
            storageKey="admin-settings-landing-about"
            dirty={dirtyAbout}
          >
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
          </SettingsCollapsible>

          <SettingsCollapsible
            id="landing-section-industries"
            title="Industries"
            description="Comma-separated industry line."
            defaultOpen={false}
            storageKey="admin-settings-landing-industries"
            dirty={dirtyIndustries}
          >
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
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={landing.sections.industries}
                onChange={(e) => patchSections({ industries: e.target.checked })}
              />
              Show industries line on the page
            </label>
          </SettingsCollapsible>

          <SettingsCollapsible
            id="landing-section-how-it-works"
            title="How it works"
            description={`${LANDING_LIMITS.howItWorksMin}–${LANDING_LIMITS.howItWorksMax} steps (default ${HOW_IT_WORKS_DEFAULT_COUNT}).`}
            defaultOpen={false}
            storageKey="admin-settings-landing-how-it-works"
            dirty={dirtyHowItWorks}
          >
            <div className="mb-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={resetHowItWorksDefaults}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset to default
              </Button>
            </div>
            <div className="space-y-4">
              {steps.map((step, i) => {
                const ph = placeholders.howItWorks[i] ?? DEFAULT_HOW_IT_WORKS[i];
                return (
                  <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Step {String(i + 1).padStart(2, "0")}
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          aria-label={`Move step ${i + 1} up`}
                          disabled={i === 0}
                          onClick={() => moveHowItWorksStep(i, -1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          aria-label={`Move step ${i + 1} down`}
                          disabled={i === steps.length - 1}
                          onClick={() => moveHowItWorksStep(i, 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        {steps.length > LANDING_LIMITS.howItWorksMin ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-700"
                            onClick={() => removeHowItWorksStep(i)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
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
                        placeholder={ph?.label ?? `Step ${i + 1}`}
                        onChange={(e) => setHowItWorks(i, { label: e.target.value })}
                      />
                    </FieldShell>
                    <FieldShell
                      label="Description"
                      htmlFor={`landing-step-${i}-desc`}
                      value={step.description}
                      max={LANDING_LIMITS.howItWorksDescription}
                      onReset={() =>
                        setHowItWorks(i, {
                          description: "",
                          label: step.label,
                          imageUrl: step.imageUrl,
                        })
                      }
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
                    <BrandAssetField
                      kind="howItWorksImage"
                      inputId={`landing-step-${i}-image`}
                      value={step.imageUrl ?? ""}
                      onUrlChange={(imageUrl) => setHowItWorks(i, { imageUrl })}
                    />
                  </div>
                );
              })}
              {steps.length < LANDING_LIMITS.howItWorksMax ? (
                <Button type="button" variant="outline" size="sm" onClick={addHowItWorksStep}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add step
                </Button>
              ) : null}
            </div>
          </SettingsCollapsible>

          <SettingsCollapsible
            id="landing-section-features"
            title="Everything in one place"
            description={`${LANDING_LIMITS.featuresMin}–${LANDING_LIMITS.featuresMax} feature cards. Icons from a fixed allowlist only.`}
            defaultOpen={false}
            storageKey="admin-settings-landing-features"
            dirty={dirtyFeatures}
          >
            <div className="mb-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setFeatures([])}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset to default
              </Button>
            </div>
            <div className="space-y-4">
              {editorFeatures().map((card, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Card {i + 1}
                    </p>
                    {editorFeatures().length > LANDING_LIMITS.featuresMin ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-700"
                        onClick={() => setFeatures(editorFeatures().filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label id={`landing-feature-${i}-icon-label`}>Icon</Label>
                    <LandingFeatureIconPicker
                      id={`landing-feature-${i}-icon`}
                      value={card.icon}
                      onChange={(icon: LandingFeatureIconId) => setFeature(i, { icon })}
                    />
                  </div>
                  <FieldShell
                    label="Title"
                    htmlFor={`landing-feature-${i}-title`}
                    value={card.title}
                    max={LANDING_LIMITS.featureTitle}
                    onReset={
                      DEFAULT_FEATURE_CARDS[i]
                        ? () => setFeature(i, { title: DEFAULT_FEATURE_CARDS[i].title })
                        : undefined
                    }
                  >
                    <Input
                      id={`landing-feature-${i}-title`}
                      maxLength={LANDING_LIMITS.featureTitle}
                      value={card.title}
                      placeholder={placeholders.features[i]?.title}
                      onChange={(e) => setFeature(i, { title: e.target.value })}
                    />
                  </FieldShell>
                  <FieldShell
                    label="Description"
                    htmlFor={`landing-feature-${i}-desc`}
                    value={card.description}
                    max={LANDING_LIMITS.featureDescription}
                    onReset={
                      DEFAULT_FEATURE_CARDS[i]
                        ? () =>
                            setFeature(i, {
                              description: DEFAULT_FEATURE_CARDS[i].description,
                            })
                        : undefined
                    }
                  >
                    <textarea
                      id={`landing-feature-${i}-desc`}
                      maxLength={LANDING_LIMITS.featureDescription}
                      rows={2}
                      value={card.description}
                      placeholder={placeholders.features[i]?.description}
                      onChange={(e) => setFeature(i, { description: e.target.value })}
                      className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                    />
                  </FieldShell>
                </div>
              ))}
              {editorFeatures().length < LANDING_LIMITS.featuresMax ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFeatures([
                      ...editorFeatures(),
                      {
                        icon: "CheckCircle2",
                        title: "",
                        description: "",
                      },
                    ])
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add card
                </Button>
              ) : null}
            </div>
          </SettingsCollapsible>

          <SettingsCollapsible
            id="landing-section-footer"
            title="Footer & social"
            description="Tagline, social links, and optional section toggles."
            defaultOpen={false}
            storageKey="admin-settings-landing-footer"
            dirty={dirtyFooter}
          >
            <div className="space-y-4">
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

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-heading">Optional sections</p>
                <p className="text-xs text-muted">
                  Turn off sections you do not use so the page never shows an empty block.
                </p>
                {(
                  [
                    ["showreel", "Hero showreel"],
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
              </div>
            </div>
          </SettingsCollapsible>
        </div>
      }
      canvas={
        <LandingEditorPreviewFrame>
          <LandingPage brand={brand} page={previewPage} />
        </LandingEditorPreviewFrame>
      }
    />
  );
}
