export const DEFAULT_PRELIMINARY_DISCLAIMER =
  "This estimate is generated automatically based on the service you selected. It is intended to provide a realistic starting price for your project. Final pricing may be adjusted after {{businessName}} reviews the property, confirms the scope of work, and schedules the shoot.";

export function preliminaryEstimateDisclaimer(
  businessName: string,
  template = DEFAULT_PRELIMINARY_DISCLAIMER
): string {
  return template.replaceAll("{{businessName}}", businessName);
}
