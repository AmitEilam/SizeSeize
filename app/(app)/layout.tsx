import { redirect } from "next/navigation";
import {
  getDisplayName,
  getGoogleAvatar,
  SiteHeader,
} from "@/app/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col pb-16">
      <SiteHeader
        email={user.email}
        avatarUrl={getGoogleAvatar(user)}
        fullName={getDisplayName(user)}
        showAuthActions={false}
        showNav
      />

      <main className="ss-container mt-7 flex flex-col gap-6 sm:mt-9 sm:gap-7">
        {children}
      </main>
    </div>
  );
}
