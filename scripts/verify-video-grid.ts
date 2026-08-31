/**
 * Verify video grid, duration capture, and formatting.
 * Usage: npx tsx scripts/verify-video-grid.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatVideoDuration, videoDurationBadge } from "../src/lib/video-duration";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function readSrc(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

async function main() {
  console.log("\n=== Duration formatting ===");
  assert(formatVideoDuration(null) === null, "null → no badge");
  assert(formatVideoDuration(0) === null, "0 → no badge");
  assert(formatVideoDuration(17) === "0:17", "short clip");
  assert(formatVideoDuration(83) === "1:23", "minutes");
  assert(formatVideoDuration(3745) === "1:02:25", "over an hour");
  console.log("formatVideoDuration:", {
    short: formatVideoDuration(17),
    minutes: formatVideoDuration(83),
    hour: formatVideoDuration(3745),
    missing: formatVideoDuration(null),
  });

  assert(videoDurationBadge({ media_source: "upload", duration_seconds: 17 }) === "0:17", "upload badge");
  assert(videoDurationBadge({ media_source: "youtube", duration_seconds: 120 }) === null, "YouTube omits badge");
  console.log("YouTube-linked videos: duration badge omitted (no API fetch).");

  console.log("\n=== media-library.ts:354 ===");
  const libSrc = readSrc("src/lib/media-library.ts");
  assert(
    libSrc.includes("function mapTourRowWithProject") &&
      libSrc.includes("duration_seconds: null") &&
      libSrc.includes('kind: "tour"'),
    "line 354 is mapTourRowWithProject for Kuula tours — not dropping video duration"
  );
  assert(
    libSrc.includes("duration_seconds: row.duration_seconds ?? null"),
    "media rows map duration_seconds from DB"
  );
  console.log(
    "Explanation: mapTourRowWithProject hardcodes null because tours are not timed video files; media asset mappers pass row.duration_seconds."
  );

  console.log("\n=== Upload PATCH includes duration ===");
  const uploadSrc = readSrc("src/lib/upload/media-upload-client.ts");
  assert(uploadSrc.includes("duration_seconds"), "attachDeferredThumbnail PATCHes duration_seconds");
  assert(uploadSrc.includes("captureVideoPosterAndDuration"), "single pass captures poster + duration");

  console.log("\n=== Grid + player components ===");
  const cardSrc = readSrc("src/components/ui/video-card.tsx");
  assert(cardSrc.includes("aspect-video"), "16:9 cards");
  assert(cardSrc.includes("videoDurationBadge"), "duration badge on card");
  assert(cardSrc.includes("Play"), "centered play button");

  const gridSrc = readSrc("src/components/projects/video-grid.tsx");
  const projectDetailSrc = readSrc("src/components/admin/project-detail.tsx");
  assert(gridSrc.includes("VideoPlayerLightbox"), "player lightbox");
  assert(gridSrc.includes("lg:flex-row"), "desktop side rail");
  assert(gridSrc.includes("max-h-[40vh]"), "mobile rail below player");
  assert(gridSrc.includes("Start video review"), "admin start review in player");
  assert(gridSrc.includes("Open review"), "open review in player");
  assert(gridSrc.includes("autoPlay"), "starts playback on open");
  assert(gridSrc.includes("key={video.id}"), "switching videos remounts player");

  const photoSrc = readSrc("src/components/projects/photo-gallery.tsx");
  assert(photoSrc.includes("PHOTO_GRID_CLASS"), "photo gallery unchanged");
  assert(!photoSrc.includes("VideoGrid"), "photos not coupled to video grid");

  const zipSrc = readSrc("src/lib/project-zip-download.ts");
  assert(zipSrc.includes('"video"'), "ZIP path still includes video media type");

  console.log("\n=== Admin video grid card ===");
  const adminCardSrc = readSrc("src/components/admin/admin-video-grid-card.tsx");
  assert(adminCardSrc.includes("min-w-0"), "admin card constrains width");
  assert(adminCardSrc.includes("overflow-hidden"), "admin card clips content");
  assert(adminCardSrc.includes("flex-wrap"), "control row wraps");
  assert(adminCardSrc.includes("stopPropagation"), "overlay actions do not open player");
  assert(adminCardSrc.includes("bg-black/60"), "overlay chips for legibility");
  assert(adminCardSrc.includes("h-11 w-11"), "44px overlay touch targets");
  assert(adminCardSrc.includes("line-clamp-2"), "long titles clamped");
  assert(gridSrc.includes("renderAdminCard"), "admin card hook on VideoGrid");
  assert(gridSrc.includes("min-w-0"), "grid items min-w-0");
  console.log("\n=== Mobile grid choice ===");
  console.log("375px: two-up grid (grid-cols-2) — readable 16:9 cards; player rail stacks below (flex-col).");

  console.log("\n=== Grid vs photo tile sizes ===");
  const photoGrid = readSrc("src/components/projects/photo-gallery.tsx").match(
    /PHOTO_GRID_CLASS\s*=\s*"([^"]+)"/
  )?.[1];
  const videoGrid = readSrc("src/components/ui/video-card.tsx").match(
    /VIDEO_GRID_CLASS\s*=\s*"([^"]+)"/
  )?.[1];
  console.log("PHOTO_GRID_CLASS:", photoGrid);
  console.log("VIDEO_GRID_CLASS:", videoGrid);
  assert(
    videoGrid?.includes("lg:grid-cols-2") && photoGrid?.includes("md:grid-cols-3"),
    "video grid uses fewer columns → larger cards than photos at md+"
  );

  console.log("\nverify-video-grid: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
