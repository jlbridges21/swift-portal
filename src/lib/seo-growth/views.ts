/**
 * Sections of /platform/analytics/seo/growth (?view=). Lives outside the "use client" nav module:
 * a server component importing a plain value from a client module gets a client reference, not the array.
 */
export const GROWTH_VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "opportunities", label: "Opportunities" },
  { key: "indexing", label: "Indexing" },
  { key: "content", label: "Content" },
  { key: "gaps", label: "Content gaps" },
  { key: "conversions", label: "Conversions" },
  { key: "roadmap", label: "Roadmap" },
] as const;

export type GrowthView = (typeof GROWTH_VIEWS)[number]["key"];

export function parseGrowthView(value: string | undefined): GrowthView {
  return GROWTH_VIEWS.find((v) => v.key === value)?.key ?? "overview";
}
