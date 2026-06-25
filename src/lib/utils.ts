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
