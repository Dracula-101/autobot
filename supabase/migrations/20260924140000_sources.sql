-- External sources: LinkedIn-clipped profiles (leads) and course assignments,
-- imported from Pratik's other Supabase projects by the autobot-import
-- function. Imports only write source fields; what he does in Autobot
-- (pipeline link, hiding a lead, marking an assignment done) is never
-- overwritten.

create table if not exists public.leads (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null default 'linkedin',
  source_id text not null,
  name text not null,
  url text not null default '',
  headline text not null default '',
  company text not null default '',
  company_raw text not null default '',
  role_kind text not null default 'other' check (role_kind in ('university', 'recruiter', 'manager', 'engineer', 'other')),
  location text not null default '',
  us boolean not null default true,
  mutuals integer not null default 0,
  mutual_names text not null default '',
  clipped_at timestamptz,
  contact_id uuid,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists leads_user_source_idx on public.leads (user_id, source, source_id);

create table if not exists public.assignments (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null default 'checker',
  source_id text not null,
  title text not null,
  course text not null default '',
  due_at timestamptz,
  url text not null default '',
  source_status text not null default '',
  checked_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists assignments_user_source_idx on public.assignments (user_id, source, source_id);
create index if not exists assignments_user_due_idx on public.assignments (user_id, due_at);

do $$
declare
  t text;
begin
  foreach t in array array['leads', 'assignments'] loop
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
end;
$$;

-- When each source last synced (shown in the app)
create table if not exists public.source_syncs (
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,
  last_run timestamptz,
  last_ok timestamptz,
  rows integer not null default 0,
  message text,
  primary key (user_id, source)
);
alter table public.source_syncs enable row level security;
drop policy if exists source_syncs_read_own on public.source_syncs;
create policy source_syncs_read_own on public.source_syncs for select to authenticated
  using ((select auth.uid()) = user_id);

-- Hourly refresh (the app also syncs on open; this keeps deadlines current for reminders).
select cron.schedule(
  'autobot-import',
  '7 * * * *',
  $cron$
  select net.http_post(
    url := 'https://jpallbmetcrnzwzsmgbp.supabase.co/functions/v1/autobot-import',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-autobot-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'autobot_cron_secret')
    ),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 55000
  );
  $cron$
);
