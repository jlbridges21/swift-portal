"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { PartnerLandingPageRow } from "@/lib/partner-landing";

type Props = {
  partnerId: string;
  initial: PartnerLandingPageRow | null;
  suggestedSlug?: string;
};

export function PartnerLandingEditor({ partnerId, initial, suggestedSlug }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState(initial?.slug ?? suggestedSlug ?? "");
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? "");
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? "Start free trial");
  const [offerText, setOfferText] = useState(initial?.offer_text ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/partners/${partnerId}/landing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          headline,
          description,
          photoUrl: photoUrl || null,
          ctaLabel,
          offerText: offerText || null,
          isActive,
        }),
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custom landing page</CardTitle>
        <p className="text-sm text-muted">
          Apex only at <code className="text-xs">/{slug || "slug"}</code>. Plain text — no HTML.
          Sets the referral cookie with source <code className="text-xs">landing_page</code>.
          Pages are noindex and excluded from the sitemap.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Slug</Label>
            <Input
              className="min-h-11 font-mono"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="acme-media"
            />
          </div>
          <div className="space-y-1">
            <Label>CTA label</Label>
            <Input
              className="min-h-11"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Headline</Label>
          <Input
            className="min-h-11"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Description</Label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Offer text (optional)</Label>
          <Input
            className="min-h-11"
            value={offerText}
            onChange={(e) => setOfferText(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Photo URL (https, optional)</Label>
          <Input
            className="min-h-11"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (inactive landings 404 and set no cookie)
        </label>
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
