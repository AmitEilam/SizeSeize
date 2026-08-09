import Link from "next/link";
import { signOut } from "@/app/actions";
import { ThemeToggle } from "@/app/components/ThemeToggle";

type SiteHeaderProps = {
  email?: string | null;
  avatarUrl?: string | null;
  fullName?: string | null;
  showAuthActions?: boolean;
};

export function SiteHeader({
  email,
  avatarUrl,
  fullName,
  showAuthActions = true,
}: SiteHeaderProps) {
  const signedIn = Boolean(email);

  return (
    <header className="ss-header">
      <div className="ss-container ss-header-inner">
        <Link href="/" className="ss-brand ss-header-brand">
          SizeSeize
        </Link>

        <div className="ss-header-actions">
          {signedIn ? (
            <div className="ss-user-cluster">
              <div className="ss-user">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={fullName ? `${fullName} profile` : "Your profile"}
                    width={36}
                    height={36}
                    className="ss-avatar"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="ss-avatar ss-avatar-fallback" aria-hidden>
                    {(fullName || email || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="ss-user-text">
                  {fullName ? (
                    <span className="ss-user-name">{fullName}</span>
                  ) : null}
                  <span className="ss-user-email">{email}</span>
                </div>
              </div>

              {showAuthActions ? (
                <Link href="/dashboard" className="ss-btn ss-btn-secondary ss-hide-sm">
                  Dashboard
                </Link>
              ) : null}

              <form action={signOut}>
                <button type="submit" className="ss-btn ss-btn-secondary">
                  Sign out
                </button>
              </form>
            </div>
          ) : showAuthActions ? (
            <Link href="/login" className="ss-btn ss-btn-primary">
              Sign in
            </Link>
          ) : null}

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function getGoogleAvatar(user: {
  user_metadata?: Record<string, unknown>;
  identities?: Array<{ identity_data?: Record<string, unknown> }>;
}): string | null {
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;

  if (fromMeta) return fromMeta;

  const googleIdentity = user.identities?.find(
    (identity) => identity.identity_data?.picture,
  );
  const picture = googleIdentity?.identity_data?.picture;
  return typeof picture === "string" ? picture : null;
}

export function getDisplayName(user: {
  user_metadata?: Record<string, unknown>;
}): string | null {
  const meta = user.user_metadata ?? {};
  if (typeof meta.full_name === "string" && meta.full_name) return meta.full_name;
  if (typeof meta.name === "string" && meta.name) return meta.name;
  return null;
}
