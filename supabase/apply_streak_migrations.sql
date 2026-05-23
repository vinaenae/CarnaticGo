-- Login streak only — run in Supabase → SQL Editor.
-- Use this if you already have public.users, sessions, etc.
-- Safe to run more than once.

-- Daily login rows (one per user per calendar day)
create table if not exists public.user_daily_engagement (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  logged_in_at timestamptz,
  activity_completed_at timestamptz,
  primary key (user_id, day)
);

create index if not exists user_daily_engagement_user_day_desc_idx
  on public.user_daily_engagement (user_id, day desc);

alter table public.user_daily_engagement enable row level security;

drop policy if exists "Users read own engagement" on public.user_daily_engagement;
create policy "Users read own engagement"
  on public.user_daily_engagement for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own engagement" on public.user_daily_engagement;
create policy "Users insert own engagement"
  on public.user_daily_engagement for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own engagement" on public.user_daily_engagement;
create policy "Users update own engagement"
  on public.user_daily_engagement for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Cached streak on profile
alter table public.users
  add column if not exists login_streak_current integer not null default 0;

alter table public.users
  add column if not exists login_streak_best integer not null default 0;

alter table public.users
  add column if not exists last_login_day date;
