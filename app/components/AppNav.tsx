"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions";
import { SignOutButton } from "@/app/components/SignOutButton";
import type { NavItem } from "@/lib/nav";

function isCurrent(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="ss-nav" aria-label="Main">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="ss-nav-link"
          aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

type AppNavMobileProps = {
  items: NavItem[];
  email?: string | null;
  fullName?: string | null;
};

export function AppNavMobile({ items, email, fullName }: AppNavMobileProps) {
  const pathname = usePathname();
  // The route the menu was opened on, so navigating anywhere closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const open = openedOn !== null && openedOn === pathname;

  useEffect(() => {
    if (!open) return;

    const close = () => setOpenedOn(null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && wrapperRef.current?.contains(target)) {
        return;
      }
      close();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="ss-nav-mobile" ref={wrapperRef}>
      <button
        type="button"
        className="ss-btn ss-btn-secondary ss-nav-toggle"
        aria-expanded={open}
        aria-controls="ss-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpenedOn(open ? null : pathname)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      <div
        id="ss-mobile-nav"
        className="ss-nav-panel"
        hidden={!open}
        aria-hidden={!open}
      >
        <nav className="ss-nav-panel-links" aria-label="Main">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="ss-nav-panel-link"
              aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
              onClick={() => setOpenedOn(null)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ss-nav-panel-footer">
          {email ? (
            <p className="ss-nav-panel-user">
              {fullName ? <strong>{fullName}</strong> : null}
              <span>{email}</span>
            </p>
          ) : null}
          <form action={signOut}>
            <SignOutButton className="ss-btn ss-btn-secondary w-full" />
          </form>
        </div>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
