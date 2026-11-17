import type { OnboardingStepId } from "@/lib/onboarding";

/**
 * The short video and three "What this does" points shown under each onboarding step title.
 * Videos live on the ShootPortal YouTube channel. Source files and the upload sheet:
 * Explainer_Videos_v2/Onboarding/ (onboarding_videos.xlsx).
 * `youtubeId: null` hides the player and keeps the points.
 */
export type OnboardingStepIntro = {
  youtubeId: string | null;
  /** Shown on the player before it loads, and used as the iframe title. */
  videoTitle: string;
  /** Length shown on the play button, e.g. "1:12". */
  duration: string;
  points: [string, string, string];
};

export const ONBOARDING_STEP_INTROS: Record<OnboardingStepId, OnboardingStepIntro> = {
  identity: {
    youtubeId: "17usJFjDYR0",
    videoTitle: "Welcome: set up your business",
    duration: "1:02",
    points: [
      "Your business name shows in client emails, your portal and your website.",
      "Client replies go to your contact email.",
      "Your address sets your time zone and is where travel fees and drive times start.",
    ],
  },
  branding: {
    youtubeId: "b6xgZPGAqrg",
    videoTitle: "Brand & look: logo, colors and theme",
    duration: "0:57",
    points: [
      "Your logo appears on your portal, emails and website.",
      "Colors style every button and link your clients see.",
      "The theme sets the background: light, dark, or your brand color.",
    ],
  },
  services: {
    youtubeId: "mErKfhogtyo",
    videoTitle: "Services: prices, time on site and travel fees",
    duration: "1:09",
    points: [
      "Clients pick these services when they request or book a shoot.",
      "Prices plus travel fees create the preliminary estimate they see right away.",
      "Time on site sets how long each booking blocks your calendar.",
    ],
  },
  booking: {
    youtubeId: "m7v7Hvfzaqw",
    videoTitle: "Booking & calendar: let clients pick a time",
    duration: "0:57",
    points: [
      "Choose whether you schedule shoots or clients book a time themselves.",
      "Clients only see times inside your working hours.",
      "Connect Google Calendar so you're never double-booked.",
    ],
  },
  payments: {
    youtubeId: "Hs7SiICE7C8",
    videoTitle: "Get paid: connect Stripe",
    duration: "0:54",
    points: [
      "Clients pay you directly by card or bank transfer.",
      "ShootPortal takes 0% of client payments.",
      "Payouts and refunds are handled in your Stripe Dashboard.",
    ],
  },
  landing: {
    youtubeId: "_FTUWwmVk_I",
    videoTitle: "Your website: make it yours",
    duration: "0:53",
    points: [
      "ShootPortal already built your website from your name, logo and services.",
      "The Book a Shoot button opens your request form.",
      "Change anything later in Settings → Business Website.",
    ],
  },
  finish: {
    youtubeId: "nJprz68LtRw",
    videoTitle: "You're live: test your portal",
    duration: "0:48",
    points: [
      "Open your portal to see what clients see.",
      "Send yourself a test request to try the full flow.",
      "Anything you skipped is one click away in Settings.",
    ],
  },
};
