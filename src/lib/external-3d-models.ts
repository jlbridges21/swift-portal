/**
 * External 3D model embeds — third-party viewer URLs (not stored media).
 * URL gate reuses parseStrictHttpsUrl from landing-content (same scheme /
 * credentials / https rules). Do not weaken that helper.
 */

import { parseStrictHttpsUrl } from "@/lib/landing-content";

export const EXTERNAL_3D_PROVIDERS = [
  "polycam",
  "agisoft",
  "pix4d",
  "sketchfab",
  "matterport",
  "dronedeploy",
  "cesium",
  "arcgis",
  "mipmap",
] as const;

export type External3dProvider = (typeof EXTERNAL_3D_PROVIDERS)[number];

export const EXTERNAL_3D_PROVIDER_LABELS: Record<External3dProvider, string> = {
  polycam: "Polycam",
  agisoft: "Agisoft Cloud",
  pix4d: "PIX4Dcloud",
  sketchfab: "Sketchfab",
  matterport: "Matterport",
  dronedeploy: "DroneDeploy",
  cesium: "Cesium ion",
  arcgis: "ArcGIS Scene Viewer",
  mipmap: "MipMap",
};

/** Exact hostnames accepted for embeds (HTTPS only). */
export const EXTERNAL_3D_PROVIDER_HOSTS: Record<External3dProvider, readonly string[]> = {
  polycam: ["poly.cam", "www.poly.cam"],
  agisoft: ["cloud.agisoft.com"],
  pix4d: ["cloud.pix4d.com"],
  sketchfab: ["sketchfab.com", "www.sketchfab.com"],
  matterport: ["my.matterport.com", "matterport.com", "www.matterport.com"],
  dronedeploy: [
    "www.dronedeploy.com",
    "dronedeploy.com",
    "app.dronedeploy.com",
    "public.dronedeploy.com",
  ],
  cesium: ["ion.cesium.com", "sandcastle.cesium.com"],
  arcgis: ["www.arcgis.com", "arcgis.com", "scene.arcgis.com"],
  // North America cloud instance only. eu/ap and bare mipmap3d.com do not
  // resolve to a viewer (apex/www are the China marketing site).
  mipmap: ["na.mipmap3d.com"],
};

const ALL_ALLOWED_HOSTS: readonly string[] = Array.from(
  new Set(Object.values(EXTERNAL_3D_PROVIDER_HOSTS).flat())
);

export const EXTERNAL_3D_SUPPORTED_LIST = EXTERNAL_3D_PROVIDERS.map(
  (p) => EXTERNAL_3D_PROVIDER_LABELS[p]
).join(", ");

export type External3dNormalizeResult =
  | {
      ok: true;
      provider: External3dProvider;
      embedUrl: string;
      /** True when share URL was rewritten to an embed form. */
      normalized: boolean;
      /** Human summary for admin UI, e.g. "Sketchfab model — will embed". */
      message: string;
      /**
       * Iframe sandbox tokens. All listed providers need scripts for WebGL;
       * same-origin is required by Sketchfab / Matterport / Polycam players
       * (cookies + WASM). Do not add allow-top-navigation.
       */
      sandbox: string;
      /** iframe allow attribute. */
      allow: string;
    }
  | {
      ok: false;
      error: string;
      /** Supported host but no known share→embed mapping. */
      needsManualEmbed?: boolean;
      provider?: External3dProvider;
    };

function providerForHost(host: string): External3dProvider | null {
  for (const p of EXTERNAL_3D_PROVIDERS) {
    if (EXTERNAL_3D_PROVIDER_HOSTS[p].includes(host)) return p;
  }
  return null;
}

/** Sketchfab share page → /models/{id}/embed */
function normalizeSketchfab(url: URL): External3dNormalizeResult | null {
  const parts = url.pathname.split("/").filter(Boolean);
  // /models/{id}/embed
  if (parts[0] === "models" && parts[1] && parts[2] === "embed") {
    return {
      ok: true,
      provider: "sketchfab",
      embedUrl: url.toString(),
      normalized: false,
      message: "Sketchfab model — will embed",
      sandbox: "allow-scripts allow-same-origin allow-popups",
      allow: "fullscreen; xr-spatial-tracking; accelerometer; gyroscope",
    };
  }
  // /models/{id}
  if (parts[0] === "models" && parts[1] && !parts[2]) {
    const embed = new URL(`https://sketchfab.com/models/${parts[1]}/embed`);
    return {
      ok: true,
      provider: "sketchfab",
      embedUrl: embed.toString(),
      normalized: true,
      message: "Sketchfab model — will embed",
      sandbox: "allow-scripts allow-same-origin allow-popups",
      allow: "fullscreen; xr-spatial-tracking; accelerometer; gyroscope",
    };
  }
  // /3d-models/slug-{hexid} — hex id is trailing 32 hex chars
  if (parts[0] === "3d-models" && parts[1]) {
    const m = parts[1].match(/([a-f0-9]{32})$/i);
    if (m) {
      const embed = new URL(`https://sketchfab.com/models/${m[1]}/embed`);
      return {
        ok: true,
        provider: "sketchfab",
        embedUrl: embed.toString(),
        normalized: true,
        message: "Sketchfab model — will embed",
        sandbox: "allow-scripts allow-same-origin allow-popups",
        allow: "fullscreen; xr-spatial-tracking; accelerometer; gyroscope",
      };
    }
    return {
      ok: false,
      error:
        "This Sketchfab link looks like a share page but we could not find a model id to embed. Open the model, use Share → Embed, and paste that URL.",
      needsManualEmbed: true,
      provider: "sketchfab",
    };
  }
  return {
    ok: false,
    error:
      "Supported Sketchfab hosts, but this path is not a known model share or embed URL. Paste a model page or an /embed link.",
    needsManualEmbed: true,
    provider: "sketchfab",
  };
}

/** Matterport show links are already iframe-friendly. */
function normalizeMatterport(url: URL): External3dNormalizeResult {
  const hasModel = url.searchParams.has("m") || /\/show\//.test(url.pathname);
  if (!hasModel && !url.pathname.includes("showcase")) {
    return {
      ok: false,
      error:
        "This Matterport link does not include a model id (?m=…). Open the space and copy the share link from the address bar.",
      needsManualEmbed: true,
      provider: "matterport",
    };
  }
  // Keep show URL; Matterport documents iframe embed of /show/?m=
  if (!url.searchParams.has("play")) url.searchParams.set("play", "1");
  return {
    ok: true,
    provider: "matterport",
    embedUrl: url.toString(),
    normalized: true,
    message: "Matterport space — will embed",
    sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
    allow: "fullscreen; xr-spatial-tracking; accelerometer; gyroscope; autoplay",
  };
}

/** Polycam capture page → embed mode. */
function normalizePolycam(url: URL): External3dNormalizeResult {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "capture" && parts[1]) {
    const id = parts[1];
    const embed = new URL(`https://poly.cam/capture/${id}`);
    embed.searchParams.set("embed", "1");
    return {
      ok: true,
      provider: "polycam",
      embedUrl: embed.toString(),
      normalized: true,
      message: "Polycam model — will embed",
      sandbox: "allow-scripts allow-same-origin",
      allow: "fullscreen; xr-spatial-tracking; accelerometer; gyroscope",
    };
  }
  return {
    ok: false,
    error:
      "Supported Polycam host, but this is not a /capture/{id} link we can convert to an embed. Open the model and paste the capture URL.",
    needsManualEmbed: true,
    provider: "polycam",
  };
}

function passThrough(
  provider: External3dProvider,
  url: URL,
  note: string,
  sandbox = "allow-scripts allow-same-origin allow-popups",
  allow = "fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
): External3dNormalizeResult {
  return {
    ok: true,
    provider,
    embedUrl: url.toString(),
    normalized: false,
    message: note,
    sandbox,
    allow,
  };
}

/**
 * Validate + normalize a pasted 3D viewer URL.
 * Returns embed URL + provider, or a clear error naming supported hosts.
 */
export function normalizeExternal3dUrl(raw: unknown): External3dNormalizeResult {
  const rawText = typeof raw === "string" ? raw.trim() : "";
  if (rawText && /^http:\/\//i.test(rawText)) {
    return {
      ok: false,
      error: "Only https:// links are allowed (no javascript:, data:, or http-only URLs).",
    };
  }
  const parsed = parseStrictHttpsUrl(raw, {
    allowedHosts: ALL_ALLOWED_HOSTS,
    maxLen: 2000,
  });
  if (!parsed.ok) {
    if (parsed.reason === "host" || parsed.reason === "empty" || parsed.reason === "invalid") {
      // Distinguish non-allowlisted host from empty
      const probe = parseStrictHttpsUrl(raw, { maxLen: 2000 });
      if (probe.ok) {
        return {
          ok: false,
          error: `That site is not supported for embedding. Supported: ${EXTERNAL_3D_SUPPORTED_LIST}.`,
        };
      }
    }
    if (parsed.reason === "scheme") {
      return {
        ok: false,
        error: "Only https:// links are allowed (no javascript:, data:, or http-only URLs).",
      };
    }
    if (parsed.reason === "credentials") {
      return {
        ok: false,
        error: "URLs must not include usernames or passwords.",
      };
    }
    return {
      ok: false,
      error: `Enter a valid https:// link from: ${EXTERNAL_3D_SUPPORTED_LIST}.`,
    };
  }

  const provider = providerForHost(parsed.host);
  if (!provider) {
    return {
      ok: false,
      error: `That site is not supported for embedding. Supported: ${EXTERNAL_3D_SUPPORTED_LIST}.`,
    };
  }

  const url = parsed.url;
  // MipMap (and some other viewers) put the share id in the fragment
  // (`#/share/…`). Dropping it loads the app shell, which routes to its
  // not-found page. Keep the raw fragment if URL parsing lost it.
  const hashAt = rawText.indexOf("#");
  if (hashAt >= 0 && !url.hash) {
    url.hash = rawText.slice(hashAt);
  }

  switch (provider) {
    case "sketchfab":
      return normalizeSketchfab(url) ?? {
        ok: false,
        error: "Could not normalize Sketchfab URL.",
        provider,
      };
    case "matterport":
      return normalizeMatterport(url);
    case "polycam":
      return normalizePolycam(url);
    case "pix4d":
      return passThrough(
        "pix4d",
        url,
        "PIX4Dcloud link — will embed as provided (paste an embed/share viewer URL if the page refuses framing)"
      );
    case "agisoft":
      return passThrough(
        "agisoft",
        url,
        "Agisoft Cloud link — will embed as provided"
      );
    case "dronedeploy":
      return passThrough(
        "dronedeploy",
        url,
        "DroneDeploy link — will embed as provided"
      );
    case "cesium":
      return passThrough(
        "cesium",
        url,
        "Cesium ion link — will embed as provided"
      );
    case "arcgis":
      return passThrough(
        "arcgis",
        url,
        "ArcGIS Scene Viewer link — will embed as provided"
      );
    case "mipmap":
      // No documented share→embed rewrite. Store the pasted URL unchanged.
      return passThrough(
        "mipmap",
        url,
        "MipMap — supported host, paste the embed URL MipMap gives you",
        "allow-scripts allow-same-origin allow-forms",
        "fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
      );
    default:
      return {
        ok: false,
        error: `That site is not supported for embedding. Supported: ${EXTERNAL_3D_SUPPORTED_LIST}.`,
      };
  }
}

export function isExternal3dProvider(value: unknown): value is External3dProvider {
  return typeof value === "string" && (EXTERNAL_3D_PROVIDERS as readonly string[]).includes(value);
}
