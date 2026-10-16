import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSolutionPage, type SolutionKey } from "@/lib/solutions";
import { SITE_ICONS } from "@/lib/site-metadata";

export const SOLUTION_OG_SIZE = { width: 1200, height: 630 };

const HEADLINES: Record<SolutionKey, string> = {
  "real-estate-software": "Real estate photography software for the whole job",
  "drone-software": "Business software for commercial drone pilots",
  "client-portal": "A branded client portal for photographers",
  crm: "The CRM built around agents and properties",
  "media-delivery": "Photo and video delivery, review, and paid downloads",
  booking: "From client request to confirmed shoot",
  invoicing: "Estimates, deposits, and payments on every project",
  "video-review": "Client video feedback on the exact frame",
  workflow: "Automate the busywork. Organize the rest.",
  "business-management": "Run your photography business from one place",
};

const AUDIENCE: Record<SolutionKey, string> = {
  "real-estate-software": "For real estate photographers",
  "drone-software": "For commercial drone pilots",
  "client-portal": "For photographers & videographers",
  crm: "For real estate photographers",
  "media-delivery": "For photographers & videographers",
  booking: "Photography booking software",
  invoicing: "Photography invoicing software",
  "video-review": "Video review software",
  workflow: "For real estate media businesses",
  "business-management": "Photography business software",
};

/** Social preview for a Solutions page: brand mark, audience label, headline. */
export async function renderSolutionOg(key: SolutionKey) {
  getSolutionPage(key);
  const [logo, interBold] = await Promise.all([
    readFile(join(process.cwd(), "public", SITE_ICONS.logoWhite.replace(/^\//, ""))),
    readFile(join(process.cwd(), "public", "fonts", "Inter-Bold.ttf")),
  ]);
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
            "radial-gradient(ellipse 70% 80% at 90% 0%, rgba(99,102,241,0.6), transparent 60%), radial-gradient(ellipse 60% 60% at 0% 100%, rgba(168,85,247,0.4), transparent 60%), #0B1124",
          fontFamily: "Inter",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders <img> into the PNG; next/image does not apply */}
          <img src={`data:image/png;base64,${logo.toString("base64")}`} width={222} height={74} alt="" />
          <div style={{ display: "flex", padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.08)", fontSize: 24, color: "#E0E7FF" }}>
            {AUDIENCE[key]}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 64, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1000 }}>{HEADLINES[key]}</div>
        <div style={{ display: "flex", fontSize: 26, color: "#A5B4FC" }}>Request → Estimate → Schedule → Shoot → Review → Pay → Deliver</div>
      </div>
    ),
    { ...SOLUTION_OG_SIZE, fonts: [{ name: "Inter", data: interBold, weight: 700, style: "normal" }] }
  );
}
