"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerBrandColorField } from "@/components/partner/partner-brand-color-field";
import { PartnerLandingPhoto } from "@/components/partner/partner-landing-photo";
import { PartnerLandingPublicView } from "@/components/partner/partner-landing-public-view";
import { LandingEditorPreviewFrame } from "@/components/landing/landing-editor-preview-frame";
import { LandingEditorShell } from "@/components/landing/landing-editor-shell";
import { SafeBrandImage } from "@/components/partner/safe-brand-image";
import { toast } from "sonner";
import { isSafeBrandAssetUrl } from "@/lib/brand-color";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  PARTNER_LANDING_LIMITS,
  resolvePartnerLandingPhotoLayout,
  type PartnerLandingDefaults,
} from "@/lib/partner-landing.constants";
import { resolvePartnerLandingContentSync } from "@/lib/partner-landing-resolve";
import type { PartnerLandingPageRow } from "@/lib/partner-landing";
import { validateLandingSlug } from "@/lib/reserved-subdomains";
import { partnerLandingPublicUrl } from "@/lib/partner-urls";

type Mode = "partner" | "admin";

type Props = {
  mode: Mode;
  partnerId: string;
  brandName: string;
  initial: PartnerLandingPageRow | null;
  defaults: PartnerLandingDefaults;
  suggestedSlug?: string;
  previewPath?: string | null;
  /** Absolute apex URL for preview (preferred over previewPath). */
  previewUrl?: string | null;
  updatedAt?: string | null;
  updatedByLabel?: string | null;
  /**
   * Left-rail section nav supplied by the caller (partner dashboard nav, platform
   * partner-detail nav, etc.). Do not import those navs here — invert the dependency.
   */
  sectionNav: React.ReactNode;
  /**
   * When true, shell nav is desktop-only (`hidden` below lg). Use when the surrounding
   * layout already exposes the same section nav on small screens.
   */
  hideNavBelowLg?: boolean;
};

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
}

function slugValidationMessage(raw: string): string | null {
  if (!raw.trim()) return "Choose a URL slug for your page.";
  const result = validateLandingSlug(raw);
  return result.ok ? null : result.error;
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={`text-xs ${value > max ? "text-red-600" : "text-muted"}`}>
      {value}/{max}
    </span>
  );
}

function FieldReset({
  onReset,
  disabled,
}: {
  onReset: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="text-xs text-accent hover:underline disabled:opacity-50"
      disabled={disabled}
      onClick={onReset}
    >
      Reset to default
    </button>
  );
}

export function PartnerLandingEditorForm({
  mode,
  partnerId,
  brandName,
  initial,
  defaults,
  suggestedSlug,
  previewPath,
  previewUrl,
  updatedAt,
  updatedByLabel,
  sectionNav,
  hideNavBelowLg = false,
}: Props) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "photo" | null>(null);

  const [slug, setSlug] = useState(initial?.slug ?? suggestedSlug ?? "");
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [subheadline, setSubheadline] = useState(initial?.subheadline ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [benefits, setBenefits] = useState<string[]>(
    initial?.benefits?.length ? initial.benefits : []
  );
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? "");
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? "");
  const [photoWidth, setPhotoWidth] = useState<number | null>(initial?.photo_width ?? null);
  const [photoHeight, setPhotoHeight] = useState<number | null>(initial?.photo_height ?? null);
  const [brandPrimary, setBrandPrimary] = useState(initial?.brand_primary_color ?? "");
  const [brandAccent, setBrandAccent] = useState(initial?.brand_accent_color ?? "");
  const [testimonialQuote, setTestimonialQuote] = useState(initial?.testimonial_quote ?? "");
  const [testimonialAttribution, setTestimonialAttribution] = useState(
    initial?.testimonial_attribution ?? ""
  );
  const [showOffer, setShowOffer] = useState(initial?.show_offer ?? true);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const benefitFields = useMemo(() => {
    const count = Math.max(
      PARTNER_LANDING_LIMITS.benefitsMin,
      benefits.length || PARTNER_LANDING_LIMITS.benefitsMin
    );
    const capped = Math.min(count, PARTNER_LANDING_LIMITS.benefitsMax);
    return Array.from({ length: capped }, (_, i) => benefits[i] ?? "");
  }, [benefits]);

  const saveUrl =
    mode === "admin"
      ? `/api/platform/partners/${partnerId}/landing`
      : "/api/partner/landing";
  const uploadUrl =
    mode === "admin"
      ? `/api/platform/partners/${partnerId}/landing/upload`
      : "/api/partner/landing/upload";

  const previewHref =
    previewUrl ??
    previewPath ??
    (slug ? partnerLandingPublicUrl(slug.trim()) : null);
  const slugError = slugValidationMessage(slug);
  const initialSlug = initial?.slug ?? "";

  const safeLogoUrl =
    logoUrl.trim() && isSafeBrandAssetUrl(logoUrl.trim()) ? logoUrl.trim() : "";
  const photoLayout = resolvePartnerLandingPhotoLayout(
    photoUrl.trim() && isSafeBrandAssetUrl(photoUrl.trim()) ? photoUrl.trim() : null,
    photoWidth,
    photoHeight
  );

  const draftContent = useMemo(
    () =>
      resolvePartnerLandingContentSync({
        brandName,
        slug: slug.trim() || "preview",
        headline,
        subheadline,
        description,
        benefits: benefitFields,
        ctaLabel,
        logoUrl: safeLogoUrl || null,
        photoUrl: photoUrl.trim() || null,
        photoWidth,
        photoHeight,
        brandPrimaryColor: brandPrimary.trim() || null,
        brandAccentColor: brandAccent.trim() || null,
        testimonialQuote,
        testimonialAttribution,
        showOffer,
        offerText: defaults.offerText,
        defaults,
      }),
    [
      brandName,
      slug,
      headline,
      subheadline,
      description,
      benefitFields,
      ctaLabel,
      safeLogoUrl,
      photoUrl,
      photoWidth,
      photoHeight,
      brandPrimary,
      brandAccent,
      testimonialQuote,
      testimonialAttribution,
      showOffer,
      defaults,
    ]
  );
  const previewContent = useDebouncedValue(draftContent, 200);

  async function createLanding() {
    const err = slugValidationMessage(slug);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/partner/landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not create landing page.");
      toast.success("Landing page created");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create landing page.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (mode === "admin" && slugError) {
      toast.error(slugError);
      return;
    }
    if (mode === "admin" && initial && slug.trim() !== initialSlug) {
      const ok = window.confirm(
        `Change landing URL from /${initialSlug} to /${slug}?\n\n` +
          `The new URL will go live immediately. The old URL (/${initialSlug}) will keep working ` +
          `as an alias so links you already posted are not lost — but update your materials when you can.`
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const cleanedBenefits = benefitFields.map((b) => b.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        headline,
        subheadline,
        description,
        benefits: cleanedBenefits.length ? cleanedBenefits : [],
        ctaLabel,
        logoUrl: logoUrl || null,
        photoUrl: photoUrl || null,
        photoWidth: photoUrl ? photoWidth : null,
        photoHeight: photoUrl ? photoHeight : null,
        brandPrimaryColor: brandPrimary || null,
        brandAccentColor: brandAccent || null,
        testimonialQuote: testimonialQuote || null,
        testimonialAttribution: testimonialAttribution || null,
        showOffer,
      };
      if (mode === "admin") {
        body.slug = slug;
        body.isActive = isActive;
      }

      const res = await fetch(saveUrl, {
        method: mode === "admin" ? "PUT" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Landing page saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind: "logo" | "photo", file: File) {
    setUploading(kind);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      const res = await fetch(uploadUrl, { method: "POST", body: form });
      const text = await res.text();
      let data: { error?: string; url?: string; width?: number; height?: number };
      try {
        data = JSON.parse(text) as {
          error?: string;
          url?: string;
          width?: number;
          height?: number;
        };
      } catch {
        throw new Error(text || "Upload failed");
      }
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (kind === "logo") {
        setLogoUrl(data.url ?? "");
      } else {
        setPhotoUrl(data.url ?? "");
        setPhotoWidth(typeof data.width === "number" ? data.width : null);
        setPhotoHeight(typeof data.height === "number" ? data.height : null);
      }
      toast.success(kind === "logo" ? "Logo uploaded" : "Photo uploaded");
      if (kind === "photo") router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function removePhoto() {
    setBusy(true);
    try {
      const res = await fetch(saveUrl, {
        method: mode === "admin" ? "PUT" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearPhoto: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove photo");
      setPhotoUrl("");
      setPhotoWidth(null);
      setPhotoHeight(null);
      toast.success("Photo removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "partner" && !initial) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create your landing page</CardTitle>
          <p className="text-sm text-muted">
            A landing page is a co-branded ShootPortal page at{" "}
            <strong>shootportal.app/your-name</strong> with your photo, headline, and offer. It
            converts better than a bare referral link for course pages, YouTube descriptions, and
            website resources — and it earns the <strong>same commission</strong> as your{" "}
            <code className="text-xs">?ref=</code> link.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-slug">Choose your URL</Label>
            <Input
              id="create-slug"
              className="min-h-11 font-mono"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={suggestedSlug ?? "your-brand"}
            />
            <FieldHelp>
              Lowercase letters, numbers, and hyphens only (2–48 characters). Must be unique and
              cannot match reserved paths like /pricing or /signup.
            </FieldHelp>
            {slugError ? <p className="text-sm text-red-600">{slugError}</p> : null}
          </div>
          <Button
            type="button"
            variant="accent"
            className="min-h-11"
            disabled={busy || Boolean(slugError)}
            onClick={() => void createLanding()}
          >
            {busy ? "Creating…" : "Create landing page"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <LandingEditorShell
      hideNavBelowLg={hideNavBelowLg}
      nav={sectionNav}
      form={
    <Card className="min-w-0 border-0 shadow-none lg:border lg:shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Customize your landing page</CardTitle>
        <p className="text-sm text-muted">
          Plain text only — no HTML. Empty fields use ShootPortal defaults when your page renders.
          {mode === "admin" ? (
            <>
              {" "}
              Apex at <code className="text-xs">/{slug || "slug"}</code>. Sets referral cookie with
              source <code className="text-xs">landing_page</code>.
            </>
          ) : (
            <>
              {" "}
              Changing your slug after launch requires ShootPortal support — old URLs are kept as
              aliases so posted links keep working.
            </>
          )}
        </p>
        {previewHref ? (
          <p className="text-sm">
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-medium text-accent hover:underline"
            >
              View your live page ↗
            </a>
          </p>
        ) : null}
        {updatedAt ? (
          <p className="text-xs text-muted">
            Last updated {new Date(updatedAt).toLocaleString()}
            {updatedByLabel ? ` by ${updatedByLabel}` : ""}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label>URL slug</Label>
            {mode === "partner" ? (
              <span className="text-xs text-muted">Set at creation — contact support to change</span>
            ) : null}
          </div>
          <Input
            className="min-h-11 font-mono"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={suggestedSlug ?? "acme-media"}
            readOnly={mode === "partner"}
            disabled={mode === "partner"}
          />
          {mode === "admin" ? (
            <>
              <FieldHelp>
                Lowercase letters, numbers, hyphens (2–48 chars). Reserved paths like /pricing are
                blocked. Renaming keeps the old slug working as an alias.
              </FieldHelp>
              {slugError ? <p className="text-sm text-red-600">{slugError}</p> : null}
            </>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PartnerBrandColorField
            id="brand-primary"
            label="Brand primary color"
            value={brandPrimary}
            fallback={defaults.brandPrimaryColor}
            onChange={setBrandPrimary}
            onReset={() => setBrandPrimary("")}
            help="Colors the main headline on your public landing page (left column)."
          />
          <PartnerBrandColorField
            id="brand-accent"
            label="Brand accent color"
            value={brandAccent}
            fallback={defaults.brandAccentColor}
            onChange={setBrandAccent}
            onReset={() => setBrandAccent("")}
            help="Colors the “Brand × ShootPortal” eyebrow, benefit dots, offer border, and primary signup button."
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Logo</Label>
            <FieldHelp>
              Optional mark next to the co-brand eyebrow at the top of the left column (about 40px
              tall). PNG, JPEG, or WebP.
            </FieldHelp>
            <div className="flex h-14 max-w-[200px] items-center rounded-lg border border-dashed border-border bg-subtle px-3">
              {safeLogoUrl ? (
                <SafeBrandImage
                  src={safeLogoUrl}
                  alt="Logo preview"
                  className="h-10 max-w-[160px] object-contain object-left"
                />
              ) : (
                <span className="text-xs text-muted">No logo — eyebrow text only</span>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload("logo", f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={uploading === "logo"}
                onClick={() => logoInputRef.current?.click()}
              >
                {uploading === "logo" ? "Uploading…" : "Upload logo"}
              </Button>
              {logoUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl("")}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Personal photo</Label>
            <FieldHelp>
              Large image on the right side of the landing page. Shown in full (never cropped) at
              the photo’s own aspect ratio, with a max height so tall portraits stay readable. PNG,
              JPEG, or WebP under 15MB — oversized dimensions are resized automatically.
            </FieldHelp>
            <PartnerLandingPhoto
              key={`${photoLayout.src}-${photoLayout.width}x${photoLayout.height}`}
              src={photoLayout.src}
              width={photoLayout.width}
              height={photoLayout.height}
              alt="Personal photo preview"
            />
            {photoLayout.isDefault ? (
              <p className="text-xs text-muted">Showing default photo (not stored on your page).</p>
            ) : photoLayout.width == null ? (
              <p className="text-xs text-muted">
                Legacy photo — shown in full with letterboxing until you re-upload.
              </p>
            ) : (
              <p className="text-xs text-muted">
                {photoLayout.width}×{photoLayout.height}px — same framing as your live page.
              </p>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload("photo", f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={uploading === "photo"}
                onClick={() => photoInputRef.current?.click()}
              >
                {uploading === "photo" ? "Uploading…" : "Upload photo"}
              </Button>
              {photoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void removePhoto()}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Headline</Label>
            <div className="flex items-center gap-3">
              <Counter value={headline.length} max={PARTNER_LANDING_LIMITS.headline} />
              <FieldReset onReset={() => setHeadline("")} disabled={!headline} />
            </div>
          </div>
          <Input
            className="min-h-11"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={defaults.headline}
            maxLength={PARTNER_LANDING_LIMITS.headline}
          />
          <FieldHelp>Large title at the top of the left column (colored with brand primary).</FieldHelp>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Subheadline</Label>
            <div className="flex items-center gap-3">
              <Counter value={subheadline.length} max={PARTNER_LANDING_LIMITS.subheadline} />
              <FieldReset onReset={() => setSubheadline("")} disabled={!subheadline} />
            </div>
          </div>
          <Textarea
            rows={2}
            value={subheadline}
            onChange={(e) => setSubheadline(e.target.value)}
            placeholder={defaults.subheadline}
            maxLength={PARTNER_LANDING_LIMITS.subheadline}
          />
          <FieldHelp>Supporting sentence directly under the headline.</FieldHelp>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Description (optional)</Label>
            <div className="flex items-center gap-3">
              <Counter value={description.length} max={PARTNER_LANDING_LIMITS.description} />
              <FieldReset onReset={() => setDescription("")} disabled={!description} />
            </div>
          </div>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional context about why you recommend ShootPortal"
            maxLength={PARTNER_LANDING_LIMITS.description}
          />
          <FieldHelp>Optional longer paragraph under the subheadline. Leave blank to hide it.</FieldHelp>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Benefits</Label>
            <FieldReset
              onReset={() => setBenefits([])}
              disabled={benefits.every((b) => !b.trim())}
            />
          </div>
          <FieldHelp>
            Bullet list under the description (accent-colored dots). Leave all empty for ShootPortal
            defaults, or enter {PARTNER_LANDING_LIMITS.benefitsMin}–
            {PARTNER_LANDING_LIMITS.benefitsMax} bullets.
          </FieldHelp>
          {benefitFields.map((value, index) => (
            <Input
              key={index}
              className="min-h-11"
              value={value}
              placeholder={defaults.benefits[index] ?? `Benefit ${index + 1}`}
              maxLength={PARTNER_LANDING_LIMITS.benefitItem}
              onChange={(e) => {
                const next = [...benefitFields];
                next[index] = e.target.value;
                setBenefits(next);
              }}
            />
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>CTA label</Label>
            <div className="flex items-center gap-3">
              <Counter value={ctaLabel.length} max={PARTNER_LANDING_LIMITS.ctaLabel} />
              <FieldReset onReset={() => setCtaLabel("")} disabled={!ctaLabel} />
            </div>
          </div>
          <Input
            className="min-h-11"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder={defaults.ctaLabel}
            maxLength={PARTNER_LANDING_LIMITS.ctaLabel}
          />
          <FieldHelp>Label on the accent-colored signup button that links to /signup.</FieldHelp>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-subtle p-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Referral offer</Label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOffer}
                onChange={(e) => setShowOffer(e.target.checked)}
              />
              Show offer block
            </label>
          </div>
          <p className="text-sm text-muted">
            {defaults.offerText
              ? defaults.offerText
              : "No active referral discount for your account — the offer block stays hidden even when enabled."}
          </p>
          <FieldHelp>
            Highlight box above the signup button (accent border). Copy comes from your live referral
            discount settings and cannot be edited here.
          </FieldHelp>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Testimonial quote (optional)</Label>
            <Counter value={testimonialQuote.length} max={PARTNER_LANDING_LIMITS.testimonialQuote} />
          </div>
          <Textarea
            rows={3}
            value={testimonialQuote}
            onChange={(e) => setTestimonialQuote(e.target.value)}
            placeholder={`Why ${brandName} recommends ShootPortal`}
            maxLength={PARTNER_LANDING_LIMITS.testimonialQuote}
          />
          <FieldHelp>Optional quote block at the bottom of the left column. Leave blank to hide.</FieldHelp>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Testimonial attribution (optional)</Label>
            <Counter
              value={testimonialAttribution.length}
              max={PARTNER_LANDING_LIMITS.testimonialAttribution}
            />
          </div>
          <Input
            className="min-h-11"
            value={testimonialAttribution}
            onChange={(e) => setTestimonialAttribution(e.target.value)}
            placeholder={brandName}
            maxLength={PARTNER_LANDING_LIMITS.testimonialAttribution}
          />
          <FieldHelp>Name shown under the testimonial quote (e.g. your studio).</FieldHelp>
        </div>

        {mode === "admin" ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active (inactive landings 404 and set no cookie)
          </label>
        ) : null}
      </CardContent>
    </Card>
      }
      formFooter={
        <Button
          type="button"
          variant="accent"
          className="min-h-11 w-full sm:w-auto"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save landing page"}
        </Button>
      }
      canvas={
        <LandingEditorPreviewFrame>
          <PartnerLandingPublicView content={previewContent} />
        </LandingEditorPreviewFrame>
      }
    />
  );
}
