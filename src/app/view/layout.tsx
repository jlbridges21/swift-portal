import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

/**
 * Share links paint their theme in `view/[token]/page.tsx`, which already
 * loads the project business. A provider here would add a second `:root` style.
 */
export default function PublicViewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
