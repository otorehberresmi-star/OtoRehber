-- Community memberships and per-community settings for OtoRehber.
-- Run this in Supabase SQL Editor.

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id text not null,
  show_on_profile boolean not null default true,
  use_vehicle_badge boolean not null default true,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists community_memberships_user_community_unique
on public.community_memberships(user_id, community_id);

create index if not exists community_memberships_user_created_idx
on public.community_memberships(user_id, created_at desc);

create or replace function public.touch_community_memberships_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_community_memberships_updated_at_trigger
on public.community_memberships;

create trigger touch_community_memberships_updated_at_trigger
before update on public.community_memberships
for each row execute function public.touch_community_memberships_updated_at();

alter table public.community_memberships enable row level security;

drop policy if exists "Users can read their own community memberships"
on public.community_memberships;
drop policy if exists "Users can insert their own community memberships"
on public.community_memberships;
drop policy if exists "Users can update their own community memberships"
on public.community_memberships;
drop policy if exists "Users can delete their own community memberships"
on public.community_memberships;

create policy "Users can read their own community memberships"
on public.community_memberships for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own community memberships"
on public.community_memberships for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own community memberships"
on public.community_memberships for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own community memberships"
on public.community_memberships for delete
to authenticated
using (auth.uid() = user_id);
