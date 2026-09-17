import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DOWNLOAD_QUALITY_PARAM,
  downloadFileNameForQuality,
  parseDownloadQuality,
  signMlsPhotoDownloadUrl,
  type DownloadQuality,
} from "@/lib/download-quality";
import { downloadFileName } from "@/lib/media-display-name";

type DownloadAsset = {
  id: string;
  file_path: string;
  file_name?: string | null;
  title?: string | null;
  mime_type?: string | null;
  media_type: string;
  file_size?: number | null;
};

/**
 * Serve an attachment download for a storage asset.
 * Photos honor quality=print|mls; other media types ignore quality and download as-is.
 */
export async function serveMediaFileDownload(opts: {
  storage: SupabaseClient;
  bucket: string;
  asset: DownloadAsset;
  searchParams: URLSearchParams;
  inline?: boolean;
  extraHeaders?: HeadersInit;
  onSuccess?: () => void;
}): Promise<NextResponse> {
  const { storage, bucket, asset, searchParams, inline = false, extraHeaders, onSuccess } = opts;
  const quality = parseDownloadQuality(searchParams.get(DOWNLOAD_QUALITY_PARAM));
  const disposition = inline ? "inline" : "attachment";

  // Non-photos: always original bytes (quality ignored).
  if (asset.media_type !== "photo" || quality === "print") {
    const { data: fileData, error: downloadError } = await storage.storage
      .from(bucket)
      .download(asset.file_path);

    if (downloadError || !fileData) {
      console.error("[media/download] storage download failed", {
        mediaId: asset.id,
        bucket,
        path: asset.file_path,
        message: downloadError?.message,
      });
      return NextResponse.json(
        { error: "We couldn't download that file. Please try again or contact support." },
        { status: 500 }
      );
    }

    onSuccess?.();

    const filename =
      asset.media_type === "photo"
        ? downloadFileNameForQuality(asset, "print")
        : downloadFileName(asset);

    return new NextResponse(fileData, {
      headers: {
        ...extraHeaders,
        "Content-Type": asset.mime_type || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=3600",
        ...(asset.media_type === "photo" ? { "X-Download-Quality": "print" } : {}),
      },
    });
  }

  // MLS photo path
  const signed = await signMlsPhotoDownloadUrl(
    storage,
    bucket,
    asset.file_path,
    asset.file_size
  );

  if (!signed.ok) {
    console.error("[media/download] MLS sign failed", {
      mediaId: asset.id,
      message: signed.error,
    });
    return NextResponse.json(
      { error: "We couldn't prepare that MLS download. Please try again or contact support." },
      { status: 500 }
    );
  }

  let fellBack = !signed.transformed;
  let fallbackReason =
    !signed.transformed && "reason" in signed ? signed.reason : undefined;
  let body: ReadableStream<Uint8Array> | Blob | null = null;
  let contentType = asset.mime_type || "image/jpeg";

  if (signed.transformed) {
    const res = await fetch(signed.signedUrl, { cache: "no-store" });
    if (res.ok && res.body) {
      body = res.body;
      contentType = res.headers.get("content-type") || contentType;
    } else {
      console.warn("[media/download] MLS transform fetch failed; falling back to original", {
        mediaId: asset.id,
        status: res.status,
      });
      fellBack = true;
      fallbackReason = "sign_failed_no_transform";
    }
  } else {
    const res = await fetch(signed.signedUrl, { cache: "no-store" });
    if (res.ok && res.body) {
      body = res.body;
      contentType = res.headers.get("content-type") || contentType;
    }
  }

  if (!body) {
    const { data: fileData, error: downloadError } = await storage.storage
      .from(bucket)
      .download(asset.file_path);
    if (downloadError || !fileData) {
      console.error("[media/download] MLS fallback download failed", {
        mediaId: asset.id,
        message: downloadError?.message,
      });
      return NextResponse.json(
        { error: "We couldn't download that file. Please try again or contact support." },
        { status: 500 }
      );
    }
    body = fileData;
    fellBack = true;
    fallbackReason = fallbackReason ?? "sign_failed_no_transform";
  }

  onSuccess?.();

  const filename = downloadFileNameForQuality(asset, "mls", {
    mlsFellBackToPrint: fellBack,
  });

  return new NextResponse(body, {
    headers: {
      ...extraHeaders,
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Download-Quality": fellBack ? "print-fallback" : "mls",
      ...(fellBack && fallbackReason
        ? { "X-Download-Quality-Reason": fallbackReason }
        : {}),
    },
  });
}

export function qualityFromRequest(request: Request): DownloadQuality {
  return parseDownloadQuality(new URL(request.url).searchParams.get(DOWNLOAD_QUALITY_PARAM));
}
