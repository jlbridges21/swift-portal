import { notFound } from "next/navigation";
import { PhotoGridHarness } from "./photo-grid-harness";

/**
 * Dev-only page for scripts/verify-photo-selection-toolbar.ts: renders the admin photo grid with
 * mock photos so the selection toolbar can be tested without signing in. Every production build
 * (Vercel production and preview included) returns 404.
 */
export default async function PhotoGridHarnessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  return <PhotoGridHarness shell={sp.shell === "new" ? "new" : "classic"} bottomNav={sp.nav === "1"} />;
}
