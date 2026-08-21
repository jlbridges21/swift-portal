export interface LandingScreenshots {
  request: string;
  dashboard: string;
  quote: string;
  microsite: string;
  review: string;
}

export interface LandingAssets {
  heroVideoId: string;
  logoNavy: string;
  logoWhite: string;
  logoStackedWhite: string;
  logoHeader: string;
  logoFooter: string;
  favicon: string;
  ownerHeadshot: string;
  luxuryHome: string;
  golfCourse: string;
  construction: string;
  screenshots: LandingScreenshots;
}

/** Empty marketing kit — another business must not inherit Swift photography.
 * Portal UI screenshots (product chrome) are safe platform defaults so How it
 * works / Inside the portal are not blank for new tenants. Property photos stay empty. */
export const DEFAULT_LANDING_ASSETS: LandingAssets = {
  heroVideoId: "",
  logoNavy: "",
  logoWhite: "",
  logoStackedWhite: "",
  logoHeader: "",
  logoFooter: "",
  favicon: "/icons/sp-icon-192.png",
  ownerHeadshot: "",
  luxuryHome: "",
  golfCourse: "",
  construction: "",
  screenshots: {
    request:
      "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3d9b856507a7960180b2b7.png",
    dashboard:
      "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3d975a4ac4f65406c4e8d9.png",
    quote:
      "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3d93076507a796017fa2e2.png",
    microsite:
      "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3d975a4ac4f65406c4e8d9.png",
    review:
      "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3d9d8cd4f4031f97bddccf.png",
  },
};

export function mergeLandingAssets(stored?: Partial<LandingAssets> | null): LandingAssets {
  const s = stored ?? {};
  const pick = (value: unknown, fallback: string) => {
    const t = typeof value === "string" ? value.trim() : "";
    return t || fallback;
  };
  const storedShots = (s.screenshots ?? {}) as Partial<LandingScreenshots>;
  return {
    heroVideoId: pick(s.heroVideoId, DEFAULT_LANDING_ASSETS.heroVideoId),
    logoNavy: pick(s.logoNavy, DEFAULT_LANDING_ASSETS.logoNavy),
    logoWhite: pick(s.logoWhite, DEFAULT_LANDING_ASSETS.logoWhite),
    logoStackedWhite: pick(s.logoStackedWhite, DEFAULT_LANDING_ASSETS.logoStackedWhite),
    logoHeader: pick(s.logoHeader, DEFAULT_LANDING_ASSETS.logoHeader),
    logoFooter: pick(s.logoFooter, DEFAULT_LANDING_ASSETS.logoFooter),
    favicon: pick(s.favicon, DEFAULT_LANDING_ASSETS.favicon),
    ownerHeadshot: pick(s.ownerHeadshot, DEFAULT_LANDING_ASSETS.ownerHeadshot),
    luxuryHome: pick(s.luxuryHome, DEFAULT_LANDING_ASSETS.luxuryHome),
    golfCourse: pick(s.golfCourse, DEFAULT_LANDING_ASSETS.golfCourse),
    construction: pick(s.construction, DEFAULT_LANDING_ASSETS.construction),
    screenshots: {
      request: pick(storedShots.request, DEFAULT_LANDING_ASSETS.screenshots.request),
      dashboard: pick(storedShots.dashboard, DEFAULT_LANDING_ASSETS.screenshots.dashboard),
      quote: pick(storedShots.quote, DEFAULT_LANDING_ASSETS.screenshots.quote),
      microsite: pick(storedShots.microsite, DEFAULT_LANDING_ASSETS.screenshots.microsite),
      review: pick(storedShots.review, DEFAULT_LANDING_ASSETS.screenshots.review),
    },
  };
}
