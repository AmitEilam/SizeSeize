"use client";

import { useEffect, useRef, useState } from "react";
import {
  THEME_PREFERENCE_LABELS,
  type ThemePreference,
  applyResolvedTheme,
  getStoredPreference,
  resolveTheme,
  setThemePreference,
} from "@/lib/theme";

const OPTIONS: ThemePreference[] = ["system", "light", "dark"];

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = getStoredPreference();
    setPreference(stored);
    applyResolvedTheme(resolveTheme(stored));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyResolvedTheme(resolveTheme("system"));

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && wrapperRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function choose(next: ThemePreference) {
    setPreference(next);
    setThemePreference(next);
    setOpen(false);
  }

  const label = mounted
    ? THEME_PREFERENCE_LABELS[preference]
    : THEME_PREFERENCE_LABELS.system;

  return (
    <div className="ss-theme-picker" ref={wrapperRef}>
      <button
        type="button"
        className="ss-btn ss-btn-secondary ss-theme-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="ss-theme-menu"
        aria-label={`Theme: ${label}. Choose light, dark, or system.`}
        title={`Theme: ${label}`}
        onClick={() => setOpen((value) => !value)}
      >
        <ThemeIcon preference={mounted ? preference : "system"} />
        <span className="ss-theme-toggle-label">{label}</span>
      </button>

      <div
        id="ss-theme-menu"
        className="ss-theme-menu"
        role="listbox"
        aria-label="Theme"
        hidden={!open}
      >
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={preference === option}
            className="ss-theme-menu-option"
            onClick={() => choose(option)}
          >
            <ThemeIcon preference={option} />
            <span>{THEME_PREFERENCE_LABELS[option]}</span>
            {preference === option ? <CheckIcon /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "light") return <SunIcon />;
  if (preference === "dark") return <MoonIcon />;
  return <SystemIcon />;
}

function SystemIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="11"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 19.5h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M17.3 6.7l1.6-1.6M5.1 18.9l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="ss-theme-menu-check"
    >
      <path
        d="M5 12.5 10 17.5 19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
