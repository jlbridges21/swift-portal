import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SurfaceToaster } from "@/components/brand/surface-toaster";
import { StandaloneAppBoot } from "@/components/pwa/standalone-app-boot";
import { getCanonicalSiteUrl, SITE, SITE_ICONS } from "@/lib/site-metadata";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SITE.themeColor },
    { media: "(prefers-color-scheme: dark)", color: SITE.themeColor },
  ],
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(getCanonicalSiteUrl()),
  title: {
    default: SITE.title,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  // "default" (opaque) status bar: iOS draws a solid status bar above the web view instead of
  // overlaying page content. "black-translucent" let every page scroll underneath the status bar /
  // Dynamic Island, where iOS paints a dark legibility gradient over whatever is there — the
  // persistent top blur over headers and menu buttons in the installed app. (startupImage pointed
  // at a 180px icon iOS can't use as a launch image, so it is gone.)
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE.name,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: SITE_ICONS.favicon, sizes: "48x48", type: "image/png" },
      { url: SITE_ICONS.icon192, sizes: "192x192", type: "image/png" },
      { url: SITE_ICONS.icon512, sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: SITE_ICONS.favicon, sizes: "48x48", type: "image/png" }],
    apple: [{ url: SITE_ICONS.apple, sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: SITE_ICONS.icon192, color: SITE.themeColor }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: getCanonicalSiteUrl(),
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    images: [
      {
        url: SITE_ICONS.ogBrand,
        width: 1200,
        height: 630,
        alt: `${SITE.name} — ${SITE.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
    images: [SITE_ICONS.ogBrand],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
        <SurfaceToaster />
        <StandaloneAppBoot />
      </body>
    </html>
  );
}
