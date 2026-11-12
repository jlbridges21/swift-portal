/**
 * Pure helpers for projects that link one or more services.
 *
 * projects.service_type keeps working as the display string every older reader
 * uses: the service name for one service, "A + B" for several. The canonical
 * links live in project_services (v127); when those are not loaded, the names
 * are recovered by splitting service_type on the separator.
 */

export const MULTI_SERVICE_SEPARATOR = " + ";
export const MULTI_SERVICE_LABEL = "Multiple Services";

/** "A", "A and B", "A, B, and C". */
export function formatServiceList(names: string[]): string {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

/** Value written to projects.service_type for the selected services. */
export function serviceTypeForNames(names: string[]): string {
  return names.map((n) => n.trim()).filter(Boolean).join(MULTI_SERVICE_SEPARATOR);
}

/** Every service name a project carries: its links when loaded, else split service_type. */
export function projectServiceNames(project: {
  service_type?: string | null;
  service_names?: string[] | null;
}): string[] {
  if (project.service_names?.length) return project.service_names;
  const raw = (project.service_type ?? "").trim();
  if (!raw) return [];
  return [...new Set(raw.split(MULTI_SERVICE_SEPARATOR).map((n) => n.trim()).filter(Boolean))];
}

/** Filter rule shared by every project list: a project matches if ANY of its services is selected. */
export function projectMatchesServices(
  project: { service_type?: string | null; service_names?: string[] | null },
  selected: string[]
): boolean {
  if (!selected.length) return true;
  return projectServiceNames(project).some((name) => selected.includes(name));
}

/** Short label for pills and cards: "Aerial Photography" or "Aerial Photography +1". */
export function compactServiceLabel(project: { service_type?: string | null; service_names?: string[] | null }): string {
  const names = projectServiceNames(project);
  if (names.length <= 1) return names[0] ?? (project.service_type ?? "");
  return `${names[0]} +${names.length - 1}`;
}

/**
 * Auto project name. One service keeps the existing "Street — Service" title;
 * several services read "Street — Multiple Services" (the list stays visible in the project).
 */
export function projectTitleForServices(propertyAddress: string, names: string[]): string {
  const label = propertyAddress.split(",")[0]?.trim() || propertyAddress.trim();
  const list = names.map((n) => n.trim()).filter(Boolean);
  const service = list.length > 1 ? MULTI_SERVICE_LABEL : (list[0] ?? "");
  return service ? `${label} — ${service}` : label;
}
