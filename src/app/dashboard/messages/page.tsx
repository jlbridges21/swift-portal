import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { ClientMessagesChat } from "@/components/projects/client-messages-chat";

export default async function ClientMessagesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin/messages");

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header variant="dashboard" userRole="client" />
      <main className="mobile-container py-8 pb-16">
        <ClientMessagesChat />
      </main>
    </div>
  );
}
