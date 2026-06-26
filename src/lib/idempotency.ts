/** Build stable idempotency keys for activity deduplication. */
export function idempotencyKey(...parts: (string | number | null | undefined)[]): string {
  return parts.filter(Boolean).join(":");
}
