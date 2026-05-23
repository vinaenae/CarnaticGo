-- Lets the leaderboard compute friends' CURRENT streaks from login days (not cached best).
-- Run in Supabase SQL Editor. Safe to run more than once.

drop policy if exists "Read friend engagement for leaderboard" on public.user_daily_engagement;
create policy "Read friend engagement for leaderboard"
  on public.user_daily_engagement for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_friendships f
      where f.user_id = auth.uid() and f.friend_id = user_daily_engagement.user_id
    )
  );

notify pgrst, 'reload schema';
