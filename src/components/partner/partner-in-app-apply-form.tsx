"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PartnerApplyPrefill } from "@/lib/partner-entry";

type FieldErrors = Partial<Record<string, string>>;

export function PartnerInAppApplyForm({ prefill }: { prefill: PartnerApplyPrefill }) {
  const router = useRouter();
  const [name, setName] = useState(prefill.name);
  const [brandName, setBrandName] = useState(prefill.brandName);
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

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Name is required.";
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

      const res = await fetch("/api/partner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: prefill.email,
          brandName: brandName.trim(),
          website: website.trim() || null,
          socialLinks,
          audienceSize: audienceSize.trim() || null,
          promotionPlan: promotionPlan.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
        autoApproved?: boolean;
      };
      if (!res.ok) {
        setFormError(data.error || "Unable to submit application. Please try again later.");
        return;
      }
      if (data.redirectTo || data.autoApproved) {
        router.push(data.redirectTo || "/partner/dashboard");
      }
      router.refresh();
    } catch {
      setFormError("Unable to submit application. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ipa-name">Name</Label>
          <Input
            id="ipa-name"
            className="min-h-11"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          {errors.name ? <p className="text-sm text-red-600">{errors.name}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ipa-email">Email</Label>
          <Input
            id="ipa-email"
            type="email"
            className="min-h-11 bg-subtle/50"
            value={prefill.email}
            readOnly
            aria-readonly
          />
          <p className="text-xs text-muted">Must match your signed-in account.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ipa-brand">Brand / business name</Label>
          <Input
            id="ipa-brand"
            className="min-h-11"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
          {errors.brandName ? <p className="text-sm text-red-600">{errors.brandName}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ipa-website">Website (optional)</Label>
          <Input
            id="ipa-website"
            className="min-h-11"
            placeholder="https://"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ipa-ig">Instagram (optional)</Label>
          <Input
            id="ipa-ig"
            className="min-h-11"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@handle or URL"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ipa-yt">YouTube (optional)</Label>
          <Input
            id="ipa-yt"
            className="min-h-11"
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ipa-tt">TikTok (optional)</Label>
          <Input
            id="ipa-tt"
            className="min-h-11"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ipa-other">Other social (optional)</Label>
          <Input
            id="ipa-other"
            className="min-h-11"
            value={otherSocial}
            onChange={(e) => setOtherSocial(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ipa-audience">Approximate audience size (optional)</Label>
        <Input
          id="ipa-audience"
          className="min-h-11"
          placeholder="e.g. 12k newsletter · 40k Instagram"
          value={audienceSize}
          onChange={(e) => setAudienceSize(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ipa-promo">How do you plan to promote ShootPortal?</Label>
        <Textarea
          id="ipa-promo"
          rows={3}
          value={promotionPlan}
          onChange={(e) => setPromotionPlan(e.target.value)}
          placeholder="YouTube, newsletter, client referrals…"
        />
        <p className="text-xs text-muted">Required — a short phrase is fine.</p>
        {errors.promotionPlan ? (
          <p className="text-sm text-red-600">{errors.promotionPlan}</p>
        ) : null}
      </div>

      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

      <Button type="submit" disabled={busy} variant="accent" className="min-h-11 px-6">
        {busy ? "Joining…" : "Become a partner"}
      </Button>
    </form>
  );
}
