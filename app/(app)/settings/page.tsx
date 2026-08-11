import { redirect } from "next/navigation";
import { NotificationSettings } from "@/app/components/NotificationSettings";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <>
      <div>
        <h1 className="ss-page-title">Settings</h1>
        <p className="ss-page-lead">
          Your preferences for SizeSeize: which emails you receive and when the
          daily availability check runs.
        </p>
      </div>

      <NotificationSettings profile={(profile as Profile | null) ?? null} />
    </>
  );
}
