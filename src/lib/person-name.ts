export interface ResolvedPersonName {
  firstName: string;
  lastName: string;
  fullName: string;
}

/** Resolve first/last/full name from structured fields or a legacy single name. */
export function resolvePersonName(input: {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
}): ResolvedPersonName {
  const first = input.first_name?.trim() ?? "";
  const last = input.last_name?.trim() ?? "";

  if (first || last) {
    const fullName = [first, last].filter(Boolean).join(" ").trim();
    return { firstName: first, lastName: last, fullName };
  }

  const legacy = input.name?.trim() ?? "";
  if (!legacy) {
    return { firstName: "", lastName: "", fullName: "" };
  }

  const parts = legacy.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName, fullName: legacy };
}

export function validatePersonName(input: {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
}): string | null {
  const { firstName, lastName, fullName } = resolvePersonName(input);
  if (firstName && lastName) return null;
  if (fullName) return null;
  return "First name and last name are required.";
}
