import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getArticle, getCategoryLabel } from "@/lib/blog/registry";
import { SITE, SITE_ICONS } from "@/lib/site-metadata";

export const alt = `${SITE.name} Blog`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Per-article social card: category, title, and the ShootPortal wordmark on the brand gradient. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  const title = article?.title ?? `${SITE.name} Blog`;
  const category = article ? getCategoryLabel(article.category) : "Blog";

  const [logo, interBold] = await Promise.all([
    readFile(join(process.cwd(), "public", SITE_ICONS.logoWhite.replace(/^\//, ""))),
    readFile(join(process.cwd(), "public", "fonts", "Inter-Bold.ttf")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(ellipse 70% 80% at 90% 0%, rgba(99,102,241,0.55), transparent 60%), radial-gradient(ellipse 60% 60% at 0% 100%, rgba(139,92,246,0.4), transparent 60%), #0B1124",
          fontFamily: "Inter",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src={logoSrc} width={222} height={74} alt="" />
          <div
            style={{
              display: "flex",
              padding: "10px 22px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.08)",
              fontSize: 24,
              color: "#E0E7FF",
            }}
          >
            {category}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: title.length > 70 ? 54 : 62, lineHeight: 1.12, letterSpacing: -1.5, maxWidth: 1000 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#A5B4FC" }}>shootportal.app/blog</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Inter", data: interBold, weight: 700, style: "normal" }] }
  );
}
