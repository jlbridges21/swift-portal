/** Shared brand tokens for the downloadable templates. Hex values have no leading "#". */
export const BRAND = {
  indigo: "4F46E5",
  indigoDark: "4338CA",
  indigoSoft: "C7D2FE",
  slate: "0F172A",
  ink: "1E293B",
  text: "334155",
  body: "475569",
  muted: "64748B",
  faint: "94A3B8",
  line: "E2E8F0",
  lineStrong: "CBD5E1",
  bgLight: "F8FAFC",
  bgIndigo: "EEF2FF",
  white: "FFFFFF",
  green: "047857",
  bgGreen: "ECFDF5",
} as const;

export const FOOTER_TEXT = "Template by ShootPortal · shootportal.app";
export const AUTHOR = "ShootPortal";

/** Fixed timestamp so rebuilding produces byte-identical files. */
export const BUILD_DATE = new Date("2026-10-01T12:00:00Z");

export type DocMeta = {
  title: string;
  subject: string;
  description: string;
  keywords: string[];
  /** Short label used in the running header on page 2+ of PDFs. */
  runningTitle: string;
};
