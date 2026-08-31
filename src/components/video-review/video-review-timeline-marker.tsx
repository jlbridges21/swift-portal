"use client";

import { useId, useState } from "react";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { formatReviewTimestamp } from "@/lib/video-review-format";
import { computeClusterMarkerAppearance } from "@/lib/video-review-timeline-marker-style";
import {
  clusterMarkerTooltip,
  type TimelineMarkerCluster,
} from "@/lib/video-review-timeline-markers";
import type { VideoReviewCommentEnriched } from "@/lib/video-review-comment-model";
import { cn } from "@/lib/utils";

interface VideoReviewTimelineMarkerProps {
  cluster: TimelineMarkerCluster;
  leftPct: number;
  repliesByCommentId: Map<string, VideoReviewCommentEnriched[]>;
  onActivate: (cluster: TimelineMarkerCluster) => void;
}

export function VideoReviewTimelineMarker({
  cluster,
  leftPct,
  repliesByCommentId,
  onActivate,
}: VideoReviewTimelineMarkerProps) {
  const [tipOpen, setTipOpen] = useState(false);
  const tipId = useId();
  const brand = usePortalBrand();
  const { extraCount, ariaLabel, lines } = clusterMarkerTooltip(cluster);
  const { fill, border, boxShadow } = computeClusterMarkerAppearance(
    cluster,
    repliesByCommentId,
    brand.primaryColor,
    brand.accentColor
  );

  return (
    <button
      type="button"
      className={cn(
        "absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2",
        "rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      )}
      style={{ left: `${leftPct}%` }}
      aria-label={`${ariaLabel} at ${formatReviewTimestamp(cluster.anchorSeconds)}`}
      aria-describedby={tipOpen ? tipId : undefined}
      onMouseEnter={() => setTipOpen(true)}
      onMouseLeave={() => setTipOpen(false)}
      onFocus={() => setTipOpen(true)}
      onBlur={() => setTipOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setTipOpen(true);
        onActivate(cluster);
      }}
    >
      <span className="relative flex items-center justify-center">
        <span
          className="block h-3 w-3 rounded-full"
          style={{
            backgroundColor: fill,
            boxShadow,
          }}
          aria-hidden
          data-marker-fill={fill}
          data-marker-border={border ?? "none"}
        />
        {extraCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-slate-800 px-0.5 text-[8px] font-bold leading-none text-white">
            +{extraCount}
          </span>
        )}
      </span>
      {tipOpen && (
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-2 text-left text-[11px] leading-snug text-white shadow-lg"
        >
          {lines.map((line, index) => (
            <span key={`${line.author}-${index}`} className={cn(index > 0 && "mt-1.5 block border-t border-white/20 pt-1.5")}>
              <span className="block font-semibold">{line.author}</span>
              <span className="block text-white/85">{line.preview}</span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
