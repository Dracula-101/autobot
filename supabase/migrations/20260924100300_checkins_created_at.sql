-- The sync engine stamps created_at on every row it uploads.
alter table public.day_checkins add column if not exists created_at timestamptz not null default now();
