-- =============================================================================
-- CarnaticGo — FULL schema (paste entire file in Supabase → SQL Editor → Run)
-- Use this if you get: relation "public.users" does not exist
-- Safe to run more than once.
-- =============================================================================

-- ----- 1. Core tables -----
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  username text,
  login_streak_current integer not null default 0,
  login_streak_best integer not null default 0,
  last_login_day date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists first_name text;
alter table public.users add column if not exists username text;
alter table public.users add column if not exists login_streak_current integer not null default 0;
alter table public.users add column if not exists login_streak_best integer not null default 0;
alter table public.users add column if not exists last_login_day date;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null default 'Practice',
  shruti_frequency double precision not null,
  bpm integer not null,
  tanpura_key text,
  pitch_data jsonb not null default '[]'::jsonb,
  tempo_data jsonb not null default '[]'::jsonb,
  volume_data jsonb not null default '[]'::jsonb,
  scores jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.sessions add column if not exists title text not null default 'Practice';
alter table public.sessions add column if not exists tanpura_key text;

create index if not exists sessions_user_id_started_at_idx
  on public.sessions (user_id, started_at desc);

create table if not exists public.session_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  pitch_accuracy numeric,
  tempo_stability numeric,
  volume_consistency numeric,
  extra jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint session_metrics_session_unique unique (session_id)
);

create table if not exists public.user_daily_engagement (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  logged_in_at timestamptz,
  activity_completed_at timestamptz,
  primary key (user_id, day)
);

create index if not exists user_daily_engagement_user_day_desc_idx
  on public.user_daily_engagement (user_id, day desc);

-- ----- 2. Username + friends -----
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

-- ----- 3. Row level security -----
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.session_metrics enable row level security;
alter table public.user_daily_engagement enable row level security;
alter table public.user_friendships enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
  on public.users for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

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

-- Lets signed-in users find others by username when adding friends (id/username/first_name only in app).
drop policy if exists "Authenticated lookup users by username" on public.users;
create policy "Authenticated lookup users by username"
  on public.users for select
  to authenticated
  using (username is not null);

drop policy if exists "Sessions CRUD own" on public.sessions;
create policy "Sessions CRUD own"
  on public.sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Session metrics via own sessions" on public.session_metrics;
create policy "Session metrics via own sessions"
  on public.session_metrics for all
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_metrics.session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_metrics.session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users read own engagement" on public.user_daily_engagement;
create policy "Users read own engagement"
  on public.user_daily_engagement for select using (auth.uid() = user_id);

drop policy if exists "Users insert own engagement" on public.user_daily_engagement;
create policy "Users insert own engagement"
  on public.user_daily_engagement for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own engagement" on public.user_daily_engagement;
create policy "Users update own engagement"
  on public.user_daily_engagement for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

drop policy if exists "Friendships read own" on public.user_friendships;
create policy "Friendships read own"
  on public.user_friendships for select using (auth.uid() = user_id);

drop policy if exists "Friendships insert own" on public.user_friendships;
create policy "Friendships insert own"
  on public.user_friendships for insert with check (auth.uid() = user_id);

drop policy if exists "Friendships delete own" on public.user_friendships;
create policy "Friendships delete own"
  on public.user_friendships for delete using (auth.uid() = user_id);

-- ----- 4. Functions -----
create or replace function public.normalize_username(p_raw text)
returns text language sql immutable as $$
  select lower(trim(coalesce(p_raw, '')));
$$;

create or replace function public.is_username_available(p_username text)
returns boolean
language plpgsql security definer set search_path = public stable as $$
declare
  u text := public.normalize_username(p_username);
begin
  if u = '' or u !~ '^[a-z][a-z0-9_]{2,23}$' then return false; end if;
  return not exists (select 1 from public.users x where lower(x.username) = u);
end;
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql security definer set search_path = public stable as $$
declare
  v text := trim(coalesce(p_identifier, ''));
  em text;
begin
  if v = '' then return null; end if;
  if position('@' in v) > 0 then return lower(v); end if;
  select u.email into em from public.users u where lower(u.username) = lower(v) limit 1;
  return em;
end;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;

create or replace function public.lookup_user_by_username(p_username text)
returns table (id uuid, username text, first_name text)
language plpgsql security definer set search_path = public stable as $$
declare u text := public.normalize_username(p_username);
begin
  if u = '' or u !~ '^[a-z][a-z0-9_]{2,23}$' then return; end if;
  return query
  select usr.id, usr.username, usr.first_name
  from public.users usr where lower(usr.username) = u limit 1;
end;
$$;

grant execute on function public.lookup_user_by_username(text) to authenticated;

create or replace function public.get_friends_streak_leaderboard()
returns table (
  rank bigint, user_id uuid, username text, first_name text,
  login_streak_current integer, login_streak_best integer, is_self boolean
)
language sql security definer set search_path = public stable as $$
  with pool as (
    select
      u.id,
      u.username,
      u.first_name,
      coalesce(u.login_streak_current, 0) as login_streak_current,
      coalesce(u.login_streak_best, 0) as login_streak_best,
      true as is_self
    from public.users u
    where u.id = auth.uid()
    union all
    select
      u.id,
      u.username,
      u.first_name,
      coalesce(u.login_streak_current, 0),
      coalesce(u.login_streak_best, 0),
      false
    from public.user_friendships f
    join public.users u on u.id = f.friend_id
    where f.user_id = auth.uid()
  ),
  ranked as (
    select
      row_number() over (
        order by
          login_streak_current desc,
          login_streak_best desc,
          lower(coalesce(username, '')),
          id
      ) as rank,
      pool.*
    from pool
  )
  select
    ranked.rank,
    ranked.id,
    ranked.username,
    ranked.first_name,
    ranked.login_streak_current,
    ranked.login_streak_best,
    ranked.is_self
  from ranked
  order by ranked.rank;
$$;

grant execute on function public.get_friends_streak_leaderboard() to authenticated;

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

-- Backfill profiles for auth users created before this script
insert into public.users (id, email, first_name, username)
select
  a.id,
  a.email,
  nullif(trim(coalesce(a.raw_user_meta_data->>'first_name', '')), ''),
  nullif(
    public.normalize_username(coalesce(a.raw_user_meta_data->>'username', '')),
    ''
  )
from auth.users a
left join public.users u on u.id = a.id
where u.id is null;

notify pgrst, 'reload schema';
