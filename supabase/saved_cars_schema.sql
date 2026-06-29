-- Saved vehicle architecture for OtoRehber.
-- Run this once in Supabase SQL Editor.

alter table public.saved_cars
add column if not exists car_key text,
add column if not exists model_id uuid references public.models(id) on delete cascade,
add column if not exists car_name text,
add column if not exists trim text,
add column if not exists image text,
add column if not exists rating numeric,
add column if not exists recommend_percent integer,
add column if not exists save_intent text default 'interested';

alter table public.saved_cars
alter column review_id drop not null,
alter column save_intent set default 'interested';

update public.saved_cars
set save_intent = 'interested'
where save_intent is null;

alter table public.saved_cars
drop constraint if exists saved_cars_save_intent_check;

alter table public.saved_cars
add constraint saved_cars_save_intent_check
check (save_intent in ('interested', 'considering_purchase', 'compare_later'));

create unique index if not exists saved_cars_user_model_unique
on public.saved_cars(user_id, model_id)
where model_id is not null;

drop index if exists public.saved_cars_user_car_key_unique;

delete from public.saved_cars a
using public.saved_cars b
where a.user_id = b.user_id
  and a.car_key = b.car_key
  and a.car_key is not null
  and a.created_at < b.created_at;

create unique index if not exists saved_cars_user_car_key_unique
on public.saved_cars(user_id, car_key);

alter table public.saved_cars enable row level security;

drop policy if exists "Users can read their own saved cars" on public.saved_cars;
drop policy if exists "Users can insert their own saved cars" on public.saved_cars;
drop policy if exists "Users can update their own saved cars" on public.saved_cars;
drop policy if exists "Users can delete their own saved cars" on public.saved_cars;

create policy "Users can read their own saved cars"
on public.saved_cars for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own saved cars"
on public.saved_cars for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own saved cars"
on public.saved_cars for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own saved cars"
on public.saved_cars for delete
to authenticated
using (auth.uid() = user_id);
