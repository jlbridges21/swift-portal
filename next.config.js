/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
  async headers() {
    const staticAssetCache = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];

    return [
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
