import type { Payment, ProjectQuote } from "@/lib/types";
import { getServicePaymentDescription } from "@/lib/service-templates";

export function getPaymentForQuote(payments: Payment[], quoteId: string): Payment | null {
  return payments.find((p) => p.quote_id === quoteId) ?? null;
}

export function canCreatePaymentFromQuote(quote: ProjectQuote): boolean {
  if (quote.quote_kind === "preliminary") return false;
  if (quote.title.startsWith("Preliminary Estimate")) return false;
  if (quote.total_cents <= 0) return false;
  return quote.status === "approved" || quote.status === "sent";
}

function streetFromAddress(propertyAddress: string): string {
  return propertyAddress.split(",")[0]?.trim() || propertyAddress.trim();
}

/** Stripe checkout title: "Client Name - Street - Service" */
export function paymentLinkTitle(
  clientName: string,
  propertyAddress: string,
  serviceType: string
): string {
  const street = streetFromAddress(propertyAddress);
  return [clientName.trim(), street, serviceType.trim()].filter(Boolean).join(" - ").slice(0, 250);
}

/** @deprecated Use paymentLinkTitle */
export function paymentDescriptionForQuote(
  _quote: ProjectQuote,
  projectName?: string,
  serviceType?: string,
  clientName?: string,
  propertyAddress?: string
): string {
  if (clientName && propertyAddress && serviceType) {
    return paymentLinkTitle(clientName, propertyAddress, serviceType);
  }
  return (projectName?.trim() || serviceType?.trim() || "Project payment").slice(0, 250);
}

export function defaultPaymentLinkDescription(serviceType?: string): string {
  if (!serviceType?.trim()) {
    return "Professional aerial media package for the selected property.";
  }
  return getServicePaymentDescription(serviceType);
}
