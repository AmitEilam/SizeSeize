import Link from "next/link";
import { signOut } from "@/app/actions";
import { AppNavLinks, AppNavMobile } from "@/app/components/AppNav";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { APP_NAV_ITEMS } from "@/lib/nav";

type SiteHeaderProps = {
  email?: string | null;
  avatarUrl?: string | null;
  fullName?: string | null;
  showAuthActions?: boolean;
  /** Renders the app sections nav (inline on desktop, hamburger on mobile). */
  showNav?: boolean;
};

export function SiteHeader({
  email,
  avatarUrl,
  fullName,
  showAuthActions = true,
  showNav = false,
}: SiteHeaderProps) {
  const signedIn = Boolean(email);
  const withNav = showNav && signedIn;

  return (
    <header className={`ss-header${withNav ? " ss-header--app" : ""}`}>
      <div className="ss-container ss-header-inner">
        <div className="ss-header-lead">
          <Link href="/" className="ss-brand ss-header-brand">
            SizeSeize
          </Link>
          {withNav ? <AppNavLinks items={APP_NAV_ITEMS} /> : null}
        </div>

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

              <form
                action={signOut}
                className={withNav ? "ss-only-wide" : undefined}
              >
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

          {withNav ? (
            <AppNavMobile
              items={APP_NAV_ITEMS}
              email={email}
              fullName={fullName}
            />
          ) : null}
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
