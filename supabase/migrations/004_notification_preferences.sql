-- Per-user notification + daily schedule preferences
alter table public.profiles
  add column if not exists notify_availability_alerts boolean not null default true,
  add column if not exists notify_daily_summary boolean not null default true,
  add column if not exists timezone text not null default 'Asia/Jerusalem',
  add column if not exists preferred_check_hour smallint not null default 12,
  add column if not exists preferred_check_minute smallint not null default 0,
  add column if not exists pending_check_hour smallint,
  add column if not exists pending_check_minute smallint,
  add column if not exists pending_schedule_effective_on date,
  add column if not exists last_scheduled_run_on date;

alter table public.profiles
  drop constraint if exists profiles_preferred_check_hour_check;

alter table public.profiles
  add constraint profiles_preferred_check_hour_check
  check (preferred_check_hour >= 0 and preferred_check_hour <= 23);

alter table public.profiles
  drop constraint if exists profiles_preferred_check_minute_check;

alter table public.profiles
  add constraint profiles_preferred_check_minute_check
  check (preferred_check_minute >= 0 and preferred_check_minute <= 59);

comment on column public.profiles.notify_availability_alerts is
  'Email when a monitored product flips from unavailable to available';
comment on column public.profiles.notify_daily_summary is
  'Email a daily summary of all monitored products after the scheduled check';
comment on column public.profiles.last_scheduled_run_on is
  'Local calendar date (in profiles.timezone) of the last completed scheduled job';
