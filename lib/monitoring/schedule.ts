/**
 * Platform cron fire time in UTC — must stay aligned with vercel.json.
 * Hobby allows one daily invocation; this is when Vercel calls /api/cron/monitor.
 */
export const PLATFORM_CRON_UTC_HOUR = 9;
export const PLATFORM_CRON_UTC_MINUTE = 0;

export const DEFAULT_TIMEZONE = "Asia/Jerusalem";
export const DEFAULT_CHECK_HOUR = 12;
export const DEFAULT_CHECK_MINUTE = 0;

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
 * If today's scheduled check already ran, queue the change for tomorrow.
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
  const alreadyRanToday = input.profile.last_scheduled_run_on === today;

  if (alreadyRanToday) {
    const tomorrow = shiftLocalDate(today, 1);

    return {
      appliesTomorrow: true,
      updates: {
        pending_check_hour: input.nextHour,
        pending_check_minute: input.nextMinute,
        pending_schedule_effective_on: tomorrow,
      },
      message: `Saved. Today's scheduled check already ran, so ${formatClock(input.nextHour, input.nextMinute)} will apply starting tomorrow.`,
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
    message: `Saved. Next scheduled check will use ${formatClock(input.nextHour, input.nextMinute)}.`,
  };
}

/** Shift a YYYY-MM-DD string by `days` (can be negative). */
export function shiftLocalDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/**
 * Whether the scheduled job should process this user right now.
 *
 * Hobby (default): once Vercel fires the daily cron, process users who have
 * not completed today's run yet. Preferred hour is still stored for UX and
 * for strict matching when CRON_STRICT_HOUR=true (e.g. hourly crons later).
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

  if (process.env.CRON_STRICT_HOUR === "true") {
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

export function describeNextScheduledRun(profile: ScheduleProfile, now = new Date()) {
  const tz = profile.timezone || DEFAULT_TIMEZONE;
  const today = localDateString(now, tz);
  const schedule = resolveEffectiveSchedule(profile, today);
  const alreadyRan = profile.last_scheduled_run_on === today;
  const clock = formatClock(schedule.hour, schedule.minute);

  if (alreadyRan) {
    const pendingClock =
      schedule.hasPendingChange && typeof schedule.pendingHour === "number"
        ? formatClock(schedule.pendingHour, schedule.pendingMinute ?? 0)
        : null;
    return {
      alreadyRanToday: true,
      label: pendingClock
        ? `Today's check already ran. New time ${pendingClock} starts tomorrow.`
        : `Today's check already ran. Next scheduled check is tomorrow at ${clock}.`,
      effectiveClock: pendingClock ?? clock,
    };
  }

  return {
    alreadyRanToday: false,
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
