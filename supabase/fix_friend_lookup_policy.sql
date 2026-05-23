-- Run this in Supabase SQL Editor if "Add friend" cannot find users by username.
-- Project must match NEXT_PUBLIC_SUPABASE_URL in .env.local.
-- Safe to run more than once.

drop policy if exists "Authenticated lookup users by username" on public.users;
create policy "Authenticated lookup users by username"
  on public.users for select
  to authenticated
  using (username is not null);

notify pgrst, 'reload schema';
