import Link from "next/link";
import { signInWithGoogle } from "@/app/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-1 flex-col">
      <header className="ss-container flex items-center justify-between py-5">
        <Link href="/" className="ss-brand text-xl text-[var(--brand)]">
          SizeSeize
        </Link>
      </header>

      <main className="ss-container flex flex-1 items-center justify-center pb-16">
        <div className="ss-card w-full max-w-md">
          <h1 className="ss-brand text-3xl text-[var(--brand)]">Sign in</h1>
          <p className="mt-2 text-[var(--muted)]">
            Use Google to access your SizeSeize dashboard. We need your email to
            send stock alerts.
          </p>

          {params.error ? (
            <p className="mt-4 rounded-lg bg-[rgba(155,44,44,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
              {params.error === "auth"
                ? "Sign-in failed. Check Google OAuth configuration and try again."
                : params.error}
            </p>
          ) : null}

          <form action={signInWithGoogle} className="mt-6">
            <button type="submit" className="ss-btn ss-btn-primary w-full">
              Continue with Google
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
