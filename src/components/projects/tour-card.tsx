"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, Rotate3d } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Tour } from "@/lib/types";
import { getTourEmbedUrl } from "@/lib/tour-url";

interface TourCardProps {
  tour: Tour;
  embedInPortal?: boolean;
}

export function TourCard({ tour, embedInPortal }: TourCardProps) {
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  // `kuula_url` is the legacy column name; it holds any provider's tour link.
  const tourUrl = tour.kuula_url;
  const embedUrl = tour.embed_code ? null : getTourEmbedUrl(tourUrl);

  async function copyToClipboard(text: string, type: "link" | "embed") {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      {embedInPortal && (
        <div className="aspect-video w-full bg-slate-900">
          {tour.embed_code ? (
            <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: tour.embed_code }} />
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              className="h-full w-full border-0"
              allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
              allowFullScreen
              title={tour.tour_name}
            />
          ) : (
            // Host not known to allow embedding: a link instead of a possibly broken iframe.
            <a
              href={tourUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex h-full w-full items-center justify-center overflow-hidden"
            >
              {tour.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tour.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-50" />
              ) : null}
              <span className="relative inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-transform group-hover:scale-105">
                <Rotate3d className="h-4 w-4" /> Open 360 Tour
              </span>
            </a>
          )}
        </div>
      )}
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-foreground">{tour.tour_name}</h3>
            <p className="mt-1 text-sm text-muted">Interactive 360° virtual tour</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={tourUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="accent" size="sm">
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </Button>
            </a>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(tourUrl, "link")}>
              {copied === "link" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              Copy Tour Link
            </Button>
            {tour.embed_code && (
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(tour.embed_code!, "embed")}>
                {copied === "embed" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                Copy Embed Code
              </Button>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 surface-dark:bg-subtle p-4 text-sm text-muted">
            <p className="font-medium text-foreground mb-2">How to use your 360° tour:</p>
            {tour.notes && <p className="mb-2 text-foreground">{tour.notes}</p>}
            <ul className="list-disc list-inside space-y-1">
              <li>{embedUrl || tour.embed_code ? "View the tour above directly in your portal" : "Open the tour in a new tab to explore it"}</li>
              <li>Share the tour link with buyers or on social media</li>
              <li>Use the embed code to add the tour to your website or MLS listing</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
