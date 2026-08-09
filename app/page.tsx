import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="ss-container flex items-center justify-between py-5">
        <span className="ss-brand text-xl text-[var(--brand)]">SizeSeize</span>
        <nav>
          {user ? (
            <Link href="/dashboard" className="ss-btn ss-btn-primary">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="ss-btn ss-btn-primary">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main className="ss-container flex flex-1 flex-col justify-center pb-16 pt-6 sm:pt-10">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[linear-gradient(135deg,rgba(15,61,46,0.94),rgba(31,107,79,0.88)),url('data:image/svg+xml,%3Csvg width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M0 39h40v1H0zM39 0v40h1V0z%22/%3E%3C/g%3E%3C/svg%3E')] px-6 py-14 text-[#f4fff8] sm:px-10 sm:py-20">
          <p className="ss-brand mb-3 text-4xl leading-none sm:text-6xl">
            SizeSeize
          </p>
          <h1 className="max-w-xl text-2xl font-semibold leading-tight sm:text-3xl">
            Know when your size is back.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-[#d7ebe0] sm:text-lg">
            Track product URLs, set the size you want, and get an email the day
            it becomes available — plus a daily stock summary.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="ss-btn bg-[#f4fff8] text-[var(--brand)] hover:bg-white"
            >
              {user ? "Open dashboard" : "Continue with Google"}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
