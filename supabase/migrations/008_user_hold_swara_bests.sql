-- Per-user best Sa hold (seconds) per shruti / tanpura key.

create table if not exists public.user_hold_swara_bests (
  user_id uuid not null references public.users (id) on delete cascade,
  tanpura_key text not null,
  best_seconds double precision not null check (best_seconds > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, tanpura_key)
);

create index if not exists user_hold_swara_bests_user_id_idx
  on public.user_hold_swara_bests (user_id);

alter table public.user_hold_swara_bests enable row level security;

drop policy if exists "Users read own hold swara bests" on public.user_hold_swara_bests;
create policy "Users read own hold swara bests"
  on public.user_hold_swara_bests for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own hold swara bests" on public.user_hold_swara_bests;
create policy "Users insert own hold swara bests"
  on public.user_hold_swara_bests for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own hold swara bests" on public.user_hold_swara_bests;
create policy "Users update own hold swara bests"
  on public.user_hold_swara_bests for update
  using (auth.uid() = user_id);

create or replace function public.upsert_hold_swara_best(
  p_tanpura_key text,
  p_seconds double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  trimmed_key text;
  prev double precision;
  stored double precision;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  trimmed_key := nullif(trim(p_tanpura_key), '');
  if trimmed_key is null or p_seconds is null or p_seconds <= 0 then
    raise exception 'invalid hold swara payload';
  end if;

  select b.best_seconds
  into prev
  from public.user_hold_swara_bests b
  where b.user_id = uid and b.tanpura_key = trimmed_key
  for update;

  if not found then
    insert into public.user_hold_swara_bests (user_id, tanpura_key, best_seconds)
    values (uid, trimmed_key, p_seconds)
    returning best_seconds into stored;
  elsif p_seconds > prev then
    update public.user_hold_swara_bests
    set best_seconds = p_seconds, updated_at = now()
    where user_id = uid and tanpura_key = trimmed_key
    returning best_seconds into stored;
  else
    stored := prev;
  end if;

  return jsonb_build_object('best_seconds', stored, 'improved', p_seconds > coalesce(prev, 0));
end;
$$;

grant execute on function public.upsert_hold_swara_best(text, double precision) to authenticated;
