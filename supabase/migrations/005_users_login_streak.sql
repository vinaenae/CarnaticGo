-- Cached login streak on profile (recomputed when user_daily_engagement.login is recorded).

alter table public.users
  add column if not exists login_streak_current integer not null default 0,
  add column if not exists login_streak_best integer not null default 0,
  add column if not exists last_login_day date;

comment on column public.users.login_streak_current is
  'Consecutive calendar days with logged_in_at ending today or yesterday.';
comment on column public.users.login_streak_best is
  'Highest login_streak_current seen for this user.';
comment on column public.users.last_login_day is
  'Most recent calendar day (user-local, stored as date) with a login recorded.';
