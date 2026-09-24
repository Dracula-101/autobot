-- Autobot v2 — robot friend.
-- Synced tables (soft deletes + server updated_at), memory, chat history,
-- change log, push subscriptions and reminder bookkeeping.
-- Idempotent: safe to run more than once.

-- ─── helpers ────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── profiles: settings live in one jsonb blob ─────────────────────────────

alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists seeded_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ─── day_checkins: first open of a logical day = "woke up" ────────────────

alter table public.day_checkins add column if not exists updated_at timestamptz not null default now();
alter table public.day_checkins add column if not exists deleted_at timestamptz;

-- ─── synced tables ─────────────────────────────────────────────────────────

create table if not exists public.missions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  key text,
  title text not null check (char_length(title) between 1 and 300),
  area text not null default 'life' check (area in ('hunt', 'prep', 'body', 'class', 'life')),
  size text not null default 'M' check (size in ('S', 'M', 'L')),
  moment text not null default 'anytime'
    check (moment in ('wake', 'out', 'evening', 'night', 'bed', 'anytime')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'skipped')),
  target_key text check (target_key in ('referral', 'application', 'leetcode', 'workout')),
  amount integer not null default 1 check (amount between 0 and 50),
  note text,
  sort integer not null default 0,
  source text not null default 'user' check (source in ('plan', 'user', 'autobot')),
  started_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists missions_user_day_idx on public.missions (user_id, day);

create table if not exists public.routines (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  emoji text not null default '✨',
  stack text check (stack in ('morning', 'night')),
  anchor text not null default 'wake' check (anchor in ('wake', 'bed', 'time')),
  offset_min integer not null default 15 check (offset_min between 0 and 600),
  at_time text check (at_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  days text[] not null default array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  per_week integer check (per_week between 1 and 7),
  remind boolean not null default true,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.routine_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid not null,
  day date not null,
  done_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists routine_logs_user_day_idx on public.routine_logs (user_id, day);

-- Countable progress toward weekly targets (referrals sent, problems solved…)
create table if not exists public.logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('referral', 'application', 'leetcode', 'workout', 'scalp', 'other')),
  amount integer not null default 1 check (amount between -50 and 50),
  ref_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists logs_user_day_idx on public.logs (user_id, day);

-- What Autobot knows about you
create table if not exists public.memories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null default 'about'
    check (category in ('about', 'goal', 'job', 'prep', 'health', 'schedule', 'habit', 'preference')),
  content text not null check (char_length(content) between 1 and 2000),
  source text not null default 'user' check (source in ('user', 'autobot', 'seed', 'interview')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Referral pipeline
create table if not exists public.contacts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  company text not null default '',
  role text not null default '',
  channel text not null default 'email' check (channel in ('email', 'linkedin', 'other')),
  handle text not null default '',
  status text not null default 'to_contact'
    check (status in ('to_contact', 'messaged', 'replied', 'referred', 'closed')),
  job_id uuid,
  last_contact_at timestamptz,
  follow_up_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.jobs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text not null check (char_length(company) between 1 and 160),
  title text not null default '',
  url text not null default '',
  location text not null default '',
  status text not null default 'saved'
    check (status in ('saved', 'applied', 'oa', 'interview', 'offer', 'rejected', 'closed')),
  sponsors text not null default 'unknown' check (sponsors in ('yes', 'no', 'unknown')),
  applied_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- LeetCode log with spaced review
create table if not exists public.problems (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null,
  title text not null,
  difficulty text not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard')),
  pattern text not null default 'Other',
  result text not null default 'solved' check (result in ('solved', 'hints', 'stuck')),
  attempts integer not null default 1,
  interval_days integer not null default 1,
  next_review date,
  last_solved_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.reviews (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  win text not null default '',
  fix text not null default '',
  focus text not null default '',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Every chat turn, on every device
create table if not exists public.chat_messages (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '' check (char_length(content) <= 20000),
  actions jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);

-- "Look up any change": who changed what, when
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  actor text not null default 'you' check (actor in ('you', 'autobot', 'system')),
  kind text not null,
  summary text not null,
  ref_table text,
  ref_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists activity_user_created_idx on public.activity (user_id, created_at desc);

-- ─── RLS, updated_at triggers, sync indexes, realtime ─────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'missions', 'routines', 'routine_logs', 'logs', 'memories', 'contacts', 'jobs',
    'problems', 'reviews', 'chat_messages', 'activity', 'day_checkins'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_own', t
    );
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before insert or update on public.%I '
      'for each row execute function public.touch_updated_at()',
      t || '_touch', t
    );
    execute format('create index if not exists %I on public.%I (user_id, updated_at)', t || '_sync_idx', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;

-- ─── push ──────────────────────────────────────────────────────────────────

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  failures integer not null default 0
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Sent reminders: dedupe for the cron + history for the app
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dedupe_key text not null,
  title text not null,
  body text not null,
  url text,
  delivered integer not null default 0,
  sent_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
alter table public.notifications enable row level security;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);

-- ─── memory inbox: private starter knowledge, claimed on first sign-in ────
-- Rows are inserted out-of-band (never committed to the repo) and move into
-- `memories` for the account whose email matches.

create table if not exists public.memory_inbox (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  category text not null default 'about',
  content text not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
alter table public.memory_inbox enable row level security; -- no policies: definer functions only

create or replace function public.claim_memory_inbox()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  claimed_count integer := 0;
begin
  if uid is null or mail = '' then
    return 0;
  end if;
  with claimed as (
    update public.memory_inbox
       set claimed_at = now()
     where lower(email) = mail and claimed_at is null
    returning id, category, content
  )
  insert into public.memories (id, user_id, category, content, source)
  select id, uid, category, content, 'seed' from claimed
  on conflict (id) do nothing;
  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;
revoke all on function public.claim_memory_inbox() from public, anon;
grant execute on function public.claim_memory_inbox() to authenticated;

-- ─── server secrets in Vault (service role only) ──────────────────────────

create or replace function public.app_secret(secret_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;
revoke all on function public.app_secret(text) from public, anon, authenticated;
grant execute on function public.app_secret(text) to service_role;

create or replace function public.set_app_secret(secret_name text, secret_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  select id into existing from vault.secrets where name = secret_name;
  if existing is null then
    perform vault.create_secret(secret_value, secret_name);
  else
    perform vault.update_secret(existing, secret_value);
  end if;
end;
$$;
revoke all on function public.set_app_secret(text, text) from public, anon, authenticated;
grant execute on function public.set_app_secret(text, text) to service_role;

-- Shared secret between pg_cron and the notify function, generated in-database.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'autobot_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'autobot_cron_secret');
  end if;
end;
$$;
