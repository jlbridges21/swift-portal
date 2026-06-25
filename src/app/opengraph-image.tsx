import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE, SITE_THEME_COLOR } from "@/lib/site-metadata";

export const alt = SITE.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const iconBuffer = await readFile(join(process.cwd(), "public/icons/icon-512.png"));
  const iconSrc = `data:image/png;base64,${iconBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: SITE_THEME_COLOR,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} width={200} height={200} alt="" />
        <div
          style={{
            marginTop: 40,
            fontSize: 56,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
          }}
        >
          {SITE.name}
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: "#94a3b8",
          }}
        >
          {SITE.company}
        </div>
      </div>
    ),
    { ...size }
  );
}
