"use client";

import { useState } from "react";
import { Image as ImageIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { UploadImageButton } from "@/components/admin/business-website/upload-image-button";
import { WEBSITE_LIMITS, type WebsiteAbout } from "@/lib/website/settings";
import { defaultAboutCopy } from "@/lib/website/view";

function ResetLink({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
      <RotateCcw className="h-3 w-3" /> Use default
    </button>
  );
}

/**
 * Settings → Business Website → About Us. The page is written automatically from what the
 * business already told ShootPortal; every field is optional and blank means "automatic".
 */
export function AboutPanel({
  value,
  onChange,
  businessName,
  serviceNames,
  tagline,
  onPickPhoto,
  onPreview,
}: {
  value: WebsiteAbout;
  onChange: (next: WebsiteAbout) => void;
  businessName: string;
  serviceNames: string[];
  tagline: string;
  /** Open the ShootPortal media picker for the About photo. */
  onPickPhoto: () => void;
  /** Show the About page in the live preview. */
  onPreview: () => void;
}) {
  const [configure, setConfigure] = useState(false);
  const auto = defaultAboutCopy(businessName, serviceNames, tagline);
  const set = (patch: Partial<WebsiteAbout>) => {
    onChange({ ...value, ...patch });
    if (value.enabled || patch.enabled) onPreview();
  };
  const hasPhoto = Boolean(value.imageMedia || value.imageUrl);
  const open = value.enabled || configure;

  return (
    <div className="space-y-5">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Show an About page
          <span className="block text-xs text-muted">Adds “About” to your website menu at /about.</span>
        </span>
        <Switch checked={value.enabled} onCheckedChange={(enabled) => set({ enabled })} />
      </label>

      {!open ? (
        <div className="rounded-lg bg-subtle px-3 py-3 text-xs text-muted">
          We’ve already written a short About page from your business name and services — turn it on to see it, or{" "}
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => setConfigure(true)}>
            edit it first
          </button>
          .
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="about-headline">Headline</Label>
              <ResetLink show={Boolean(value.headline)} onClick={() => set({ headline: "" })} />
            </div>
            <Input id="about-headline" maxLength={WEBSITE_LIMITS.aboutHeadline} value={value.headline} placeholder={auto.headline} onChange={(e) => set({ headline: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="about-intro">Introduction</Label>
              <ResetLink show={Boolean(value.intro)} onClick={() => set({ intro: "" })} />
            </div>
            <Textarea id="about-intro" rows={2} maxLength={WEBSITE_LIMITS.aboutIntro} value={value.intro} placeholder={auto.intro} onChange={(e) => set({ intro: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="about-body">About your business</Label>
              <ResetLink show={Boolean(value.body)} onClick={() => set({ body: "" })} />
            </div>
            <Textarea
              id="about-body"
              rows={7}
              maxLength={WEBSITE_LIMITS.aboutBody}
              value={value.body}
              placeholder={auto.paragraphs.join("\n\n")}
              onChange={(e) => set({ body: e.target.value })}
            />
            <p className="text-xs text-muted">
              Leave blank to use the text shown in gray. Separate paragraphs with a blank line. Your services are listed on the page automatically.
            </p>
            {!value.body ? (
              <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => set({ body: auto.paragraphs.join("\n\n") })}>
                Start from the default text
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Photo (optional)</Label>
            {hasPhoto ? (
              <div className="relative aspect-[4/3] w-40 overflow-hidden rounded-lg border border-border bg-slate-100 surface-dark:bg-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value.imageMedia ? `/api/admin/website/media/${value.imageMedia.id}?s=thumb` : value.imageUrl}
                  alt="About photo"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            ) : (
              <p className="text-xs text-muted">You, your team or your gear. Without one, the page uses a clean text layout.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onPickPhoto}>
                <ImageIcon className="h-4 w-4" /> Select from your media
              </Button>
              <UploadImageButton onUploaded={(imageUrl) => set({ imageUrl, imageMedia: null })} />
              {hasPhoto ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ imageMedia: null, imageUrl: "" })}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          {!value.enabled ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">The page isn’t on your website until you turn it on above.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
