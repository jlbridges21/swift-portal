import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { ClientMessagesScreen } from "@/components/client-portal/client-messages-screen";

export default async function ClientMessagesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin/messages");

  return (
    <div className="min-h-screen bg-[#F8FAFC] surface-dark:bg-background">
      <Header variant="dashboard" userRole="client" />
      <ClientMessagesScreen />
    </div>
  );
}
