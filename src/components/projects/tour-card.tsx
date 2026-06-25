"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Tour } from "@/lib/types";
import { getKuulaEmbedUrl } from "@/lib/kuula";

interface TourCardProps {
  tour: Tour;
  embedInPortal?: boolean;
}

export function TourCard({ tour, embedInPortal }: TourCardProps) {
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const embedUrl = tour.embed_code
    ? null
    : getKuulaEmbedUrl(tour.kuula_url);

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
          ) : (
            <iframe
              src={embedUrl || tour.kuula_url}
              className="h-full w-full border-0"
              allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
              allowFullScreen
              title={tour.tour_name}
            />
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
            <a href={tour.kuula_url} target="_blank" rel="noopener noreferrer">
              <Button variant="accent" size="sm">
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </Button>
            </a>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(tour.kuula_url, "link")}>
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

          <div className="rounded-lg bg-slate-50 p-4 text-sm text-muted">
            <p className="font-medium text-foreground mb-2">How to use your 360° tour:</p>
            {tour.notes && <p className="mb-2 text-foreground">{tour.notes}</p>}
            <ul className="list-disc list-inside space-y-1">
              <li>View the tour above directly in your portal</li>
              <li>Share the tour link with buyers or on social media</li>
              <li>Use the embed code to add the tour to your website or MLS listing</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
