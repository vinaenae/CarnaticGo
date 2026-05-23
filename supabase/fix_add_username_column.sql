-- =============================================================================
-- MINIMAL FIX: "column users.username does not exist"
-- Run in Supabase SQL Editor on project mwsosmxyjtkmhdwxufvt (match .env.local URL).
-- Safe to run more than once.
-- =============================================================================

-- 1) Username column
alter table public.users add column if not exists username text;

alter table public.users add column if not exists login_streak_current integer not null default 0;
alter table public.users add column if not exists login_streak_best integer not null default 0;
alter table public.users add column if not exists last_login_day date;

create unique index if not exists users_username_lower_unique
  on public.users (lower(username))
  where username is not null;

alter table public.users drop constraint if exists users_username_format;
alter table public.users
  add constraint users_username_format check (
    username is null
    or (
      char_length(username) between 3 and 24
      and username ~ '^[a-z][a-z0-9_]{2,23}$'
    )
  );

-- 2) Friends table
create table if not exists public.user_friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  friend_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_friendships_no_self check (user_id <> friend_id),
  constraint user_friendships_unique unique (user_id, friend_id)
);

create index if not exists user_friendships_user_id_idx
  on public.user_friendships (user_id);

alter table public.user_friendships enable row level security;

drop policy if exists "Friendships read own" on public.user_friendships;
create policy "Friendships read own"
  on public.user_friendships for select using (auth.uid() = user_id);

drop policy if exists "Friendships insert own" on public.user_friendships;
create policy "Friendships insert own"
  on public.user_friendships for insert with check (auth.uid() = user_id);

drop policy if exists "Friendships delete own" on public.user_friendships;
create policy "Friendships delete own"
  on public.user_friendships for delete using (auth.uid() = user_id);

-- 3) Policies so add-friend + leaderboard work
drop policy if exists "Users read friends for leaderboard" on public.users;
create policy "Users read friends for leaderboard"
  on public.users for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.user_friendships f
      where f.user_id = auth.uid() and f.friend_id = users.id
    )
  );

drop policy if exists "Authenticated lookup users by username" on public.users;
create policy "Authenticated lookup users by username"
  on public.users for select
  to authenticated
  using (username is not null);

-- 4) Save username on sign-up
create or replace function public.normalize_username(p_raw text)
returns text language sql immutable as $$
  select lower(trim(coalesce(p_raw, '')));
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare fn text; un text;
begin
  fn := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  un := public.normalize_username(coalesce(new.raw_user_meta_data->>'username', ''));
  if un = '' then un := null;
  elsif un !~ '^[a-z][a-z0-9_]{2,23}$' then un := null;
  end if;
  insert into public.users (id, email, first_name, username)
  values (new.id, new.email, fn, un)
  on conflict (id) do update set
    email = excluded.email,
    first_name = coalesce(nullif(excluded.first_name, ''), public.users.first_name),
    username = coalesce(excluded.username, public.users.username);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) Backfill username from auth metadata for existing accounts
update public.users u
set username = nullif(
  public.normalize_username(coalesce(a.raw_user_meta_data->>'username', '')),
  ''
)
from auth.users a
where a.id = u.id
  and u.username is null
  and coalesce(trim(a.raw_user_meta_data->>'username'), '') <> '';

notify pgrst, 'reload schema';
