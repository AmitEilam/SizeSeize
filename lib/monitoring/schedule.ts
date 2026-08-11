/**
 * Legacy platform cron fire time in UTC (daily-only deployments).
 * Hourly crons in vercel.json use strict per-user local times instead.
 */
export const PLATFORM_CRON_UTC_HOUR = 9;
export const PLATFORM_CRON_UTC_MINUTE = 0;

export const DEFAULT_TIMEZONE = "Asia/Jerusalem";
export const DEFAULT_CHECK_HOUR = 12;
export const DEFAULT_CHECK_MINUTE = 0;

/** Opt out with CRON_STRICT_HOUR=false when stuck on a single daily cron. */
export function isStrictHourScheduling(): boolean {
  return process.env.CRON_STRICT_HOUR !== "false";
}

export type ScheduleProfile = {
  timezone: string;
  preferred_check_hour: number;
  preferred_check_minute: number;
  pending_check_hour: number | null;
  pending_check_minute: number | null;
  pending_schedule_effective_on: string | null;
  last_scheduled_run_on: string | null;
};

export type EffectiveSchedule = {
  hour: number;
  minute: number;
  /** True when a pending change is waiting for tomorrow (or a later date). */
  hasPendingChange: boolean;
  pendingHour: number | null;
  pendingMinute: number | null;
  pendingEffectiveOn: string | null;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/** Calendar date YYYY-MM-DD in a given IANA timezone. */
export function localDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Local hour/minute in a timezone. */
export function localTimeParts(
  date: Date,
  timeZone: string,
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
}

export function formatClock(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/**
 * Resolve the schedule that should apply on `localToday`.
 * Pending changes activate on pending_schedule_effective_on.
 */
export function resolveEffectiveSchedule(
  profile: ScheduleProfile,
  localToday: string,
): EffectiveSchedule {
  const pendingOn = profile.pending_schedule_effective_on;
  const hasPending =
    typeof profile.pending_check_hour === "number" && Boolean(pendingOn);

  if (
    hasPending &&
    pendingOn &&
    pendingOn <= localToday &&
    typeof profile.pending_check_hour === "number"
  ) {
    return {
      hour: profile.pending_check_hour,
      minute: profile.pending_check_minute ?? 0,
      hasPendingChange: false,
      pendingHour: null,
      pendingMinute: null,
      pendingEffectiveOn: null,
    };
  }

  return {
    hour: profile.preferred_check_hour,
    minute: profile.preferred_check_minute,
    hasPendingChange: hasPending,
    pendingHour: profile.pending_check_hour,
    pendingMinute: profile.pending_check_minute,
    pendingEffectiveOn: pendingOn,
  };
}

/**
 * Build profile updates when the user picks a new preferred local time.
 * If today's scheduled check is already done, queue the change for tomorrow.
 */
export function buildScheduleUpdate(input: {
  profile: ScheduleProfile;
  nextHour: number;
  nextMinute: number;
  now?: Date;
}): {
  updates: Record<string, unknown>;
  appliesTomorrow: boolean;
  message: string;
} {
  const now = input.now ?? new Date();
  const tz = input.profile.timezone || DEFAULT_TIMEZONE;
  const today = localDateString(now, tz);
  const clock = formatClock(input.nextHour, input.nextMinute);

  if (hasCompletedTodaysScheduledCheck(input.profile, now)) {
    const tomorrow = shiftLocalDate(today, 1);

    return {
      appliesTomorrow: true,
      updates: {
        pending_check_hour: input.nextHour,
        pending_check_minute: input.nextMinute,
        pending_schedule_effective_on: tomorrow,
      },
      message: `Saved. Today's scheduled check already ran, so ${clock} will apply starting tomorrow. Next scheduled check: tomorrow at ${clock}.`,
    };
  }

  return {
    appliesTomorrow: false,
    updates: {
      preferred_check_hour: input.nextHour,
      preferred_check_minute: input.nextMinute,
      pending_check_hour: null,
      pending_check_minute: null,
      pending_schedule_effective_on: null,
    },
    message: `Saved. Next scheduled check: today at ${clock}.`,
  };
}

/** Shift a YYYY-MM-DD string by `days` (can be negative). */
export function shiftLocalDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/**
 * Today's daily check is considered done when:
 * - the scheduled job recorded last_scheduled_run_on for today, or
 * - the current preferred time has already passed (daily slot consumed).
 */
export function hasCompletedTodaysScheduledCheck(
  profile: ScheduleProfile,
  now = new Date(),
): boolean {
  const tz = profile.timezone || DEFAULT_TIMEZONE;
  const today = localDateString(now, tz);

  if (profile.last_scheduled_run_on === today) {
    return true;
  }

  // Legacy daily cron: after the user's preferred local time, treat today's slot
  // as consumed even if last_scheduled_run_on was not recorded yet.
  if (!isStrictHourScheduling()) {
    const local = localTimeParts(now, tz);
    const nowMinutes = local.hour * 60 + local.minute;
    const preferredMinutes =
      (profile.preferred_check_hour ?? DEFAULT_CHECK_HOUR) * 60 +
      (profile.preferred_check_minute ?? DEFAULT_CHECK_MINUTE);

    return nowMinutes >= preferredMinutes;
  }

  return false;
}

/**
 * Whether the scheduled job should process this user right now.
 *
 * Default (strict): hourly cron skips users until their preferred local time,
 * then runs once per calendar day (last_scheduled_run_on).
 *
 * Legacy (CRON_STRICT_HOUR=false): a single daily cron processes everyone when
 * it fires, regardless of preferred hour.
 */
export function shouldRunScheduledCheck(
  profile: ScheduleProfile,
  now = new Date(),
): boolean {
  const tz = profile.timezone || DEFAULT_TIMEZONE;
  const today = localDateString(now, tz);
  if (profile.last_scheduled_run_on === today) {
    return false;
  }

  if (isStrictHourScheduling()) {
    const schedule = resolveEffectiveSchedule(profile, today);
    const local = localTimeParts(now, tz);
    const nowMinutes = local.hour * 60 + local.minute;
    const targetMinutes = schedule.hour * 60 + schedule.minute;
    return nowMinutes >= targetMinutes;
  }

  return true;
}

/** Promote due pending schedule into preferred_* fields (DB write payload). */
export function promotePendingScheduleIfDue(
  profile: ScheduleProfile,
  localToday: string,
): Record<string, unknown> | null {
  const pendingOn = profile.pending_schedule_effective_on;
  if (
    typeof profile.pending_check_hour !== "number" ||
    !pendingOn ||
    pendingOn > localToday
  ) {
    return null;
  }

  return {
    preferred_check_hour: profile.pending_check_hour,
    preferred_check_minute: profile.pending_check_minute ?? 0,
    pending_check_hour: null,
    pending_check_minute: null,
    pending_schedule_effective_on: null,
  };
}

/**
 * Actual next scheduled run for UI copy.
 * Always the next possible daily check, never a time that already passed today.
 */
export function describeNextScheduledRun(
  profile: ScheduleProfile,
  now = new Date(),
) {
  const tz = profile.timezone || DEFAULT_TIMEZONE;
  const today = localDateString(now, tz);
  const schedule = resolveEffectiveSchedule(profile, today);
  const completedToday = hasCompletedTodaysScheduledCheck(profile, now);

  const nextHour =
    schedule.hasPendingChange && typeof schedule.pendingHour === "number"
      ? schedule.pendingHour
      : schedule.hour;
  const nextMinute =
    schedule.hasPendingChange && typeof schedule.pendingMinute === "number"
      ? schedule.pendingMinute
      : schedule.minute;
  const clock = formatClock(nextHour, nextMinute);

  // Pending schedule changes always start tomorrow.
  if (schedule.hasPendingChange && typeof schedule.pendingHour === "number") {
    return {
      alreadyRanToday: completedToday,
      when: "tomorrow" as const,
      label: `Next scheduled check: tomorrow at ${clock}.`,
      effectiveClock: clock,
    };
  }

  if (completedToday) {
    return {
      alreadyRanToday: true,
      when: "tomorrow" as const,
      label: `Next scheduled check: tomorrow at ${clock}.`,
      effectiveClock: clock,
    };
  }

  return {
    alreadyRanToday: false,
    when: "today" as const,
    label: `Next scheduled check: today at ${clock}.`,
    effectiveClock: clock,
  };
}

/** Resolve an IANA timezone from the browser, with a safe fallback. */
export function detectBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return tz;
    }
  } catch {
    // fall through
  }
  return DEFAULT_TIMEZONE;
}

export function isValidTimezone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}
