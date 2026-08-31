/** Client-safe email parsing for the share modal (no server imports). */

export function normalizeShareEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidShareEmail(email: string): boolean {
  const normalized = normalizeShareEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function parseShareEmailInput(input: string): string[] {
  const parts = input
    .split(/[\s,;]+|\n/)
    .map((part) => normalizeShareEmail(part))
    .filter(Boolean);
  return [...new Set(parts)];
}
