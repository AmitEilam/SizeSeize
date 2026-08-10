"use client";

import { useActionState, useEffect, useState } from "react";
import {
  updateNotificationSettings,
  type ActionState,
} from "@/app/actions";
import type { Profile } from "@/lib/types";
import {
  DEFAULT_CHECK_HOUR,
  DEFAULT_CHECK_MINUTE,
  DEFAULT_TIMEZONE,
  detectBrowserTimezone,
  describeNextScheduledRun,
  formatClock,
  localDateString,
  resolveEffectiveSchedule,
} from "@/lib/monitoring/schedule";

const initial: ActionState = {};

function hourOptions() {
  return Array.from({ length: 24 }, (_, hour) => hour);
}

type Props = {
  profile: Profile | null;
};

export function NotificationSettings({ profile }: Props) {
  const [state, action, pending] = useActionState(
    updateNotificationSettings,
    initial,
  );
  const [timezone, setTimezone] = useState(
    profile?.timezone || DEFAULT_TIMEZONE,
  );

  useEffect(() => {
    setTimezone(detectBrowserTimezone());
  }, []);

  const scheduleProfile = {
    timezone,
    preferred_check_hour: profile?.preferred_check_hour ?? DEFAULT_CHECK_HOUR,
    preferred_check_minute:
      profile?.preferred_check_minute ?? DEFAULT_CHECK_MINUTE,
    pending_check_hour: profile?.pending_check_hour ?? null,
    pending_check_minute: profile?.pending_check_minute ?? null,
    pending_schedule_effective_on:
      profile?.pending_schedule_effective_on ?? null,
    last_scheduled_run_on: profile?.last_scheduled_run_on ?? null,
  };

  const today = localDateString(new Date(), timezone);
  const effective = resolveEffectiveSchedule(scheduleProfile, today);
  const displayHour =
    effective.hasPendingChange && typeof effective.pendingHour === "number"
      ? effective.pendingHour
      : effective.hour;
  const displayMinute =
    effective.hasPendingChange && typeof effective.pendingMinute === "number"
      ? effective.pendingMinute
      : effective.minute;

  const nextRun = describeNextScheduledRun(scheduleProfile);

  return (
    <form action={action} className="ss-card flex flex-col gap-4">
      <input type="hidden" name="timezone" value={timezone} />

      <div>
        <h2 className="m-0 text-[1.15rem] font-bold tracking-[-0.01em]">
          Notifications & schedule
        </h2>
        <p className="mt-2 mb-0 text-[0.95rem] leading-relaxed text-[var(--muted)]">
          Choose which emails to receive and what time the daily check should
          run. Times are shown in your local time.
        </p>
      </div>

      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold tracking-wide text-[var(--muted)]">
          Email preferences
        </legend>
        <label className="ss-check-row">
          <input
            type="checkbox"
            name="notify_availability_alerts"
            value="on"
            defaultChecked={profile?.notify_availability_alerts ?? true}
          />
          <span>
            <span className="font-semibold">Availability alerts</span>
            <span className="mt-0.5 block text-[0.9rem] text-[var(--muted)]">
              Email me when a product changes from unavailable to available.
            </span>
          </span>
        </label>
        <label className="ss-check-row">
          <input
            type="checkbox"
            name="notify_daily_summary"
            value="on"
            defaultChecked={profile?.notify_daily_summary ?? true}
          />
          <span>
            <span className="font-semibold">Daily summary</span>
            <span className="mt-0.5 block text-[0.9rem] text-[var(--muted)]">
              Send me the daily product availability summary after the scheduled
              check.
            </span>
          </span>
        </label>
      </fieldset>

      <div>
        <p className="mb-2 mt-0 text-sm font-semibold tracking-wide text-[var(--muted)]">
          Daily check time
        </p>
        <div className="grid max-w-xs grid-cols-2 gap-3">
          <div className="ss-field">
            <label htmlFor="preferred_check_hour">Hour</label>
            <select
              id="preferred_check_hour"
              name="preferred_check_hour"
              defaultValue={displayHour}
              className="ss-select"
            >
              {hourOptions().map((hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          <div className="ss-field">
            <label htmlFor="preferred_check_minute">Minute</label>
            <select
              id="preferred_check_minute"
              name="preferred_check_minute"
              defaultValue={displayMinute}
              className="ss-select"
            >
              {[0, 15, 30, 45].map((minute) => (
                <option key={minute} value={minute}>
                  {String(minute).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-[var(--surface-soft)] px-3 py-3 text-[0.92rem] leading-relaxed text-[var(--muted)]">
        <p className="m-0">{nextRun.label}</p>
        {effective.hasPendingChange &&
        typeof effective.pendingHour === "number" ? (
          <p className="mt-2 mb-0">
            Pending change:{" "}
            <strong className="text-[var(--ink)]">
              {formatClock(
                effective.pendingHour,
                effective.pendingMinute ?? 0,
              )}
            </strong>{" "}
            takes effect tomorrow. Until then, today&apos;s completed check
            stands.
          </p>
        ) : null}
        <p className="mt-2 mb-0">
          Checks run once per day. If you change the time after today&apos;s
          check has already run, the new schedule applies from tomorrow.
        </p>
      </div>

      {state.error ? (
        <p className="m-0 text-[0.95rem] text-[var(--danger)]">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="m-0 text-[0.95rem] text-[var(--ok)]">{state.success}</p>
      ) : null}

      <button
        type="submit"
        className="ss-btn ss-btn-primary w-full sm:w-auto"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
