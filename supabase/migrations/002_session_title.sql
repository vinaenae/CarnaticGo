-- Adds title + tanpura_key to sessions (safe to re-run).
-- If the dashboard errors before migrations ran, run this in Supabase SQL Editor
-- or use ../fix_sessions_title_tanpura.sql (same statements).

alter table public.sessions
  add column if not exists title text not null default 'Practice';

alter table public.sessions
  add column if not exists tanpura_key text;
