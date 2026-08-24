"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  PARTNER_LANDING_LIMITS,
  type PartnerLandingDefaults,
} from "@/lib/partner-landing.constants";
import type { PartnerLandingPageRow } from "@/lib/partner-landing";

type Mode = "partner" | "admin";

type Props = {
  mode: Mode;
  partnerId: string;
  brandName: string;
  initial: PartnerLandingPageRow | null;
  defaults: PartnerLandingDefaults;
  suggestedSlug?: string;
  previewPath?: string | null;
  updatedAt?: string | null;
  updatedByLabel?: string | null;
};

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
  updatedAt,
  updatedByLabel,
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

  const previewHref = previewPath ?? (slug ? `/${slug}` : null);

  async function save() {
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
      let data: { error?: string; url?: string };
      try {
        data = JSON.parse(text) as { error?: string; url?: string };
      } catch {
        throw new Error(text || "Upload failed");
      }
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (kind === "logo") setLogoUrl(data.url ?? "");
      else setPhotoUrl(data.url ?? "");
      toast.success(kind === "logo" ? "Logo uploaded" : "Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  if (mode === "partner" && !initial) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom landing page</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">
          Your custom landing page has not been activated yet. Contact ShootPortal support to set
          up your URL — then you can customize messaging and branding here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custom landing page</CardTitle>
        <p className="text-sm text-muted">
          Plain text only — no HTML. Empty fields use strong ShootPortal defaults at render time.
          {mode === "admin" ? (
            <>
              {" "}
              Apex at <code className="text-xs">/{slug || "slug"}</code>. Sets referral cookie with
              source <code className="text-xs">landing_page</code>.
            </>
          ) : null}
        </p>
        {previewHref ? (
          <p className="text-sm">
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:underline"
            >
              Preview your page ↗
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
              <span className="text-xs text-muted">Contact support to change</span>
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Brand primary color</Label>
              <FieldReset onReset={() => setBrandPrimary("")} disabled={!brandPrimary} />
            </div>
            <Input
              className="min-h-11 font-mono"
              value={brandPrimary}
              onChange={(e) => setBrandPrimary(e.target.value)}
              placeholder={defaults.brandPrimaryColor}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Brand accent color</Label>
              <FieldReset onReset={() => setBrandAccent("")} disabled={!brandAccent} />
            </div>
            <Input
              className="min-h-11 font-mono"
              value={brandAccent}
              onChange={(e) => setBrandAccent(e.target.value)}
              placeholder={defaults.brandAccentColor}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Logo</Label>
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
                <Button type="button" variant="ghost" size="sm" onClick={() => setPhotoUrl("")}>
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
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Benefits</Label>
            <FieldReset
              onReset={() => setBenefits([])}
              disabled={benefits.every((b) => !b.trim())}
            />
          </div>
          <p className="text-xs text-muted">
            Leave all empty for defaults, or enter {PARTNER_LANDING_LIMITS.benefitsMin}–
            {PARTNER_LANDING_LIMITS.benefitsMax} bullets.
          </p>
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
          <p className="text-xs text-muted">
            Offer copy is generated from your live referral discount settings and cannot be edited
            here.
          </p>
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

        <Button
          type="button"
          variant="accent"
          className="min-h-11"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save landing page"}
        </Button>
      </CardContent>
    </Card>
  );
}
