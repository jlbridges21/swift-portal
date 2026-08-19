import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

export function TenantUnavailable({
  title = "This portal is unavailable",
  description = "This business is suspended or no longer active. If you believe this is a mistake, contact your administrator.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        <p className="mt-3 max-w-md text-muted">{description}</p>
        <Link href="/login" className="mt-8">
          <Button variant="outline">Sign In</Button>
        </Link>
      </main>
    </div>
  );
}
