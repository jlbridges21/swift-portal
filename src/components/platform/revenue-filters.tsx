"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RevenueFilters({
  businesses,
  showStatus,
}: {
  businesses: { id: string; name: string }[];
  showStatus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(formData: FormData) {
    const next = new URLSearchParams();
    const business = String(formData.get("business") || "").trim();
    const from = String(formData.get("from") || "").trim();
    const to = String(formData.get("to") || "").trim();
    const status = String(formData.get("status") || "").trim();
    if (business) next.set("business", business);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    if (showStatus && status) next.set("status", status);
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <form
      action={apply}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="min-w-[180px]">
        <Label htmlFor="business">Business</Label>
        <select
          id="business"
          name="business"
          defaultValue={searchParams.get("business") ?? ""}
          className="mt-1 flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All businesses</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="from">From</Label>
        <Input
          id="from"
          name="from"
          type="date"
          className="mt-1"
          defaultValue={searchParams.get("from") ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          name="to"
          type="date"
          className="mt-1"
          defaultValue={searchParams.get("to") ?? ""}
        />
      </div>
      {showStatus && (
        <div className="min-w-[140px]">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={searchParams.get("status") ?? "paid"}
            className="mt-1 flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="paid">Paid (headline)</option>
            <option value="all">All statuses</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Filtering…" : "Apply filters"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => startTransition(() => router.push(pathname))}
      >
        Clear
      </Button>
    </form>
  );
}
