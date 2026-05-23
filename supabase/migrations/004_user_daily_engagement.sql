-- Daily login + activity tracking for dashboard streaks.
-- A streak day requires both logged_in_at and activity_completed_at on the same calendar day.

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
