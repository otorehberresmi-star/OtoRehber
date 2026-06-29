-- Garage expense/service timeline persistence for OtoRehber.
-- Run this in Supabase SQL Editor.

create table if not exists public.timeline_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  garage_car_id uuid references public.garage_cars(id) on delete cascade,
  type text not null check (type in ('fuel', 'service')),
  title text not null,
  amount numeric,
  detail text,
  tag text,
  icon text,
  km text,
  entry_date timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.timeline_entries
add column if not exists garage_car_id uuid references public.garage_cars(id) on delete cascade,
add column if not exists title text,
add column if not exists amount numeric,
add column if not exists detail text,
add column if not exists tag text,
add column if not exists icon text,
add column if not exists km text,
add column if not exists date timestamptz default now(),
add column if not exists entry_date timestamptz default now(),
add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.timeline_entries
alter column date set default now();

create index if not exists timeline_entries_user_car_date_idx
on public.timeline_entries(user_id, garage_car_id, entry_date desc);

alter table public.timeline_entries enable row level security;

drop policy if exists "Kullanıcı sadece kendi timeline'ını görebilir" on public.timeline_entries;
drop policy if exists "Users can read their own timeline entries" on public.timeline_entries;
drop policy if exists "Users can insert their own timeline entries" on public.timeline_entries;
drop policy if exists "Users can update their own timeline entries" on public.timeline_entries;
drop policy if exists "Users can delete their own timeline entries" on public.timeline_entries;

create policy "Users can read their own timeline entries"
on public.timeline_entries for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own timeline entries"
on public.timeline_entries for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own timeline entries"
on public.timeline_entries for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own timeline entries"
on public.timeline_entries for delete
to authenticated
using (auth.uid() = user_id);
