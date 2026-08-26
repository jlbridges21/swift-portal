"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MARKETING_BRAND } from "@/lib/marketing";

type FieldErrors = Partial<Record<string, string>>;

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function PartnerApplyForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [brandName, setBrandName] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [otherSocial, setOtherSocial] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [promotionPlan, setPromotionPlan] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<"auto" | "pending" | null>(null);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!email.trim() || !isEmail(email)) next.email = "Enter a valid email.";
    if (!brandName.trim()) next.brandName = "Brand or business name is required.";
    if (!promotionPlan.trim()) {
      next.promotionPlan = "Tell us how you plan to promote ShootPortal.";
    }
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const socialLinks: Record<string, string> = {};
      if (instagram.trim()) socialLinks.instagram = instagram.trim();
      if (youtube.trim()) socialLinks.youtube = youtube.trim();
      if (tiktok.trim()) socialLinks.tiktok = tiktok.trim();
      if (otherSocial.trim()) socialLinks.other = otherSocial.trim();

      const res = await fetch("/api/partners/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          brandName: brandName.trim(),
          website: website.trim() || null,
          socialLinks,
          audienceSize: audienceSize.trim() || null,
          promotionPlan: promotionPlan.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        autoApproved?: boolean;
      };
      if (!res.ok) {
        setFormError(data.error || "Unable to submit application. Please try again later.");
        return;
      }
      setSuccess(data.autoApproved === false ? "pending" : "auto");
    } catch {
      setFormError("Unable to submit application. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  if (success === "pending") {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
          Application received
        </p>
        <h3 className="mt-2 text-2xl font-semibold text-[#0F172A]">Thanks, we got it.</h3>
        <p className="mt-3 text-base leading-relaxed text-[#475569]">
          Our team reviews partner applications in the order they arrive. We will email you when
          your application is approved with next steps for your partner account.
        </p>
        <p className="mt-3 text-sm text-[#475569]">
          Questions? Email{" "}
          <a className="underline" href="mailto:hello@shootportal.app">
            hello@shootportal.app
          </a>
          .
        </p>
      </div>
    );
  }

  if (success === "auto") {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
          You&apos;re in
        </p>
        <h3 className="mt-2 text-2xl font-semibold text-[#0F172A]">Welcome to the Partner Program.</h3>
        <p className="mt-3 text-base leading-relaxed text-[#475569]">
          Your partner account is active. Check your email for your referral link and next steps —
          then sign in at <strong>shootportal.app/partner</strong> to open your dashboard.
        </p>
        <p className="mt-3 text-sm text-[#475569]">
          Questions? Email{" "}
          <a className="underline" href="mailto:hello@shootportal.app">
            hello@shootportal.app
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pa-name">Name</Label>
          <Input
            id="pa-name"
            className="min-h-11"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          {errors.name ? <p className="text-sm text-red-600">{errors.name}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pa-email">Email</Label>
          <Input
            id="pa-email"
            type="email"
            className="min-h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {errors.email ? <p className="text-sm text-red-600">{errors.email}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pa-brand">Brand / business name</Label>
          <Input
            id="pa-brand"
            className="min-h-11"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
          {errors.brandName ? <p className="text-sm text-red-600">{errors.brandName}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pa-website">Website (optional)</Label>
          <Input
            id="pa-website"
            className="min-h-11"
            placeholder="https://"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pa-ig">Instagram (optional)</Label>
          <Input
            id="pa-ig"
            className="min-h-11"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@handle or URL"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pa-yt">YouTube (optional)</Label>
          <Input
            id="pa-yt"
            className="min-h-11"
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pa-tt">TikTok (optional)</Label>
          <Input
            id="pa-tt"
            className="min-h-11"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pa-other">Other social (optional)</Label>
          <Input
            id="pa-other"
            className="min-h-11"
            value={otherSocial}
            onChange={(e) => setOtherSocial(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pa-audience">Approximate audience size (optional)</Label>
        <Input
          id="pa-audience"
          className="min-h-11"
          placeholder="e.g. 12k newsletter · 40k Instagram"
          value={audienceSize}
          onChange={(e) => setAudienceSize(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pa-promo">How do you plan to promote ShootPortal?</Label>
        <Textarea
          id="pa-promo"
          rows={3}
          value={promotionPlan}
          onChange={(e) => setPromotionPlan(e.target.value)}
          placeholder="YouTube, newsletter, client referrals…"
        />
        <p className="text-xs text-[#64748B]">Required — a short phrase is fine.</p>
        {errors.promotionPlan ? (
          <p className="text-sm text-red-600">{errors.promotionPlan}</p>
        ) : null}
      </div>

      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

      <Button
        type="submit"
        disabled={busy}
        className="min-h-11 px-6 text-white"
        style={{ backgroundColor: MARKETING_BRAND.indigo }}
      >
        {busy ? "Joining…" : "Become a partner"}
      </Button>
    </form>
  );
}
