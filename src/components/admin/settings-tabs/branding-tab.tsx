"use client";

import { AlertTriangle, CircleCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PORTAL_LOGO_SIZE } from "@/lib/brand-logo-size";
import { AcceptSetupDefaultButton } from "@/components/admin/accept-setup-default-button";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { BRAND } from "@/lib/brand";
import {
  brandSurfaceAdjusted,
  deriveBrandTheme,
  parseSurfaceMode,
  surfaceTone,
  type SurfaceMode,
} from "@/lib/brand-color";
import { logoLuminanceClass } from "@/lib/logo-luminance-class";
import { cn } from "@/lib/utils";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";
import { BrandingLogoTile } from "@/components/admin/settings-tabs/branding-logo-tile";
import { BrandingLogoSize } from "@/components/admin/settings-tabs/branding-logo-size";
import { BrandingColorSwatch } from "@/components/admin/settings-tabs/branding-color-swatch";
import { BrandingLivePreview } from "@/components/admin/settings-tabs/branding-live-preview";

const CARD = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6";

const BACKGROUNDS: { mode: SurfaceMode; label: string }[] = [
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
  { mode: "brand", label: "Primary color" },
];

export function BrandingTab() {
  const { settings, brandUnsaved, colorWarnings, patchBusiness, dismissLogoSuggestion } = useSettingsTab();
  const b = settings.business;
  const surfaceMode = parseSurfaceMode(b.surfaceMode);
  const emailLogo = b.emailLogoUrl ?? "";
  const emailLinked = !emailLogo.trim() || emailLogo === b.logoUrl;
  const logoStillDefault = !b.logoUrl || b.logoUrl === PLATFORM_BUSINESS_DEFAULTS.logoUrl || b.logoUrl === BRAND.logoUrl;
  const colorsDefault =
    b.brandPrimaryColor === PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor &&
    b.brandAccentColor === PLATFORM_BUSINESS_DEFAULTS.brandAccentColor;

  return (
    <>
      <SectionHeading id="branding">Branding &amp; Colors</SectionHeading>
      <p className="mt-1 mb-4 text-sm text-muted">
        Your logo, colors and background. Changes preview live; clients see them after you save.
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {/* Logos */}
          <section className={CARD} aria-labelledby="branding-logos-title">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 id="branding-logos-title" className="text-base font-semibold text-heading">
                Logos
              </h3>
              <p className="text-[13px] text-muted">PNG, JPG or WebP · under 4 MB</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div id="settings-logo" tabIndex={-1} className="min-w-0 scroll-mt-24">
                <BrandingLogoTile
                  kind="logo"
                  inputId="logoUrl"
                  title="Portal logo"
                  hint="Top of your portal"
                  value={b.logoUrl}
                  onUrlChange={(logoUrl) =>
                    patchBusiness({
                      logoUrl,
                      // A linked email logo follows the portal logo.
                      emailLogoUrl: emailLinked ? logoUrl : emailLogo,
                    })
                  }
                  onLogoMeasured={(logoLuminance) => patchBusiness({ logoLuminance })}
                />
              </div>
              <div id="settings-email-logo" tabIndex={-1} className="min-w-0 scroll-mt-24">
                <BrandingLogoTile
                  kind="emailLogo"
                  inputId="emailLogoUrl"
                  title="Email logo"
                  hint="Top of client emails"
                  linked={emailLinked && Boolean(b.logoUrl.trim())}
                  linkedHint="Same as portal logo"
                  value={emailLogo || b.logoUrl}
                  onUrlChange={(emailLogoUrl) => patchBusiness({ emailLogoUrl })}
                />
              </div>
              <div id="settings-favicon" tabIndex={-1} className="min-w-0 scroll-mt-24">
                <BrandingLogoTile
                  kind="favicon"
                  inputId="faviconUrl"
                  title="Browser icon"
                  hint="Square, 48 × 48 or larger"
                  square
                  value={b.faviconUrl ?? ""}
                  onUrlChange={(faviconUrl) => patchBusiness({ faviconUrl })}
                />
              </div>
            </div>

            {logoLuminanceClass(b.logoLuminance) === "light" &&
            surfaceMode === "light" &&
            b.logoSuggestionDismissedFor !== b.logoUrl ? (
              <div
                role="status"
                className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-subtle px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-foreground">
                  This logo may be hard to see on a light background. Switch your portal to dark?
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" className="h-9" onClick={() => patchBusiness({ surfaceMode: "dark" })}>
                    Switch to dark
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => void dismissLogoSuggestion()}>
                    Keep light
                  </Button>
                </div>
              </div>
            ) : null}

            {settings.setupAcceptedDefaults?.logo ? (
              <p className="mt-3 text-xs text-muted">Using ShootPortal default logo until you upload your own.</p>
            ) : logoStillDefault ? (
              <div className="mt-3">
                <AcceptSetupDefaultButton acceptKey="logo" />
              </div>
            ) : null}

            <div className="mt-5 border-t border-border pt-5">
              <BrandingLogoSize
                value={b.portalLogoSizePx ?? PORTAL_LOGO_SIZE.default}
                onChange={(portalLogoSizePx) => patchBusiness({ portalLogoSizePx })}
              />
            </div>
          </section>

          {/* Colors */}
          <section id="settings-colors" tabIndex={-1} className={cn(CARD, "scroll-mt-24")} aria-labelledby="branding-colors-title">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 id="branding-colors-title" className="text-base font-semibold text-heading">
                Colors
              </h3>
              {colorsDefault ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-accent"
                onClick={() =>
                  patchBusiness({
                    brandPrimaryColor: PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor,
                    brandAccentColor: PLATFORM_BUSINESS_DEFAULTS.brandAccentColor,
                  })
                }
              >
                <RotateCcw className="h-4 w-4" /> Use ShootPortal colors
              </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <BrandingColorSwatch
                id="brandPrimaryColor"
                label="Primary"
                description="Header, headings, main buttons"
                value={b.brandPrimaryColor}
                fallback="#0F172A"
                onChange={(v) => patchBusiness({ brandPrimaryColor: v })}
              />
              <BrandingColorSwatch
                id="brandAccentColor"
                label="Accent"
                description="Buttons, links, highlights"
                value={b.brandAccentColor}
                fallback="#3B82F6"
                onChange={(v) => patchBusiness({ brandAccentColor: v })}
              />
            </div>
            {colorWarnings.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {colorWarnings.map((w) => (
                  <li
                    key={`${w.field}-${w.message}`}
                    className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 surface-dark:bg-amber-500/15 surface-dark:text-amber-200"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      <span className="font-semibold">{w.field === "brandPrimaryColor" ? "Primary: " : "Accent: "}</span>
                      {w.message}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
                <CircleCheck className="h-4 w-4 text-emerald-600 surface-dark:text-emerald-300" aria-hidden />
                Both colors are easy to read.
              </p>
            )}
            {settings.setupAcceptedDefaults?.colors ? (
              <p className="mt-2 text-xs text-muted">Using ShootPortal default colors until you change them.</p>
            ) : colorsDefault ? (
              <div className="mt-3">
                <AcceptSetupDefaultButton acceptKey="colors" label="Keep these colors" />
              </div>
            ) : null}
          </section>

          {/* Portal background */}
          <section
            id="settings-portal-background"
            tabIndex={-1}
            className={cn(CARD, "scroll-mt-24")}
            aria-labelledby="portal-background-label"
          >
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 id="portal-background-label" className="text-base font-semibold text-heading">
                Portal background
              </h3>
              <p className="text-[13px] text-muted">For you and your clients, including shared links</p>
            </div>
            <div role="radiogroup" aria-labelledby="portal-background-label" className="grid gap-3 sm:grid-cols-3">
              {BACKGROUNDS.map(({ mode, label }) => {
                const selected = surfaceMode === mode;
                const t = deriveBrandTheme(b.brandPrimaryColor, b.brandAccentColor, mode);
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => patchBusiness({ surfaceMode: mode })}
                    className={cn(
                      "rounded-xl border p-2.5 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      selected ? "border-accent ring-3 ring-accent/20" : "border-border hover:border-accent/50"
                    )}
                  >
                    <span
                      className="flex h-16 flex-col gap-1.5 rounded-lg border p-2"
                      style={{ background: t.background, borderColor: t.border }}
                      aria-hidden
                    >
                      <span className="block h-1.5 w-1/2 rounded-full" style={{ background: t.heading }} />
                      <span className="block flex-1 rounded-md" style={{ background: t.card }} />
                    </span>
                    <span className="mt-2.5 flex items-center gap-2 text-sm font-semibold text-heading">
                      <span
                        className={cn(
                          "h-4 w-4 shrink-0 rounded-full border-2",
                          selected ? "border-[5px] border-accent" : "border-border"
                        )}
                        aria-hidden
                      />
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            {surfaceMode === "brand" ? (
              <p className="mt-3 text-xs text-muted">
                Text switches between light and dark automatically so it stays readable on your color.
                {brandSurfaceAdjusted(b.brandPrimaryColor)
                  ? surfaceTone("brand", b.brandPrimaryColor) === "dark"
                    ? " Your color is deepened a little for the background so light text stays easy to read."
                    : " Your color is lightened a little for the background so dark text stays easy to read."
                  : ""}
              </p>
            ) : null}
          </section>
        </div>

        <BrandingLivePreview
          primary={b.brandPrimaryColor}
          accent={b.brandAccentColor}
          surfaceMode={surfaceMode}
          portalName={b.portalName}
          businessName={b.businessName}
          logoUrl={b.logoUrl ?? ""}
          emailLogoUrl={emailLogo}
          logoSizePx={b.portalLogoSizePx ?? PORTAL_LOGO_SIZE.default}
          footerText={settings.email.footerText}
          brandUnsaved={brandUnsaved}
        />
      </div>
    </>
  );
}
