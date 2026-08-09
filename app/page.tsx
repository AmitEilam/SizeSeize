import Link from "next/link";
import {
  getDisplayName,
  getGoogleAvatar,
  SiteHeader,
} from "@/app/components/SiteHeader";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        email={user?.email}
        avatarUrl={user ? getGoogleAvatar(user) : null}
        fullName={user ? getDisplayName(user) : null}
      />

      <main className="ss-container flex flex-1 flex-col justify-center pb-16 pt-8 sm:pt-12">
        <section className="ss-hero">
          <p className="ss-brand mb-3 text-4xl leading-none sm:text-6xl">
            SizeSeize
          </p>
          <h1 className="max-w-xl text-2xl font-semibold leading-snug sm:text-[2rem]">
            Know when your size is back.
          </h1>
          <p className="mt-4 max-w-lg text-[1.08rem] leading-relaxed text-[var(--hero-muted)]">
            Track product URLs, set the size you want, and get an email the day
            it becomes available, plus a daily stock summary.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="ss-btn ss-hero-cta"
            >
              {user ? "Open dashboard" : "Continue with Google"}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
