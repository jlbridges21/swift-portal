/**
 * Google Calendar event title/description templates. Pure.
 */
import type { EventTemplateSettings } from "@/lib/booking/settings";
import { formatDuration } from "@/lib/booking/settings";

export type EventTemplateValues = {
  property_address: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  project_name: string;
  services: string;
  photographer: string;
  duration_minutes: number | null;
  business_name: string;
};

export function renderEventTemplate(template: string, values: EventTemplateValues): string {
  const map: Record<string, string> = {
    property_address: values.property_address,
    client_name: values.client_name,
    client_phone: values.client_phone,
    client_email: values.client_email,
    project_name: values.project_name,
    services: values.services,
    photographer: values.photographer,
    duration: values.duration_minutes ? formatDuration(values.duration_minutes) : "",
    business_name: values.business_name,
  };
  return template
    .replace(/\{([a-z_]+)\}/g, (match, key: string) => (key in map ? map[key] : match))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildEventText(input: {
  settings: EventTemplateSettings;
  values: EventTemplateValues;
  projectUrl: string | null;
  pending: boolean;
}): { summary: string; description: string; location: string | null } {
  const title = renderEventTemplate(input.settings.titleTemplate, input.values) || input.values.project_name || "Shoot";
  const body = renderEventTemplate(input.settings.descriptionTemplate, input.values);
  const extras = [
    input.settings.includeProjectLink && input.projectUrl ? `ShootPortal project: ${input.projectUrl}` : null,
    input.values.property_address ? `Property: ${input.values.property_address}` : null,
  ].filter(Boolean);
  return {
    summary: (input.pending ? `PENDING - ${title}` : title).slice(0, 250),
    description: [body, extras.join("\n")].filter(Boolean).join("\n\n").slice(0, 8000),
    location: input.settings.includeAddressAsLocation && input.values.property_address ? input.values.property_address : null,
  };
}
