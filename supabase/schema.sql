-- Xainy Music / Streamsxainy — shared public cache table.
-- Run this once in Supabase Dashboard → SQL Editor.
--
-- Stores expensive lookup results (YouTube videoIds, durations, search
-- results) so every visitor benefits from one resolution instead of each
-- browser doing its own. Values are public catalog data — no secrets.

create table if not exists public.app_cache (
  key         text primary key,
  value       jsonb not null,
  expires_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);

-- Anyone can read/write cache entries (it's a shared public cache).
-- Writes are upserts of non-sensitive catalog data only.
alter table public.app_cache enable row level security;

create policy "app_cache_read_all"
  on public.app_cache for select
  to anon, authenticated
  using (true);

create policy "app_cache_write_all"
  on public.app_cache for insert
  to anon, authenticated
  with check (true);

create policy "app_cache_update_all"
  on public.app_cache for update
  to anon, authenticated
  using (true)
  with check (true);

-- Optional housekeeping: delete expired rows occasionally
-- (Supabase pg_cron can run: delete from public.app_cache where expires_at < now();)
