import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

/** Default display name: "123 Main St — Aerial Photography" */
export function defaultProjectName(propertyAddress: string, serviceType: string): string {
  const address = propertyAddress.trim();
  const service = serviceType.trim();
  if (!address && !service) return "";
  if (!service) return address;
  if (!address) return service;
  return `${address} — ${service}`;
}

export function getPublicUrl(
  supabaseUrl: string,
  bucket: string,
  path: string
): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export function getSignedUrlPath(bucket: string, projectId: string, fileName: string): string {
  return `${projectId}/${fileName}`;
}

/** Human-friendly relative time, e.g. "2h ago", "Yesterday", "Mar 4". */
export function formatRelativeTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(date);
}
