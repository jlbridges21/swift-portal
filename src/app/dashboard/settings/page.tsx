import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");

  const supabase = await createClient();
  const { data: client } = profile.client_id
    ? await supabase.from("clients").select("*").eq("id", profile.client_id).single()
    : { data: null };

  return <SettingsClient profile={profile} client={client} />;
}
