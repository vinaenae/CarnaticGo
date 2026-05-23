-- ragify.ai — initial schema
-- Run in Supabase SQL Editor (full file) or via `supabase db push`.
-- After this, apply `002_session_title.sql` if your project was created before title/tanpura_key existed,
-- or run `fix_sessions_title_tanpura.sql` once to repair an existing database.

-- App profile row (extends auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists first_name text;

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn text;
begin
  fn := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  insert into public.users (id, email, first_name)
  values (new.id, new.email, fn)
  on conflict (id) do update
    set email = excluded.email,
        first_name = coalesce(nullif(excluded.first_name, ''), public.users.first_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

-- Safe if you already had sessions from an older 001 without these columns:
alter table public.sessions
  add column if not exists title text not null default 'Practice';
alter table public.sessions
  add column if not exists tanpura_key text;

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

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.session_metrics enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

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
