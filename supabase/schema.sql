-- Lock-in Check-in schema
-- Run in Supabase SQL Editor after creating the project.
-- Enable Email auth under Authentication → Providers.

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  reminder_email text not null default '',
  sport_day text not null default 'mon' check (sport_day in ('mon', 'sun')),
  timezone text not null default 'America/Denver',
  created_at timestamptz not null default now()
);

-- Daily check-ins (opened app / tapped Check in — separate from task completion)
create table if not exists public.day_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  checked_in_at timestamptz not null default now(),
  note text,
  unique (user_id, date)
);

create index if not exists day_checkins_user_date_idx on public.day_checkins (user_id, date);

-- Per-task completions
create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  task_id text not null,
  completed boolean not null default true,
  completed_at timestamptz,
  meta jsonb default '{}'::jsonb,
  unique (user_id, date, task_id)
);

create index if not exists task_completions_user_date_idx on public.task_completions (user_id, date);

-- Sunday scoreboard notes
create table if not exists public.weekly_notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  win text not null default '',
  fix text not null default '',
  focus text not null default '',
  primary key (user_id, week_start)
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, reminder_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.day_checkins enable row level security;
alter table public.task_completions enable row level security;
alter table public.weekly_notes enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- day_checkins
drop policy if exists "checkins_all_own" on public.day_checkins;
create policy "checkins_all_own" on public.day_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- task_completions
drop policy if exists "tasks_all_own" on public.task_completions;
create policy "tasks_all_own" on public.task_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- weekly_notes
drop policy if exists "notes_all_own" on public.weekly_notes;
create policy "notes_all_own" on public.weekly_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
