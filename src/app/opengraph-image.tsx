import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE, SITE_ICONS } from "@/lib/site-metadata";

// TODO(tenant): per-business PWA manifest and OG images — later phase
export const alt = SITE.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const brandBuffer = await readFile(join(process.cwd(), "public", SITE_ICONS.ogBrand.replace(/^\//, "")));
  const brandSrc = `data:image/png;base64,${brandBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F172A",
        }}
      >
        <img
          src={brandSrc}
          width={1200}
          height={630}
          alt=""
          style={{ objectFit: "cover" }}
        />
      </div>
    ),
    { ...size }
  );
}
