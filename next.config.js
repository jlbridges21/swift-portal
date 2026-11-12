/** @type {import('next').NextConfig} */
const nextConfig = {
  // Marketing Kit exports render with the same font files the live preview loads
  // (public/marketing-fonts). Make sure they ship with the export function.
  outputFileTracingIncludes: {
    "/api/marketing/[projectId]/export": ["./public/marketing-fonts/**/*"],
    // Official proposal PDFs render on the server with the same Inter files the editor preview loads.
    "/api/quotes": ["./public/fonts/Inter-*.ttf"],
    "/api/quotes/[id]/pdf": ["./public/fonts/Inter-*.ttf"],
  },
  images: {
    // 75 is the default; 90 keeps UI text sharp in marketing product screenshots (ShowcaseImage).
    qualities: [75, 90],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      // Custom Supabase Auth/Storage domain (prod NEXT_PUBLIC_SUPABASE_URL).
      // Without this, next/image returns 400 INVALID_IMAGE_OPTIMIZE_REQUEST for
      // client gallery thumbs/previews while plain <img> (admin grid) still works.
      { protocol: "https", hostname: "auth.shootportal.app" },
      { protocol: "https", hostname: "assets.cdn.filesafe.space" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "encrypted-tbn0.gstatic.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  /**
   * Canonical host is www.shootportal.app (Vercel already 308s apex → www).
   * Keep production NEXT_PUBLIC_APP_URL=https://www.shootportal.app so metadata matches.
   */
  async rewrites() {
    return [
      { source: "/favicon.ico", destination: "/icons/icon-48.png" },
      { source: "/icon.png", destination: "/icons/icon-48.png" },
    ];
  },
  async headers() {
    const staticAssetCache = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];

    return [
      // Photo Editor engine (LightCraft, installed by scripts/lightcraft/install.mjs).
      // File names don't change between versions → revalidate instead of immutable.
      // Framable only by ShootPortal itself; never indexed.
      {
        source: "/lightcraft/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Robots-Tag", value: "noindex" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/lightcraft/:path*.wasm",
        headers: [{ key: "Content-Type", value: "application/wasm" }],
      },
      {
        source: "/icons/:path*",
        headers: staticAssetCache,
      },
      {
        source: "/icon.png",
        headers: staticAssetCache,
      },
      {
        source: "/apple-icon.png",
        headers: staticAssetCache,
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
