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

/** Empty marketing kit — another business must not inherit Swift photography. */
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
    request: "",
    dashboard: "",
    quote: "",
    microsite: "",
    review: "",
  },
};

export function mergeLandingAssets(stored?: Partial<LandingAssets> | null): LandingAssets {
  return {
    ...DEFAULT_LANDING_ASSETS,
    ...(stored ?? {}),
    screenshots: {
      ...DEFAULT_LANDING_ASSETS.screenshots,
      ...(stored?.screenshots ?? {}),
    },
  };
}
