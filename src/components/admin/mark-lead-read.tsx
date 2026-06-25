"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MarkLeadReadButton({ leadId }: { leadId: string }) {
  const router = useRouter();

  async function handleMarkRead() {
    await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read: true }),
    });
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleMarkRead}>
      Mark Read
    </Button>
  );
}
