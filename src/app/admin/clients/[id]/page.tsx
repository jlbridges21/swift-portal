import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getClientCrmProfile } from "@/lib/clients-crm";
import { ClientCrmProfile } from "@/components/admin/clients-table";
import { ChevronLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminClientDetailPage({ params }: PageProps) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const data = await getClientCrmProfile(id, { includeDeleted: true });
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/admin/clients">
            <Button variant="ghost" size="sm" className="mb-2">
              <ChevronLeft className="h-4 w-4" />
              All Clients
            </Button>
          </Link>
        </div>
        <ClientCrmProfile data={data} />
      </main>
    </div>
  );
}
