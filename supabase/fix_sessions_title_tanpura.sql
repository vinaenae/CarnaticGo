-- Run this in Supabase → SQL Editor if you see:
--   "column sessions.title does not exist"
-- (Your DB was created before title / tanpura_key were added.)

alter table public.sessions
  add column if not exists title text not null default 'Practice';

alter table public.sessions
  add column if not exists tanpura_key text;
