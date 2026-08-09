import Link from "next/link";
import { signInWithGoogle } from "@/app/actions";
import { SiteHeader } from "@/app/components/SiteHeader";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader showAuthActions={false} />

      <main className="ss-container flex flex-1 items-center justify-center pb-16 pt-8">
        <div className="ss-card w-full max-w-md">
          <h1 className="ss-brand text-3xl text-[var(--brand)]">Sign in</h1>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-[var(--muted)]">
            Use Google to open your SizeSeize dashboard. We use your email for
            stock alerts and your Google photo in the header.
          </p>

          {params.error ? (
            <p className="mt-4 rounded-lg bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2 text-[0.95rem] text-[var(--danger)]">
              {params.error === "auth"
                ? "Sign-in failed. Check Google OAuth configuration and try again."
                : params.error}
            </p>
          ) : null}

          <form action={signInWithGoogle} className="mt-7">
            <button type="submit" className="ss-btn ss-btn-primary w-full">
              Continue with Google
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--muted)]">
            <Link href="/" className="underline-offset-2 hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
