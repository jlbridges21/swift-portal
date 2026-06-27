"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { MediaAsset, Tour, AssetReview } from "@/lib/types";
import { Check, X, MessageSquare, Images, Clapperboard, Globe, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DeliverableReviewProps {
  projectId: string;
  photos: MediaAsset[];
  videos: MediaAsset[];
  tours: Tour[];
  documents: MediaAsset[];
  reviews: AssetReview[];
  isPreview?: boolean;
}

function isJpgOrPng(asset: MediaAsset): boolean {
  const mime = asset.mime_type?.toLowerCase() ?? "";
  if (mime === "image/jpeg" || mime === "image/png") return true;
  const ext = asset.file_name.split(".").pop()?.toLowerCase() ?? "";
  return ext === "jpg" || ext === "jpeg" || ext === "png";
}

function PhotoReviewThumb({ assetId, fileName }: { assetId: string; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/media/download/${assetId}?thumb=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.url) setUrl(d.url);
        else if (!cancelled) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-black/5">
      {url ? (
        <Image src={url} alt={fileName} fill className="object-cover" sizes="64px" />
      ) : failed ? (
        <div className="flex h-full items-center justify-center">
          <Images className="h-5 w-5 text-muted" />
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-slate-200" />
      )}
    </div>
  );
}

export function DeliverableReview({
  projectId,
  photos,
  videos,
  tours,
  documents,
  reviews: initialReviews,
  isPreview,
}: DeliverableReviewProps) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);

  const allItems = [
    ...photos.map((p) => ({
      type: "photo" as const,
      id: p.id,
      name: p.file_name,
      icon: Images,
      asset: p,
    })),
    ...videos.map((v) => ({
      type: "video" as const,
      id: v.id,
      name: v.file_name,
      icon: Clapperboard,
      asset: null as MediaAsset | null,
    })),
    ...tours.map((t) => ({
      type: "tour" as const,
      id: t.id,
      name: t.tour_name,
      icon: Globe,
      asset: null as MediaAsset | null,
    })),
    ...documents.map((d) => ({
      type: "document" as const,
      id: d.id,
      name: d.file_name,
      icon: FileText,
      asset: d,
    })),
  ];

  if (allItems.length === 0) return null;

  function getReview(assetType: string, assetId: string) {
    return reviews.find((r) => r.asset_type === assetType && r.asset_id === assetId);
  }

  async function submitReview(assetType: string, assetId: string, status: "approved" | "rejected") {
    const key = `${assetType}:${assetId}`;
    if (reviewingKey) return;
    setReviewingKey(key);
    try {
      const res = await fetch("/api/asset-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          project_id: projectId,
          asset_type: assetType,
          asset_id: assetId,
          status,
          feedback: feedbackMap[key] || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setReviews((prev) => {
          const filtered = prev.filter((r) => !(r.asset_type === assetType && r.asset_id === assetId));
          return [...filtered, updated];
        });
        toast.success(status === "approved" ? "Approved" : "Feedback submitted");
        setExpandedFeedback(null);
        router.refresh();
      } else {
        toast.error("Failed to submit review");
      }
    } finally {
      setReviewingKey(null);
    }
  }

  return (
    <Card className="shadow-sm border-purple-200" id="deliverable-review">
      <CardHeader>
        <CardTitle className="text-base">Review Deliverables</CardTitle>
        <p className="text-sm text-muted">Approve each item or provide feedback for changes.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {allItems.map((item) => {
          const review = getReview(item.type, item.id);
          const key = `${item.type}:${item.id}`;
          const isRejected = review?.status === "rejected";
          const isApproved = review?.status === "approved";
          const Icon = item.icon;
          const showPhotoThumb =
            item.type === "photo" && item.asset && isJpgOrPng(item.asset);

          return (
            <div
              key={key}
              className={cn(
                "rounded-lg border p-4 transition-colors",
                isRejected && "border-red-300 bg-red-50/80",
                isApproved && "border-emerald-200 bg-emerald-50/50",
                !review && "border-border"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {showPhotoThumb ? (
                    <PhotoReviewThumb assetId={item.id} fileName={item.name} />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 ring-1 ring-black/5">
                      <Icon className={cn("h-6 w-6", isRejected ? "text-red-500" : "text-muted")} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted capitalize">{item.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isApproved && <Badge variant="success">Approved</Badge>}
                  {isRejected && <Badge variant="danger">Changes Requested</Badge>}
                  {!isPreview && !isApproved && (
                    <>
                      <Button
                        variant="accent"
                        size="sm"
                        disabled={!!reviewingKey}
                        onClick={() => submitReview(item.type, item.id, "approved")}
                      >
                        {reviewingKey === key ? "Approving…" : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedFeedback(expandedFeedback === key ? null : key)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {review?.feedback && (
                <p className="mt-2 text-sm text-red-700 bg-red-50 rounded p-2">{review.feedback}</p>
              )}
              {expandedFeedback === key && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <Textarea
                    placeholder="Describe what you'd like changed..."
                    value={feedbackMap[key] || ""}
                    onChange={(e) => setFeedbackMap({ ...feedbackMap, [key]: e.target.value })}
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200"
                    disabled={!!reviewingKey}
                    onClick={() => submitReview(item.type, item.id, "rejected")}
                  >
                    <X className="h-3.5 w-3.5" /> {reviewingKey === key ? "Submitting..." : "Submit Feedback"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
