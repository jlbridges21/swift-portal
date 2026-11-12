/** Client-safe receipt formatters (no server imports). */
export function formatReceiptMoney(cents: number, currency: string): string {
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

export function receiptDateLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function receiptStatusLabel(receipt: { kind: "stripe" | "manual"; status: "paid" | "partially_refunded" | "refunded" }): string {
  if (receipt.status === "refunded") return "Refunded";
  if (receipt.status === "partially_refunded") return "Partially refunded";
  return receipt.kind === "manual" ? "Recorded as paid" : "Paid";
}
