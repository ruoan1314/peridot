-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.cycle_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cycle_length int not null default 28 check (cycle_length between 21 and 40),
  period_length int not null default 5 check (period_length between 1 and 14),
  period_reminder_days_before int not null default 2 check (period_reminder_days_before between 1 and 10),
  daily_log_reminder_hour int not null default 20 check (daily_log_reminder_hour between 0 and 23),
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  period_length int not null check (period_length between 1 and 14),
  flow text not null check (flow in ('Light', 'Medium', 'Heavy')),
  symptoms text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists cycles_user_id_start_date_idx on public.cycles(user_id, start_date desc);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  mood text not null default '',
  pain_level int check (pain_level is null or pain_level between 0 and 10),
  energy_level int check (energy_level is null or energy_level between 0 and 10),
  discharge text not null default '',
  medications text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists daily_logs_user_id_log_date_idx on public.daily_logs(user_id, log_date desc);

create table if not exists public.shared_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  title text,
  range_start date,
  range_end date,
  report_payload jsonb not null,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists shared_reports_user_id_created_at_idx on public.shared_reports(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_cycle_preferences on public.cycle_preferences;
create trigger set_updated_at_cycle_preferences
before update on public.cycle_preferences
for each row
execute procedure public.set_updated_at();

drop trigger if exists set_updated_at_daily_logs on public.daily_logs;
create trigger set_updated_at_daily_logs
before update on public.daily_logs
for each row
execute procedure public.set_updated_at();

alter table public.cycle_preferences enable row level security;
alter table public.cycles enable row level security;
alter table public.daily_logs enable row level security;
alter table public.shared_reports enable row level security;

drop policy if exists "cycle_preferences_select_own" on public.cycle_preferences;
create policy "cycle_preferences_select_own" on public.cycle_preferences
for select using (auth.uid() = user_id);

drop policy if exists "cycle_preferences_insert_own" on public.cycle_preferences;
create policy "cycle_preferences_insert_own" on public.cycle_preferences
for insert with check (auth.uid() = user_id);

drop policy if exists "cycle_preferences_update_own" on public.cycle_preferences;
create policy "cycle_preferences_update_own" on public.cycle_preferences
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cycles_select_own" on public.cycles;
create policy "cycles_select_own" on public.cycles
for select using (auth.uid() = user_id);

drop policy if exists "cycles_insert_own" on public.cycles;
create policy "cycles_insert_own" on public.cycles
for insert with check (auth.uid() = user_id);

drop policy if exists "cycles_update_own" on public.cycles;
create policy "cycles_update_own" on public.cycles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cycles_delete_own" on public.cycles;
create policy "cycles_delete_own" on public.cycles
for delete using (auth.uid() = user_id);

drop policy if exists "daily_logs_select_own" on public.daily_logs;
create policy "daily_logs_select_own" on public.daily_logs
for select using (auth.uid() = user_id);

drop policy if exists "daily_logs_insert_own" on public.daily_logs;
create policy "daily_logs_insert_own" on public.daily_logs
for insert with check (auth.uid() = user_id);

drop policy if exists "daily_logs_update_own" on public.daily_logs;
create policy "daily_logs_update_own" on public.daily_logs
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "daily_logs_delete_own" on public.daily_logs;
create policy "daily_logs_delete_own" on public.daily_logs
for delete using (auth.uid() = user_id);

drop policy if exists "shared_reports_select_own" on public.shared_reports;
create policy "shared_reports_select_own" on public.shared_reports
for select using (auth.uid() = user_id);

drop policy if exists "shared_reports_insert_own" on public.shared_reports;
create policy "shared_reports_insert_own" on public.shared_reports
for insert with check (auth.uid() = user_id);

drop policy if exists "shared_reports_update_own" on public.shared_reports;
create policy "shared_reports_update_own" on public.shared_reports
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "shared_reports_delete_own" on public.shared_reports;
create policy "shared_reports_delete_own" on public.shared_reports
for delete using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cycle_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();
