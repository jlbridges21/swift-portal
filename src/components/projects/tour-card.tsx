"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Tour } from "@/lib/types";
import { embedSrcFromCode, getTourEmbedUrl } from "@/lib/tour-url";
import { TourViewer } from "@/components/tours/tour-viewer";

interface TourCardProps {
  tour: Tour;
  embedInPortal?: boolean;
  /** Server-resolved iframe URL (resolveTourEmbedUrl). Omitted: decided from the saved link/embed code. */
  embedUrl?: string | null;
}

export function TourCard({ tour, embedInPortal, embedUrl: resolvedEmbedUrl }: TourCardProps) {
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  // `kuula_url` is the legacy column name; it holds any provider's tour link.
  const tourUrl = tour.kuula_url;
  // Only the iframe src of saved embed code is used, never the raw HTML.
  const embedUrl = resolvedEmbedUrl !== undefined ? resolvedEmbedUrl : embedSrcFromCode(tour.embed_code) ?? getTourEmbedUrl(tourUrl);

  async function copyToClipboard(text: string, type: "link" | "embed") {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      {embedInPortal && (
        <TourViewer title={tour.tour_name} url={tourUrl} embedUrl={embedUrl} thumbnailUrl={tour.thumbnail_url} showOpenLink={false} />
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
              <li>{embedUrl ? "View the tour above directly in your portal" : "Open the tour in a new tab to explore it"}</li>
              <li>Share the tour link with buyers or on social media</li>
              <li>Use the embed code to add the tour to your website or MLS listing</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
